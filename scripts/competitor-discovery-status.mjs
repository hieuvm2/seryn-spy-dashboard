/* ============================================================
   SERYN Spy — Competitor Discovery status (read-only summary)
   ------------------------------------------------------------
   Đọc:  Competitor Discovery + Crawl Runs  (chỉ trẻ hóa da).
   Chạy:  npm run competitors:status
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab } from "./lib/sheets.mjs";
import { TAB, RUN_TYPE } from "./lib/schemas.mjs";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function main() {
  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets } = ctx;

  const runs = (await readTab(sheets, TAB.crawlRuns)).filter((r) => r.run_type === RUN_TYPE.exaDiscovery);
  const cand = await readTab(sheets, TAB.discovery);

  console.log("\n=== COMPETITOR DISCOVERY STATUS (skin_rejuvenation) ===");
  const latest = runs[runs.length - 1];
  if (!latest) { console.log("Chưa có Discovery run nào. Chạy workflow 'Competitor Discovery Manual'."); return; }
  console.log(`Latest run : ${latest.run_id} (${latest.status}) @ ${latest.finished_at || latest.started_at}`);

  const by = (s) => cand.filter((c) => (c.status || "").toLowerCase() === s).length;
  console.log(`Total candidates : ${cand.length}`);
  console.log(`  new            : ${by("new")}`);
  console.log(`  needs_review   : ${by("needs_review")}`);
  console.log(`  needs_page_id  : ${by("needs_page_id")}`);
  console.log(`  approved       : ${by("approved")}`);
  console.log(`  imported       : ${by("imported_to_competitors")}`);
  console.log(`  duplicates     : ${by("duplicate")}`);
  console.log(`  ready_for_spy  : ${cand.filter((c) => (c.ready_for_spy || "").toLowerCase() === "true").length}`);

  const impBy = (s) => cand.filter((c) => (c.import_status || "").toLowerCase() === s).length;
  console.log(`Import status    : imported=${impBy("imported")} skipped_dup=${impBy("skipped_duplicate")} skipped_missing_pid=${impBy("skipped_missing_page_id")} skipped_low_conf=${impBy("skipped_low_confidence")} not_imported=${impBy("not_imported")}`);

  const top = cand.slice().sort((a, b) => num(b.overall_confidence_score) - num(a.overall_confidence_score)).slice(0, 10);
  console.log("\nTop candidates by confidence:");
  for (const c of top) {
    console.log(`  ${num(c.overall_confidence_score).toFixed(2)}  ${c.brand_name}  [${c.status}]  pid=${c.facebook_page_id || "-"}  ${c.website_url || ""}`);
  }
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
