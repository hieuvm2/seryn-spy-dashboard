/* ============================================================
   SERYN Spy — Market Research status (read-only summary)
   Chạy:  npm run market:status
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

  const runs = await readTab(sheets, TAB.researchRuns);
  const sources = await readTab(sheets, TAB.marketSources);
  const trends = await readTab(sheets, TAB.trendSignals);
  const sizes = await readTab(sheets, TAB.marketSizeEstimates);
  const briefs = await readTab(sheets, TAB.opportunityBriefs);
  const queue = await readTab(sheets, TAB.researchQueue);

  const latest = runs[runs.length - 1];
  console.log("\n=== MARKET RESEARCH STATUS ===");
  if (!latest) { console.log("Chưa có Market Research run nào. Chạy workflow 'Market Research Manual'."); return; }

  console.log(`Latest run     : ${latest.research_run_id} (${latest.status}) @ ${latest.finished_at || latest.started_at}`);
  console.log(`  market/geo/sc: ${latest.market} / ${latest.geo} / ${latest.service_category}`);
  console.log(`Total sources  : ${sources.length}`);
  console.log(`Trend signals  : ${trends.length}`);
  console.log(`Size estimates : ${sizes.length}`);
  console.log(`Opportunity     : ${briefs.length} briefs`);
  console.log(`Queue pending  : ${queue.filter((q) => (q.status || "").toLowerCase() === "pending").length} / ${queue.length}`);

  // confidence distribution (sources relevance)
  const buckets = { low: 0, mid: 0, high: 0 };
  for (const s of sources) {
    const c = num(s.credibility_score);
    if (c >= 0.75) buckets.high++; else if (c >= 0.5) buckets.mid++; else buckets.low++;
  }
  console.log(`Source credibility: high=${buckets.high} mid=${buckets.mid} low=${buckets.low}`);
  const lastSize = sizes[sizes.length - 1];
  if (lastSize) console.log(`Latest market size confidence: ${lastSize.confidence_score} (method=${lastSize.method}) — directional, không audited.`);
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
