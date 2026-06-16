/* ============================================================
   SERYN Spy — Market Research status (read-only summary)
   ------------------------------------------------------------
   Đọc:  Market Intelligence + Crawl Runs  (chỉ trẻ hóa da).
   Chạy:  npm run market:status
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab } from "./lib/sheets.mjs";
import { TAB, RUN_TYPE, INTELLIGENCE_TYPE } from "./lib/schemas.mjs";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function main() {
  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets } = ctx;

  const mi = await readTab(sheets, TAB.marketIntelligence);
  const runs = (await readTab(sheets, TAB.crawlRuns)).filter((r) => r.run_type === RUN_TYPE.exaMarket);

  const byType = (t) => mi.filter((r) => r.intelligence_type === t);
  const sources = byType(INTELLIGENCE_TYPE.source);
  const trends = byType(INTELLIGENCE_TYPE.trend);
  const sizes = byType(INTELLIGENCE_TYPE.marketSize);
  const briefs = byType(INTELLIGENCE_TYPE.opportunity);
  const queue = byType(INTELLIGENCE_TYPE.queue);

  console.log("\n=== MARKET RESEARCH STATUS (skin_rejuvenation) ===");
  const latest = runs[runs.length - 1];
  if (!latest) { console.log("Chưa có Market Research run nào. Chạy workflow 'Market Research Manual'."); return; }

  console.log(`Latest run     : ${latest.run_id} (${latest.status}) @ ${latest.finished_at || latest.started_at}`);
  console.log(`  geo/sc       : ${latest.geo} / ${latest.service_category}`);
  console.log(`Total sources  : ${sources.length}`);
  console.log(`Trend signals  : ${trends.length}`);
  console.log(`Size estimates : ${sizes.length}`);
  console.log(`Opportunity    : ${briefs.length} briefs`);
  console.log(`Queue pending  : ${queue.filter((q) => (q.status || "").toLowerCase() === "pending").length} / ${queue.length}`);

  const buckets = { low: 0, mid: 0, high: 0 };
  for (const s of sources) {
    const c = num(s.credibility_score);
    if (c >= 0.75) buckets.high++; else if (c >= 0.5) buckets.mid++; else buckets.low++;
  }
  console.log(`Source credibility: high=${buckets.high} mid=${buckets.mid} low=${buckets.low}`);
  const lastSize = sizes[sizes.length - 1];
  if (lastSize) console.log(`Latest market size confidence: ${lastSize.confidence_score} (method=${lastSize.market_size_method}) — directional, không audited.`);
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
