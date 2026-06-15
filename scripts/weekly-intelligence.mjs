/* ============================================================
   SERYN Spy — Weekly Intelligence Report generator (CLI)
   ------------------------------------------------------------
   Chạy SAU weekly spy sync (đọc tab pipeline đã ghi) -> tạo
   Weekly_Summary + Action_Plan + Swipe_File_Suggestions + markdown.

   Chạy:  npm run report:weekly
   ENV:   GOOGLE_SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON|FILE (như spy:weekly)
   KHÔNG dùng Exa. KHÔNG crawl ads (chỉ đọc dữ liệu đã có).
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSheetsClient, readTab, appendTab, writeTab } from "./lib/sheets.mjs";
import { TAB, HEADERS } from "./lib/schemas.mjs";
import {
  getWeekRange, calculateDataQualityScore, generateWeeklySummary,
  generateActionPlan, generateSwipeFileCandidates, generateMarkdownReport,
} from "./lib/weeklyIntel.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const num = (v) => { const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const PROVIDER = (process.env.ADS_SOURCE_PROVIDER || "mock").trim().toLowerCase();

/** Ghi đè rows của tuần hiện tại, giữ tuần khác (idempotent khi chạy lại). */
async function replaceWeek(sheets, titles, tab, headers, rows, weekField, weekVal) {
  const existing = await readTab(sheets, tab);
  const kept = existing.filter((r) => String(r[weekField]) !== String(weekVal));
  await writeTab(sheets, titles, tab, headers, [...kept, ...rows]);
}

async function main() {
  console.log("\nSERYN Weekly Intelligence — generate report");
  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = ctx;

  // ---- đọc dữ liệu pipeline đã ghi ----
  const ads = await readTab(sheets, "Ad Level Analysis");
  const visual = await readTab(sheets, "Visual Analysis");
  const snapshot = await readTab(sheets, "Brand Weekly Snapshot");
  const competitors = await readTab(sheets, TAB.competitors);
  const crawlRuns = await readTab(sheets, "Crawl Runs");
  const pageLogs = await readTab(sheets, "Page Crawl Logs");
  const existingSwipe = await readTab(sheets, "Swipe File");

  if (!ads.length && !snapshot.length) {
    console.log("[SKIP] Chưa có dữ liệu 'Ad Level Analysis'/'Brand Weekly Snapshot' — chạy spy:weekly trước.");
    process.exit(0);
  }

  // ---- xác định tuần (mới nhất trong Ad Level Analysis / snapshot) ----
  const weeks = [...new Set([...ads, ...snapshot].map((r) => r.week_date).filter(Boolean))].sort();
  const weekDate = weeks[weeks.length - 1];
  const { week_start, week_end } = getWeekRange(weekDate);
  console.log(`Tuần: ${week_start} → ${week_end} (week_date=${weekDate})`);

  const weekAds = ads.filter((a) => a.week_date === weekDate);
  const weekVisual = visual; // visual không stamp week_date theo tuần -> dùng toàn bộ (đã là bản mới nhất)
  const latestCrawl = crawlRuns.filter((r) => r.week_date === weekDate).slice(-1)[0] || crawlRuns.slice(-1)[0] || {};
  const weekPageLogs = pageLogs.filter((p) => p.week_date === weekDate);

  // new competitors trong tuần (created_at trong khoảng tuần)
  const inWeek = (d) => { const s = String(d).slice(0, 10); return s >= week_start && s <= week_end; };
  const newCompetitorsCount = competitors.filter((c) => inWeek(c.created_at)).length;

  // ---- data quality ----
  const dataQuality = calculateDataQualityScore({
    crawlRun: latestCrawl, pageLogs: weekPageLogs, competitors, ads: weekAds, provider: PROVIDER,
  });
  console.log(`Data quality: ${dataQuality.overall_data_quality_score}/100` + (dataQuality.warnings.length ? ` — ${dataQuality.warnings.length} cảnh báo` : ""));
  dataQuality.warnings.forEach((w) => console.log("  [!] " + w));

  // ---- generators ----
  const summary = generateWeeklySummary({ ads: weekAds, snapshot, crawlRun: latestCrawl, competitors, newCompetitorsCount, dataQuality, weekDate });
  const actions = generateActionPlan({ summary, weekDate });
  const swipe = generateSwipeFileCandidates({ ads: weekAds, visual: weekVisual, existingSwipe, summary, weekDate });
  const markdown = generateMarkdownReport({ summary, actions, swipe, dataQuality });

  // bỏ field nội bộ trước khi ghi sheet
  const { _internal, ...summaryRow } = summary;

  // ---- write ----
  console.log("\nGhi Google Sheets...");
  await replaceWeek(sheets, titles, TAB.weeklySummary, HEADERS.weeklySummary, [summaryRow], "week_start", week_start);
  await replaceWeek(sheets, titles, TAB.actionPlan, HEADERS.actionPlan, actions, "week_start", week_start);
  await replaceWeek(sheets, titles, TAB.swipeSuggestions, HEADERS.swipeSuggestions, swipe, "week_start", week_start);

  // ---- markdown ra file (để export / commit nếu muốn) ----
  const outDir = path.resolve(__dirname, "..", "..", "outputs", "weekly_reports");
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const mdPath = path.join(outDir, `weekly_intelligence_${week_start}.md`);
    fs.writeFileSync(mdPath, markdown, "utf8");
    console.log(`  [OK] Markdown: ${mdPath}`);
  } catch (e) { console.warn("  [!] Không ghi được markdown file: " + (e?.message || e)); }

  console.log(`\n[DONE] Weekly Intelligence ${week_start} — actions=${actions.length} swipe=${swipe.length} dq=${dataQuality.overall_data_quality_score}`);
  if (dataQuality.mock_provider) console.log("⚠ MOCK provider — dashboard sẽ cảnh báo đây KHÔNG phải ads thật.");
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
