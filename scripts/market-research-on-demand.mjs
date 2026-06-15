/* ============================================================
   SERYN Spy — Exa MARKET RESEARCH (manual / on-demand)
   ------------------------------------------------------------
   Chạy:  npm run market:run   (chỉ qua GitHub Actions workflow_dispatch
          hoặc local khi MARKET_RESEARCH_RUN_MODE=manual + có EXA_API_KEY).

   KHÔNG chạy trong weekly spy cron. Không gọi từ frontend.
   Ghi: Market Research Runs / Market Sources / Trend Signals /
        Competitor Market Activity / Market Size Estimates /
        SERYN Opportunity Briefs / Market Research Queue.
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, appendTab, writeTab } from "./lib/sheets.mjs";
import { exaSearch } from "./lib/exaClient.mjs";
import { detectAll } from "./lib/marketResearchUtils.mjs";
import { estimateMarketSize, marketOpportunityScore } from "./lib/marketSizing.mjs";
import { buildMarketResearchQueries } from "./lib/queries.mjs";
import { TAB, HEADERS } from "./lib/schemas.mjs";
import {
  readRunConfig, manualGuard, resolveServiceCategories,
  currentMondayISO, todayISO, nowISO, runId,
} from "./lib/runConfig.mjs";

const num = (v) => { const n = Number(String(v).replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };

async function main() {
  const cfg = readRunConfig();
  console.log("\nSERYN Market Research — manual/on-demand");
  const guard = manualGuard(cfg);
  if (!guard.ok) { console.log("[SKIP] " + guard.reason); process.exit(0); }

  const weekDate = currentMondayISO();
  const research_run_id = runId("mr", weekDate);
  const started_at = nowISO();
  const services = resolveServiceCategories(cfg.serviceCategory);
  const costGuard = [];
  if (cfg.maxQueriesClamped) costGuard.push("max_queries_clamped_to_20");
  if (cfg.maxResultsClamped) costGuard.push("max_results_clamped_to_20");
  if (cfg.deepSearch) costGuard.push("WARNING_deep_search_enabled_may_cost_more");

  console.log(`run=${research_run_id} week=${weekDate} market="${cfg.market}" geo=${cfg.geo} sc=${cfg.serviceCategory}`);
  console.log(`budget: maxQueries=${cfg.maxQueries} maxResults=${cfg.maxResults} deep=${cfg.deepSearch}`);

  let sheetsCtx;
  try { sheetsCtx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = sheetsCtx;

  // dữ liệu cũ (dedupe sources + competitor context)
  const prevSources = await readTab(sheets, TAB.marketSources);
  const prevSeen = new Map(prevSources.map((s) => [s.source_url, s]));
  const competitors = await readTab(sheets, TAB.competitors);
  const adLevel = await readTab(sheets, "Ad Level Analysis");
  const snapshot = await readTab(sheets, "Brand Weekly Snapshot");

  // ---- Exa queries ----
  const queries = buildMarketResearchQueries(services, cfg.geo, cfg.maxQueries);
  console.log(`\n${queries.length} queries:`);
  const sourceRows = [];
  let failedQueries = 0;
  for (const q of queries) {
    const r = await exaSearch(q, { numResults: cfg.maxResults, type: cfg.searchType, country: cfg.searchCountry });
    if (!r.ok) { failedQueries++; console.warn(`  [!] query failed: ${q} -> ${r.error}`); continue; }
    console.log(`  [OK] ${q} -> ${r.results.length}`);
    for (const res of r.results) {
      if (!res.url) continue;
      if (sourceRows.find((x) => x.source_url === res.url)) continue;
      const det = detectAll(res, { geo: cfg.geo, serviceCategory: cfg.serviceCategory });
      const prev = prevSeen.get(res.url);
      sourceRows.push({
        research_run_id, week_date: weekDate, geo: cfg.geo, market: cfg.market,
        service_category: cfg.serviceCategory,
        source_url: res.url, source_domain: res.domain, title: res.title,
        source_type: res.source_type, published_date: res.published_date,
        summary: res.summary, highlights: (res.highlights || []).join(" | "),
        key_facts: [det.detected_growth_claims, det.detected_market_numbers].filter(Boolean).join(" | "),
        ...det,
        reused_from_cache: prev ? "TRUE" : "FALSE",
        changed_since_last_check: prev ? (prev.content_hash !== res.content_hash ? "TRUE" : "FALSE") : "FALSE",
        first_seen_date: prev?.first_seen_date || weekDate,
        last_seen_date: weekDate,
        content_hash: res.content_hash,
      });
    }
  }
  console.log(`\nsources: ${sourceRows.length} (failed queries: ${failedQueries})`);

  // ---- Trend Signals ----
  const trendRows = buildTrendSignals(sourceRows, cfg, weekDate);

  // ---- Competitor Market Activity (digital share of voice) ----
  const activityRows = buildCompetitorActivity(competitors, adLevel, snapshot, sourceRows, cfg, weekDate);

  // ---- Market Size Estimates ----
  const size = estimateMarketSize({
    geo: cfg.geo, market: cfg.market, service_category: cfg.serviceCategory,
    trendSignals: trendRows, competitorActivity: activityRows, marketSources: sourceRows,
  });
  const sizeRow = { week_date: weekDate, geo: cfg.geo, market: cfg.market, service_category: cfg.serviceCategory, ...size };

  // ---- SERYN Opportunity Briefs ----
  const briefRows = buildOpportunityBriefs(sourceRows, trendRows, activityRows, cfg, weekDate);

  // ---- Market Research Queue (cho Claude phân tích sâu) ----
  const queueRows = buildResearchQueue(trendRows, sourceRows, research_run_id, cfg, weekDate);

  // ---- Write ----
  console.log("\nGhi Google Sheets...");
  await appendTab(sheets, titles, TAB.marketSources, HEADERS.marketSources, sourceRows);
  await appendTab(sheets, titles, TAB.trendSignals, HEADERS.trendSignals, trendRows);
  await appendTab(sheets, titles, TAB.competitorMarketActivity, HEADERS.competitorMarketActivity, activityRows);
  await appendTab(sheets, titles, TAB.marketSizeEstimates, HEADERS.marketSizeEstimates, [sizeRow]);
  await appendTab(sheets, titles, TAB.opportunityBriefs, HEADERS.opportunityBriefs, briefRows);
  await appendTab(sheets, titles, TAB.researchQueue, HEADERS.researchQueue, queueRows);

  const runRow = {
    research_run_id, started_at, finished_at: nowISO(), week_date: weekDate,
    market: cfg.market, geo: cfg.geo, service_category: cfg.serviceCategory,
    search_type: cfg.searchType, max_queries: cfg.maxQueries, max_results: cfg.maxResults,
    deep_search: cfg.deepSearch ? "TRUE" : "FALSE",
    status: failedQueries === queries.length && queries.length ? "failed" : (failedQueries ? "partial" : "ok"),
    sources_count: sourceRows.length, trend_signals_count: trendRows.length,
    opportunity_briefs_count: briefRows.length, market_size_confidence: size.confidence_score,
    cost_guard_status: costGuard.join("|") || "ok",
    error_summary: failedQueries ? `${failedQueries}/${queries.length} queries failed` : "",
  };
  await appendTab(sheets, titles, TAB.researchRuns, HEADERS.researchRuns, [runRow]);

  console.log(`\n[DONE] ${research_run_id} — sources=${sourceRows.length} trends=${trendRows.length} briefs=${briefRows.length}`);
}

/* ---------- builders ---------- */
function buildTrendSignals(sources, cfg, weekDate) {
  // Chỉ tính nguồn đủ liên quan (relevance >= 0.35) để strength không bị nhiễu.
  const relevant = sources.filter((s) => num(s.relevance_score) >= 0.35);
  const pool = relevant.length ? relevant : sources;

  // Gom theo 2 chiều: service category + customer problem (concern cụ thể).
  const agg = (keyFn) => {
    const m = new Map();
    for (const s of pool) {
      for (const k of keyFn(s)) {
        if (!k) continue;
        const o = m.get(k) || { mentions: 0, growth: 0, offers: 0, cred: 0, urls: [], evid: new Set() };
        o.mentions++;
        if (s.detected_growth_claims) o.growth++;
        if (s.detected_offers) o.offers++;
        o.cred += num(s.credibility_score);
        if (s.source_url) o.urls.push(s.source_url);
        String(s.detected_customer_problems || "").split("|").filter(Boolean).forEach((p) => o.evid.add(p));
        String(s.detected_trend_keywords || "").split("|").filter(Boolean).forEach((p) => o.evid.add(p));
        m.set(k, o);
      }
    }
    return m;
  };

  const mk = (topic, sc, o, type) => {
    // strength có trọng số credibility; chuẩn hóa theo số nguồn liên quan.
    const avgCred = o.cred / Math.max(1, o.mentions);
    const strength = Math.round(Math.min(1, (o.mentions / 6) * 0.6 + (o.growth / 4) * 0.3 + avgCred * 0.1) * 100) / 100;
    const direction = o.growth >= 2 ? "up" : (o.mentions >= 3 ? "emerging" : "stable");
    return {
      week_date: weekDate, geo: cfg.geo, topic, service_category: sc,
      trend_signal: `${o.mentions} nguồn liên quan · ${o.growth} growth claim · ${o.offers} offer signal`,
      signal_type: o.growth >= 2 ? "report_claim" : type,
      source: [...new Set(o.urls)].slice(0, 3).join("|"),
      evidence: [...o.evid].slice(0, 6).join("|"),
      direction, strength_score: strength,
      confidence_score: Math.round(Math.min(1, avgCred * 0.7 + Math.min(1, o.mentions / 5) * 0.3) * 100) / 100,
      first_seen_date: weekDate,
    };
  };

  const byService = agg((s) => { const v = String(s.detected_services || "").split("|").filter(Boolean); return v.length ? v : ["general"]; });
  const byProblem = agg((s) => String(s.detected_customer_problems || "").split("|").filter(Boolean));

  const rows = [];
  for (const [sc, o] of byService) rows.push(mk(sc, sc, o, "web_mentions"));
  for (const [p, o] of byProblem) { if (o.mentions >= 2) rows.push(mk(p, "consumer_problem", o, "consumer_problem_mentions")); }
  // dedup theo topic, giữ bản strength cao nhất.
  const seen = new Map();
  for (const r of rows.sort((a, b) => b.strength_score - a.strength_score)) {
    if (!seen.has(r.topic)) seen.set(r.topic, r);
  }
  return [...seen.values()].sort((a, b) => b.strength_score - a.strength_score).slice(0, 25);
}

