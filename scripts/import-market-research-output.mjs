/* ============================================================
   SERYN Spy — Import Claude market research output -> Sheets
   ------------------------------------------------------------
   Chạy:  npm run market:import

   Sau khi validate PASS:
   - Upsert SERYN Opportunity Briefs theo (topic + service_category + geo + week_date)
   - Update Market Research Queue status=reviewed cho topic tương ứng
   - KHÔNG xóa dữ liệu cũ không liên quan.
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSheetsClient, readTab, writeTab, upsertTab } from "./lib/sheets.mjs";
import { TAB, HEADERS } from "./lib/schemas.mjs";
import { validateOutput } from "./validate-market-research-output.mjs";
import { currentMondayISO, nowISO } from "./lib/runConfig.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, "..", "data", "market-research", "market_research_output.json");
const str = (v) => (v === undefined || v === null ? "" : String(v));

async function main() {
  if (!fs.existsSync(OUTPUT_PATH)) { console.log(`[SKIP] Chưa có ${path.relative(process.cwd(), OUTPUT_PATH)}.`); process.exit(0); }
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")); }
  catch (e) { console.error("[X] JSON không hợp lệ: " + (e?.message || e)); process.exit(1); }

  const { ok, errors, items } = validateOutput(parsed);
  if (!ok) { console.error("[X] Validate FAILED — chạy 'npm run market:validate' để xem chi tiết."); errors.slice(0, 5).forEach((e) => console.error("   - " + e)); process.exit(1); }

  const weekDate = str(parsed.week_date) || currentMondayISO();

  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = ctx;

  const briefRows = items.map((it) => ({
    week_date: weekDate, geo: it.geo, service_category: it.service_category,
    opportunity_type: "claude_deep_analysis",
    insight: it.insight,
    recommended_seryn_action: it.recommended_seryn_action,
    suggested_content_angle: str(it.suggested_content_angle),
    suggested_offer_angle: str(it.suggested_offer_angle),
    suggested_hook: str(it.suggested_hook),
    priority: Number(it.confidence_score) >= 0.6 ? "High" : "Medium",
    confidence_score: it.confidence_score,
    source_urls: Array.isArray(it.source_urls) ? it.source_urls.join("|") : str(it.source_urls),
  }));

  await upsertTab(sheets, titles, TAB.opportunityBriefs, HEADERS.opportunityBriefs, briefRows,
    (r) => `${str(r.suggested_hook)}|${str(r.service_category)}|${str(r.geo)}|${str(r.week_date)}`.toLowerCase());

  // update queue status -> reviewed cho topic khớp
  const topics = new Set(items.map((it) => `${str(it.topic).toLowerCase()}|${str(it.service_category).toLowerCase()}`));
  const queue = await readTab(sheets, TAB.researchQueue);
  let touched = 0;
  for (const q of queue) {
    const k = `${str(q.topic).toLowerCase()}|${str(q.service_category).toLowerCase()}`;
    if (topics.has(k) && str(q.status).toLowerCase() !== "reviewed") {
      q.status = "reviewed"; q.reviewed_at = nowISO(); q.reviewed_by = "claude"; touched++;
    }
  }
  if (touched) await writeTab(sheets, titles, TAB.researchQueue, HEADERS.researchQueue, queue);

  console.log(`[DONE] briefs upserted=${briefRows.length}, queue reviewed=${touched}`);
}

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
