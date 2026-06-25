/* ============================================================
   SERYN Spy — Sync Google Sheet -> Supabase (cho dashboard đọc).
   Chạy:  npm run supabase:sync   (hoặc tự gọi cuối weekly-spy-sync)
   ------------------------------------------------------------
   Đọc các TAB mà dashboard cần từ Google Sheet -> đẩy lên Supabase
   (bảng spy_data, mỗi dataset 1 hàng jsonb). Sheet = dữ liệu thô/work;
   Supabase = nguồn dashboard đọc.

   Cần .env: GOOGLE_SHEET_ID + service account (đọc Sheet) +
            SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ghi Supabase).
   ============================================================ */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import { getSheetsClient, readTab } from "./lib/sheets.mjs";
import { pushDatasets, supabaseConfigured } from "./lib/supabase.mjs";

/** dataset_key (dashboard) -> tên tab Sheet. Khớp SHEET_MAP của Apps Script. */
const DATASET_TABS = {
  brandWeeklySnapshot: "Brand Weekly Snapshot",
  adLevelAnalysis: "Ad Level Analysis",
  scaledContentAnalysis: "Scaled Content Analysis",
  weeklyStrategyChange: "Weekly Strategy Change",
  serynContentRecommendations: "SERYN Content Recommendations",
  visualAnalysis: "Visual Analysis",
  brandVisualSummary: "Brand Visual Summary",
  visualPatternAnalysis: "Visual Pattern Analysis",
  weeklyChangeInsights: "Weekly Change Insights",
  crawlRuns: "Crawl Runs",
  marketIntelligence: "Market Intelligence",
  competitorDiscovery: "Competitor Discovery",
  hookIntelligence: "Hook Intelligence",
  weeklySummary: "Weekly_Summary",
  actionPlan: "Action_Plan",
  swipeSuggestions: "Swipe_File_Suggestions",
  weeklyReports: "Weekly Reports",
  monthlyReports: "Monthly Reports",
};

/** Đọc Sheet -> đẩy lên Supabase. Trả {ok, fail, datasets, errors}. KHÔNG process.exit. */
export async function syncSheetToSupabase() {
  if (!supabaseConfigured()) {
    console.log("[SKIP] Chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — bỏ qua đẩy Supabase.");
    return { ok: 0, fail: 0, datasets: 0, errors: [] };
  }
  const { sheets } = await getSheetsClient();
  const datasets = {};
  let weekDate = "";
  for (const [key, tab] of Object.entries(DATASET_TABS)) {
    try {
      const rows = await readTab(sheets, tab);
      datasets[key] = rows;
      if (!weekDate && rows[0]?.week_date) weekDate = String(rows[0].week_date);
    } catch {
      datasets[key] = []; // tab chưa tồn tại -> rỗng (không crash)
    }
  }
  const res = await pushDatasets(datasets, weekDate);
  const counts = Object.entries(datasets).map(([k, r]) => `${k}:${r.length}`).join(" · ");
  console.log(`  [Supabase] đẩy ${res.ok}/${res.ok + res.fail} dataset (week ${weekDate || "?"}).`);
  if (res.errors.length) console.warn("  [Supabase] lỗi:", res.errors.slice(0, 3).join(" | "));
  console.log("  [Supabase] rows:", counts);
  return { ...res, datasets: Object.keys(datasets).length };
}

// Chỉ tự chạy khi gọi trực tiếp (node sync-sheet-to-supabase.mjs).
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);
if (isDirectRun) {
  console.log("\nSERYN — Sync Google Sheet -> Supabase\n");
  syncSheetToSupabase().catch((e) => { console.error("[X] " + (e?.stack || e?.message || e)); process.exit(1); });
}
