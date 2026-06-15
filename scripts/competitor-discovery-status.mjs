/* ============================================================
   SERYN Spy — Competitor Discovery status (read-only summary)
   Chạy:  npm run competitors:status
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab } from "./lib/sheets.mjs";
import { TAB } from "./lib/schemas.mjs";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function main() {
  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets } = ctx;

  const runs = await readTab(sheets, TAB.discoveryRuns);
  const cand = await readTab(sheets, TAB.discovery);

  console.log("\n=== COMPETITOR DISCOVERY STATUS ===");
  const latest = runs[runs.length - 1];
  if (!latest) { console.log("Chưa có Discovery run nào. Chạy workflow 'Competitor Discovery Manual'."); return; }
  console.log(`Latest run : ${latest.discovery_run_id} (${latest.status}) @ ${latest.finished_at || latest.started_at}`);

  const by = (s) => cand.filter((c) => (c.status || "").toLowerCase() === s).length;
  console.log(`Total candidates : ${cand.length}`);
  console.log(`  new            : ${by("new")}`);
  console.log(`  needs_review   : ${by("needs_review")}`);
  console.log(`  needs_page_id  : ${by("needs_page_id")}`);
  console.log(`  approved       : ${by("approved")}`);
  console.log(`  imported       : ${by("imported_to_competitors")}`);
  console.log(`  duplicates     : ${by("duplicate")}`);
  console.log(`  ready_for_spy  : ${cand.filter((c) => (c.ready_for_spy || "").toLowerCase() === "true").length}`);

  const top = cand.slice().sort((a, b) => num(b.overall_confidence_score) - num(a.overall_confidence_score)).slice(0, 10);
  console.log("\nTop candidates by confidence:");
  for (const c of top) {
    console.log(`  ${num(c.overall_confidence_score).toFixed(2)}  ${c.brand_name}  [${c.status}]  pid=${c.facebook_page_id || "-"}  ${c.website_url || ""}`);
  }
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
