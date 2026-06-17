/* ============================================================
   SERYN Spy — Exa COMPETITOR DISCOVERY (manual / on-demand)
   ------------------------------------------------------------
   PHẠM VI: chỉ đối thủ trẻ hóa da (service_category=skin_rejuvenation).
   Chạy:  npm run competitors:discover

   GỘP TAB — chỉ ghi:
     - Competitor Discovery  (run + website + fanpage + import status, 1 tab)
     - Crawl Runs            (run_type=exa_skin_rejuvenation_competitor_discovery)

   KHÔNG tự import vào Competitors (xem import-discovered-competitors.mjs).
   KHÔNG bịa page_id. Vanity URL -> resolution_status=needs_page_id.
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, appendTab } from "./lib/sheets.mjs";
import { exaSearch } from "./lib/exaClient.mjs";
import { detectServices, detectOffers, detectPrices } from "./lib/marketResearchUtils.mjs";
import {
  normalizeBrandName, extractCandidateBrand, extractWebsiteUrl, extractSocialLinks,
  normalizeFacebookUrl, extractFacebookPageIdFromUrl, isNumericPageId,
  scoreCompetitorCandidate, dedupeCompetitorCandidates, brandQualityScore,
  extractPhones, extractHotline, extractAddresses, buildFanpageQueries,
} from "./lib/competitorDiscoveryUtils.mjs";
import { extractDomain } from "./lib/exaClient.mjs";
import { buildCompetitorQueries } from "./lib/queries.mjs";
import { TAB, HEADERS, RUN_TYPE, SERVICE_CATEGORY } from "./lib/schemas.mjs";
import {
  readRunConfig, manualGuard, resolveServiceCategories,
  currentMondayISO, nowISO, runId,
} from "./lib/runConfig.mjs";

async function main() {
  const cfg = readRunConfig();
  console.log("\nSERYN Competitor Discovery — manual/on-demand · service_category=skin_rejuvenation");
  const guard = manualGuard(cfg);
  if (!guard.ok) { console.log("[SKIP] " + guard.reason); process.exit(0); }

  const weekDate = currentMondayISO();
  const run_id = runId("disc", weekDate);
  const started_at = nowISO();
  const services = resolveServiceCategories();
  const costGuard = [];
  if (cfg.maxQueriesClamped) costGuard.push("max_queries_clamped_to_20");
  if (cfg.maxResultsClamped) costGuard.push("max_results_clamped_to_20");

  let sheetsCtx;
  try { sheetsCtx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = sheetsCtx;

  const existingCompetitors = await readTab(sheets, TAB.competitors);
  const prevDiscovery = await readTab(sheets, TAB.discovery);

  const queries = buildCompetitorQueries(services, cfg.geo, cfg.maxQueries);
  console.log(`\n${queries.length} queries (đối thủ trẻ hóa da)`);

  // ---- gom candidate theo domain/brand ----
  const byKey = new Map();
  let failedQueries = 0;
  let sourcesCount = 0;

  for (const q of queries) {
    const r = await exaSearch(q, { numResults: cfg.maxResults, type: cfg.searchType, country: cfg.searchCountry });
    if (!r.ok) { failedQueries++; console.warn(`  [!] ${q} -> ${r.error}`); continue; }
    sourcesCount += r.results.length;
    console.log(`  [OK] ${q} -> ${r.results.length}`);
    for (const res of r.results) {
      const fullText = [res.title, res.summary, (res.highlights || []).join(" "), res.text].join(" \n ");
      const social = extractSocialLinks(res);
      const isFbResult = /facebook\.com/i.test(res.domain);
      const website = extractWebsiteUrl(res);
      const fbFromResult = isFbResult ? res.url : (social.facebook[0] || "");
      const fbUrl = fbFromResult ? normalizeFacebookUrl(fbFromResult) : "";
      const fbPageId = fbUrl ? extractFacebookPageIdFromUrl(fbUrl) : "";
      const brand = extractCandidateBrand(res);
      if (!brand) continue;

      const nb = normalizeBrandName(brand);
      const key = nb || extractDomain(res.url) || res.url;
      const agg = byKey.get(key) || {
        brand_name: brand, website_url: "", facebook_url: "", facebook_page_id: "",
        facebook_page_name: "", instagram_url: "", tiktok_url: "",
        detected_services: "", detected_offers: "", detected_prices: "",
        phone: "", address: "",
        source_urls: [], source_titles: [], source_types: new Set(), evidenceBits: [],
      };
      // enrichment cho scraper: hotline + địa chỉ (best-effort, không bịa)
      if (!agg.phone) agg.phone = extractHotline(fullText) || (extractPhones(fullText)[0] || "");
      if (!agg.address) agg.address = extractAddresses(fullText)[0] || "";
      if (!agg.website_url && website) agg.website_url = website;
      if (!agg.facebook_url && fbUrl) agg.facebook_url = fbUrl;
      if (!agg.facebook_page_id && isNumericPageId(fbPageId)) agg.facebook_page_id = fbPageId;
      if (!agg.facebook_page_name && isFbResult) agg.facebook_page_name = res.title.slice(0, 80);
      if (!agg.instagram_url && social.instagram[0]) agg.instagram_url = social.instagram[0];
      if (!agg.tiktok_url && social.tiktok[0]) agg.tiktok_url = social.tiktok[0];
      agg.detected_services = mergePipe(agg.detected_services, detectServices(fullText));
      agg.detected_offers = mergePipe(agg.detected_offers, detectOffers(fullText));
      agg.detected_prices = mergePipe(agg.detected_prices, detectPrices(fullText));
      agg.source_urls.push(res.url);
      agg.source_titles.push(res.title);
      agg.source_types.add(res.source_type);
      agg.evidenceBits.push(res.summary.slice(0, 120));
      byKey.set(key, agg);
    }
  }

  // ---- finalize candidates: score + dedupe + status ----
  let candidates = [...byKey.values()].map((a) => ({
    brand_name: a.brand_name,
    normalized_brand_name: normalizeBrandName(a.brand_name),
    website_url: a.website_url, website_domain: extractDomain(a.website_url),
    facebook_url: a.facebook_url, facebook_page_id: a.facebook_page_id,
    facebook_page_name: a.facebook_page_name,
    instagram_url: a.instagram_url, tiktok_url: a.tiktok_url,
    detected_services: a.detected_services, detected_offers: a.detected_offers, detected_prices: a.detected_prices,
    phone: a.phone || "", address: a.address || "",
    source_urls: a.source_urls.slice(0, 6).join("|"), source_titles: a.source_titles.slice(0, 6).join(" || "),
    source_types: [...a.source_types].join("|"),
    evidence_summary: a.evidenceBits.slice(0, 3).join(" || "),
    geo: cfg.geo,
  }));

  candidates = dedupeCompetitorCandidates(candidates, existingCompetitors, prevDiscovery);

  // ---- ENRICHMENT: candidate có website nhưng thiếu fanpage -> tìm fanpage (cost guard) ----
  const MAX_FANPAGE_ENRICH = 8; // số candidate tối đa được enrich/run
  let enrichTargets = candidates.filter((c) => !c.facebook_url && c.website_url && c.detected_services && !c.duplicate_of).slice(0, MAX_FANPAGE_ENRICH);
  let fanpageQueriesRun = 0;
  for (const c of enrichTargets) {
    const fq = buildFanpageQueries(c, cfg.geo);
    for (const q of fq) {
      const r = await exaSearch(q, { numResults: 3, type: cfg.searchType, country: cfg.searchCountry });
      fanpageQueriesRun++;
      if (!r.ok) continue;
      for (const res of r.results) {
        const social = extractSocialLinks(res);
        const fb = /facebook\.com/i.test(res.domain) ? res.url : (social.facebook[0] || "");
        if (!fb) continue;
        const norm = normalizeFacebookUrl(fb);
        if (!c.facebook_url) { c.facebook_url = norm; c.facebook_page_name = /facebook\.com/i.test(res.domain) ? res.title.slice(0, 80) : c.facebook_page_name; }
        const pid = extractFacebookPageIdFromUrl(norm);
        if (isNumericPageId(pid) && !c.facebook_page_id) c.facebook_page_id = pid;
        break;
      }
      if (c.facebook_url) break; // đã có fanpage -> ngừng query candidate này
    }
  }
  if (fanpageQueriesRun) console.log(`  [enrich] ${enrichTargets.length} candidate · ${fanpageQueriesRun} fanpage queries`);

  // Lọc rác trước khi ghi (bài blog/SEO không phải brand thật).
  const before = candidates.length;
  candidates = candidates.filter((c) => {
    const bq = brandQualityScore(c.brand_name);
    const hasFanpage = !!c.facebook_url;
    const hasUsefulWebsite = !!c.website_url && !!c.detected_services;
    if (c.duplicate_of) return true;
    return bq >= 0.3 || hasFanpage || hasUsefulWebsite;
  });
  const droppedJunk = before - candidates.length;
  if (droppedJunk) console.log(`  [filter] bỏ ${droppedJunk} candidate rác.`);

  const discoveryRows = candidates.map((c) => {
    const sc = scoreCompetitorCandidate(c, { geo: cfg.geo, serviceCategory: SERVICE_CATEGORY });
    const overall = sc.overall_confidence_score;
    const bq = sc.brand_quality_score;
    const hasNumericPid = isNumericPageId(c.facebook_page_id);
    const hasUsefulWebsite = !!c.website_url && !!c.detected_services;
    let status, reason, resolution_status;
    if (c.duplicate_of) { status = "duplicate"; reason = `Trùng với "${c.duplicate_of}".`; resolution_status = "duplicate"; }
    else if (bq < 0.3 && !c.facebook_url && !hasUsefulWebsite) { status = "rejected"; reason = "Chất lượng thấp: brand giống tiêu đề blog, không có fanpage/website rõ ràng."; resolution_status = "manual_review"; }
    else if (hasNumericPid) { resolution_status = "resolved_page_id"; status = (cfg.autoImport && overall >= cfg.autoImportMinConfidence) ? "approved" : (overall >= cfg.discoveryMinConfidence ? "needs_review" : "new"); reason = status === "approved" ? "Auto-approved (high confidence + numeric page_id)." : "Có numeric page_id — chờ review/duyệt."; }
    else if (c.facebook_url) { status = "needs_page_id"; resolution_status = "needs_page_id"; reason = "Có facebook_url (vanity) nhưng chưa có numeric page_id."; }
    else if (hasUsefulWebsite) { status = "needs_review"; resolution_status = "not_facebook"; reason = "Có website + dịch vụ trẻ hóa da nhưng chưa có fanpage."; }
    else { status = "new"; resolution_status = "manual_review"; reason = "Candidate mới, confidence thấp — chưa review."; }

    const ready_for_spy = (status === "approved") && c.brand_name && hasNumericPid && overall >= 0.65;
    return {
      discovery_id: `cd-${c.normalized_brand_name.replace(/\s+/g, "-")}-${weekDate}`.slice(0, 60) || `cd-${Math.random().toString(36).slice(2, 8)}`,
      run_id, week_date: weekDate, run_type: RUN_TYPE.exaDiscovery, geo: cfg.geo, service_category: SERVICE_CATEGORY,
      brand_name: c.brand_name, normalized_brand_name: c.normalized_brand_name,
      business_type: guessBusinessType(c),
      website_url: c.website_url, website_domain: c.website_domain,
      facebook_url: c.facebook_url, facebook_page_id: c.facebook_page_id, facebook_page_name: c.facebook_page_name,
      instagram_url: c.instagram_url, tiktok_url: c.tiktok_url,
      phone: c.phone || "", address: c.address || "", location: c.address || cfg.geo,
      detected_services: c.detected_services, detected_offers: c.detected_offers, detected_prices: c.detected_prices,
      source_urls: c.source_urls, source_titles: c.source_titles, source_types: c.source_types,
      evidence_summary: c.evidence_summary,
      competitor_relevance_score: sc.competitor_relevance_score,
      service_match_score: sc.service_match_score, geo_match_score: sc.geo_match_score,
      source_credibility_score: sc.source_credibility_score,
      fanpage_confidence_score: sc.fanpage_confidence_score, website_confidence_score: sc.website_confidence_score,
      overall_confidence_score: overall, duplicate_of: c.duplicate_of, resolution_status,
      status, ready_for_spy: ready_for_spy ? "TRUE" : "FALSE",
      import_status: "not_imported", imported_at: "", reason,
      created_at: nowISO(), updated_at: nowISO(), reviewed_at: "", reviewed_by: "",
      notes: `brand_quality=${bq}`,
    };
  });

  // ---- counts ----
  const count = (f) => discoveryRows.filter(f).length;
  const stats = {
    candidates_found: discoveryRows.length,
    candidates_new: count((r) => r.status === "new"),
    candidates_duplicates: count((r) => r.status === "duplicate"),
    candidates_needs_review: count((r) => r.status === "needs_review"),
    candidates_ready_for_spy: count((r) => r.ready_for_spy === "TRUE"),
  };
  const rejectedCount = count((r) => r.status === "rejected");
  const needsPageId = count((r) => r.status === "needs_page_id");

  console.log(`\nGhi Competitor Discovery... (candidates=${discoveryRows.length})`);
  await appendTab(sheets, titles, TAB.discovery, HEADERS.discovery, discoveryRows);

  const runRow = {
    crawl_run_id: run_id, run_id, run_type: RUN_TYPE.exaDiscovery, started_at, finished_at: nowISO(),
    week_date: weekDate, provider: "exa", country: cfg.searchCountry, geo: cfg.geo, service_category: SERVICE_CATEGORY,
    queries_count: queries.length, sources_count: sourcesCount, candidates_found: stats.candidates_found,
    new_items_count: stats.candidates_new, changed_items_count: stats.candidates_needs_review,
    reused_items_count: stats.candidates_duplicates, failed_items_count: failedQueries,
    status: failedQueries === queries.length && queries.length ? "failed" : (failedQueries ? "partial" : "ok"),
    error_summary: [
      failedQueries ? `${failedQueries}/${queries.length} queries failed` : "",
      droppedJunk ? `dropped ${droppedJunk} junk` : "",
      rejectedCount ? `${rejectedCount} low_quality` : "",
      needsPageId ? `${needsPageId} needs_page_id` : "",
    ].filter(Boolean).join("; "),
    cost_guard_status: costGuard.join("|") || "ok",
  };
  await appendTab(sheets, titles, TAB.crawlRuns, HEADERS.crawlRuns, [runRow]);

  console.log(`\n[DONE] ${run_id} — found=${stats.candidates_found} needs_review=${stats.candidates_needs_review} ready=${stats.candidates_ready_for_spy} dup=${stats.candidates_duplicates} needs_page_id=${needsPageId} rejected=${rejectedCount}`);
  if (cfg.autoImport) console.log("AUTO_IMPORT_COMPETITORS=true -> chạy 'npm run competitors:import' để import approved candidate.");
}

const mergePipe = (a, b) => [...new Set([...(a ? a.split("|") : []), ...(b ? b.split("|") : [])].filter(Boolean))].join("|");
function guessBusinessType(c) {
  const t = `${c.brand_name} ${c.source_titles}`.toLowerCase();
  if (/bệnh viện|hospital/.test(t)) return "hospital";
  if (/spa/.test(t)) return "spa";
  if (/clinic|phòng khám|thẩm mỹ viện/.test(t)) return "clinic";
  return "unknown";
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