function buildCompetitorActivity(competitors, adLevel, snapshot, sources, cfg, weekDate) {
  const adsByBrand = new Map();
  for (const a of adLevel) (adsByBrand.get(a.brand_name) || adsByBrand.set(a.brand_name, []).get(a.brand_name)).push(a);
  const snapByBrand = new Map(snapshot.map((s) => [s.brand_name, s]));
  // web mentions theo brand (match tên trong title/summary)
  const mentionCount = (brand) => {
    const nb = String(brand || "").toLowerCase();
    return sources.filter((s) => `${s.title} ${s.summary}`.toLowerCase().includes(nb)).length;
  };
  const rows = [];
  const brands = competitors.length ? competitors.map((c) => c.brand_name || c.brand) : [...adsByBrand.keys()];
  for (const brand of brands) {
    if (!brand) continue;
    const ads = adsByBrand.get(brand) || [];
    const snap = snapByBrand.get(brand) || {};
    const offers = new Set(ads.map((a) => a.offer_detected).filter((x) => x && x !== "no_clear_offer"));
    const services = new Set(ads.map((a) => a.service_or_product).filter(Boolean));
    const hooks = ads.map((a) => a.hook_text).filter(Boolean);
    const web = mentionCount(brand);
    const active = num(snap.total_active_ads) || ads.length;
    const sov = Math.round(Math.min(1, (active / 50) * 0.6 + (web / 5) * 0.4) * 100) / 100;
    rows.push({
      week_date: weekDate, brand, geo: cfg.geo, service_category: cfg.serviceCategory,
      active_ads_count: active, new_ads_count: num(snap.new_ads_count),
      landing_pages_count: "unknown", offer_count: offers.size,
      top_offer: [...offers][0] || "unknown", top_service: [...services][0] || "unknown",
      top_hook: hooks[0] || "unknown", web_mentions_count: web,
      detected_landing_pages: "unknown",
      digital_share_of_voice_score: sov,
      aggressiveness_score: Math.round(Math.min(1, offers.size / 5 + active / 50) * 100) / 100,
      confidence_score: ads.length ? 0.7 : 0.4,
    });
  }
  return rows.sort((a, b) => num(b.digital_share_of_voice_score) - num(a.digital_share_of_voice_score));
}

