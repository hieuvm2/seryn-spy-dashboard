/* ============================================================
   SERYN Spy — Monthly historical report generator (CLI)
   ------------------------------------------------------------
   Tạo báo cáo TỔNG KẾT THÁNG: tổng hợp từ các `Weekly Reports` trong tháng
   + dữ liệu pipeline (fallback). LƯU vào tab `Monthly Reports` theo kỳ —
   KHÔNG ghi đè tháng cũ.

   Chạy:
     node scripts/generate-monthly-report.mjs --current-month
     node scripts/generate-monthly-report.mjs --month=2026-06
     node scripts/generate-monthly-report.mjs --current-month --only-if-last-day
     node scripts/generate-monthly-report.mjs --month=2026-06 --force-new

   `--only-if-last-day`: chỉ chạy nếu hôm nay là NGÀY CUỐI THÁNG (theo timezone,
   không hardcode 31). Dùng cho GitHub Actions schedule ngày 28–31.
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab } from "./lib/sheets.mjs";
import { TAB } from "./lib/schemas.mjs";
import { buildMonthlyReport } from "./lib/reportGen.mjs";
import { hasSheetCreds, upsertReport, writeReportMarkdown, pushReportToSupabase } from "./lib/reportStore.mjs";
import {
  DEFAULT_TZ, getCurrentMonthRange, getMonthRangeFromString,
  isLastDayOfMonth, getReportId,
} from "./lib/reportDateUtils.mjs";

function parseArgs(argv) {
  const o = { forceNew: false, onlyIfLastDay: false, tz: DEFAULT_TZ };
  for (const a of argv) {
    if (a === "--current-month") o.currentMonth = true;
    else if (a === "--force-new") o.forceNew = true;
    else if (a === "--only-if-last-day") o.onlyIfLastDay = true;
    else if (a.startsWith("--month=")) o.month = a.split("=")[1];
    else if (a.startsWith("--tz=")) o.tz = a.split("=")[1] || DEFAULT_TZ;
  }
  return o;
}

/** Weekly report thuộc tháng: period_start HOẶC period_end nằm trong tháng. */
function weeklyInMonth(r, period) {
  const ps = String(r.period_start || "").slice(0, 10);
  const pe = String(r.period_end || "").slice(0, 10);
  const inIt = (d) => d && d >= period.period_start && d <= period.period_end;
  return String(r.report_type || "weekly") !== "monthly" && (inIt(ps) || inIt(pe));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // --only-if-last-day: thoát sớm nếu chưa phải ngày cuối tháng.
  if (opts.onlyIfLastDay && !isLastDayOfMonth(new Date(), opts.tz)) {
    console.log("Not last day of month. Skipping monthly report.");
    process.exit(0);
  }

  const period = opts.month ? getMonthRangeFromString(opts.month, opts.tz) : getCurrentMonthRange(opts.tz);
  if (!period) { console.error(`[X] --month không hợp lệ: "${opts.month}" (định dạng YYYY-MM).`); process.exit(1); }
  console.log(`\nSERYN Monthly Report — tháng ${period.month} (${period.period_start} → ${period.period_end}, TZ ${opts.tz})`);

  if (!hasSheetCreds()) {
    console.log("[SKIP] Thiếu GOOGLE_SHEET_ID / service account — không ghi được Sheet. Bỏ qua an toàn.");
    process.exit(0);
  }

  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = ctx;

  // ---- weekly reports trong tháng ----
  const allWeekly = await readTab(sheets, TAB.weeklyReports);
  const weeklyReports = allWeekly.filter((r) => weeklyInMonth(r, period));
  console.log(`  Weekly reports trong tháng: ${weeklyReports.length}`);

  // ---- raw fallback ----
  const tabs = {
    snapshot: await readTab(sheets, "Brand Weekly Snapshot"),
    ads: await readTab(sheets, "Ad Level Analysis"),
    scaled: await readTab(sheets, "Scaled Content Analysis"),
    contentRecs: await readTab(sheets, "SERYN Content Recommendations"),
  };
  const ownNames = (await readTab(sheets, TAB.ownBrandPages)).map((r) => String(r.brand_name || "").toLowerCase().trim()).filter(Boolean);

  const reportId = getReportId("monthly", period.period_start, period.period_end);
  const { row } = buildMonthlyReport({
    weeklyReports,
    tabs,
    ownNames,
    period,
    meta: { generatedAt: new Date().toISOString(), timezone: opts.tz, reportId, createdBy: "generate-monthly-report" },
  });
  console.log(`  KPI: brands=${row.total_brands_tracked} active(cuối tháng)=${row.total_active_ads} new=${row.total_new_ads} stopped=${row.total_stopped_ads}`);
  if (row.data_quality_note.includes("thiếu")) console.log("  [note] " + row.data_quality_note);

  console.log("\nGhi Google Sheets...");
  const res = await upsertReport(sheets, titles, TAB.monthlyReports, row, { forceNew: opts.forceNew });
  const md = writeReportMarkdown({ ...row, report_id: res.reportId }, "monthly_reports");

  // Mirror lên Supabase (dashboard đọc Supabase làm nguồn chính) — no-op nếu chưa cấu hình.
  const sb = await pushReportToSupabase("monthlyReports", res.rows, period.period_start);
  if (!sb.skipped) console.log(`  [Supabase] monthlyReports: ${sb.fail ? "lỗi " + sb.errors.join(" | ") : "đã đẩy"}`);

  console.log(`\n[DONE] Monthly report ${res.reportId} (${res.action})` + (md ? ` — md: ${md}` : ""));
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
