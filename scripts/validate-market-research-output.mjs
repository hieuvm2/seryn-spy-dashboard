/* ============================================================
   SERYN Spy — Validate Claude market research output
   ------------------------------------------------------------
   Chạy:  npm run market:validate

   Đọc data/market-research/market_research_output.json và kiểm tra:
   - JSON valid, có items[]
   - required fields đủ
   - confidence_score 0–1, opportunity_score_adjustment -1..1
   - source_urls là array
   - recommended_seryn_action thuộc enum
   - service_category hợp lệ hoặc "unknown"
   Exit code != 0 nếu có lỗi (CI dùng được).
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SERVICE_CATEGORIES } from "./lib/runConfig.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, "..", "data", "market-research", "market_research_output.json");
const ACTIONS = ["copy", "adapt", "counter", "avoid", "monitor"];
const VALID_SC = new Set([...SERVICE_CATEGORIES, "all", "unknown", "general"]);

export function validateOutput(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object") return { ok: false, errors: ["File không phải JSON object."], items: [] };
  const items = Array.isArray(parsed.items) ? parsed.items : null;
  if (!items) return { ok: false, errors: ["Thiếu mảng 'items'."], items: [] };

  items.forEach((it, i) => {
    const at = `items[${i}]`;
    const req = ["topic", "service_category", "geo", "insight", "recommended_seryn_action", "confidence_score", "source_urls"];
    for (const f of req) if (it[f] === undefined || it[f] === null || it[f] === "") errors.push(`${at}: thiếu '${f}'.`);
    const cs = Number(it.confidence_score);
    if (!Number.isFinite(cs) || cs < 0 || cs > 1) errors.push(`${at}: confidence_score phải 0–1.`);
    if (it.opportunity_score_adjustment !== undefined) {
      const o = Number(it.opportunity_score_adjustment);
      if (!Number.isFinite(o) || o < -1 || o > 1) errors.push(`${at}: opportunity_score_adjustment phải -1..1.`);
    }
    if (!Array.isArray(it.source_urls)) errors.push(`${at}: source_urls phải là array.`);
    if (it.recommended_seryn_action && !ACTIONS.includes(it.recommended_seryn_action)) errors.push(`${at}: recommended_seryn_action không hợp lệ (${it.recommended_seryn_action}).`);
    if (it.service_category && !VALID_SC.has(String(it.service_category).toLowerCase())) errors.push(`${at}: service_category không hợp lệ (${it.service_category}).`);
  });
  return { ok: errors.length === 0, errors, items };
}

function main() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.log(`[SKIP] Chưa có file ${path.relative(process.cwd(), OUTPUT_PATH)} — Claude chưa xuất output.`);
    process.exit(0);
  }
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")); }
  catch (e) { console.error("[X] JSON không hợp lệ: " + (e?.message || e)); process.exit(1); }

  const { ok, errors, items } = validateOutput(parsed);
  if (!ok) {
    console.error(`[X] Validate FAILED (${errors.length} lỗi):`);
    errors.forEach((e) => console.error("   - " + e));
    process.exit(1);
  }
  console.log(`[OK] Validate PASSED — ${items.length} items hợp lệ.`);
}

// Chỉ chạy main() khi gọi trực tiếp (không khi được import bởi market:import).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
