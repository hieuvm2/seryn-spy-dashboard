/* ============================================================
   SERYN Spy — Exa MARKET RESEARCH (manual / on-demand)
   ------------------------------------------------------------
   PHẠM VI: chỉ trẻ hóa da (service_category=skin_rejuvenation).
   Chạy:  npm run market:run  (manual; GitHub Actions workflow_dispatch
          hoặc local khi MARKET_RESEARCH_RUN_MODE=manual + có EXA_API_KEY).

   KHÔNG chạy trong weekly spy cron. KHÔNG gọi từ frontend.
   GỘP TAB — chỉ ghi:
     - Market Intelligence            (source / trend / market size / opportunity / queue)
     - SERYN Content Recommendations  (sync opportunity quan trọng)
     - Crawl Runs                     (run_type=exa_skin_rejuvenation_market)
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, appendTab, upsertTab } from "./lib/sheets.mjs";
import { exaSearch } from "./lib/exaClient.mjs";
import { detectAll } from "./lib/marketResearchUtils.mjs";
import { estimateMarketSize } from "./lib/marketSizing.mjs";
import { buildMarketResearchQueries } from "./lib/queries.mjs";
import { TAB, HEADERS, RUN_TYPE, INTELLIGENCE_TYPE, SERVICE_CATEGORY } from "./lib/schemas.mjs";
import {
  readRunConfig, manualGuard, resolveServiceCategories,
  currentMondayISO, nowISO, runId,
} from "./lib/runConfig.mjs";

const num = (v) => { const n = Number(String(v).replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Mọi row Market Intelligence đều có đủ default an toàn (cột thiếu -> ""). */
function miRow(run_id, weekDate, geo, type, fields) {
  return {
    run_id, week_date: weekDate, run_type: RUN_TYPE.exaMarket, geo,
    service_category: SERVICE_CATEGORY, intelligence_type: type,
    status: "new", created_at: nowISO(), updated_at: nowISO(),
    ...fields,
  };
}

