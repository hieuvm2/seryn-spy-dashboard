/* ============================================================
   SERYN Spy — Weekly Intelligence unit/validation tests
   Chạy:  npm run test:weekly-intel   (không cần Sheets/network)
   Exit != 0 nếu có test fail.
   ============================================================ */
import {
  getWeekRange, buildAdDedupeKey, calculateDataQualityScore,
  generateWeeklySummary, generateActionPlan, generateSwipeFileCandidates,
  generateMarkdownReport, parseSheetJsonField, stringifySheetJsonField, normalizePageId,
} from "./lib/weeklyIntel.mjs";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error("  [FAIL] " + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log("Weekly Intelligence — tests\n");

/* ---- getWeekRange ---- */
{
  const r = getWeekRange("2026-06-15"); // thứ Hai
  eq(r.week_start, "2026-06-15", "week_start = Monday");
  eq(r.week_end, "2026-06-21", "week_end = Sunday");
  const r2 = getWeekRange("2026-06-17"); // thứ Tư -> về thứ Hai
  eq(r2.week_start, "2026-06-15", "mid-week normalizes to Monday");
}

/* ---- dedupe ---- */
{
  const a1 = { ad_id: "123" }, a2 = { ad_id: "123" }, a3 = { ad_id: "" , page_id: "999999", primary_text: "hello", media_url: "m" };
  eq(buildAdDedupeKey(a1), buildAdDedupeKey(a2), "same ad_id -> same key");
  ok(buildAdDedupeKey(a1) !== buildAdDedupeKey(a3), "different ads -> different key");
  ok(buildAdDedupeKey(a3).startsWith("sig:"), "fallback signature when no ad_id");
}

/* ---- normalizePageId ---- */
{
  eq(normalizePageId("359285057508884"), "359285057508884", "numeric pid kept");
  eq(normalizePageId("brandname"), "", "vanity -> empty");
}

/* ---- JSON field helpers ---- */
{
  const o = [{ key: "a", count: 2 }];
  eq(parseSheetJsonField(stringifySheetJsonField(o)), o, "round-trip JSON field");
  eq(parseSheetJsonField("not json", []), [], "bad JSON -> fallback");
}

/* ---- data quality ---- */
{
  const good = calculateDataQualityScore({
    crawlRun: { failed_pages: 0, carried_forward_count: 0, provider: "scrapecreators" },
    competitors: [{ brand_name: "X", page_id: "359285057508884", active: "TRUE" }],
    ads: [{ primary_text: "hi", media_url: "m" }],
    provider: "scrapecreators",
  });
  eq(good.overall_data_quality_score, 100, "clean run -> 100");
  ok(good.mock_provider === false, "not mock");

  const bad = calculateDataQualityScore({
    crawlRun: { failed_pages: 3, carried_forward_count: 12, provider: "mock" },
    competitors: [{ brand_name: "Y", page_id: "", active: "TRUE" }],
    ads: [{ primary_text: "" }, { primary_text: "" }],
    provider: "mock",
  });
  ok(bad.overall_data_quality_score < 50, "bad run -> low score (" + bad.overall_data_quality_score + ")");
  ok(bad.mock_provider === true, "mock flagged");
  ok(bad.missing_page_id_competitors.includes("Y"), "missing page_id listed");
  ok(bad.warnings.length >= 3, "multiple warnings");
}

/* ---- weekly summary + action plan + swipe ---- */
{
  const mkAd = (i, brand, over = {}) => ({
    ad_id: "ad" + i, brand_name: brand, page_id: "111111", status: "ACTIVE",
    hook_text: "Hook " + i, hook_type: over.hook || "offer_led",
    offer_detected: over.offer || "giảm 50%", service_or_product: "melasma_treatment",
    content_format: over.fmt || "offer_promotion", content_angle: "promotion",
    days_active: over.days ?? 5, is_new_this_week: over.new ? "TRUE" : "FALSE",
    is_likely_scaled: over.scaled ? "TRUE" : "FALSE", week_date: "2026-06-15",
    ad_snapshot_url: "http://x/" + i, media_url: "http://m/" + i,
  });
  // 12 new ads cho brand A (scaling), vài ad bền cho swipe
  const ads = [];
  for (let i = 0; i < 12; i++) ads.push(mkAd(i, "Brand A", { new: true }));
  for (let i = 12; i < 20; i++) ads.push(mkAd(i, "Brand B", { hook: "doctor_authority", days: 30, scaled: true }));

  const summary = generateWeeklySummary({ ads, snapshot: [], crawlRun: { provider: "scrapecreators" }, competitors: [], weekDate: "2026-06-15" });
  eq(summary.total_ads_active, 20, "summary active count");
  eq(summary.total_new_ads, 12, "summary new count");
  ok(parseSheetJsonField(summary.top_hooks).length >= 1, "top hooks computed");
  ok(summary.executive_summary.includes("Brand A") || summary.executive_summary.length > 10, "exec summary text");

  const actions = generateActionPlan({ summary, weekDate: "2026-06-15" });
  ok(actions.length >= 1, "action plan generated");
  ok(actions.some((a) => a.insight_type === "competitor_scaling" && a.priority === "high"), "Rule1: +12 new -> high competitor_scaling");
  ok(actions.every((a) => a.status === "new" && a.action_id), "actions well-formed");

  const swipe = generateSwipeFileCandidates({ ads, visual: [], existingSwipe: [], summary, weekDate: "2026-06-15" });
  ok(swipe.length >= 1, "swipe candidates generated");
  ok(swipe.every((s) => s.why_save && s.how_to_adapt), "swipe items have why/how");
  // dedupe vs existing: nếu MỌI ad đã có trong swipe file -> không đề xuất lại
  const swipe2 = generateSwipeFileCandidates({ ads, visual: [], existingSwipe: ads.map((a) => ({ ad_id: a.ad_id })), summary, weekDate: "2026-06-15" });
  ok(swipe2.length === 0, "swipe dedupes against existing (all ads already saved -> 0)");

  const md = generateMarkdownReport({ summary, actions, swipe });
  ok(md.includes("# SERYN Weekly Spy Report"), "markdown has title");
  ok(md.includes("## Action Plan"), "markdown has action plan section");
}

/* ---- crawl-fail safety: data quality reflects failure, không crash ---- */
{
  const r = calculateDataQualityScore({ crawlRun: { failed_pages: 5, carried_forward_count: 30 }, competitors: [], ads: [], provider: "scrapecreators" });
  ok(r.failed_pages === 5, "failed pages surfaced");
  ok(r.carried_forward_count === 30, "carried_forward surfaced");
  ok(r.overall_data_quality_score < 100, "score penalized on failure");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
