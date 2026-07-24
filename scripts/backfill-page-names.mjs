/* ============================================================
   SERYN Spy — Backfill tên page (một lần).
   ------------------------------------------------------------
   Điền TÊN cho các page_id đang chỉ hiện số ID trên dashboard:
   1) Gom tên đã biết (ownBrandPages + adLevelAnalysis + pageDirectory hiện có).
   2) Với page_id trong brandWeeklySnapshot chưa có tên -> gọi ScrapeCreators
      company/ads?pageId= lấy page_name THẬT (chỉ trang đầu, 1 call/page).
   3) Merge tích lũy -> đẩy dataset 'pageDirectory' lên Supabase.

   CHỈ tên do API trả về (KHÔNG bịa). Mặc định DRY-RUN; thêm --apply để đẩy.
   Cờ: --apply | --limit=N (giới hạn số page gọi API) | --test (=--limit=2, dry).
   ============================================================ */
import "dotenv/config";
import { fetchDataset, pushDatasets, supabaseConfigured } from "./lib/supabase.mjs";
import { mergeDirectory } from "./lib/pageDirectory.mjs";

const SC_ADS_URL = "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads";
const COUNTRY = (process.env.ADS_SOURCE_COUNTRY || "VN").trim().toUpperCase();
const KEYS = (process.env.ADS_SOURCE_API_KEY || "").split(",").map((s) => s.trim()).filter(Boolean);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TEST = args.includes("--test");
const LIMIT = (() => {
  if (TEST) return 2;
  const a = args.find((x) => x.startsWith("--limit="));
  return a ? Math.max(0, parseInt(a.split("=")[1], 10) || 0) : Infinity;
})();

const clean = (s) => String(s ?? "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tên page THẬT theo page_id qua ScrapeCreators (1 call, chỉ trang đầu). "" nếu không có. */
async function pageNameById(pageId) {
  if (!KEYS.length) throw new Error("Thiếu ADS_SOURCE_API_KEY.");
  const u = new URL(SC_ADS_URL);
  u.searchParams.set("pageId", pageId);
  if (COUNTRY) u.searchParams.set("country", COUNTRY);
  let lastErr = "";
  for (const key of KEYS) {
    try {
      const res = await fetch(u.toString(), { headers: { "x-api-key": key } });
      if (res.status === 402 || res.status === 429) { lastErr = `HTTP ${res.status}`; continue; }
      if (!res.ok) return { name: "", err: `HTTP ${res.status}` };
      const json = await res.json();
      if (json.success === false) {
        if (/credit/i.test(json.message || "")) { lastErr = json.message; continue; }
        return { name: "", err: json.message || "sc_error" };
      }
      const ads = json.results || json.ads || [];
      for (const a of ads) { const nm = clean(a.page_name); if (nm) return { name: nm, err: "" }; }
      return { name: "", err: ads.length ? "no_page_name" : "no_ads" };
    } catch (e) { lastErr = e?.message || String(e); }
  }
  return { name: "", err: lastErr || "all_keys_failed" };
}

async function main() {
  if (!supabaseConfigured()) throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  const [snap, ad, own, dir] = await Promise.all([
    fetchDataset("brandWeeklySnapshot"),
    fetchDataset("adLevelAnalysis"),
    fetchDataset("ownBrandPages"),
    fetchDataset("pageDirectory"),
  ]);

  // Tên đã biết (không cần gọi API): ownBrandPages + adLevelAnalysis + directory hiện có.
  const known = new Map();
  const seed = []; // rows để merge (giữ mọi tên đã biết trong directory cho tự đủ)
  const putKnown = (id, nm, brand) => {
    const i = clean(id), n = clean(nm);
    if (i && n && !known.has(i)) { known.set(i, n); seed.push({ page_id: i, page_name: n, brand_name: clean(brand) }); }
  };
  for (const p of own) putKnown(p.page_id, p.page_name, p.brand_name);
  for (const a of ad) putKnown(a.page_id, a.page_name, a.brand_name);
  for (const e of dir) putKnown(e.page_id, e.page_name, e.brand_name);

  // Mọi page_id hiển thị (snapshot) + brand tương ứng.
  const brandOf = new Map();
  const allIds = new Set();
  for (const s of snap) {
    const brand = clean(s.brand_name || s.brand);
    for (const id of String(s.page_ids || "").split(/[|,]/).map(clean).filter(Boolean)) {
      allIds.add(id);
      if (!brandOf.has(id)) brandOf.set(id, brand);
    }
  }
  const missing = [...allIds].filter((id) => !known.has(id));
  console.log(`Tổng page_id hiển thị: ${allIds.size} | đã có tên: ${allIds.size - missing.length} | THIẾU: ${missing.length}`);
  console.log(`Chế độ: ${APPLY ? "APPLY (sẽ đẩy)" : "DRY-RUN"} | giới hạn gọi API: ${LIMIT === Infinity ? "không" : LIMIT}\n`);

  const toResolve = missing.slice(0, LIMIT === Infinity ? missing.length : LIMIT);
  const resolved = [];
  let okN = 0;
  const errs = {};
  for (let i = 0; i < toResolve.length; i++) {
    const id = toResolve[i];
    const { name, err } = await pageNameById(id);
    if (name) { resolved.push({ page_id: id, page_name: name, brand_name: brandOf.get(id) || "" }); okN++; console.log(`  ✓ ${id} -> ${name}`); }
    else { errs[err] = (errs[err] || 0) + 1; console.log(`  · ${id} -> (không có tên: ${err})`); }
    await sleep(250); // nhẹ tay với API
  }
  console.log(`\nGọi API ${toResolve.length} page | ra tên: ${okN} | không ra: ${toResolve.length - okN}`);
  if (Object.keys(errs).length) console.log("Lý do không ra:", JSON.stringify(errs));

  const merged = mergeDirectory(dir, [...seed, ...resolved]);
  console.log(`\npageDirectory: hiện ${dir.length} -> sau merge ${merged.length} (thêm ${merged.length - dir.length}).`);

  if (APPLY) {
    const res = await pushDatasets({ pageDirectory: merged });
    console.log(res.fail ? `[X] Đẩy lỗi: ${res.errors.join(" | ")}` : `[✓] ĐÃ ĐẨY pageDirectory (${merged.length} page).`);
  } else {
    console.log("(DRY-RUN — chưa đẩy. Thêm --apply để lưu lên Supabase.)");
  }
}

main().catch((e) => { console.error("[X] " + (e?.stack || e?.message || e)); process.exit(1); });
