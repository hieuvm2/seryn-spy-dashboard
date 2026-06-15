/* ============================================================
   SERYN Spy — Exa COMPETITOR DISCOVERY (manual / on-demand)
   ------------------------------------------------------------
   Chạy:  npm run competitors:discover

   Tìm brand/clinic/spa đối thủ mới -> website + fanpage candidate ->
   score + dedupe -> ghi Competitor Discovery (+ Runs / Website
   Intelligence / Fanpage Candidates). KHÔNG tự import vào Competitors
   trừ khi AUTO_IMPORT_COMPETITORS=true (chỉ candidate page_id numeric,
   not duplicate, confidence >= min).
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, appendTab } from "./lib/sheets.mjs";
import { exaSearch } from "./lib/exaClient.mjs";
import { detectServices, detectOffers, detectPrices, detectLocations, detectClaims } from "./lib/marketResearchUtils.mjs";
import {
  normalizeBrandName, extractCandidateBrand, extractWebsiteUrl, extractSocialLinks,
  normalizeFacebookUrl, extractFacebookPageIdFromUrl, isNumericPageId,
  scoreCompetitorCandidate, dedupeCompetitorCandidates,
} from "./lib/competitorDiscoveryUtils.mjs";
import { extractDomain } from "./lib/exaClient.mjs";
import { buildCompetitorQueries } from "./lib/queries.mjs";
import { TAB, HEADERS } from "./lib/schemas.mjs";
import {
  readRunConfig, manualGuard, resolveServiceCategories,
  currentMondayISO, nowISO, runId,
} from "./lib/runConfig.mjs";

async function main() {
  const cfg = readRunConfig();
  console.log("\nSERYN Competitor Discovery — manual/on-demand");
  const guard = manualGuard(cfg);
  if (!guard.ok) { console.log("[SKIP] " + guard.reason); process.exit(0); }

  const weekDate = currentMondayISO();
  const discovery_run_id = runId("disc", weekDate);
  const started_at = nowISO();
  const services = resolveServiceCategories(cfg.serviceCategory);
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
  console.log(`\n${queries.length} queries`);

  // ---- gom candidate theo domain/brand ----
  const byKey = new Map();   // key -> candidate aggregate
  const websiteRows = [];
  const fanpageRows = [];
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
        source_urls: [], source_titles: [], source_types: new Set(), evidenceBits: [],
      };
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

      // Website Intelligence row (chỉ website thật)
      if (website && !isFbResult) {
        websiteRows.push({
          discovery_run_id, week_date: weekDate, brand_name: brand,
          website_url: website, website_domain: extractDomain(website), title: res.title,
          summary: res.summary, detected_services: detectServices(fullText),
          detected_offers: detectOffers(fullText), detected_prices: detectPrices(fullText),
          detected_claims: detectClaims(fullText), detected_locations: detectLocations(fullText),
          detected_contact_info: (fullText.match(/0\d{8,10}/g) || []).slice(0, 3).join("|"),
          detected_social_links: [...social.facebook, ...social.instagram, ...social.tiktok].slice(0, 6).join("|"),
          facebook_links: social.facebook.join("|"), instagram_links: social.instagram.join("|"),
          tiktok_links: social.tiktok.join("|"),
          credibility_score: 0.6, relevance_score: detectServices(fullText) ? 0.7 : 0.4,
          content_hash: res.content_hash, first_seen_date: weekDate, last_seen_date: weekDate,
        });
      }
      // Fanpage candidate row
      if (fbUrl) {
        fanpageRows.push({
          discovery_run_id, week_date: weekDate, brand_name: brand,
          facebook_url: fbUrl, facebook_page_id: fbPageId, facebook_page_name: isFbResult ? res.title.slice(0, 80) : "",
          source_url: res.url, source_type: res.source_type,
          evidence: res.summary.slice(0, 150),
          confidence_score: isNumericPageId(fbPageId) ? 0.9 : 0.5,
          resolution_status: isNumericPageId(fbPageId) ? "resolved_page_id" : "needs_page_id",
          notes: "",
        });
      }
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
    source_urls: a.source_urls.slice(0, 6).join("|"), source_titles: a.source_titles.slice(0, 6).join(" || "),
    source_types: [...a.source_types].join("|"),
    evidence_summary: a.evidenceBits.slice(0, 3).join(" || "),
    geo: cfg.geo,
  }));

  candidates = dedupeCompetitorCandidates(candidates, existingCompetitors, prevDiscovery);

  const discoveryRows = candidates.map((c) => {
    const sc = scoreCompetitorCandidate(c, { geo: cfg.geo, serviceCategory: cfg.serviceCategory });
    const overall = sc.overall_confidence_score;
    const hasNumericPid = isNumericPageId(c.facebook_page_id);
    let status, reason;
    if (c.duplicate_of) { status = "duplicate"; reason = `Trùng với "${c.duplicate_of}".`; }
    else if (c.facebook_url && !hasNumericPid) { status = "needs_page_id"; reason = "Có facebook_url (vanity) nhưng chưa có numeric page_id."; }
    else if (cfg.autoImport && hasNumericPid && overall >= cfg.autoImportMinConfidence) { status = "approved"; reason = "Auto-approved (high confidence + numeric page_id)."; }
    else if (overall >= cfg.discoveryMinConfidence) { status = "needs_review"; reason = "Confidence trung bình — cần review."; }
    else { status = "new"; reason = "Candidate mới, confidence thấp — chưa review."; }

    const ready_for_spy = (status === "approved") && c.brand_name && hasNumericPid && overall >= 0.65;
    return {
      discovery_id: `cd-${c.normalized_brand_name.replace(/\s+/g, "-")}-${weekDate}`.slice(0, 60) || `cd-${Math.random().toString(36).slice(2, 8)}`,
      discovery_run_id, week_date: weekDate, geo: cfg.geo, market: cfg.market, service_category: cfg.serviceCategory,
      brand_name: c.brand_name, normalized_brand_name: c.normalized_brand_name,
      business_type: guessBusinessType(c),
      website_url: c.website_url, website_domain: c.website_domain,
      facebook_url: c.facebook_url, facebook_page_id: c.facebook_page_id, facebook_page_name: c.facebook_page_name,
      instagram_url: c.instagram_url, tiktok_url: c.tiktok_url,
      phone: "", address: "", location: cfg.geo,
      detected_services: c.detected_services, detected_offers: c.detected_offers, detected_prices: c.detected_prices,
      source_urls: c.source_urls, source_titles: c.source_titles, source_types: c.source_types,
      evidence_summary: c.evidence_summary,
      competitor_relevance_score: sc.competitor_relevance_score,
      service_match_score: sc.service_match_score, geo_match_score: sc.geo_match_score,
      source_credibility_score: sc.source_credibility_score,
      fanpage_confidence_score: sc.fanpage_confidence_score, website_confidence_score: sc.website_confidence_score,
      overall_confidence_score: overall, duplicate_of: c.duplicate_of,
      status, ready_for_spy: ready_for_spy ? "TRUE" : "FALSE", reason,
      created_at: nowISO(), updated_at: nowISO(), reviewed_at: "", reviewed_by: "", notes: "",
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
    candidates_imported: 0,
  };

  console.log(`\nGhi Google Sheets... (candidates=${discoveryRows.length})`);
  await appendTab(sheets, titles, TAB.discovery, HEADERS.discovery, discoveryRows);
  await appendTab(sheets, titles, TAB.websiteIntel, HEADERS.websiteIntel, websiteRows);
  await appendTab(sheets, titles, TAB.fanpageCandidates, HEADERS.fanpageCandidates, fanpageRows);

  const runRow = {
    discovery_run_id, started_at, finished_at: nowISO(), week_date: weekDate,
    geo: cfg.geo, market: cfg.market, service_category: cfg.serviceCategory,
    queries_count: queries.length, sources_count: sourcesCount,
    ...stats,
    status: failedQueries === queries.length && queries.length ? "failed" : (failedQueries ? "partial" : "ok"),
    error_summary: failedQueries ? `${failedQueries}/${queries.length} queries failed` : "",
    cost_guard_status: costGuard.join("|") || "ok",
  };
  await appendTab(sheets, titles, TAB.discoveryRuns, HEADERS.discoveryRuns, [runRow]);

  console.log(`\n[DONE] ${discovery_run_id} — found=${stats.candidates_found} needs_review=${stats.candidates_needs_review} ready=${stats.candidates_ready_for_spy} dup=${stats.candidates_duplicates}`);
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
