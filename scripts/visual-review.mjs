/* ============================================================
   SERYN Visual Review — quy trình phân tích ảnh ĐỊNH KỲ (thủ công, vision).

   Gom creative giống nhau (creative_signature) -> chỉ phân tích 1 đại diện/cụm,
   rồi áp kết quả cho cả cụm. Giảm mạnh số ad cần nhìn tay.

   MODE 1 — gom cụm + tải ảnh đại diện cần review:
     node scripts/visual-review.mjs fetch [N]
       Đọc tab "Visual Analysis", gom theo creative_signature, lấy 1 đại diện/cụm
       CHƯA review (confidence < 0.8) có thumbnail -> tải ảnh về work/visual_review/
       + ghi manifest.json. (N = số cụm tối đa, mặc định 40.)

   MODE 2 — áp phân tích cho cả cụm:
     node scripts/visual-review.mjs write
       Đọc work/visual_review/analysis.json (do người/Claude điền) -> áp cho MỌI ad
       cùng creative_signature trong tab "Visual Analysis" -> ghi lại Sheet.

   analysis.json: [{ "creative_signature": "...", "visual_format": "...",
     "visual_angle":"...", "human":true, "doctor":false, "before_after":false,
     "text_overlay":true, "offer":false, "clinical":80, "luxury":30, "ugc":10,
     "trust":70, "offer_vis":5, "scroll":45, "risk":"low", "ba_risk":"low",
     "med_risk":"low", "pro_risk":"low", "claim":10, "action":"adapt",
     "summary":"Ảnh thật: ..." }]
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB = "Visual Analysis";
const OUT = "C:/seryn-spy-agent/work/visual_review";
const MODE = (process.argv[2] || "fetch").toLowerCase();

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  if (raw && raw.trim()) return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes });
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file && fs.existsSync(file)) return new google.auth.GoogleAuth({ keyFile: file, scopes });
  throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_FILE.");
}
const sheets = google.sheets({ version: "v4", auth: buildAuth() });

async function readTab() {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'` }).catch(() => null);
  const values = res?.data?.values || [];
  if (!values.length) throw new Error(`Tab "${TAB}" trống — chạy npm run spy:weekly trước.`);
  const header = values[0];
  const rows = values.slice(1).map((r) => { const o = {}; header.forEach((h, i) => o[h] = r[i] ?? ""); return o; });
  return { header, rows };
}

async function doFetch(N) {
  fs.mkdirSync(OUT, { recursive: true });
  const { rows } = await readTab();
  const groups = {};
  for (const r of rows) { const k = r.creative_signature || r.ad_id; (groups[k] ||= []).push(r); }
  // đại diện/cụm: chưa review (confidence < 0.8) + có thumbnail
  const reps = [];
  for (const [sig, list] of Object.entries(groups)) {
    const reviewed = list.some((x) => Number(x.confidence_score) >= 0.8);
    if (reviewed) continue;
    const rep = list.find((x) => x.thumbnail_url) || list[0];
    if (!rep.thumbnail_url) continue;
    reps.push({ sig, size: list.length, rep });
  }
  reps.sort((a, b) => b.size - a.size);
  const pick = reps.slice(0, N);
  const manifest = [];
  let ok = 0;
  for (const { sig, size, rep } of pick) {
    const fname = `${rep.ad_id}.jpg`;
    try {
      const r = await fetch(rep.thumbnail_url);
      if (!r.ok) { console.warn("  [!] tải lỗi", rep.ad_id, r.status); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1000) continue;
      fs.writeFileSync(path.join(OUT, fname), buf);
      ok++;
    } catch (e) { console.warn("  [!]", rep.ad_id, e.message); continue; }
    manifest.push({ ad_id: rep.ad_id, brand: rep.brand, creative_signature: sig, cluster_size: size, file: fname, thumbnail_url: rep.thumbnail_url, text: rep.text_overlay_summary || "", current_format: rep.visual_format });
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nGom ${Object.keys(groups).length} cụm; cần review ${reps.length}; tải ${ok} ảnh đại diện -> ${OUT}`);
  console.log(`Tiếp theo: xem ảnh, điền ${OUT}\\analysis.json rồi chạy: node scripts/visual-review.mjs write`);
}

function applyAnalysis(o, a, m) {
  const reasons = [];
  if (a.before_after) reasons.push("Có visual trước/sau (compliance)");
  if (a.med_risk === "high") reasons.push("Cảnh y khoa/phẫu thuật graphic");
  if (a.pro_risk === "high") reasons.push("Nhấn mạnh giá/khuyến mãi");
  o.creative_type = a.creative_type || o.creative_type;
  o.visual_format = a.visual_format; o.visual_angle = a.visual_angle;
  o.human_presence = !!a.human; o.doctor_presence = !!a.doctor; o.before_after_presence = !!a.before_after;
  o.text_overlay_presence = !!a.text_overlay; o.offer_visual_presence = !!a.offer;
  o.clinical_score = a.clinical; o.beauty_luxury_score = a.luxury; o.ugc_score = a.ugc;
  o.trust_signal_score = a.trust; o.offer_visibility_score = a.offer_vis; o.scroll_stop_score = a.scroll;
  o.confidence_score = 0.85; o.confidence_reason = "Manual vision analysis (đọc ảnh thật, áp cho cả cụm).";
  o.visual_risk_level = a.risk; o.risk_reasons = JSON.stringify(reasons); o.claim_risk_score = a.claim;
  o.before_after_risk = a.ba_risk; o.medical_claim_risk = a.med_risk; o.promotion_claim_risk = a.pro_risk;
  o.visual_insight_summary = a.summary; o.seryn_action = a.action;
  o.has_media_asset = true;
  if (m) o.cluster_size = m.cluster_size || o.cluster_size;
  return o;
}

async function doWrite() {
  const file = path.join(OUT, "analysis.json");
  if (!fs.existsSync(file)) throw new Error(`Không thấy ${file}. Chạy fetch + điền analysis.json trước.`);
  const analyses = JSON.parse(fs.readFileSync(file, "utf8"));
  const { header, rows } = await readTab();
  const bySig = {}; for (const a of analyses) bySig[a.creative_signature || a.ad_id] = a;
  let applied = 0, clusters = 0;
  const seen = new Set();
  for (const o of rows) {
    const k = o.creative_signature || o.ad_id;
    const a = bySig[k] || (o.ad_id && bySig[o.ad_id]);
    if (a) { applyAnalysis(o, a); applied++; if (!seen.has(k)) { seen.add(k); clusters++; } }
  }
  const matrix = [header, ...rows.map((o) => header.map((h) => { const v = o[h]; return v === undefined || v === null ? "" : String(v); }))];
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${TAB}'` });
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1`, valueInputOption: "RAW", requestBody: { values: matrix } });
  console.log(`[OK] Áp ${analyses.length} phân tích cho ${clusters} cụm -> ${applied} ad cập nhật (đè cả cụm).`);
}

if (MODE === "fetch") doFetch(Number(process.argv[3]) || 40).catch((e) => { console.error("[X]", e.message); process.exit(1); });
else if (MODE === "write") doWrite().catch((e) => { console.error("[X]", e.message); process.exit(1); });
else { console.error("Mode: fetch | write"); process.exit(1); }
