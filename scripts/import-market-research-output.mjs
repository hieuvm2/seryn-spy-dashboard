/* ============================================================
   SERYN Spy — Import Claude market research output -> Sheets
   ------------------------------------------------------------
   Chạy:  npm run market:import   (sau khi validate PASS)

   Gộp tab — chỉ ghi:
     - Market Intelligence (intelligence_type=opportunity_brief, upsert)
     - SERYN Content Recommendations (sync opportunity)
     - cập nhật research_queue (status=reviewed) ngay trong Market Intelligence
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSheetsClient, readTab, writeTab, upsertTab } from "./lib/sheets.mjs";
import { TAB, HEADERS, RUN_TYPE, INTELLIGENCE_TYPE, SERVICE_CATEGORY } from "./lib/schemas.mjs";
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

  // ---- Market Intelligence opportunity rows (upsert) ----
  const miRows = items.map((it) => ({
    intelligence_id: `op-claude-${slug(it.suggested_hook || it.topic)}-${weekDate}`.slice(0, 60),
    run_id: `claude-${weekDate}`, week_date: weekDate, run_type: RUN_TYPE.claudeReview,
    geo: str(it.geo), service_category: SERVICE_CATEGORY, topic: str(it.topic),
    intelligence_type: INTELLIGENCE_TYPE.opportunity,
    summary: str(it.insight), evidence: Array.isArray(it.source_urls) ? it.source_urls.join(" | ") : str(it.source_urls),
    recommended_seryn_action: str(it.recommended_seryn_action),
    suggested_content_angle: str(it.suggested_content_angle), suggested_offer_angle: str(it.suggested_offer_angle),
    suggested_hook: str(it.suggested_hook), priority: Number(it.confidence_score) >= 0.6 ? "High" : "Medium",
    confidence_score: it.confidence_score, source_url: Array.isArray(it.source_urls) ? it.source_urls[0] : str(it.source_urls),
    status: "reviewed", created_at: nowISO(), updated_at: nowISO(),
  }));
  // Merge AN TOÀN: chỉ thay row opportunity của claude trùng key; GIỮ NGUYÊN mọi
  // row khác (source/trend/size/queue/opportunity từ Exa). KHÔNG dùng upsertTab vì
  // key sẽ trùng cho các row có suggested_hook rỗng -> gộp mất dữ liệu.
  const existingMI = await readTab(sheets, TAB.marketIntelligence);
  const oppKey = (r) => `${str(r.suggested_hook).toLowerCase()}|${str(r.service_category)}|${str(r.week_date)}`;
  const isClaudeOpp = (r) => r.intelligence_type === INTELLIGENCE_TYPE.opportunity && r.run_type === RUN_TYPE.claudeReview;
  const newOppKeys = new Set(miRows.map(oppKey));
  const keptMI = existingMI.filter((r) => !(isClaudeOpp(r) && newOppKeys.has(oppKey(r))));
  await writeTab(sheets, titles, TAB.marketIntelligence, HEADERS.marketIntelligence, [...keptMI, ...miRows]);

  // ---- Sync -> SERYN Content Recommendations ----
  const recRows = items.map((it) => ({
    week_date: weekDate, source: RUN_TYPE.exaMarket, service_category: SERVICE_CATEGORY,
    recommendation_type: "exa_skin_rejuvenation_opportunity",
    market_signal: str(it.insight), competitor_evidence: "",
    seryn_content_niche: "Trẻ hóa da từ nền tảng sinh học (calm, premium)",
    insight: str(it.insight), suggested_content_format: "doctor_explainer",
    suggested_hook: str(it.suggested_hook), suggested_content_angle: str(it.suggested_content_angle),
    suggested_offer_angle: str(it.suggested_offer_angle), content_style: "scientific_calm_premium",
    main_message: str(it.insight), proof_to_use: "", cta: "Đặt lịch đánh giá nền tảng sinh học",
    kpi: "qualified_booking", priority: Number(it.confidence_score) >= 0.6 ? "High" : "Medium",
    confidence_score: it.confidence_score,
    source_urls: Array.isArray(it.source_urls) ? it.source_urls.join("|") : str(it.source_urls),
  }));
  // Merge AN TOÀN: giữ nguyên row weekly (source!=exaMarket), chỉ thay row exa trùng key.
  const existingRecs = await readTab(sheets, TAB.contentRecs);
  const recKey = (r) => `${str(r.suggested_hook).toLowerCase()}|${str(r.week_date)}`;
  const newRecKeys = new Set(recRows.map(recKey));
  const keptRecs = existingRecs.filter((r) => !(String(r.source) === RUN_TYPE.exaMarket && newRecKeys.has(recKey(r))));
  await writeTab(sheets, titles, TAB.contentRecs, HEADERS.contentRecs, [...keptRecs, ...recRows]);

  // ---- Update research_queue rows (status=reviewed) trong Market Intelligence ----
  const topics = new Set(items.map((it) => str(it.topic).toLowerCase()));
  const mi = await readTab(sheets, TAB.marketIntelligence);
  let touched = 0;
  for (const q of mi) {
    if (q.intelligence_type !== INTELLIGENCE_TYPE.queue) continue;
    if (topics.has(str(q.topic).toLowerCase()) && str(q.status).toLowerCase() !== "reviewed") {
      q.status = "reviewed"; q.updated_at = nowISO(); touched++;
    }
  }
  if (touched) await writeTab(sheets, titles, TAB.marketIntelligence, HEADERS.marketIntelligence, mi);

  console.log(`[DONE] opportunity upserted=${miRows.length}, recs synced=${recRows.length}, queue reviewed=${touched}`);
}

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