function buildOpportunityBriefs(sources, trends, activity, cfg, weekDate) {
  const rows = [];
  // 1 brief / top trend (tối đa 6)
  for (const t of trends.slice(0, 6)) {
    if (num(t.strength_score) < 0.2) continue;
    const urls = String(t.source || "").split("|").filter(Boolean).slice(0, 3).join("|");
    rows.push({
      week_date: weekDate, geo: cfg.geo, service_category: t.service_category,
      opportunity_type: t.direction === "up" ? "rising_demand" : "emerging_interest",
      insight: `Tín hiệu ${t.direction} ở "${t.topic}": ${t.trend_signal}.`,
      recommended_seryn_action: t.direction === "up" ? "adapt" : "monitor",
      suggested_content_angle: "Giáo dục nền tảng sinh học + bằng chứng khoa học (calm, premium).",
      suggested_offer_angle: "Đặt lịch phân tích/đánh giá nền tảng sinh học (không FOMO).",
      suggested_hook: `Hiểu đúng về ${t.topic} trước khi điều trị`,
      priority: num(t.strength_score) >= 0.5 ? "High" : "Medium",
      confidence_score: t.confidence_score,
      source_urls: urls,
    });
  }
  return rows;
}

function buildResearchQueue(trends, sources, research_run_id, cfg, weekDate) {
  const rows = [];
  for (const t of trends.slice(0, 8)) {
    rows.push({
      queue_id: `q-${weekDate}-${t.service_category}`.slice(0, 60),
      research_run_id, week_date: weekDate, geo: cfg.geo, service_category: t.service_category,
      topic: t.topic, source_urls: String(t.source || "").split("|").slice(0, 4).join("|"),
      reason_for_review: "Cần Claude phân tích sâu market size assumption + opportunity.",
      priority: num(t.strength_score) >= 0.5 ? "High" : "Medium",
      status: "pending", created_at: nowISO(), reviewed_at: "", reviewed_by: "",
    });
  }
  return rows;
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
