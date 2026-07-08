/* ============================================================
   SERYN Spy — Sync SERYN Pages từ sheet vận hành (Meta_Ads_Master_Database).
   ------------------------------------------------------------
   Đọc tab "Seryn Page" trong sheet vận hành của team ads -> lọc page
   theo Địa lý (mặc định "Nội địa") + Tình Trạng (mặc định "Đang chạy")
   -> lấy Tên page + Link page (làm sạch) + ID Page -> upsert vào tab
   "Own Brand Pages" của sheet pipeline (nguồn crawl ads SERYN hàng tuần)
   -> đẩy dataset ownBrandPages lên Supabase cho dashboard.

   Chạy:  node scripts/sync-seryn-pages.mjs            (DRY-RUN — chỉ xem)
          node scripts/sync-seryn-pages.mjs --write    (ghi thật)
          node scripts/sync-seryn-pages.mjs --write --soft  (lỗi -> warn, exit 0)

   .env:
     SERYN_PAGES_SHEET_ID   = <id sheet vận hành>  (bắt buộc để bật sync)
     SERYN_PAGES_TAB        = Seryn Page           (mặc định)
     SERYN_PAGES_GEO        = Nội địa              (mặc định)
     SERYN_PAGES_STATUS     = Đang chạy            (mặc định)
     + GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_FILE|JSON (sheet pipeline đích)
     + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (tùy chọn — đẩy dashboard)

   Quy tắc an toàn:
   - Upsert theo page_id, KHÔNG xóa row khác trong Own Brand Pages.
   - Row do sync này quản lý được đánh dấu notes chứa [auto:seryn-pages];
     page rơi khỏi bộ lọc (dừng chạy / đổi địa lý) -> is_active=FALSE,
     crawl_enabled=FALSE (không xóa). Row thêm tay không bị đụng tới.
   - Page thiếu ID Page numeric và không rút được từ URL -> skip + cảnh báo.
   ============================================================ */
import "dotenv/config";
import { google } from "googleapis";
import { buildAuth, getSheetsClient, readTab, writeTab, withRetry } from "./lib/sheets.mjs";
import { pushDatasets, supabaseConfigured } from "./lib/supabase.mjs";

const AUTO_MARK = "[auto:seryn-pages]";
const DEST_TAB = "Own Brand Pages";
const DEST_HEADERS = [
  "brand_name", "page_name", "page_id", "page_url", "platform", "market",
  "service_focus", "is_active", "crawl_enabled", "notes", "created_at", "updated_at",
];

