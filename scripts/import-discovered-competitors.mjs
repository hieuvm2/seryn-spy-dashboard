/* ============================================================
   SERYN Spy — Import discovered competitors -> tab Competitors
   ------------------------------------------------------------
   Chạy:  npm run competitors:import

   Đọc Competitor Discovery -> lọc đủ điều kiện import:
     status=approved (người dùng xác nhận)  OR  ready_for_spy=true (auto, cần conf>=0.80)
     not duplicate
   -> AUTO RESOLVE page_id + danh sách page:
        1) facebook_page_id sẵn (numeric)
        2) trích từ facebook_url (?id= / /pages/.../<digits>)
        3) ScrapeCreators search-by-name (RESOLVE_PAGE_ID=true, cần ADS_SOURCE_API_KEY)
           -> điền page_ids (pipe-joined) + page_urls để spy ads tự động.
   -> upsert vào Competitors (theo page_id; KHÔNG tạo duplicate).

   Ghi trạng thái import NGAY trong tab Competitor Discovery
   (import_status / imported_at / status=imported_to_competitors / resolution_status).
   KHÔNG tạo tab 'Competitor Import Log' riêng. Log run vào Crawl Runs.
   KHÔNG bịa page_id — resolve không ra thì giữ skipped_missing_page_id (cần review tay).
   ============================================================ */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import { getSheetsClient, readTab, writeTab, appendTab } from "./lib/sheets.mjs";
import { normalizeBrandName, isNumericPageId, extractFacebookPageIdFromUrl, isValidCompetitorBrand, ensureCompetitorIds } from "./lib/competitorDiscoveryUtils.mjs";
import { resolvePageIds, pageIdResolverAvailable } from "./lib/pageIdResolver.mjs";
import { extractDomain } from "./lib/exaClient.mjs";
import { TAB, HEADERS, RUN_TYPE, SERVICE_CATEGORY } from "./lib/schemas.mjs";
import { currentMondayISO, nowISO, runId } from "./lib/runConfig.mjs";

const MIN_IMPORT_CONFIDENCE = 0.8;
// Tự resolve page_id qua ScrapeCreators search-by-name khi candidate thiếu page_id (mặc định bật).
const RESOLVE_PAGE_ID = String(process.env.RESOLVE_PAGE_ID ?? "true").trim().toLowerCase() !== "false";
const MAX_PAGE_ID_RESOLVES = Number(process.env.MAX_PAGE_ID_RESOLVES_PER_RUN || 20);
const str = (v) => (v === undefined || v === null ? "" : String(v));
const slug = (s) => normalizeBrandName(s).replace(/\s+/g, "-").slice(0, 40);