async function main() {
  const cfg = readRunConfig();
  console.log("\nSERYN Market Research — manual/on-demand · service_category=skin_rejuvenation");
  const guard = manualGuard(cfg);
  if (!guard.ok) { console.log("[SKIP] " + guard.reason); process.exit(0); }

  const weekDate = currentMondayISO();
  const run_id = runId("mr", weekDate);
  const started_at = nowISO();
  const services = resolveServiceCategories();
  const costGuard = [];
  if (cfg.maxQueriesClamped) costGuard.push("max_queries_clamped_to_20");
  if (cfg.maxResultsClamped) costGuard.push("max_results_clamped_to_20");
  if (cfg.deepSearch) costGuard.push("WARNING_deep_search_enabled_may_cost_more");

  console.log(`run=${run_id} week=${weekDate} geo=${cfg.geo} sc=${SERVICE_CATEGORY}`);
  console.log(`budget: maxQueries=${cfg.maxQueries} maxResults=${cfg.maxResults} deep=${cfg.deepSearch}`);

  let sheetsCtx;
  try { sheetsCtx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = sheetsCtx;

  // dữ liệu cũ trong Market Intelligence (chỉ source rows) để dedupe + cache.
  const prevMI = await readTab(sheets, TAB.marketIntelligence);
  const prevSeen = new Map(
    prevMI.filter((r) => r.intelligence_type === INTELLIGENCE_TYPE.source && r.source_url)
      .map((r) => [r.source_url, r]),
  );

  // ---- Exa queries ----
  const queries = buildMarketResearchQueries(services, cfg.geo, cfg.maxQueries);
  console.log(`\n${queries.length} queries (trẻ hóa da):`);
  const sources = [];      // normalized + detected (dùng để build trend/size/opportunity)
  const sourceRows = [];   // Market Intelligence rows (intelligence_type=source)
  let failedQueries = 0;
  for (const q of queries) {
    const r = await exaSearch(q, { numResults: cfg.maxResults, type: cfg.searchType, country: cfg.searchCountry });
    if (!r.ok) { failedQueries++; console.warn(`  [!] query failed: ${q} -> ${r.error}`); continue; }
    console.log(`  [OK] ${q} -> ${r.results.length}`);
    for (const res of r.results) {
      if (!res.url) continue;
      if (sources.find((x) => x.source_url === res.url)) continue;
      const det = detectAll(res, { geo: cfg.geo, serviceCategory: SERVICE_CATEGORY });
      const prev = prevSeen.get(res.url);
      const s = {
        source_url: res.url, source_domain: res.domain, source_title: res.title,
        source_type: res.source_type, summary: res.summary,
        ...det, content_hash: res.content_hash,
      };
      sources.push(s);
      sourceRows.push(miRow(run_id, weekDate, cfg.geo, INTELLIGENCE_TYPE.source, {
        source_url: res.url, source_domain: res.domain, source_title: res.title, source_type: res.source_type,
        summary: res.summary, evidence: (res.highlights || []).join(" | "),
        detected_services: det.detected_services, detected_offers: det.detected_offers,
        detected_prices: det.detected_prices, detected_claims: det.detected_claims,
        detected_customer_problems: det.detected_customer_problems,
        detected_trend_keywords: det.detected_trend_keywords, detected_locations: det.detected_locations,
        detected_target_audience: det.detected_target_audience,
        detected_growth_claims: det.detected_growth_claims, detected_market_numbers: det.detected_market_numbers,
        relevance_score: det.relevance_score, credibility_score: det.credibility_score,
        content_hash: res.content_hash,
        reused_from_cache: prev ? "TRUE" : "FALSE",
        changed_since_last_check: prev ? (prev.content_hash !== res.content_hash ? "TRUE" : "FALSE") : "FALSE",
      }));
    }
  }
  console.log(`\nsources: ${sources.length} (failed queries: ${failedQueries})`);

  // ---- Trend Signals ----
  const trends = buildTrendSignals(sources);
  const trendRows = trends.map((t) => miRow(run_id, weekDate, cfg.geo, INTELLIGENCE_TYPE.trend, {
    topic: t.topic, summary: t.signal, evidence: t.evidence, source_url: t.sourceUrls[0] || "",
    detected_trend_keywords: t.evidence,
    trend_direction: t.direction, trend_strength_score: t.strength,
    confidence_score: t.confidence, relevance_score: t.strength,
  }));

  // ---- Market Size Estimate ----
  const size = estimateMarketSize({
    geo: cfg.geo, market: cfg.market, service_category: SERVICE_CATEGORY,
    trendSignals: trends, competitorActivity: [], marketSources: sources,
  });
  const sizeRow = miRow(run_id, weekDate, cfg.geo, INTELLIGENCE_TYPE.marketSize, {
    topic: "skin_rejuvenation_market_size",
    summary: `TAM ${size.tam_low}-${size.tam_high} ${size.currency} (mid ${size.tam_mid}). Directional.`,
    market_size_tam_low: size.tam_low, market_size_tam_mid: size.tam_mid, market_size_tam_high: size.tam_high,
    market_size_sam_low: size.sam_low, market_size_sam_mid: size.sam_mid, market_size_sam_high: size.sam_high,
    market_size_som_low: size.som_low, market_size_som_mid: size.som_mid, market_size_som_high: size.som_high,
    market_size_method: size.method, assumptions: size.assumptions, missing_data: size.missing_data,
    evidence: size.analyst_notes, source_url: String(size.evidence_sources || "").split("|")[0] || "",
    confidence_score: size.confidence_score,
  });

  // ---- Opportunity Briefs ----
  const opportunities = buildOpportunityBriefs(trends);
  const oppRows = opportunities.map((o) => miRow(run_id, weekDate, cfg.geo, INTELLIGENCE_TYPE.opportunity, {
    topic: o.topic, summary: o.insight, evidence: o.evidence,
    recommended_seryn_action: o.recommended_seryn_action,
    suggested_content_angle: o.suggested_content_angle, suggested_offer_angle: o.suggested_offer_angle,
    suggested_hook: o.suggested_hook, priority: o.priority, confidence_score: o.confidence_score,
    source_url: o.source_urls.split("|")[0] || "",
  }));

  // ---- Research Queue (cho Claude phân tích sâu) ----
  const queueRows = trends.slice(0, 8).map((t) => miRow(run_id, weekDate, cfg.geo, INTELLIGENCE_TYPE.queue, {
    topic: t.topic, summary: "Cần Claude phân tích sâu market size assumption + opportunity trẻ hóa da.",
    evidence: t.evidence, source_url: t.sourceUrls[0] || "", priority: t.strength >= 0.5 ? "High" : "Medium",
    status: "pending",
  }));

  // ---- Write Market Intelligence (append) ----
  console.log("\nGhi Market Intelligence...");
  const allMI = [...sourceRows, ...trendRows, sizeRow, ...oppRows, ...queueRows];
  await appendTab(sheets, titles, TAB.marketIntelligence, HEADERS.marketIntelligence, allMI);

  // ---- Sync opportunity -> SERYN Content Recommendations (upsert, không đụng row weekly) ----
  const recRows = opportunities.map((o) => ({
    week_date: weekDate, source: RUN_TYPE.exaMarket, service_category: SERVICE_CATEGORY,
    recommendation_type: "exa_skin_rejuvenation_opportunity",
    market_signal: o.insight, competitor_evidence: o.evidence,
    seryn_content_niche: "Trẻ hóa da từ nền tảng sinh học (calm, premium)",
    insight: o.insight, suggested_content_format: "doctor_explainer",
    suggested_hook: o.suggested_hook, suggested_content_angle: o.suggested_content_angle,
    suggested_offer_angle: o.suggested_offer_angle, content_style: "scientific_calm_premium",
    main_message: o.insight, proof_to_use: "", cta: "Đặt lịch đánh giá nền tảng sinh học",
    kpi: "qualified_booking", priority: o.priority, confidence_score: o.confidence_score, source_urls: o.source_urls,
  }));
  if (recRows.length) {
    await upsertTab(sheets, titles, TAB.contentRecs, HEADERS.contentRecs, recRows,
      (r) => `${RUN_TYPE.exaMarket}|${String(r.suggested_hook).toLowerCase()}|${r.week_date}`);
  }

  // ---- Crawl Runs (gộp run log) ----
  const runRow = {
    crawl_run_id: run_id, run_id, run_type: RUN_TYPE.exaMarket, started_at, finished_at: nowISO(),
    week_date: weekDate, provider: "exa", country: cfg.searchCountry, geo: cfg.geo,
    service_category: SERVICE_CATEGORY,
    status: failedQueries === queries.length && queries.length ? "failed" : (failedQueries ? "partial" : "ok"),
    queries_count: queries.length, sources_count: sources.length,
    new_items_count: sourceRows.filter((r) => r.reused_from_cache === "FALSE").length,
    changed_items_count: sourceRows.filter((r) => r.changed_since_last_check === "TRUE").length,
    reused_items_count: sourceRows.filter((r) => r.reused_from_cache === "TRUE").length,
    failed_items_count: failedQueries,
    error_summary: failedQueries ? `${failedQueries}/${queries.length} queries failed` : "",
    cost_guard_status: costGuard.join("|") || "ok",
  };
  await appendTab(sheets, titles, TAB.crawlRuns, HEADERS.crawlRuns, [runRow]);

  console.log(`\n[DONE] ${run_id} — sources=${sources.length} trends=${trends.length} opportunities=${opportunities.length}`);
}

/* ---------- builders ---------- */
function buildTrendSignals(sources) {
  const relevant = sources.filter((s) => num(s.relevance_score) >= 0.35);
  const pool = relevant.length ? relevant : sources;

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

  const mk = (topic, o) => {
    const avgCred = o.cred / Math.max(1, o.mentions);
    const strength = Math.round(Math.min(1, (o.mentions / 6) * 0.6 + (o.growth / 4) * 0.3 + avgCred * 0.1) * 100) / 100;
    const direction = o.growth >= 2 ? "up" : (o.mentions >= 3 ? "emerging" : "stable");
    return {
      topic, direction, strength,
      signal: `${o.mentions} nguồn liên quan · ${o.growth} growth claim · ${o.offers} offer signal`,
      evidence: [...o.evid].slice(0, 6).join("|"),
      sourceUrls: [...new Set(o.urls)].slice(0, 3),
      confidence: Math.round(Math.min(1, avgCred * 0.7 + Math.min(1, o.mentions / 5) * 0.3) * 100) / 100,
    };
  };

  const byProblem = agg((s) => String(s.detected_customer_problems || "").split("|").filter(Boolean));
  const byKeyword = agg((s) => String(s.detected_trend_keywords || "").split("|").filter(Boolean));

  const rows = [];
  for (const [p, o] of byProblem) { if (o.mentions >= 2) rows.push(mk(p, o)); }
  for (const [k, o] of byKeyword) { if (o.mentions >= 2) rows.push(mk(k, o)); }
  const seen = new Map();
  for (const r of rows.sort((a, b) => b.strength - a.strength)) {
    if (!seen.has(r.topic)) seen.set(r.topic, r);
  }
  return [...seen.values()].sort((a, b) => b.strength - a.strength).slice(0, 25);
}

function buildOpportunityBriefs(trends) {
  const rows = [];
  for (const t of trends.slice(0, 6)) {
    if (t.strength < 0.2) continue;
    rows.push({
      topic: t.topic,
      insight: `Tín hiệu ${t.direction} ở "${t.topic}": ${t.signal}.`,
      evidence: t.evidence,
      recommended_seryn_action: t.direction === "up" ? "adapt" : "monitor",
      suggested_content_angle: "Giáo dục nền tảng sinh học + bằng chứng khoa học (calm, premium).",
      suggested_offer_angle: "Đặt lịch phân tích/đánh giá nền tảng sinh học (không FOMO).",
      suggested_hook: `Hiểu đúng về ${t.topic} trước khi điều trị`,
      priority: t.strength >= 0.5 ? "High" : "Medium",
      confidence_score: t.confidence,
      source_urls: t.sourceUrls.join("|"),
    });
  }
  return rows;
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