const str = (v) => (v === undefined || v === null ? "" : String(v));
/** Chuẩn hóa so khớp tiếng Việt: bỏ dấu, đ->d, thường hóa, gọn khoảng trắng. */
const norm = (s) => str(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();

/** Làm sạch link Facebook: bỏ #, bỏ notif_id/ref…, giữ ?id= của profile.php. */
export function cleanPageUrl(raw) {
  let u = str(raw).trim().replace(/#+$/, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  try {
    const url = new URL(u);
    url.hash = "";
    if (/(^|\.)facebook\.com$/i.test(url.hostname)) {
      url.hostname = "www.facebook.com";
      const id = url.searchParams.get("id");
      url.search = "";
      if (/profile\.php$/i.test(url.pathname) && id) url.searchParams.set("id", id);
    }
    return url.toString().replace(/\/$/, "").replace(/\/\?/, "?");
  } catch { return u; }
}

/** Rút page_id numeric từ URL (profile.php?id=... hoặc /123456789). */
function pageIdFromUrl(url) {
  const m = str(url).match(/(?:profile\.php\?id=|\/)(\d{6,})(?:$|[/?&])/);
  return m ? m[1] : "";
}

/** Đọc tab nguồn (header có thể không nằm ở dòng 1 — dò dòng chứa "Tên page"). */
async function readSourceRows() {
  const srcId = (process.env.SERYN_PAGES_SHEET_ID || "").trim();
  if (!srcId) throw new Error("Thiếu SERYN_PAGES_SHEET_ID trong .env — chưa cấu hình sheet nguồn Seryn Page.");
  const tabName = (process.env.SERYN_PAGES_TAB || "Seryn Page").trim();
  const auth = buildAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await withRetry(
    () => sheets.spreadsheets.values.get({ spreadsheetId: srcId, range: `'${tabName}'!A1:Z1000` }),
    { label: `đọc tab nguồn ${tabName}` },
  );
  const values = res.data.values || [];
  const headerIdx = values.findIndex((row) => row.some((c) => norm(c) === "ten page") && row.some((c) => norm(c) === "link page"));
  if (headerIdx < 0) throw new Error(`Tab "${tabName}" không có dòng header chứa "Tên page" + "Link page".`);
  const headers = values[headerIdx].map((h) => str(h).trim());
  return values.slice(headerIdx + 1)
    .filter((row) => row.some((c) => str(c).trim() !== ""))
    .map((row) => {
      const o = {};
      headers.forEach((h, i) => { if (h) o[h] = row[i] != null ? String(row[i]).trim() : ""; });
      return o;
    });
}

/** Lọc + map row nguồn -> row Own Brand Pages. Trả {rows, skipped}. */
function buildRows(sourceRows) {
  const geoFilter = norm(process.env.SERYN_PAGES_GEO || "Nội địa");
  const statusFilter = norm(process.env.SERYN_PAGES_STATUS || "Đang chạy");
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map();
  const skipped = [];
  for (const r of sourceRows) {
    const name = str(r["Tên page"]).trim();
    if (!name) continue;
    if (norm(r["Địa lý"]) !== geoFilter) continue;
    if (norm(r["Tình Trạng"] ?? r["Tình trạng"]) !== statusFilter) continue;
    const url = cleanPageUrl(r["Link page"]);
    let pid = str(r["ID Page"]).replace(/\D/g, "");
    if (!/^\d{6,}$/.test(pid)) pid = pageIdFromUrl(url);
    if (!/^\d{6,}$/.test(pid)) { skipped.push(`${name} — thiếu ID Page numeric (URL: ${url || "trống"})`); continue; }
    if (byId.has(pid)) { skipped.push(`${name} — trùng page_id ${pid} với "${byId.get(pid).page_name}" (giữ dòng đầu)`); continue; }
    byId.set(pid, {
      brand_name: "SERYN",
      page_name: name,
      page_id: pid,
      page_url: url,
      platform: "facebook",
      market: str(r["Địa lý"]).trim() || "Nội địa",
      service_focus: str(r["Loại Page"]).trim(),
      is_active: "TRUE",
      crawl_enabled: "TRUE",
      notes: `${AUTO_MARK} Mã page: ${str(r["Mã page"]).trim() || "?"} · nguồn: Seryn Page`,
      created_at: today,
      updated_at: today,
    });
  }
  return { rows: [...byId.values()], skipped };
}

/**
 * Đồng bộ chính. Trả về summary {matched, deactivated, total, pushedSupabase}.
 * @param {{write?: boolean}} opts
 */
export async function syncSerynPages({ write = false } = {}) {
  console.log(`\nSERYN — Sync Seryn Pages -> Own Brand Pages (${write ? "WRITE" : "DRY-RUN"})`);
  const sourceRows = await readSourceRows();
  const { rows, skipped } = buildRows(sourceRows);
  console.log(`  Nguồn: ${sourceRows.length} dòng -> khớp bộ lọc (${process.env.SERYN_PAGES_GEO || "Nội địa"} + ${process.env.SERYN_PAGES_STATUS || "Đang chạy"}): ${rows.length} page`);
  rows.forEach((p) => console.log(`   + ${p.page_id.padEnd(16)} ${p.page_name}  (${p.service_focus || "?"})`));
  skipped.forEach((s) => console.log(`   ! skip: ${s}`));

  // Merge với tab đích: upsert theo page_id; auto-row rơi khỏi bộ lọc -> deactive.
  const { sheets, titles } = await getSheetsClient();
  const existing = await readTab(sheets, DEST_TAB);
  const today = new Date().toISOString().slice(0, 10);
  const newIds = new Set(rows.map((r) => r.page_id));
  const byId = new Map(existing.map((r) => [str(r.page_id), r]));
  let deactivated = 0;
  for (const [pid, old] of byId) {
    const isAuto = str(old.notes).includes(AUTO_MARK);
    if (isAuto && !newIds.has(pid) && norm(old.is_active) !== "false") {
      byId.set(pid, { ...old, is_active: "FALSE", crawl_enabled: "FALSE", updated_at: today });
      deactivated++;
      console.log(`   - deactive: ${pid} ${old.page_name} (rơi khỏi bộ lọc)`);
    }
  }
  for (const r of rows) {
    const old = byId.get(r.page_id);
    // Giữ created_at cũ nếu có; còn lại lấy dữ liệu mới từ sheet nguồn.
    byId.set(r.page_id, { ...old, ...r, created_at: str(old?.created_at) || r.created_at });
  }
  const finalRows = [...byId.values()];
  console.log(`  Own Brand Pages: ${existing.length} -> ${finalRows.length} dòng (deactive ${deactivated}).`);

  if (!write) {
    console.log("\n[DRY-RUN] Chưa ghi gì. Thêm --write để ghi Sheet + Supabase.");
    return { matched: rows.length, deactivated, total: finalRows.length, pushedSupabase: false };
  }

  await writeTab(sheets, titles, DEST_TAB, DEST_HEADERS, finalRows);

  let pushedSupabase = false;
  if (supabaseConfigured()) {
    const { ok, fail, errors } = await pushDatasets({ ownBrandPages: finalRows });
    pushedSupabase = ok > 0 && fail === 0;
    console.log(`  [supabase] ownBrandPages: ${pushedSupabase ? "đã đẩy" : `lỗi (${errors.join("; ")})`}`);
  } else {
    console.log("  [supabase] bỏ qua (chưa cấu hình SUPABASE_URL / SERVICE_ROLE_KEY).");
  }
  console.log(`\n[DONE] ${rows.length} page SERYN Nội địa đang chạy -> '${DEST_TAB}'.`);
  return { matched: rows.length, deactivated, total: finalRows.length, pushedSupabase };
}

/* CLI */
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  const write = process.argv.includes("--write");
  const soft = process.argv.includes("--soft");
  syncSerynPages({ write }).catch((e) => {
    console.error(`\n[${soft ? "!" : "X"}] Sync Seryn Pages lỗi: ${e?.message || e}`);
    process.exit(soft ? 0 : 1);
  });
}