export async function importDiscovered() {
  console.log("\nSERYN — Import discovered competitors -> Competitors (approved tự vào watchlist)");

  const sheetsCtx = await getSheetsClient(); // throw -> caller xử lý
  const { sheets, titles } = sheetsCtx;

  const discovery = await readTab(sheets, TAB.discovery);
  if (!discovery.length) { console.log("[SKIP] Tab 'Competitor Discovery' trống — chưa có gì để import."); return { created: 0, updated: 0, skipped: 0, resolvedPages: 0 }; }
  const competitors = await readTab(sheets, TAB.competitors);
  // Self-heal: dòng thiếu id (thêm tay / script cũ) -> dashboard không xóa/sửa
  // online được (Apps Script match theo cột id). Điền id thiếu mỗi lần chạy.
  const idBackfilled = ensureCompetitorIds(competitors);
  if (idBackfilled) console.log(`  [id] Điền id cho ${idBackfilled} dòng Competitors còn thiếu.`);

  // index competitor hiện có: theo page_id, theo id (cmp-<slug>), theo brand+domain.
  const pidIndex = new Map();
  const idIndex = new Map();
  const keyIndex = new Map();
  const domainOf = (r) => str(r.website_url ? extractDomain(r.website_url) : (r.website_domain || "")).toLowerCase().trim();
  for (const c of competitors) {
    str(c.page_ids).split("|").filter(Boolean).forEach((p) => isNumericPageId(p) && pidIndex.set(p.trim(), c));
    if (str(c.id)) idIndex.set(str(c.id), c);
    keyIndex.set(normalizeBrandName(c.brand_name) + "|" + domainOf(c), c);
  }

  let created = 0, updated = 0, skipped = 0, touchedDiscovery = 0, resolvedPages = 0, resolveCalls = 0;
  if (RESOLVE_PAGE_ID && !pageIdResolverAvailable()) {
    console.log("[i] RESOLVE_PAGE_ID bật nhưng thiếu ADS_SOURCE_API_KEY — bỏ qua auto-resolve page_id (chỉ dùng page_id sẵn có).");
  }

  for (const d of discovery) {
    const eligible = str(d.status).toLowerCase() === "approved" || str(d.ready_for_spy).toLowerCase() === "true";
    if (!eligible) continue;
    const approved = str(d.status).toLowerCase() === "approved"; // người dùng đã xác nhận
    const overall = Number(d.overall_confidence_score) || 0;

    const setImport = (import_status, reason) => {
      d.import_status = import_status;
      d.imported_at = import_status === "imported" ? nowISO() : str(d.imported_at);
      d.reason = reason;
      d.updated_at = nowISO();
      if (import_status === "imported") d.status = "imported_to_competitors";
      touchedDiscovery++;
    };

    if (str(d.duplicate_of).trim() || str(d.status).toLowerCase() === "duplicate") { setImport("skipped_duplicate", "Trùng đối thủ đã có."); skipped++; continue; }
    // Chặn tên rác/generic (vd "Giới thiệu", "Trẻ hóa da", "HIFU") — không resolve/import (tránh spy nhầm page + tốn credit).
    if (!isValidCompetitorBrand(d.brand_name)) { setImport("skipped_invalid_brand", `Tên không phải brand đối thủ: "${str(d.brand_name)}".`); skipped++; continue; }
    // Confidence gate: candidate người dùng đã xác nhận (approved) thì bỏ qua gate auto;
    // chỉ candidate auto (ready_for_spy) mới cần overall_confidence >= ngưỡng.
    if (!approved && overall < MIN_IMPORT_CONFIDENCE) { setImport("skipped_low_confidence", `overall_confidence_score=${overall} < ${MIN_IMPORT_CONFIDENCE}.`); skipped++; continue; }

    /* ---- Lấy page_id + danh sách page (auto) ---- */
    let pageIds = [];
    let resolveNote = "";
    const existingPid = str(d.facebook_page_id).trim();
    if (isNumericPageId(existingPid)) pageIds = [existingPid];
    if (!pageIds.length) { // thử trích từ facebook_url (vd ?id=123 hoặc /pages/.../123)
      const fromUrl = extractFacebookPageIdFromUrl(str(d.facebook_url));
      if (isNumericPageId(fromUrl)) { pageIds = [fromUrl]; d.facebook_page_id = fromUrl; }
    }
    // Đã thử resolve & thất bại ở lần trước -> KHÔNG gọi lại (tránh tốn credit mỗi lần spy).
    const triedResolveBefore = /no_matching_pages_found|failed_scrapecreators/i.test(str(d.resolution_status));
    if (!pageIds.length && RESOLVE_PAGE_ID && pageIdResolverAvailable() && !triedResolveBefore && resolveCalls < MAX_PAGE_ID_RESOLVES) {
      resolveCalls++;
      const r = await resolvePageIds(d.brand_name, { geo: d.geo, domain: d.website_domain });
      if (r.pageIds && r.pageIds.length && r.best) {
        pageIds = r.pageIds;
        d.facebook_page_id = r.best.page_id;
        if (!str(d.facebook_url).trim()) d.facebook_url = `https://www.facebook.com/${r.best.page_id}`;
        d.resolution_status = "resolved_via_scrapecreators";
        resolveNote = ` · auto-page: ${r.pages.map((p) => `${p.name}#${p.page_id}`).join(", ")}`;
        resolvedPages++;
        console.log(`  ↳ resolve "${d.brand_name}" -> page_ids=${pageIds.join("|")} (${r.pages.map((p) => p.name).join(", ")})`);
      } else if (r.error) {
        d.resolution_status = "failed_scrapecreators_error";
        console.warn(`  [!] resolve "${d.brand_name}" lỗi: ${r.error}`);
      } else {
        d.resolution_status = "no_matching_pages_found";
      }
    }
    if (!pageIds.length || !isNumericPageId(pageIds[0])) {
      setImport("skipped_missing_page_id", "Thiếu numeric page_id (không resolve được)."); skipped++; continue;
    }
    const pid = pageIds[0];
    const pageIdsStr = pageIds.join("|");

    const existing = pidIndex.get(pid)
      || idIndex.get(`cmp-${slug(d.brand_name)}`)
      || keyIndex.get(normalizeBrandName(d.brand_name) + "|" + str(d.website_domain).toLowerCase());

    if (existing) {
      // điền page_ids nếu đối thủ cũ chưa có (để spy được) + index để khử trùng candidate sau
      if (!isNumericPageId(str(existing.page_ids).split("|")[0])) {
        existing.page_ids = pageIdsStr;
        pageIds.forEach((p) => isNumericPageId(p) && pidIndex.set(p.trim(), existing));
      }
      existing.page_urls = existing.page_urls || d.facebook_url;
      existing.website_url = existing.website_url || d.website_url;
      existing.service_focus = existing.service_focus || d.detected_services;
      existing.geo = existing.geo || d.geo;
      existing.source = existing.source || RUN_TYPE.exaDiscovery;
      existing.discovery_id = d.discovery_id;
      existing.notes = (str(existing.notes) ? existing.notes + " · " : "") + "exa: " + str(d.evidence_summary).slice(0, 80) + resolveNote;
      existing.updated_at = nowISO();
      existing.status = existing.status || "active";
      setImport("imported", "Updated existing competitor.");
      updated++;
    } else {
      const row = {
        brand_name: d.brand_name, page_ids: pageIdsStr, page_urls: d.facebook_url,
        active: "TRUE", notes: "exa: " + str(d.evidence_summary).slice(0, 80) + resolveNote,
        category: d.business_type, last_crawled_at: "", last_status: "active",
        id: `cmp-${slug(d.brand_name)}`,
        website_url: d.website_url, service_focus: d.detected_services, geo: d.geo,
        source: RUN_TYPE.exaDiscovery, discovery_id: d.discovery_id, status: "active",
        created_at: nowISO(), updated_at: nowISO(),
      };
      competitors.push(row);
      pageIds.forEach((p) => isNumericPageId(p) && pidIndex.set(p.trim(), row)); // index MỌI page_id (tránh tạo trùng ở candidate sau)
      idIndex.set(str(row.id), row);
      setImport("imported", "Created new competitor.");
      created++;
    }
  }

  if (created || updated || idBackfilled) {
    await writeTab(sheets, titles, TAB.competitors, HEADERS.competitors, competitors);
  }
  if (touchedDiscovery) {
    await writeTab(sheets, titles, TAB.discovery, HEADERS.discovery, discovery);
  }

  // Log run vào Crawl Runs CHỈ khi có thay đổi thật (tránh ghi log no-op mỗi lần spy).
  if (created || updated || resolvedPages) {
    const weekDate = currentMondayISO();
    const rid = runId("imp", weekDate);
    await appendTab(sheets, titles, TAB.crawlRuns, HEADERS.crawlRuns, [{
      crawl_run_id: rid, run_id: rid, run_type: RUN_TYPE.claudeReview, started_at: nowISO(), finished_at: nowISO(),
      week_date: weekDate, provider: "import", geo: "", service_category: SERVICE_CATEGORY,
      new_items_count: created, changed_items_count: updated, failed_items_count: 0,
      candidates_found: created + updated + skipped,
      status: "ok", error_summary: skipped ? `${skipped} skipped` : "", cost_guard_status: "ok",
    }]);
  }

  console.log(`\n[DONE] created=${created} updated=${updated} skipped=${skipped} resolved_pages=${resolvedPages}/${resolveCalls} (discovery rows touched=${touchedDiscovery})`);
  return { created, updated, skipped, resolvedPages };
}

// Chỉ tự chạy khi gọi trực tiếp (node import-discovered-competitors.mjs), KHÔNG chạy khi được import.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);
if (isDirectRun) importDiscovered().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
