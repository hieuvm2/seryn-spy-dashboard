/* ============================================================
   SERYN Spy — Thêm đối thủ thủ công vào tab `Competitors`
   ------------------------------------------------------------
   Input: JSON [{ brand, url }]  (mặc định scripts/_new-competitors.json)
   - Resolve page_id: lấy trực tiếp từ URL (profile.php?id= / /pages/.../<digits>),
     nếu không có thì ScrapeCreators search-by-name (pageIdResolver). KHÔNG bịa id.
   - Dedupe theo tên brand (chuẩn hóa) + page_id so với watchlist hiện có.
   - Resolve được -> active=TRUE; không resolve được -> active=FALSE (review tay).
   - Mặc định DRY-RUN (chỉ in bảng). Thêm cờ --write để ghi vào Sheet.

   Chạy:  node scripts/add-competitors.mjs [path.json] [--write]
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSheetsClient, readTab, upsertTab } from "./lib/sheets.mjs";
import { resolvePageIds, pageIdResolverAvailable } from "./lib/pageIdResolver.mjs";
import { normalizeBrandName, isNumericPageId, competitorIdForBrand } from "./lib/competitorDiscoveryUtils.mjs";
import { HEADERS as SHEET_HEADERS } from "./lib/schemas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes("--write");
const jsonArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const JSON_PATH = jsonArg || path.join(__dirname, "_new-competitors.json");
// Header ĐẦY ĐỦ của tab Competitors (schemas.mjs). Trước đây dùng 5 cột đầu ->
// upsertTab clear + ghi lại làm MẤT cột id/category/status của mọi dòng (dashboard
// không xóa/sửa online được vì Apps Script match theo cột id).
const HEADERS = SHEET_HEADERS.competitors;
const NOTE = "manual import (Excel THĂM DÒ THỊ TRƯỜNG)";

/** page_id trực tiếp từ URL — CHỈ /pages/.../<digits> (là page_id thật).
 *  KHÔNG lấy số trong profile.php?id=<digits>: đó là PROFILE/people id, KHÔNG phải
 *  Ad Library advertiser page_id -> fetch ad trả 0. Các URL profile.php sẽ rơi xuống
 *  resolvePageIds (search-by-name) để lấy đúng page_id quảng cáo. */
function pageIdFromUrl(url) {
  const u = String(url || "");
  const m = u.match(/\/pages\/[^/]+\/(\d{6,})/);
  if (m) return m[1];
  return "";
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) throw new Error(`Không thấy file input: ${JSON_PATH}`);
  const input = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  console.log(`\nSERYN — Thêm đối thủ vào Competitors (${WRITE ? "WRITE" : "DRY-RUN"})`);
  console.log(`Input : ${JSON_PATH} (${input.length} brand)\n`);

  const { sheets, titles } = await getSheetsClient();
  const existing = await readTab(sheets, "Competitors");
  console.log(`Watchlist hiện có: ${existing.length} brand.`);
  const existNames = new Set(existing.map((r) => normalizeBrandName(r.brand_name)));
  const existPageIds = new Set(
    existing.flatMap((r) => String(r.page_ids || "").split("|").map((s) => s.trim()).filter(Boolean)),
  );
  const takenIds = new Set(existing.map((r) => String(r.id || "").trim()).filter(Boolean));
  const uniqueId = (brand) => {
    let id = competitorIdForBrand(brand);
    let n = 2;
    while (takenIds.has(id)) id = `${competitorIdForBrand(brand)}-${n++}`;
    takenIds.add(id);
    return id;
  };

  const canResolve = pageIdResolverAvailable();
  if (!canResolve) console.log("[!] Thiếu ADS_SOURCE_API_KEY — chỉ resolve được URL có sẵn id.\n");

  const newRows = [];
  const report = [];
  for (const item of input) {
    const brand = String(item.brand || "").trim();
    const url = String(item.url || "").trim();
    if (!brand) continue;
    const norm = normalizeBrandName(brand);

    if (existNames.has(norm)) { report.push({ brand, status: "đã có trong watchlist", pageIds: "" }); continue; }

    let pageIds = [];
    let how = "";
    const direct = pageIdFromUrl(url);
    if (direct && isNumericPageId(direct)) { pageIds = [direct]; how = "từ URL"; }
    else if (canResolve) {
      try {
        const r = await resolvePageIds(brand, { geo: "Vietnam" });
        pageIds = (r.pageIds || []).filter(isNumericPageId);
        how = pageIds.length ? `search (score ${r.best?.score?.toFixed?.(2) ?? "?"})` : "search: no match";
      } catch (e) { how = `search lỗi: ${e?.message || e}`; }
    }

    const dupIds = pageIds.filter((id) => existPageIds.has(id));
    const freshIds = pageIds.filter((id) => !existPageIds.has(id));
    if (pageIds.length && !freshIds.length) {
      report.push({ brand, status: `trùng page_id đã có (${dupIds.join("|")})`, pageIds: pageIds.join("|") });
      continue;
    }

    const resolved = freshIds.length > 0;
    newRows.push({
      brand_name: brand,
      page_ids: freshIds.join("|"),
      page_urls: url,
      active: resolved ? "TRUE" : "FALSE",
      notes: resolved ? `${NOTE} · ${how}` : `${NOTE} · CHƯA resolve page_id (${how}) — review tay`,
      id: uniqueId(brand),
    });
    freshIds.forEach((id) => existPageIds.add(id));
    existNames.add(norm);
    report.push({ brand, status: resolved ? `✓ ${how}` : `⚠ chưa resolve (${how})`, pageIds: freshIds.join("|") });
  }

  // In bảng kết quả
  console.log("Kết quả resolve:");
  for (const r of report) {
    console.log(`  ${r.status.startsWith("✓") ? "✓" : r.status.startsWith("⚠") ? "⚠" : "·"}  ${r.brand.slice(0, 42).padEnd(42)} ${r.pageIds.padEnd(20)} ${r.status}`);
  }
  const willAdd = newRows.filter((r) => r.active === "TRUE");
  const willPark = newRows.filter((r) => r.active === "FALSE");
  console.log(`\nTổng: +${newRows.length} dòng mới (active=TRUE: ${willAdd.length}, active=FALSE chờ resolve: ${willPark.length}); bỏ qua trùng: ${report.length - newRows.length}.`);

  if (!WRITE) { console.log("\n[DRY-RUN] Chưa ghi. Chạy lại với --write để ghi vào tab Competitors."); return; }
  if (!newRows.length) { console.log("\nKhông có dòng mới để ghi."); return; }

  await upsertTab(sheets, titles, "Competitors", HEADERS, newRows, (r) => normalizeBrandName(r.brand_name));
  console.log(`\n[DONE] Đã ghi ${newRows.length} đối thủ mới vào tab Competitors.`);
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
