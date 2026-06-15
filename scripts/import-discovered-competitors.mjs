/* ============================================================
   SERYN Spy — Import discovered competitors -> tab Competitors
   ------------------------------------------------------------
   Chạy:  npm run competitors:import

   Đọc Competitor Discovery -> lọc (approved OR ready_for_spy=true,
   numeric page_id, not duplicate) -> upsert vào Competitors.
   - Upsert theo page_id; nếu chưa có page_id -> upsert theo
     normalized_brand_name + website_domain với active=false.
   - KHÔNG xóa competitor cũ. KHÔNG tạo duplicate.
   - Ghi Competitor Import Log. Update discovery status=imported_to_competitors.
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, writeTab, appendTab } from "./lib/sheets.mjs";
import { normalizeBrandName, isNumericPageId } from "./lib/competitorDiscoveryUtils.mjs";
import { extractDomain } from "./lib/exaClient.mjs";
import { TAB, HEADERS } from "./lib/schemas.mjs";
import { readRunConfig, nowISO } from "./lib/runConfig.mjs";

const str = (v) => (v === undefined || v === null ? "" : String(v));
const slug = (s) => normalizeBrandName(s).replace(/\s+/g, "-").slice(0, 40);

async function main() {
  const cfg = readRunConfig();
  console.log("\nSERYN — Import discovered competitors -> Competitors");

  let sheetsCtx;
  try { sheetsCtx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = sheetsCtx;

  const discovery = await readTab(sheets, TAB.discovery);
  if (!discovery.length) { console.log("[SKIP] Tab 'Competitor Discovery' trống — chưa có gì để import."); process.exit(0); }
  const competitors = await readTab(sheets, TAB.competitors);

  // index competitor hiện có
  const pidIndex = new Map(); // page_id -> row
  const keyIndex = new Map(); // nb|domain -> row
  for (const c of competitors) {
    str(c.page_ids).split("|").filter(Boolean).forEach((p) => isNumericPageId(p) && pidIndex.set(p.trim(), c));
    const k = normalizeBrandName(c.brand_name) + "|" + str(c.website_url ? extractDomain(c.website_url) : "").toLowerCase();
    keyIndex.set(k, c);
  }

  const importLog = [];
  const importedDiscoveryIds = new Set();
  let created = 0, updated = 0, skipped = 0;

  for (const d of discovery) {
    const eligible = str(d.status).toLowerCase() === "approved" || str(d.ready_for_spy).toLowerCase() === "true";
    if (!eligible) continue;
    const base = {
      import_id: `imp-${slug(d.brand_name)}-${Date.now().toString(36)}`,
      imported_at: nowISO(), discovery_id: d.discovery_id, brand_name: d.brand_name,
      website_url: d.website_url, facebook_url: d.facebook_url, facebook_page_id: d.facebook_page_id,
      target_tab: TAB.competitors, error_message: "",
    };

    if (str(d.duplicate_of).trim()) { importLog.push({ ...base, action: "skipped_duplicate", status: "skipped" }); skipped++; continue; }
    const pid = str(d.facebook_page_id).trim();
    const overall = Number(d.overall_confidence_score) || 0;

    if (!isNumericPageId(pid)) { importLog.push({ ...base, action: "skipped_missing_page_id", status: "skipped" }); skipped++; continue; }
    if (overall < cfg.discoveryMinConfidence) { importLog.push({ ...base, action: "skipped_low_confidence", status: "skipped" }); skipped++; continue; }

    const existing = pidIndex.get(pid)
      || keyIndex.get(normalizeBrandName(d.brand_name) + "|" + str(d.website_domain).toLowerCase());

    if (existing) {
      // update fields, KHÔNG tạo duplicate
      existing.website_url = existing.website_url || d.website_url;
      existing.service_focus = existing.service_focus || d.detected_services;
      existing.geo = existing.geo || d.geo;
      existing.source = existing.source || "exa_discovery";
      existing.discovery_id = d.discovery_id;
      existing.notes = (str(existing.notes) ? existing.notes + " · " : "") + "exa: " + str(d.evidence_summary).slice(0, 80);
      existing.updated_at = nowISO();
      existing.status = existing.status || "active";
      importLog.push({ ...base, action: "updated", status: "ok" });
      updated++;
    } else {
      const row = {
        brand_name: d.brand_name, page_ids: pid, page_urls: d.facebook_url,
        active: "TRUE", notes: "exa: " + str(d.evidence_summary).slice(0, 80),
        category: d.business_type, last_crawled_at: "", last_status: "active",
        id: `cmp-${slug(d.brand_name)}`,
        website_url: d.website_url, service_focus: d.detected_services, geo: d.geo,
        source: "exa_discovery", discovery_id: d.discovery_id, status: "active",
        created_at: nowISO(), updated_at: nowISO(),
      };
      competitors.push(row);
      pidIndex.set(pid, row);
      importLog.push({ ...base, action: "created", status: "ok" });
      created++;
    }
    importedDiscoveryIds.add(d.discovery_id);
  }

  if (created || updated) {
    await writeTab(sheets, titles, TAB.competitors, HEADERS.competitors, competitors);
  }
  await appendTab(sheets, titles, TAB.importLog, HEADERS.importLog, importLog);

  // update discovery status
  if (importedDiscoveryIds.size) {
    for (const d of discovery) {
      if (importedDiscoveryIds.has(d.discovery_id)) { d.status = "imported_to_competitors"; d.updated_at = nowISO(); }
    }
    await writeTab(sheets, titles, TAB.discovery, HEADERS.discovery, discovery);
  }

  console.log(`\n[DONE] created=${created} updated=${updated} skipped=${skipped} (log rows=${importLog.length})`);
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
