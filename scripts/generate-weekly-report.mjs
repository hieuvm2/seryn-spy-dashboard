/* ============================================================
   SERYN Spy — Weekly historical report generator (CLI)
   ------------------------------------------------------------
   Tạo báo cáo TUẦN TRƯỚC (thứ Hai → Chủ Nhật) từ dữ liệu pipeline đã ghi,
   LƯU vào tab `Weekly Reports` theo kỳ — KHÔNG ghi đè kỳ cũ.

   Chạy:
     node scripts/generate-weekly-report.mjs --last-week
     node scripts/generate-weekly-report.mjs --period-start=2026-06-15 --period-end=2026-06-21
     node scripts/generate-weekly-report.mjs --last-week --force-new

   ENV: GOOGLE_SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON|FILE (như spy:weekly).
   KHÔNG crawl ads (chỉ đọc dữ liệu đã có). KHÔNG bịa spend/CPA/ROAS.
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab } from "./lib/sheets.mjs";
import { TAB } from "./lib/schemas.mjs"; // tên tab `Weekly Reports`
import { buildWeeklyReport } from "./lib/reportGen.mjs";
import { hasSheetCreds, upsertReport, writeReportMarkdown, pushReportToSupabase } from "./lib/reportStore.mjs";
import {
  DEFAULT_TZ, getLastWeekRange, getWeekRangeContaining, getReportId,
} from "./lib/reportDateUtils.mjs";

function parseArgs(argv) {
  const o = { forceNew: false, tz: DEFAULT_TZ };
  for (const a of argv) {
    if (a === "--last-week") o.lastWeek = true;
    else if (a === "--force-new") o.forceNew = true;
    else if (a.startsWith("--period-start=")) o.periodStart = a.split("=")[1];
    else if (a.startsWith("--period-end=")) o.periodEnd = a.split("=")[1];
    else if (a.startsWith("--tz=")) o.tz = a.split("=")[1] || DEFAULT_TZ;
  }
  return o;
}

function resolvePeriod(opts) {
  if (opts.periodStart && opts.periodEnd) {
    return { period_start: String(opts.periodStart).slice(0, 10), period_end: String(opts.periodEnd).slice(0, 10) };
  }
  if (opts.periodStart) return getWeekRangeContaining(opts.periodStart, opts.tz);
  // mặc định (và --last-week): tuần trước.
  return getLastWeekRange(opts.tz);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const period = resolvePeriod(opts);
  console.log(`\nSERYN Weekly Report — kỳ ${period.period_start} → ${period.period_end} (TZ ${opts.tz})`);

  if (!hasSheetCreds()) {
    console.log("[SKIP] Thiếu GOOGLE_SHEET_ID / service account — không ghi được Sheet. " +
      "Đặt env (xem .env) rồi chạy lại. Bỏ qua an toàn.");
    process.exit(0);
  }

  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = ctx;

  // ---- đọc tab pipeline ----
  const tabs = {
    snapshot: await readTab(sheets, "Brand Weekly Snapshot"),
    ads: await readTab(sheets, "Ad Level Analysis"),
    scaled: await readTab(sheets, "Scaled Content Analysis"),
    weeklyStrategyChange: await readTab(sheets, "Weekly Strategy Change"),
    changes: await readTab(sheets, "Weekly Change Insights"),
    crawlRuns: await readTab(sheets, "Crawl Runs"),
    visualPatterns: await readTab(sheets, "Visual Pattern Analysis"),
    brandVisualSummary: await readTab(sheets, "Brand Visual Summary"),
    visualAnalysis: await readTab(sheets, "Visual Analysis"),
    actionPlan: await readTab(sheets, "Action_Plan"),
    contentRecs: await readTab(sheets, "SERYN Content Recommendations"),
  };
  // Own Brand Pages -> tên brand SERYN để tách own vs competitor khi benchmark.
  const ownNames = (await readTab(sheets, TAB.ownBrandPages)).map((r) => String(r.brand_name || "").toLowerCase().trim()).filter(Boolean);

  const reportId = getReportId("weekly", period.period_start, period.period_end);
  const { row, notes } = buildWeeklyReport({
    tabs,
    ownNames,
    period,
    meta: { generatedAt: new Date().toISOString(), timezone: opts.tz, reportId, createdBy: "generate-weekly-report" },
  });
  notes.forEach((n) => console.log("  [note] " + n));
  console.log(`  KPI: brands=${row.total_brands_tracked} active=${row.total_active_ads} new=${row.total_new_ads} stopped=${row.total_stopped_ads}`);

  console.log("\nGhi Google Sheets...");
  const res = await upsertReport(sheets, titles, TAB.weeklyReports, row, { forceNew: opts.forceNew });
  const md = writeReportMarkdown({ ...row, report_id: res.reportId }, "weekly_reports");

  // Mirror lên Supabase (dashboard đọc Supabase làm nguồn chính) — no-op nếu chưa cấu hình.
  const sb = await pushReportToSupabase("weeklyReports", res.rows, period.period_start);
  if (!sb.skipped) console.log(`  [Supabase] weeklyReports: ${sb.fail ? "lỗi " + sb.errors.join(" | ") : "đã đẩy"}`);

  console.log(`\n[DONE] Weekly report ${res.reportId} (${res.action})` + (md ? ` — md: ${md}` : ""));
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
