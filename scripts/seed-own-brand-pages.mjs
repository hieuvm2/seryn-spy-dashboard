/* ============================================================
   SERYN Spy — Seed tab `Own Brand Pages` với các page của SERYN.
   Chạy:  node scripts/seed-own-brand-pages.mjs [--write]
   Mặc định DRY-RUN. --write để ghi (upsert theo page_id, không xóa page khác).
   Nguồn: file Seryn.xlsx do người dùng cung cấp (page_id numeric).
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, writeTab } from "./lib/sheets.mjs";
import { TAB, HEADERS } from "./lib/schemas.mjs";

const WRITE = process.argv.includes("--write");
const now = new Date().toISOString().slice(0, 10);

const PAGES = [
  ["Phòng khám Seryn Việt Nam", "https://www.facebook.com/phongkhamserynvietnam/", "100558049051139", "Hà Nội", "trẻ hóa da|nâng cơ|clinic tổng", "Page chính"],
  ["Lại Minh Hiếu - Chuyên gia sắc đẹp Seryn Việt Nam", "https://www.facebook.com/profile.php?id=100092620323079", "102248398862424", "toàn quốc", "trẻ hóa da", ""],
  ["Lại Minh Hiếu - Seryn Clinic Việt Nam", "https://www.facebook.com/profile.php?id=100091434092299", "108910554850173", "toàn quốc", "trẻ hóa da", ""],
  ["Lại Minh Hiếu - Phòng khám Seryn", "https://www.facebook.com/profile.php?id=61551569680928", "191037889667981", "toàn quốc", "trẻ hóa da", ""],
  ["Chuyên gia sắc đẹp Lại Minh Hiếu - Seryn Clinic", "https://www.facebook.com/profile.php?id=61550115911294", "110304951354635", "toàn quốc", "trẻ hóa da", ""],
  ["Minh Hiếu - Phòng khám Seryn", "https://www.facebook.com/profile.php?id=100094971317327", "110055188068776", "toàn quốc", "trẻ hóa da", ""],
  ["Phòng khám đa khoa Seryn Việt Nam", "https://www.facebook.com/profile.php?id=100094474805993", "101136148947610", "toàn quốc", "clinic tổng", ""],
  ["Phòng khám đa khoa - Seryn Việt Nam", "https://www.facebook.com/profile.php?id=100094550904349", "102183905593576", "toàn quốc", "clinic tổng", ""],
  ["BS. CKI Vũ Trung Hiếu - Phòng khám Seryn", "https://www.facebook.com/bacsivutrunghieu.seryn/", "100973408964712", "toàn quốc", "trẻ hóa da", ""],
  ["Phòng khám Seryn Việt Nam - Chuyên gia trẻ hóa Minh Hiếu", "https://www.facebook.com/profile.php?id=100091539075712", "140368131524726", "toàn quốc", "trẻ hóa da", ""],
];

function toRow([page_name, page_url, page_id, market, service_focus, notes]) {
  return {
    brand_name: "SERYN", page_name, page_id, page_url,
    platform: "facebook", market, service_focus,
    is_active: "TRUE", crawl_enabled: "TRUE", notes,
    created_at: now, updated_at: now,
  };
}

async function main() {
  console.log(`\nSERYN — Seed Own Brand Pages (${WRITE ? "WRITE" : "DRY-RUN"})`);
  const { sheets, titles } = await getSheetsClient();
  const existing = await readTab(sheets, TAB.ownBrandPages);
  const byId = new Map(existing.map((r) => [String(r.page_id), r]));
  for (const p of PAGES) { const r = toRow(p); byId.set(String(r.page_id), { ...byId.get(String(r.page_id)), ...r }); }
  const rows = [...byId.values()];
  console.log(`  Page hiện có: ${existing.length} -> sau seed: ${rows.length}`);
  PAGES.forEach((p) => console.log(`   + ${p[2].padEnd(16)} ${p[0]}`));
  if (!WRITE) { console.log("\n[DRY-RUN] Chưa ghi. Thêm --write để ghi vào tab Own Brand Pages."); return; }
  await writeTab(sheets, titles, TAB.ownBrandPages, HEADERS.ownBrandPages, rows);
  console.log(`\n[DONE] Đã ghi ${rows.length} page SERYN vào tab '${TAB.ownBrandPages}'.`);
}
main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
