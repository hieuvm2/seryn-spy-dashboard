/* ============================================================
   SERYN Spy — WEEKLY AUTOMATED SYNC (GitHub Actions / local)
   ------------------------------------------------------------
   Đọc tab `Competitors` -> pull ads (provider mock|custom) -> phân tích
   (classification + scale detection) -> tạo 5 bảng -> ghi Google Sheets.

   Chạy:  npm run spy:weekly

   ENV:
     GOOGLE_SHEET_ID               (bắt buộc)
     GOOGLE_SERVICE_ACCOUNT_JSON   (nội dung JSON service account, dạng string — GitHub Secret)
     GOOGLE_SERVICE_ACCOUNT_FILE   (fallback local: đường dẫn file JSON)
     ADS_SOURCE_PROVIDER           mock | custom   (mặc định mock)
     ADS_SOURCE_API_URL            (provider=custom)
     ADS_SOURCE_API_KEY            (provider=custom, tùy chọn)

   KHÔNG bịa page_id. KHÔNG khẳng định ads chắc chắn hiệu quả — chỉ
   "likely scaled based on duration and repetition".
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import { google } from "googleapis";
import { HEADERS as SHARED_HEADERS, RUN_TYPE, SERVICE_CATEGORY } from "./lib/schemas.mjs";
import { analyzeHook } from "./lib/hookAnalysis.mjs";
import { importDiscovered } from "./import-discovered-competitors.mjs";
import { syncSheetToSupabase } from "./sync-sheet-to-supabase.mjs";
import { supabaseConfigured } from "./lib/supabase.mjs";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const PROVIDER = (process.env.ADS_SOURCE_PROVIDER || "mock").trim().toLowerCase();
/* PHẠM VI SPY (mặc định): chỉ ad CĂNG DA / TRẺ HÓA DA MẶT (service_category=skin_rejuvenation)
   của danh sách đối thủ trong tab Competitors. KHÔNG spy dịch vụ khác (nâng ngực, hút mỡ,
   nâng mũi/cắt mí, răng, triệt lông, filler/botox thuần…). Đặt ADS_SCOPE=all để tắt lọc. */
const ADS_SCOPE = (process.env.ADS_SCOPE || "skin_rejuvenation").trim().toLowerCase();
// Tự import đối thủ đã duyệt (approved) vào watchlist TRƯỚC khi spy → duyệt xong là lần spy tới tự pull.
const AUTO_IMPORT_APPROVED = String(process.env.AUTO_IMPORT_APPROVED ?? "true").trim().toLowerCase() !== "false";

/* ---- versions (incremental cache) ---- */
const ANALYSIS_VERSION = "v2";
const TEXT_PROMPT_VERSION = (process.env.TEXT_ANALYSIS_PROMPT_VERSION || "t1").trim();
const VISUAL_PROMPT_VERSION = (process.env.VISUAL_ANALYSIS_PROMPT_VERSION || "v1").trim();
const VISUAL_AI_PROVIDER = (process.env.VISUAL_AI_PROVIDER || "heuristic").trim().toLowerCase();

/* ---- hashing (stable, normalize null/whitespace) ---- */
const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
function sha(parts) {
  return crypto.createHash("sha256").update(parts.map(norm).join("")).digest("hex").slice(0, 16);
}
/** Bỏ query token (fbcdn xoay vòng mỗi fetch) -> hash ổn định giữa các tuần. */
function urlKey(u) {
  const s = String(u ?? "").split("?")[0];
  const file = s.split("/").pop() || "";
  const m = file.match(/^(\d+_\d+)/); // tên file ảnh fbcdn ổn định
  return m ? m[1] : s;
}
function buildContentHash(ad) {
  return sha([ad.ad_id, ad.primary_text, ad.headline, ad.description, ad.cta, ad.landing_url || ad.link_url, ad.offer_detected]);
}
function buildVisualHash(ad) {
  const imgs = Array.isArray(ad.image_urls) ? ad.image_urls.map(urlKey).join(",") : urlKey(ad.image_urls);
  return sha([urlKey(ad.thumbnail_url), urlKey(ad.media_url), imgs, urlKey(ad.video_preview_url), ad.creative_type || ad.media_type, urlKey(ad.ad_snapshot_url || ad.snapshot_url)]);
}
function buildPatternHash(brand, service, hook, offer, vf, va) {
  return sha([brand, service, hook, offer, vf, va]);
}
function nowISO() { return new Date().toISOString(); }
function crawlRunId(weekDate) { return `run-${weekDate}-${Date.now().toString(36)}`; }

const warnings = [];
function warn(msg) { warnings.push(msg); console.warn("  [!] " + msg); }
function fail(msg) { console.error("\n[X] " + msg + "\n"); process.exit(1); }

/* ---------- date helpers ---------- */
function iso(d) { return d.toISOString().slice(0, 10); }
function currentMondayISO() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // 0 = thứ Hai
  d.setUTCDate(d.getUTCDate() - day);
  return iso(d);
}
function daysAgoISO(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return iso(d); }
function daysActive(startISO) {
  if (!startISO) return 0;
  const ms = Date.now() - new Date(startISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/* ============================================================
   1) AUTH — service account JSON string hoặc file fallback
   ============================================================ */
function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    let creds;
    try { creds = JSON.parse(raw); }
    catch (e) { fail("GOOGLE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ: " + (e?.message || e)); }
    return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file && fs.existsSync(file)) {
    return new google.auth.GoogleAuth({ keyFile: file, scopes: SCOPES });
  }
  fail(
    "Thiếu credentials service account.\n" +
    "  → Đặt GOOGLE_SERVICE_ACCOUNT_JSON (nội dung JSON, dùng cho GitHub Actions),\n" +
    "    hoặc GOOGLE_SERVICE_ACCOUNT_FILE (đường dẫn file JSON, dùng khi chạy local).\n" +
    "  → Nhớ Share Google Sheet (Editor) cho client_email của service account."
  );
}

/* ---------- Sheets I/O ---------- */
async function readTabObjects(sheets, name) {
  let res;
  try {
    res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${name}'` });
  } catch { return []; } // tab chưa tồn tại
  const values = res.data.values || [];
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h || "").trim());
  return values.slice(1)
    .filter((row) => row.some((c) => String(c || "").trim() !== ""))
    .map((row) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = row[i] != null ? String(row[i]) : ""; });
      return o;
    });
}

async function writeTab(sheets, titles, name, headers, rows) {
  if (!titles.includes(name)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
    titles.push(name);
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${name}'` });
  const matrix = [headers, ...rows.map((r) => headers.map((h) => {
    const v = r[h];
    return v === undefined || v === null ? "" : String(v);
  }))];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${name}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: matrix },
  });
  console.log(`  [OK] ${name}: ghi ${rows.length} dòng dữ liệu`);
}

/** Reconcile header: tab cũ có header khác (đổi thứ tự/thêm cột) -> migrate
 *  dữ liệu cũ theo tên cột rồi ghi lại, tránh lệch cột khi append schema mới. */
async function reconcileHeader(sheets, name, headers) {
  let res;
  try { res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${name}'` }); }
  catch { return; }
  const values = res.data.values || [];
  if (!values.length) return;
  const cur = values[0].map((h) => String(h || "").trim());
  if (cur.length === headers.length && headers.every((h, i) => cur[i] === h)) return;
  const idx = {}; cur.forEach((h, i) => { idx[h] = i; });
  const migrated = values.slice(1).map((row) => headers.map((h) => (h in idx ? (row[idx[h]] ?? "") : "")));
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${name}'!A1`, valueInputOption: "RAW", requestBody: { values: [headers, ...migrated] } });
  console.log(`  [migrate] ${name}: header ${cur.length}→${headers.length} cột, giữ ${migrated.length} dòng.`);
}

/** Append rows (giữ lịch sử) — tạo tab + header nếu chưa có; không clear. */
async function appendTab(sheets, titles, name, headers, rows) {
  const toRow = (r) => headers.map((h) => { const v = r[h]; return v === undefined || v === null ? "" : String(v); });
  if (!titles.includes(name)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: name } } }] } });
    titles.push(name);
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${name}'!A1`, valueInputOption: "RAW", requestBody: { values: [headers] } });
  } else {
    await reconcileHeader(sheets, name, headers);
  }
  if (!rows.length) { console.log(`  [OK] ${name}: +0 dòng`); return; }
  await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `'${name}'!A1`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: rows.map(toRow) } });
  console.log(`  [OK] ${name}: +${rows.length} dòng (append)`);
}

/* ============================================================
   COMPETITORS — đọc watchlist
   ============================================================ */
const DEFAULT_COMPETITORS = [
  { brand_name: "Bệnh viện JW Hàn Quốc", page_ids: "101055868985301|400844936646543", page_urls: "https://www.facebook.com/benhvienjw.vn", active: "TRUE", notes: "default" },
  { brand_name: "Viện Thẩm Mỹ LG Clinic", page_ids: "138495609852248", page_urls: "https://www.facebook.com/vienthammylgclinic", active: "TRUE", notes: "default" },
  { brand_name: "Bệnh viện Thẩm mỹ Kangnam", page_ids: "359285057508884", page_urls: "https://www.facebook.com/Thammykangnam", active: "TRUE", notes: "default" },
  { brand_name: "Thẩm mỹ viện Ngọc Dung", page_ids: "105431292369518|372398605948395|108877052096057", page_urls: "https://www.facebook.com/ngocdungbeautycenter", active: "TRUE", notes: "default" },
  { brand_name: "Pensilia Beauty Clinic", page_ids: "291660597514323|108600987972847", page_urls: "https://www.facebook.com/pensilia", active: "TRUE", notes: "default" },
  { brand_name: "Thẩm mỹ Thu Cúc", page_ids: "101804119684503|500793556456269|938714509514807", page_urls: "https://www.facebook.com/thammythucuc.com.vn/", active: "TRUE", notes: "default" },
  { brand_name: "Thẩm mỹ Đông Á", page_ids: "160104667517819|102483108454334", page_urls: "https://www.facebook.com/ThamMyDongA/", active: "TRUE", notes: "default" },
  { brand_name: "Bệnh viện Thẩm mỹ Gangwhoo", page_ids: "112411351351957", page_urls: "https://www.facebook.com/benhvienthammygangwhoo", active: "TRUE", notes: "default" },
  { brand_name: "Shynh House", page_ids: "422033221305938", page_urls: "https://www.facebook.com/vienchamsocdaspashynhhouse", active: "TRUE", notes: "default" },
  { brand_name: "Lavender By Chang", page_ids: "887334961357859", page_urls: "https://www.facebook.com/LavenderByChang/", active: "TRUE", notes: "default" },
  { brand_name: "Thẩm mỹ viện Seoul Center", page_ids: "322462184801000", page_urls: "https://www.facebook.com/thammyvienseoulcenter/", active: "TRUE", notes: "default" },
  { brand_name: "Lux Beauty Center", page_ids: "103915115173880", page_urls: "https://www.facebook.com/deluxbeautycenter/", active: "TRUE", notes: "default" },
  { brand_name: "SeoulSpa.Vn", page_ids: "108687825073367", page_urls: "https://www.facebook.com/SeoulSpa.Vn", active: "TRUE", notes: "default" },
];

function isTrue(v) { return ["true", "1", "yes", "x", "có"].includes(String(v || "").trim().toLowerCase()); }

async function loadCompetitors(sheets) {
  const rows = await readTabObjects(sheets, "Competitors");
  let source = rows;
  if (!rows.length) {
    if (PROVIDER === "mock") {
      warn("Tab `Competitors` trống/không tồn tại — dùng DEFAULT_COMPETITORS (5 brand) để test (provider=mock).");
      source = DEFAULT_COMPETITORS;
    } else {
      warn("Tab `Competitors` trống/không tồn tại — không có brand để xử lý.");
      return [];
    }
  }
  const out = [];
  for (const r of source) {
    const brand = String(r.brand_name || "").trim();
    if (!brand) continue;
    if (!isTrue(r.active)) continue; // chỉ active=TRUE
    const pageIds = String(r.page_ids || "").split("|").map((s) => s.trim()).filter(Boolean);
    if (!pageIds.length) { warn(`Brand "${brand}" thiếu page_ids — skip (không bịa page_id).`); continue; }
    out.push({ brand_name: brand, page_ids: pageIds, page_urls: String(r.page_urls || "").trim(), notes: String(r.notes || "") });
  }
  return out;
}

/* ============================================================
   4) CLASSIFICATION — từ headline + primary_text + description
   ============================================================ */
const SERVICE_KEYWORDS = [
  ["skin_analysis", ["soi da", "phân tích da", "skin analysis", "đánh giá da"]],
  ["melasma_treatment", ["nám", "tàn nhang", "melasma"]],
  ["pigmentation_treatment", ["sạm", "thâm", "sắc tố", "đốm nâu", "pigment"]],
  ["acne_treatment", ["mụn", "acne", "trị mụn"]],
  ["laser_treatment", ["laser", "pico", "co2"]],
  ["collagen_stimulation", ["collagen", "kích thích collagen", "tái tạo"]],
  ["lifting_firming", ["nâng cơ", "căng da", "lifting", "hifu", "thermage", "săn chắc", "trắng"]],
  ["filler_botox", ["filler", "botox", "tiêm"]],
  ["facial_contouring", ["gọt", "vline", "v-line", "tạo hình mặt", "thon gọn mặt"]],
  ["body_slimming", ["giảm béo", "giảm mỡ", "thon gọn", "slimming"]],
  ["hair_removal", ["triệt lông", "wax"]],
  ["surgery", ["phẫu thuật", "nâng mũi", "cắt mí", "thẩm mỹ mắt", "độn cằm", "surgery"]],
  ["dental_aesthetics", ["răng", "niềng", "veneer", "nha khoa"]],
  ["anti_aging_consultation", ["chống lão hóa", "anti aging", "lão hóa", "trẻ hóa"]],
  ["hormone_biology_assessment", ["nội tiết", "hormone", "sinh học", "nền tảng sinh học"]],
  ["nutrition_lifestyle", ["dinh dưỡng", "lối sống", "nutrition"]],
  ["facial_rejuvenation", ["trẻ hóa da", "tươi trẻ", "rejuvenation", "phục hồi da", "da"]],
];
const FORMAT_KEYWORDS = [
  ["doctor_explainer", ["bác sĩ", "ts.bs", "bs.", "chuyên gia giải thích", "doctor"]],
  ["before_after", ["trước sau", "before after", "before/after", "sau 1 liệu trình", "kết quả sau"]],
  ["offer_promotion", ["ưu đãi", "khuyến mãi", "giảm giá", "chỉ còn", "combo", "trọn gói"]],
  ["technology_proof", ["công nghệ", "máy", "chuẩn fda", "technology", "độc quyền"]],
  ["customer_testimonial", ["khách hàng", "review thật", "chia sẻ", "cảm nhận", "testimonial"]],
  ["kol_review", ["kol", "koc", "diễn viên", "hoa hậu", "nghệ sĩ", "celeb"]],
  ["educational_post", ["bạn có biết", "kiến thức", "giải thích", "vì sao", "tại sao"]],
  ["problem_solution", ["giải pháp", "khắc phục", "nỗi lo", "vấn đề"]],
  ["facility_trust", ["cơ sở", "phòng khám", "bệnh viện", "không gian", "trang thiết bị"]],
  ["consultation_lead", ["tư vấn", "đặt lịch", "đăng ký", "liên hệ"]],
  ["service_demo", ["quy trình", "trải nghiệm dịch vụ", "demo"]],
  ["seasonal_campaign", ["tết", "hè", "8/3", "20/10", "noel", "mùa"]],
  ["ugc_style", ["tự quay", "vlog", "nhật ký"]],
];
const HOOK_KEYWORDS = [
  ["fear_based", ["lão hóa nhanh", "chảy xệ", "già đi", "đáng sợ", "cảnh báo", "đừng để quá muộn"]],
  ["offer_led", ["chỉ còn", "ưu đãi", "giảm", "khuyến mãi", "combo", "miễn phí", "trọn gói"]],
  ["doctor_authority", ["bác sĩ", "ts.bs", "chuyên gia", "phác đồ", "y khoa"]],
  ["transformation_led", ["lột xác", "thay đổi ngoạn mục", "trước sau", "kết quả rõ rệt"]],
  ["social_proof", ["hàng nghìn", "khách hàng tin tưởng", "5 sao", "review", "đánh giá"]],
  ["education_led", ["bạn có biết", "vì sao", "tại sao", "cơ chế", "hiểu đúng"]],
  ["premium_positioning", ["cao cấp", "đẳng cấp", "chuẩn quốc tế", "sang trọng", "luxury"]],
  ["consultation_led", ["tư vấn", "đặt lịch", "đăng ký nhận"]],
  ["problem_led", ["nám", "mụn", "nếp nhăn", "thâm", "lo lắng", "nỗi lo"]],
  ["curiosity", ["bí mật", "điều ít ai biết", "sự thật", "bất ngờ"]],
];
const PRICE_TOKEN = /(\d[\d.,]*\s?(?:k|K|đ|tr|triệu|VNĐ|vnđ|%))/g;
const OFFER_WORDS = ["giảm", "ưu đãi", "tặng", "miễn phí", "combo", "trọn gói", "khuyến mãi"];

function lc(s) { return String(s || "").toLowerCase(); }
function matchFirst(text, table, fallback) {
  const t = lc(text);
  for (const [label, kws] of table) if (kws.some((k) => t.includes(k))) return label;
  return fallback;
}
function detectPrice(text) {
  const m = String(text || "").match(PRICE_TOKEN);
  if (!m) return "unknown";
  const prices = [...new Set(m.map((x) => x.trim()).filter((x) => /\d/.test(x) && (/k|đ|tr|triệu|vnđ/i.test(x))))];
  return prices.length ? prices.slice(0, 3).join("|") : "unknown";
}
function detectOffer(text) {
  const t = lc(text);
  const hit = OFFER_WORDS.filter((w) => t.includes(w));
  if (!hit.length) return "no_clear_offer";
  const price = detectPrice(text);
  return price !== "unknown" ? `${hit[0]} ${price.split("|")[0]}` : hit.join("|");
}

const ANGLE_BY_HOOK = {
  fear_based: "fear_aging", offer_led: "price_promotion", doctor_authority: "medical_authority",
  transformation_led: "transformation", social_proof: "social_proof", education_led: "education",
  premium_positioning: "premium", consultation_led: "consultation", problem_led: "problem_solution",
  curiosity: "curiosity", unknown: "unknown",
};
const PROOF_BY_FORMAT = {
  doctor_explainer: "doctor_expert", before_after: "before_after", technology_proof: "technology_machine",
  customer_testimonial: "customer_testimonial", kol_review: "KOL_celebrity", offer_promotion: "price_proof",
  facility_trust: "clinic_facility", educational_post: "scientific_explanation",
};
const FUNNEL_BY_HOOK = {
  offer_led: "conversion", transformation_led: "conversion", social_proof: "consideration",
  doctor_authority: "consideration", education_led: "awareness", premium_positioning: "consideration",
  consultation_led: "conversion", problem_led: "awareness", curiosity: "awareness", fear_based: "awareness",
};

/* ============================================================
   3b) AD FORMAT & FUNNEL inference (chỉ suy luận từ public data)
   ------------------------------------------------------------
   KHÔNG khẳng định campaign objective chính thức; chỉ inferred_objective
   kèm objective_confidence + evidence. Thiếu dữ liệu -> unknown.
   ============================================================ */
const round2 = (n) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

/** Service category cho ad — gắn skin_rejuvenation nếu thuộc nhóm trẻ hóa. */
const SKIN_REJU_SERVICES = new Set([
  "facial_rejuvenation", "anti_aging_consultation", "collagen_stimulation",
  "lifting_firming", "skin_analysis",
]);
// Dịch vụ RÕ RÀNG KHÔNG phải trẻ hóa da mặt — loại cứng dù text có lẫn keyword da
// (vd ad "giảm mỡ" có nhắc collagen). Tránh lọt giảm béo/nâng ngực/triệt lông/răng/phẫu thuật.
const NON_SKIN_SERVICES = new Set([
  "body_slimming", "hair_removal", "surgery", "dental_aesthetics", "facial_contouring", "filler_botox",
]);
// Từ khóa dịch vụ khác ngay trong text (loại cứng kể cả khi service_or_product đoán nhầm sang da).
const NON_SKIN_TEXT_RE = /giảm béo|giảm mỡ|hút mỡ|nâng ngực|độn cằm|nâng mũi|cắt mí|gọt hàm|v-?line|triệt lông|niềng răng|bọc răng|trồng răng/i;
// VÙNG CƠ THỂ (không phải da MẶT): loại cứng dù text có "trẻ hóa/collagen/căng da".
// Bắt các ad kiểu "khử thâm/sần mông, cellulite, rạn da, vòng eo…" bị gắn nhầm là trẻ hóa da.
const BODY_AREA_RE = /mông|đùi|bắp tay|bắp chân|cellulite|sần vỏ cam|rạn da|thâm mông|toàn thân|vùng kín|mỡ bụng|vòng eo|vòng 1|vòng 2|vòng 3|\bbụng\b|tắm trắng (toàn thân|body)/i;
function inferServiceCategory(ad) {
  const svc = String(ad.service_or_product || "");
  const t = lc([ad.headline, ad.primary_text, ad.hook_text].join(" "));
  // 1) Loại cứng: dịch vụ khác (service/text) HOẶC nhắm vùng cơ thể (không phải da mặt).
  if (NON_SKIN_SERVICES.has(svc) || NON_SKIN_TEXT_RE.test(t) || BODY_AREA_RE.test(t)) return "other";
  // 2) Trẻ hóa da mặt.
  if (SKIN_REJU_SERVICES.has(svc)) return SERVICE_CATEGORY;
  if (/trẻ hóa|căng bóng|tái tạo da|hifu|thermage|ultherapy|\brf\b|skin booster|collagen|nâng cơ|exosome|mesotherapy/i.test(t)) return SERVICE_CATEGORY;
  return "other";
}

/** ad_format enum: image | video | carousel | collection | text_only | unknown. */
function inferAdFormat(raw) {
  const media = lc(raw.media_type || raw.creative_type);
  const carouselN = Array.isArray(raw.carousel_image_urls) ? raw.carousel_image_urls.length : 0;
  const imgs = Array.isArray(raw.image_urls) ? raw.image_urls.length : (raw.image_urls ? 1 : 0);
  const hasVideo = !!raw.video_preview_url || /video|reel/.test(media);
  const hasCarousel = carouselN > 1 || imgs > 1 || /carousel|dco/.test(media);
  const hasImage = imgs > 0 || !!raw.thumbnail_url || !!raw.media_url || /image|img|photo/.test(media);

  let ad_format = "unknown", conf = 0.4;
  if (/collection/.test(media)) { ad_format = "collection"; conf = 0.7; }
  else if (hasCarousel) { ad_format = "carousel"; conf = 0.8; }
  else if (hasVideo) { ad_format = "video"; conf = /video|reel/.test(media) ? 0.9 : 0.6; }
  else if (hasImage) { ad_format = "image"; conf = media ? 0.8 : 0.6; }
  else if (raw.primary_text || raw.headline) { ad_format = "text_only"; conf = 0.5; }

  const hasAsset = !!(raw.media_url || raw.video_preview_url || imgs || raw.thumbnail_url);
  return {
    ad_format, ad_format_confidence: round2(conf),
    has_video: hasVideo ? "TRUE" : "FALSE",
    has_image: hasImage ? "TRUE" : "FALSE",
    has_carousel: hasCarousel ? "TRUE" : "FALSE",
    media_asset_quality: hasAsset ? (hasVideo || imgs > 1 ? "rich" : "ok") : "missing",
  };
}

/** inferred_objective enum: messenger|landing_page_conversion|lead_form|phone_call|website_traffic|engagement|branding|unknown. */
function inferObjective(raw) {
  const link = lc(raw.link_url || raw.landing_url);
  const ctaText = lc(raw.cta);
  const evidence = [];
  let inferred_objective = "unknown", conf = 0.3;
  if (/m\.me|messenger|facebook\.com\/messages|fb-messenger/.test(link) || /nhắn tin|message|inbox|chat/.test(ctaText)) {
    inferred_objective = "messenger"; conf = 0.7; evidence.push("messenger_link_or_cta");
  } else if (/^tel:|zalo\.me|\/zalo|gọi ngay/.test(link) || /gọi|call now|hotline/.test(ctaText)) {
    inferred_objective = "phone_call"; conf = 0.6; evidence.push("phone_link_or_cta");
  } else if (/lead|\/form|dang-ky|signup|register|đăng-ký/.test(link) || /đăng ký|sign up|nhận tư vấn|nhận ưu đãi/.test(ctaText)) {
    inferred_objective = "lead_form"; conf = 0.55; evidence.push("lead_form_signal");
  } else if (/^https?:\/\//.test(link)) {
    if (/book|dat-lich|đặt-lịch|booking|order|mua|checkout|landing/.test(link + " " + ctaText)) { inferred_objective = "landing_page_conversion"; conf = 0.6; evidence.push("conversion_landing_link"); }
    else { inferred_objective = "website_traffic"; conf = 0.5; evidence.push("external_link"); }
  } else if (/tìm hiểu|learn more|xem thêm/.test(ctaText)) {
    inferred_objective = "website_traffic"; conf = 0.4; evidence.push("learn_more_cta");
  }
  let destination_type = "unknown";
  if (inferred_objective === "messenger") destination_type = "messenger";
  else if (inferred_objective === "phone_call") destination_type = "phone";
  else if (inferred_objective === "lead_form") destination_type = "lead_form";
  else if (link) destination_type = "website";
  return {
    inferred_objective, objective_confidence: round2(conf),
    objective_evidence: evidence.join("|") || "insufficient_public_data",
    destination_type, destination_url: raw.link_url || raw.landing_url || "",
  };
}

/* ============================================================
   3) SCALE detection
   ============================================================ */
function scaleByDuration(days) {
  if (days >= 60) return { level: 4, label: "evergreen_winner" };
  if (days >= 30) return { level: 3, label: "strong_scale" };
  if (days >= 14) return { level: 2, label: "early_scale" };
  return { level: 1, label: "testing" };
}
function clusterKey(a) {
  return [a.brand_name, a.service_or_product, a.content_format, a.content_angle, a.offer_detected].join("|");
}

/* ============================================================
   ADS PROVIDERS
   ============================================================ */
function mockAdsForBrand(brand) {
  // mẫu nội dung tiếng Việt để classifier hoạt động; ad_id ổn định để so tuần.
  const TEMPLATES = {
    "Bệnh viện JW Hàn Quốc": [
      { suffix: "JW-1", daysAgo: 80, media: "video", headline: "TS.BS Tú Dung giải thích cấu trúc gương mặt", text: "Bác sĩ phân tích cơ chế lão hóa và vì sao cần hiểu cấu trúc trước khi trẻ hóa.", cta: "Tìm hiểu thêm" },
      { suffix: "JW-2", daysAgo: 25, media: "video", headline: "Phác đồ trẻ hóa cá nhân hóa cùng bác sĩ", text: "Đăng ký tư vấn cùng chuyên gia y khoa, hiểu đúng làn da của bạn.", cta: "Đặt lịch" },
    ],
    "Viện Thẩm Mỹ LG Clinic": [
      { suffix: "LG-1", daysAgo: 44, media: "image", headline: "Trị nám chỉ 449K", text: "Ưu đãi combo trị nám 449K (gốc 5.000K), giảm sâu, công nghệ laser độc quyền.", cta: "Nhận ưu đãi" },
      { suffix: "LG-2", daysAgo: 10, media: "image", headline: "Triệt lông trọn gói mùa hè", text: "Combo triệt lông tặng 2 buổi, khuyến mãi có hạn.", cta: "Đăng ký" },
    ],
    "Bệnh viện Thẩm mỹ Kangnam": [
      { suffix: "KN-1", daysAgo: 24, media: "video", headline: "Cắt mí 30 phút - đôi mắt trẻ trung", text: "Kết quả trước sau tự nhiên, phẫu thuật mắt chuẩn Hàn.", cta: "Tư vấn" },
      { suffix: "KN-2", daysAgo: 62, media: "image", headline: "Hành trình trẻ hóa đôi mắt cùng KOL", text: "Diễn viên chia sẻ review thật sau liệu trình.", cta: "Xem thêm" },
    ],
    "Thẩm mỹ viện Ngọc Dung": [
      { suffix: "ND-1", daysAgo: 6, media: "image", headline: "Chăm sóc da chuẩn spa", text: "Trải nghiệm dịch vụ chăm sóc da, kiến thức làm đẹp mỗi tuần.", cta: "Đặt lịch" },
    ],
    "Pensilia Beauty Clinic": [
      { suffix: "PEN-1", daysAgo: 20, media: "image", headline: "Combo trải nghiệm 299K", text: "Khách hàng review thật, làn da khỏe hơn sau buổi đầu tiên, combo 299K.", cta: "Nhắn tin" },
    ],
  };
  const tpl = TEMPLATES[brand.brand_name] || [
    { suffix: "GEN-1", daysAgo: 30, media: "image", headline: `${brand.brand_name} - dịch vụ trẻ hóa da`, text: "Tư vấn cá nhân hóa, công nghệ hiện đại.", cta: "Tìm hiểu thêm" },
    { suffix: "GEN-2", daysAgo: 12, media: "video", headline: `${brand.brand_name} - ưu đãi mới`, text: "Ưu đãi combo dịch vụ, đăng ký nhận tư vấn.", cta: "Đăng ký" },
  ];
  const pid = brand.page_ids[0];
  return tpl.map((t) => {
    const start = daysAgoISO(t.daysAgo);
    const adId = `MOCK-${t.suffix}`;
    return {
      page_id: pid,
      page_name: brand.brand_name,
      ad_id: adId,
      ad_snapshot_url: `https://www.facebook.com/ads/library/?id=${adId}`,
      status: "ACTIVE",
      start_date: start,
      media_type: t.media,
      platforms: "Facebook|Instagram",
      headline: t.headline,
      primary_text: t.text,
      description: "",
      cta: t.cta,
    };
  });
}

async function customAdsForBrand(brand) {
  const url = (process.env.ADS_SOURCE_API_URL || "").trim();
  if (!url) { warn(`provider=custom nhưng thiếu ADS_SOURCE_API_URL — skip brand "${brand.brand_name}".`); return []; }
  const apiKey = (process.env.ADS_SOURCE_API_KEY || "").trim();
  const out = [];
  for (const pid of brand.page_ids) {
    const u = new URL(url);
    u.searchParams.set("brand_name", brand.brand_name);
    u.searchParams.set("page_id", pid);
    if (apiKey) u.searchParams.set("key", apiKey);
    try {
      const res = await fetch(u.toString(), { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
      if (!res.ok) { warn(`API ads lỗi HTTP ${res.status} cho "${brand.brand_name}" (page ${pid}).`); continue; }
      const json = await res.json();
      const ads = Array.isArray(json) ? json : (Array.isArray(json.ads) ? json.ads : (Array.isArray(json.data) ? json.data : []));
      for (const a of ads) {
        out.push({
          page_id: pid,
          page_name: a.page_name || brand.brand_name,
          ad_id: String(a.ad_id || a.id || ""),
          ad_snapshot_url: a.ad_snapshot_url || a.snapshot_url || "",
          status: a.status || "ACTIVE",
          start_date: (a.start_date || a.ad_delivery_start_time || "").slice(0, 10),
          media_type: a.media_type || "unknown",
          platforms: Array.isArray(a.platforms) ? a.platforms.join("|") : (a.platforms || "Facebook"),
          headline: a.headline || a.title || "",
          primary_text: a.primary_text || a.body || a.ad_creative_body || "",
          description: a.description || "",
          cta: a.cta || a.call_to_action || "",
        });
      }
    } catch (e) {
      warn(`Không gọi được API ads cho "${brand.brand_name}" (page ${pid}): ${e?.message || e}`);
    }
  }
  return out;
}

/* ---------- ScrapeCreators (Facebook Ad Library) ---------- */
const SC_ADS_URL = "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads";
const SC_COUNTRY = (process.env.ADS_SOURCE_COUNTRY || "VN").trim().toUpperCase();
const SC_MAX_ADS_PER_PAGE = Number(process.env.ADS_SOURCE_MAX_ADS || 80);
function scKeys() {
  return (process.env.ADS_SOURCE_API_KEY || "").split(",").map((s) => s.trim()).filter(Boolean);
}
async function scFetch(pageId, cursor) {
  const keys = scKeys();
  if (!keys.length) throw new Error("Thiếu ADS_SOURCE_API_KEY cho provider=scrapecreators.");
  const u = new URL(SC_ADS_URL);
  u.searchParams.set("pageId", pageId);
  if (SC_COUNTRY) u.searchParams.set("country", SC_COUNTRY);
  if (cursor) u.searchParams.set("cursor", cursor);
  let lastErr = "";
  for (const key of keys) { // rotation khi 1 key hết credit
    const res = await fetch(u.toString(), { headers: { "x-api-key": key } });
    if (res.status === 402 || res.status === 429) { lastErr = `HTTP ${res.status}`; continue; }
    if (!res.ok) { lastErr = `HTTP ${res.status}`; break; }
    const json = await res.json();
    if (json.success === false) {
      if (/credit/i.test(json.message || "")) { lastErr = json.message; continue; }
      throw new Error(json.message || "ScrapeCreators error");
    }
    return json;
  }
  throw new Error(lastErr || "ScrapeCreators: tất cả key đều lỗi/hết credit.");
}
function unixToISO(sec) {
  if (!sec) return "";
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString().slice(0, 10);
}
/** Vân tay ảnh ổn định (tên file fbcdn, bỏ query token) -> dedup creative trùng. */
function imageFingerprint(url) {
  if (!url) return "";
  const path = String(url).split("?")[0];
  const file = path.split("/").pop() || "";
  const m = file.match(/^([0-9]+_[0-9]+)/); // <id>_<id>
  return m ? m[1] : file;
}
function mapScAd(a, brand, pageId) {
  const s = a.snapshot || {};
  const platforms = Array.isArray(a.publisher_platform) ? a.publisher_platform.join("|") : (a.publisher_platform || "Facebook");
  const media = s.display_format || ((s.videos || []).length ? "VIDEO" : "IMAGE");
  const body = (s.body && (s.body.text || (typeof s.body === "string" ? s.body : ""))) || s.caption || "";
  const imgs = s.images || [];
  const vids = s.videos || [];
  const cards = s.cards || [];
  const img = imgs[0] || {};
  const vid = vids[0] || {};
  const card = cards[0] || {};
  const thumbnail_url = img.resized_image_url || img.original_image_url || vid.video_preview_image_url || card.resized_image_url || card.original_image_url || card.video_preview_image_url || "";
  const media_url = vid.video_hd_url || vid.video_sd_url || img.original_image_url || thumbnail_url || "";
  const image_urls = imgs.map((x) => x.resized_image_url || x.original_image_url).filter(Boolean);
  const video_preview_url = vid.video_preview_image_url || "";
  const carousel_image_urls = cards.map((c) => c.resized_image_url || c.original_image_url || c.video_preview_image_url).filter(Boolean);
  return {
    page_id: a.page_id || pageId,
    page_name: a.page_name || brand.brand_name,
    ad_id: String(a.ad_archive_id || a.ad_id || ""),
    ad_snapshot_url: a.url || (a.ad_archive_id ? `https://www.facebook.com/ads/library/?id=${a.ad_archive_id}` : ""),
    status: a.is_active ? "ACTIVE" : "INACTIVE",
    start_date: unixToISO(a.start_date),
    media_type: String(media).toLowerCase(),
    platforms,
    headline: s.title || "",
    primary_text: body,
    description: s.link_description || "",
    cta: s.cta_text || s.cta_type || "",
    link_url: s.link_url || "",
    // ---- media thật + grouping ----
    thumbnail_url,
    media_url,
    image_urls,
    video_preview_url,
    carousel_image_urls,
    collation_id: a.collation_id ? String(a.collation_id) : "",
    image_fingerprint: imageFingerprint(thumbnail_url),
    // ---- raw để archive ----
    _raw: a,
  };
}
async function scrapeCreatorsAdsForBrand(brand) {
  const out = [];
  let errored = false, pagesOk = 0, pagesFail = 0;
  const pageLogs = [];
  for (const pageId of brand.page_ids) {
    let cursor = undefined, pages = 0, ok = false, errMsg = "";
    const startedAt = nowISO();
    const before = out.length;
    try {
      do {
        const json = await scFetch(pageId, cursor);
        const ads = json.results || json.ads || [];
        for (const a of ads) out.push(mapScAd(a, brand, pageId));
        cursor = json.cursor || json.nextCursor || json.next_cursor || undefined;
        pages++; ok = true;
      } while (cursor && out.length < SC_MAX_ADS_PER_PAGE && pages < 5);
    } catch (e) {
      errored = true; errMsg = String(e?.message || e);
      warn(`ScrapeCreators lỗi cho "${brand.brand_name}" (page ${pageId}): ${errMsg}`);
    }
    if (ok) pagesOk++; else pagesFail++;
    pageLogs.push({ brand: brand.brand_name, page_id: pageId, status: ok ? "ok" : "error", ads_fetched: out.length - before, error_message: errMsg, started_at: startedAt, finished_at: nowISO() });
  }
  return { ads: out, errored, pagesOk, pagesFail, pageLogs };
}

/** Page logs giả lập cho provider không-per-page (mock/custom): 1 log/page. */
function fakePageLogs(brand, ads, ok) {
  const ts = nowISO();
  return brand.page_ids.map((pid) => ({ brand: brand.brand_name, page_id: pid, status: ok ? "ok" : "error", ads_fetched: ads.filter((a) => String(a.page_id) === String(pid)).length, error_message: "", started_at: ts, finished_at: ts }));
}

/** Trả { ads, errored, pagesOk, pagesFail, pageLogs }. errored=true khi lỗi API. */
async function pullAds(brand) {
  const nPages = brand.page_ids.length;
  if (PROVIDER === "mock") { const ads = mockAdsForBrand(brand); return { ads, errored: false, pagesOk: nPages, pagesFail: 0, pageLogs: fakePageLogs(brand, ads, true) }; }
  if (PROVIDER === "scrapecreators") return scrapeCreatorsAdsForBrand(brand);
  if (PROVIDER === "custom") { const ads = await customAdsForBrand(brand); return { ads, errored: false, pagesOk: nPages, pagesFail: 0, pageLogs: fakePageLogs(brand, ads, true) }; }
  warn(`ADS_SOURCE_PROVIDER="${PROVIDER}" không hỗ trợ — không bịa dữ liệu, bỏ qua "${brand.brand_name}".`);
  return { ads: [], errored: false, pagesOk: 0, pagesFail: nPages, pageLogs: fakePageLogs(brand, [], false) };
}

/* ============================================================
   ANALYZE — raw ad -> Ad Level row
   ============================================================ */
function adText(raw) { return [raw.headline, raw.primary_text, raw.description].join(" \n "); }

/** Phần phân tích text (AI/heuristic) — tách riêng để CHECK-BEFORE-ANALYSIS reuse từ cache. */
function computeTextAnalysis(raw) {
  const text = adText(raw);
  const service = matchFirst(text, SERVICE_KEYWORDS, "unknown");
  const format = matchFirst(text, FORMAT_KEYWORDS, "unknown");
  const hook = matchFirst(text, HOOK_KEYWORDS, "unknown");
  return {
    hook_type: hook, service_or_product: service, content_format: format,
    content_angle: ANGLE_BY_HOOK[hook] || "unknown", proof_point: PROOF_BY_FORMAT[format] || "unknown",
    funnel_stage: FUNNEL_BY_HOOK[hook] || "consideration",
    offer_detected: detectOffer(text), price_detected: detectPrice(text),
  };
}
function hashAd(raw) {
  return {
    content_hash: buildContentHash({ ...raw, ad_id: raw.ad_id, offer_detected: detectOffer(adText(raw)) }),
    visual_hash: buildVisualHash({ ...raw, creative_type: String(raw.media_type || "").toLowerCase() }),
  };
}

/** opts.reuse = text-analysis từ cache (cache hit -> KHÔNG phân tích lại). opts.hashes = precomputed. */
function analyzeAd(raw, brand, weekDate, prevAdIds, opts = {}) {
  const days = daysActive(raw.start_date);
  const sc = scaleByDuration(days);
  const adId = raw.ad_id || `${brand.brand_name}-${raw.start_date}`;
  const ta = opts.reuse || computeTextAnalysis(raw);
  const { content_hash, visual_hash } = opts.hashes || hashAd(raw);
  const fmt = inferAdFormat(raw);
  const obj = inferObjective(raw);
  const base = {
    week_date: weekDate,
    brand_name: brand.brand_name,
    page_id: raw.page_id || "",
    page_name: raw.page_name || brand.brand_name,
    ad_id: adId,
    ad_snapshot_url: raw.ad_snapshot_url || "",
    status: raw.status || "ACTIVE",
    start_date: raw.start_date || "",
    days_active: days,
    media_type: raw.media_type || "unknown",
    platforms: raw.platforms || "Facebook",
    headline: raw.headline || "",
    primary_text: raw.primary_text || "",
    hook_text: (raw.headline || raw.primary_text || "").slice(0, 160),
    hook_type: ta.hook_type,
    service_or_product: ta.service_or_product,
    price_detected: ta.price_detected,
    offer_detected: ta.offer_detected,
    content_format: ta.content_format,
    content_angle: ta.content_angle,
    proof_point: ta.proof_point,
    cta: raw.cta || "",
    funnel_stage: ta.funnel_stage,
    is_new_this_week: prevAdIds.has(adId) ? "false" : "true",
    was_seen_previous_week: prevAdIds.has(adId) ? "true" : "false",
    is_likely_scaled: "false", // điều chỉnh sau khi cluster
    scale_level: sc.level,
    scale_reason: "",
    notes: "",
    // media thật + grouping (chỉ dùng cho visual/archive)
    thumbnail_url: raw.thumbnail_url || "",
    media_url: raw.media_url || "",
    image_urls: raw.image_urls || [],
    video_preview_url: raw.video_preview_url || "",
    carousel_image_urls: raw.carousel_image_urls || [],
    collation_id: raw.collation_id || "",
    image_fingerprint: raw.image_fingerprint || "",
    landing_url: raw.link_url || "",
    content_hash,
    visual_hash,
    _raw: raw._raw,
    _reused: !!opts.reuse,
    _scaleLabel: sc.label,
  };
  // ---- ad format & funnel (section 4) ----
  base.ad_format = fmt.ad_format;
  base.ad_format_confidence = fmt.ad_format_confidence;
  base.has_video = fmt.has_video;
  base.has_image = fmt.has_image;
  base.has_carousel = fmt.has_carousel;
  base.media_asset_quality = fmt.media_asset_quality;
  base.inferred_objective = obj.inferred_objective;
  base.objective_confidence = obj.objective_confidence;
  base.objective_evidence = obj.objective_evidence;
  base.destination_type = obj.destination_type;
  base.destination_url = obj.destination_url;
  base.service_category = inferServiceCategory({ ...base, ...ta });
  // ---- deep hook analysis (section 2) ----
  const hk = analyzeHook(base);
  delete hk._claim;
  Object.assign(base, hk);
  return base;
}

/** Danh sách ad_id bị AI vision loại (ảnh/nội dung thực ra là body/dịch vụ khác).
 *  Nạp từ scripts/vision_excludes.json (mảng ad_id, hoặc {excludeIds:[...]}). */
const VISION_EXCLUDES = (() => {
  try {
    const p = new URL("./vision_excludes.json", import.meta.url);
    if (!fs.existsSync(p)) return new Set();
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const ids = Array.isArray(raw) ? raw : (raw.excludeIds || raw.ids || []);
    return new Set(ids.map((x) => String(x).trim()).filter(Boolean));
  } catch { return new Set(); }
})();

/** PHẠM VI SPY: chỉ giữ ad căng da / trẻ hóa da mặt (skin_rejuvenation), loại dịch vụ khác.
 *  + loại ad_id do AI vision đánh dấu (ảnh thực ra là body/dịch vụ khác).
 *  ADS_SCOPE=all -> bỏ qua lọc service (vẫn áp vision excludes). Log để minh bạch. */
function scopeAds(ads, brandName) {
  const kept = ads.filter((a) =>
    (ADS_SCOPE === "all" || a.service_category === SERVICE_CATEGORY) && !VISION_EXCLUDES.has(String(a.ad_id)),
  );
  const dropped = ads.length - kept.length;
  if (dropped > 0) console.log(`    ↳ scope trẻ hóa da: "${brandName}" bỏ ${dropped}/${ads.length} ad dịch vụ khác (giữ ${kept.length}).`);
  return kept;
}

function applyScale(ads) {
  const sizes = {};
  for (const a of ads) { const k = clusterKey(a); sizes[k] = (sizes[k] || 0) + 1; }
  for (const a of ads) {
    const repeats = sizes[clusterKey(a)] > 1;
    const likely = a.days_active >= 14 || repeats;
    a.is_likely_scaled = likely ? "true" : "false";
    const bits = [`${a.days_active}d`, a._scaleLabel];
    if (repeats) bits.push(`cluster x${sizes[clusterKey(a)]}`);
    a.scale_reason = likely ? `Có thể đang nhân rộng dựa trên thời lượng + lặp lại (${bits.join(", ")})` : `${bits.join(", ")}`;
    delete a._scaleLabel;
  }
  return ads;
}

/* ============================================================
   AGGREGATE — Snapshot / Scaled / Recommendations
   ============================================================ */
const HEADERS = {
  ad: "week_date,brand_name,page_id,page_name,ad_id,ad_snapshot_url,status,start_date,days_active,media_type,platforms,headline,primary_text,hook_text,hook_type,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,cta,funnel_stage,is_new_this_week,was_seen_previous_week,is_likely_scaled,scale_level,scale_reason,notes,content_hash,visual_hash,analysis_status,reused_from_cache,analysis_version,last_analyzed_at,ad_format,ad_format_confidence,has_video,has_image,has_carousel,media_asset_quality,inferred_objective,objective_confidence,objective_evidence,destination_type,destination_url,service_category,hook_raw_text,hook_normalized,hook_category,hook_subcategory,hook_formula,hook_emotional_trigger,hook_pain_point,hook_desired_outcome,hook_promise,hook_proof_type,hook_offer_linked,hook_target_audience,hook_funnel_stage,hook_angle,hook_strength_score,hook_clarity_score,hook_specificity_score,hook_urgency_score,hook_trust_score,hook_risk_score,hook_confidence_score,hook_evidence".split(","),
  snapshot: "week_date,brand_name,page_urls,page_ids,total_active_ads,total_ads_collected,num_pages_running,services_running,prices_detected,offers_detected,main_content_formats,main_hooks,main_angles,main_proof_points,main_ctas,scaled_content_count,new_ads_count,stopped_ads_count,content_strategy_summary,weekly_change_summary,seryn_opportunity,skin_rejuvenation_ads_count,skin_rejuvenation_image_ads,skin_rejuvenation_video_ads,skin_rejuvenation_carousel_ads,skin_rejuvenation_image_rate,skin_rejuvenation_video_rate,skin_rejuvenation_carousel_rate,skin_rejuvenation_messenger_ads,skin_rejuvenation_landing_page_conversion_ads,skin_rejuvenation_lead_form_ads,skin_rejuvenation_phone_call_ads,skin_rejuvenation_unknown_objective_ads,skin_rejuvenation_messenger_rate,skin_rejuvenation_landing_page_conversion_rate,skin_rejuvenation_lead_form_rate,skin_rejuvenation_phone_call_rate,skin_rejuvenation_unknown_objective_rate,skin_rejuvenation_top_format,skin_rejuvenation_top_inferred_objective,skin_rejuvenation_format_objective_pattern,skin_rejuvenation_confidence_score".split(","),
  scaled: "week_date,brand_name,content_cluster_id,representative_ad_id,representative_hook,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,number_of_similar_ads,longest_days_active,average_days_active,scale_level,why_it_is_scaling,competitor_strategy_interpretation,seryn_should_copy_adapt_counter_avoid,seryn_reframe".split(","),
  change: "week_date,brand_name,active_ads_change,new_ads_count,stopped_ads_count,new_services_detected,removed_services,new_offers_detected,removed_offers,new_content_angles,removed_content_angles,scaled_content_new,scaled_content_still_running,strategic_change_type,change_summary,seryn_implication".split(","),
  // SERYN Content Recommendations — header SUPERSET dùng chung (weekly + opportunity Exa).
  rec: SHARED_HEADERS.contentRecs,
  visual: "ad_id,brand,page_id,creative_type,media_url,thumbnail_url,snapshot_url,image_urls,video_preview_url,carousel_image_urls,has_media_asset,text_overlay_raw,text_overlay_summary,offer_from_visual,claim_from_visual,risk_terms_from_visual,visual_format,visual_angle,human_presence,doctor_presence,before_after_presence,text_overlay_presence,offer_visual_presence,clinical_score,beauty_luxury_score,ugc_score,trust_signal_score,offer_visibility_score,scroll_stop_score,confidence_score,confidence_reason,visual_risk_level,risk_reasons,claim_risk_score,before_after_risk,medical_claim_risk,promotion_claim_risk,visual_insight_summary,seryn_action,creative_signature,cluster_size,content_hash,visual_hash,analysis_status,reused_from_cache,analysis_version,last_analyzed_at,last_seen_date".split(","),
  brandVisual: "brand,week_date,total_creatives,before_after_rate,doctor_rate,ugc_rate,offer_banner_rate,high_risk_rate,avg_clinical_score,avg_luxury_score,top_visual_formats,dominant_visual_angle,notes".split(","),
  visualPattern: "id,week_date,brand,visual_format,visual_angle,hook_type,offer_type,ad_count,is_signal,representative_ad_id,summary,recommended_seryn_response".split(","),
  changeInsight: "id,brand,week_start,previous_week_start,change_type,severity,confidence_score,summary,evidence,affected_ads,previous_value,current_value,recommended_action".split(","),
  cache: "ad_id,brand,page_id,content_hash,visual_hash,analysis_version,analysis_provider,analysis_status,reused_from_cache,text_analysis_json,visual_analysis_json,first_seen_date,last_seen_date,last_analyzed_at".split(","),
  rawArchive: "crawl_run_id,week_date,brand,page_id,ad_id,content_hash,visual_hash,status,source_provider,source_country,first_seen_date,last_seen_date,raw_json".split(","),
  // Crawl Runs — header SUPERSET dùng chung (weekly + exa market/discovery + import).
  crawlRuns: SHARED_HEADERS.crawlRuns,
  pageCrawlLogs: "crawl_run_id,week_date,brand,page_id,status,ads_fetched,error_message,started_at,finished_at".split(","),
  historical: "week_date,brand,active_ads_count,new_ads_count,stopped_ads_count,changed_ads_count,reused_ads_count,top_service,top_hook,top_offer,top_visual_format,crawl_status,snapshot_json".split(","),
  patternCache: "pattern_id,pattern_hash,brand,service_type,hook_type,offer_type,visual_format,visual_angle,first_seen_date,last_seen_date,ads_count,active_days_avg,example_ads,scale_signal".split(","),
};

function uniqJoin(arr) { return [...new Set(arr.filter((x) => x && x !== "unknown" && x !== "no_clear_offer"))].join("|"); }
function topCounts(arr, n = 3) {
  const c = {};
  for (const x of arr) if (x && x !== "unknown") c[x] = (c[x] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k).join("|");
}

function buildSnapshot(brand, ads, scaledClusters, weekDate) {
  const active = ads.filter((a) => String(a.status).toUpperCase() === "ACTIVE");
  return {
    week_date: weekDate,
    brand_name: brand.brand_name,
    page_urls: brand.page_urls,
    page_ids: brand.page_ids.join("|"),
    total_active_ads: active.length,
    total_ads_collected: ads.length,
    num_pages_running: new Set(ads.map((a) => a.page_id).filter(Boolean)).size,
    services_running: uniqJoin(ads.map((a) => a.service_or_product)),
    prices_detected: uniqJoin(ads.map((a) => a.price_detected)),
    offers_detected: uniqJoin(ads.map((a) => a.offer_detected)),
    main_content_formats: topCounts(ads.map((a) => a.content_format)),
    main_hooks: topCounts(ads.map((a) => a.hook_type)),
    main_angles: topCounts(ads.map((a) => a.content_angle)),
    main_proof_points: topCounts(ads.map((a) => a.proof_point)),
    main_ctas: topCounts(ads.map((a) => a.cta)),
    scaled_content_count: scaledClusters.length,
    new_ads_count: ads.filter((a) => a.is_new_this_week === "true").length,
    stopped_ads_count: 0, // tính ở weekly change so với tuần trước
    content_strategy_summary: `${active.length} ad active; format chính: ${topCounts(ads.map((a) => a.content_format)) || "unknown"}.`,
    weekly_change_summary: "",
    seryn_opportunity: "",
    ...skinRejuvenationSummary(ads),
  };
}

/** Tổng hợp format/funnel cho ad trẻ hóa da (gộp vào Brand Weekly Snapshot,
 *  KHÔNG tạo tab Ad Format Funnel Summary riêng). */
function skinRejuvenationSummary(ads) {
  const skin = ads.filter((a) => a.service_category === SERVICE_CATEGORY);
  const n = skin.length;
  const fmt = (f) => skin.filter((a) => a.ad_format === f).length;
  const obj = (o) => skin.filter((a) => a.inferred_objective === o).length;
  const rate = (x) => (n ? Math.round((x / n) * 100) / 100 : 0);
  const img = fmt("image"), vid = fmt("video"), car = fmt("carousel");
  const msg = obj("messenger"), lpc = obj("landing_page_conversion"), lead = obj("lead_form"), phone = obj("phone_call"), unk = obj("unknown");

  const topOfCounts = (pairs) => pairs.filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k)[0] || "unknown";
  const topFormat = topOfCounts([["image", img], ["video", vid], ["carousel", car]]);
  const topObjective = topOfCounts([["messenger", msg], ["landing_page_conversion", lpc], ["lead_form", lead], ["phone_call", phone]]);
  const avg = (key) => (n ? Math.round((skin.reduce((s, a) => s + (Number(a[key]) || 0), 0) / n) * 100) / 100 : 0);

  return {
    skin_rejuvenation_ads_count: n,
    skin_rejuvenation_image_ads: img,
    skin_rejuvenation_video_ads: vid,
    skin_rejuvenation_carousel_ads: car,
    skin_rejuvenation_image_rate: rate(img),
    skin_rejuvenation_video_rate: rate(vid),
    skin_rejuvenation_carousel_rate: rate(car),
    skin_rejuvenation_messenger_ads: msg,
    skin_rejuvenation_landing_page_conversion_ads: lpc,
    skin_rejuvenation_lead_form_ads: lead,
    skin_rejuvenation_phone_call_ads: phone,
    skin_rejuvenation_unknown_objective_ads: unk,
    skin_rejuvenation_messenger_rate: rate(msg),
    skin_rejuvenation_landing_page_conversion_rate: rate(lpc),
    skin_rejuvenation_lead_form_rate: rate(lead),
    skin_rejuvenation_phone_call_rate: rate(phone),
    skin_rejuvenation_unknown_objective_rate: rate(unk),
    skin_rejuvenation_top_format: n ? topFormat : "unknown",
    skin_rejuvenation_top_inferred_objective: n ? topObjective : "unknown",
    skin_rejuvenation_format_objective_pattern: n ? `${topFormat}->${topObjective}` : "unknown",
    skin_rejuvenation_confidence_score: round2((avg("ad_format_confidence") + avg("objective_confidence")) / 2),
  };
}

function buildScaled(brand, ads, weekDate) {
  const groups = {};
  for (const a of ads) { (groups[clusterKey(a)] ||= []).push(a); }
  const out = [];
  let idx = 0;
  for (const [key, group] of Object.entries(groups)) {
    const maxDays = Math.max(...group.map((a) => a.days_active));
    const repeats = group.length >= 2;
    if (!(repeats || maxDays >= 30)) continue; // chỉ giữ cụm có dấu hiệu scale
    const rep = group.slice().sort((a, b) => b.days_active - a.days_active)[0];
    const avg = Math.round(group.reduce((s, a) => s + a.days_active, 0) / group.length);
    const level = scaleByDuration(maxDays).level;
    const action = decideAction(rep);
    out.push({
      week_date: weekDate,
      brand_name: brand.brand_name,
      content_cluster_id: `${brand.brand_name.split(" ")[0]}-CL-${++idx}`,
      representative_ad_id: rep.ad_id,
      representative_hook: rep.hook_text,
      service_or_product: rep.service_or_product,
      price_detected: rep.price_detected,
      offer_detected: rep.offer_detected,
      content_format: rep.content_format,
      content_angle: rep.content_angle,
      proof_point: rep.proof_point,
      number_of_similar_ads: group.length,
      longest_days_active: maxDays,
      average_days_active: avg,
      scale_level: level,
      why_it_is_scaling: `Có thể đang nhân rộng dựa trên thời lượng + lặp lại (${maxDays} ngày, ${group.length} biến thể)`,
      competitor_strategy_interpretation: interpret(rep),
      seryn_should_copy_adapt_counter_avoid: action,
      seryn_reframe: serynReframe(rep, action),
    });
  }
  return out;
}

function decideAction(ad) {
  if (ad.content_angle === "price_promotion" || ad.hook_type === "offer_led") return "counter";
  if (ad.hook_type === "fear_based") return "avoid";
  if (ad.content_format === "doctor_explainer" || ad.hook_type === "education_led") return "adapt";
  if (ad.hook_type === "doctor_authority") return "adapt";
  return "monitor";
}
function interpret(ad) {
  const map = {
    price_promotion: "Đẩy mạnh giá/khuyến mãi để chuyển đổi nhanh.",
    medical_authority: "Dựng uy tín bác sĩ + giáo dục y khoa dài hạn.",
    transformation: "Nhấn kết quả trước-sau để tạo niềm tin nhanh.",
    social_proof: "Dùng KOL/khách hàng làm bằng chứng xã hội.",
    education: "Nội dung giáo dục dẫn dắt nhận thức.",
  };
  return map[ad.content_angle] || "Theo dõi pattern nội dung của đối thủ.";
}

/* ============================================================
   9) SERYN RECOMMENDATIONS — rule-based, an toàn định vị
   ============================================================ */
const BANNED = ["trẻ hóa thần kỳ", "xóa sạch nếp nhăn", "lấy lại thanh xuân", "trẻ hơn 10 tuổi", "inbox ngay"];
const PREFERRED_CTAS = ["Đặt lịch phân tích gương mặt", "Đặt lịch đánh giá nền tảng sinh học", "Tìm hiểu thêm", "Trao đổi với đội ngũ chuyên môn"];
function assertSafe(text) {
  const t = lc(text);
  for (const b of BANNED) if (t.includes(b)) throw new Error(`SERYN guideline vi phạm (cụm cấm: "${b}") trong: ${text}`);
  return text;
}
/** Nhãn dịch vụ tiếng Việt cho câu reframe (tránh lẫn enum tiếng Anh). */
const SERVICE_VI = {
  skin_analysis: "phân tích da", facial_rejuvenation: "trẻ hóa da", melasma_treatment: "điều trị nám",
  pigmentation_treatment: "điều trị sắc tố", acne_treatment: "điều trị mụn", laser_treatment: "điều trị laser",
  collagen_stimulation: "kích thích collagen", lifting_firming: "nâng cơ săn chắc da", filler_botox: "filler/botox",
  facial_contouring: "tạo đường nét gương mặt", body_slimming: "giảm béo", hair_removal: "triệt lông",
  surgery: "phẫu thuật thẩm mỹ", dental_aesthetics: "thẩm mỹ răng", anti_aging_consultation: "chống lão hóa",
  hormone_biology_assessment: "đánh giá nền tảng sinh học", nutrition_lifestyle: "dinh dưỡng & lối sống",
};
function serynReframe(ad, action) {
  const key = String(ad.service_or_product || "");
  const svc = SERVICE_VI[key] || "dịch vụ chăm sóc da";
  const base = {
    counter: `Đừng bắt đầu ${svc} bằng giá — hãy bắt đầu bằng việc hiểu đúng nền tảng sinh học & chỉ định cá nhân hóa.`,
    avoid: `Không hù dọa tuổi tác; SERYN giải thích cơ chế ${svc} một cách điềm tĩnh, dựa trên dữ liệu.`,
    adapt: `Giữ chiều sâu y khoa của ${svc}, nâng lên tầng nền tảng sinh học & đa chuyên khoa của SERYN.`,
    monitor: `Theo dõi ${svc}; khác biệt bằng phân tích cá nhân hóa, tự nhiên và bền vững.`,
  };
  return assertSafe(base[action] || base.monitor);
}

function buildRecommendations(allAds, allScaled, weekDate) {
  const recs = [];
  const angleCount = (a) => allAds.filter((x) => x.content_angle === a).length;
  const fmtCount = (f) => allAds.filter((x) => x.content_format === f).length;
  const brandsWith = (pred) => [...new Set(allAds.filter(pred).map((a) => a.brand_name))];

  // 1) Counter giá nếu đối thủ đẩy khuyến mãi
  if (angleCount("price_promotion") > 0) {
    const ev = brandsWith((a) => a.content_angle === "price_promotion");
    recs.push(assertRec({
      week_date: weekDate, recommendation_type: "counter_price_war",
      market_signal: "Đối thủ đẩy mạnh khuyến mãi giá để chuyển đổi nhanh.",
      competitor_evidence: `Khuyến mãi giá quan sát ở: ${ev.join(", ")}.`,
      seryn_content_niche: "Trẻ hóa từ nền tảng sinh học (không đua giá)",
      suggested_content_format: "doctor_explainer",
      suggested_hook: "Có những thay đổi của làn da không bắt đầu từ một con số khuyến mãi.",
      content_style: "Khoa học, điềm tĩnh, cao cấp",
      main_message: "SERYN không bán giá — SERYN giúp bạn hiểu nền tảng sinh học của chính mình rồi mới chỉ định liệu trình phù hợp.",
      proof_to_use: "bác sĩ chuyên môn|phân tích cá nhân hóa|dữ liệu đo lường được",
      cta: "Đặt lịch đánh giá nền tảng sinh học", kpi: "message-to-booking; lead quality", priority: "High",
    }));
  }
  // 2) Adapt nếu doctor_explainer/education đang scale
  if (fmtCount("doctor_explainer") > 0 || angleCount("education") > 0) {
    const ev = brandsWith((a) => a.content_format === "doctor_explainer" || a.content_angle === "education");
    recs.push(assertRec({
      week_date: weekDate, recommendation_type: "adapt_doctor_education",
      market_signal: "Nội dung bác sĩ/giáo dục y khoa đang được đối thủ dùng dài hạn.",
      competitor_evidence: `Doctor/education content ở: ${ev.join(", ")}.`,
      seryn_content_niche: "Giáo dục nền tảng sinh học & đa chuyên khoa",
      suggested_content_format: "doctor_explainer",
      suggested_hook: "Vì sao hai người cùng tuổi lại lão hóa rất khác nhau?",
      content_style: "Bác sĩ giải thích, gần gũi nhưng chính xác",
      main_message: "Hiểu đúng cơ chế lão hóa từ nền tảng sinh học để chọn lộ trình phù hợp với cơ thể bạn.",
      proof_to_use: "bác sĩ chuyên môn|giải thích khoa học|đa chuyên khoa",
      cta: "Đặt lịch phân tích gương mặt", kpi: "thumb-stop rate; CTR; booking", priority: "High",
    }));
  }
  // 3) Counter transformation/before_after bằng kết quả tự nhiên đo lường được
  if (angleCount("transformation") > 0 || fmtCount("before_after") > 0) {
    const ev = brandsWith((a) => a.content_angle === "transformation" || a.content_format === "before_after");
    recs.push(assertRec({
      week_date: weekDate, recommendation_type: "counter_transformation",
      market_signal: "Đối thủ nhấn mạnh trước-sau/biến đổi nhanh.",
      competitor_evidence: `Transformation content ở: ${ev.join(", ")}.`,
      seryn_content_niche: "Kết quả tự nhiên, bền vững, đo lường được",
      suggested_content_format: "educational_post",
      suggested_hook: "Tự nhiên không có nghĩa là không thấy gì — mà là không lộ can thiệp.",
      content_style: "Tinh tế, trung thực, không phóng đại",
      main_message: "SERYN ưu tiên thay đổi tự nhiên, bền vững và đo lường được thay vì hiệu ứng tức thời.",
      proof_to_use: "phân tích cá nhân hóa|chỉ số đo lường|bác sĩ đa chuyên khoa",
      cta: "Trao đổi với đội ngũ chuyên môn", kpi: "lead quality; booking", priority: "Medium",
    }));
  }
  // 4) Baseline giáo dục nền tảng sinh học (luôn có)
  recs.push(assertRec({
    week_date: weekDate, recommendation_type: "always_on_education",
    market_signal: "Thị trường nhiều nội dung cảm tính/khuyến mãi, thiếu chiều sâu sinh học.",
    competitor_evidence: allScaled.length ? `${allScaled.length} cụm nội dung đang được đối thủ nhân rộng.` : "Quan sát tổng thể thị trường.",
    seryn_content_niche: "TRẺ HÓA TỪ NỀN TẢNG SINH HỌC",
    suggested_content_format: "doctor_explainer",
    suggested_hook: "Da bạn đang phản ánh điều gì về cơ thể bên trong?",
    content_style: "Khoa học, ấm áp, đáng tin",
    main_message: "Trẻ hóa bền vững bắt đầu từ việc hiểu nền tảng sinh học và phân tích cá nhân hóa.",
    proof_to_use: "bác sĩ chuyên môn|đa chuyên khoa|dữ liệu cá nhân hóa",
    cta: "Đặt lịch phân tích gương mặt", kpi: "reach; thumb-stop; booking", priority: "Medium",
  }));
  return recs;
}
function assertRec(r) {
  if (!PREFERRED_CTAS.includes(r.cta)) r.cta = PREFERRED_CTAS[0];
  assertSafe([r.suggested_hook, r.main_message, r.seryn_content_niche].join(" "));
  if (!r.source) r.source = RUN_TYPE.weeklySpy;
  if (r.service_category === undefined) r.service_category = "";
  return r;
}

/* ============================================================
   8) WEEKLY STRATEGY CHANGE — so với tuần trước
   ============================================================ */
function buildChanges(snapshots, ads, prevSnapByBrand, prevAdsByBrand, weekDate) {
  const adsByBrand = {};
  for (const a of ads) (adsByBrand[a.brand_name] ||= []).push(a);
  const out = [];
  for (const snap of snapshots) {
    const b = snap.brand_name;
    const prev = prevSnapByBrand[b];
    const curAds = adsByBrand[b] || [];
    const prevAds = prevAdsByBrand[b] || [];
    if (!prev && !prevAds.length) {
      out.push({
        week_date: weekDate, brand_name: b, active_ads_change: 0,
        new_ads_count: curAds.length, stopped_ads_count: 0,
        new_services_detected: snap.services_running, removed_services: "",
        new_offers_detected: snap.offers_detected, removed_offers: "",
        new_content_angles: snap.main_angles, removed_content_angles: "",
        scaled_content_new: "", scaled_content_still_running: "",
        strategic_change_type: "first_week_no_comparison_available",
        change_summary: "first_week_no_comparison_available",
        seryn_implication: "Thiết lập baseline; tuần sau bắt đầu so sánh thay đổi.",
      });
      continue;
    }
    const curIds = new Set(curAds.map((a) => a.ad_id));
    const prevIds = new Set(prevAds.map((a) => a.ad_id));
    const newAds = [...curIds].filter((id) => !prevIds.has(id));
    const stopped = [...prevIds].filter((id) => !curIds.has(id));
    const prevActive = prev ? Number(prev.total_active_ads || 0) : prevAds.length;
    const change = Number(snap.total_active_ads || 0) - prevActive;
    const setDiff = (cur, pv) => {
      const c = new Set(String(cur || "").split("|").filter(Boolean));
      const p = new Set(String(pv || "").split("|").filter(Boolean));
      return {
        added: [...c].filter((x) => !p.has(x)).join("|"),
        removed: [...p].filter((x) => !c.has(x)).join("|"),
      };
    };
    const svc = setDiff(snap.services_running, prev?.services_running);
    const off = setDiff(snap.offers_detected, prev?.offers_detected);
    const ang = setDiff(snap.main_angles, prev?.main_angles);
    let type = "stable";
    if (change > 0 || newAds.length) type = "expanding";
    if (change < 0 || stopped.length) type = newAds.length ? "rotating_creative" : "pulling_back";
    out.push({
      week_date: weekDate, brand_name: b,
      active_ads_change: change, new_ads_count: newAds.length, stopped_ads_count: stopped.length,
      new_services_detected: svc.added, removed_services: svc.removed,
      new_offers_detected: off.added, removed_offers: off.removed,
      new_content_angles: ang.added, removed_content_angles: ang.removed,
      scaled_content_new: "", scaled_content_still_running: "",
      strategic_change_type: type,
      change_summary: `${change >= 0 ? "+" : ""}${change} active ad; +${newAds.length} mới, -${stopped.length} dừng.`,
      seryn_implication: type === "expanding"
        ? "Đối thủ đang tăng nhiệt — SERYN giữ nhịp nội dung nền tảng sinh học, không chạy theo giá."
        : "Đối thủ xoay/giảm — cơ hội phủ nội dung giáo dục cá nhân hóa của SERYN.",
    });
    // gắn stopped vào snapshot tương ứng
    snap.stopped_ads_count = stopped.length;
    snap.weekly_change_summary = out[out.length - 1].change_summary;
    snap.seryn_opportunity = out[out.length - 1].seryn_implication;
  }
  return out;
}

/* ============================================================
   VISUAL INTELLIGENCE — heuristic fallback (rule-based)
   PROVIDER: process.env.VISUAL_ANALYSIS_PROVIDER = heuristic | ai (MVP: heuristic)
   ============================================================ */
const VISUAL_PROVIDER = (process.env.VISUAL_ANALYSIS_PROVIDER || "heuristic").trim().toLowerCase();
const VKW = {
  beforeAfter: ["trước sau", "trước/sau", "before after", "lột xác", "transformation", "sau liệu trình", "kết quả sau"],
  doctor: ["bác sĩ", "ts.bs", "ths.bs", "bs.", "doctor", "dr.", "chuyên gia", "phác đồ", "y khoa"],
  offer: ["giảm", "ưu đãi", "tặng", "sale", " off", "đồng giá", "combo", "trọn gói", "khuyến mãi", "giá gốc", "miễn phí"],
  ugc: ["review", "trải nghiệm", "khách hàng", "chia sẻ", "cảm nhận", "nhật ký"],
  education: ["bạn có biết", "vì sao", "tại sao", "cơ chế", "giải thích", "hiểu đúng", "kiến thức"],
  luxury: ["cao cấp", "đẳng cấp", "luxury", "sang trọng", "thanh xuân", "quý cô", "tinh hoa"],
  clinic: ["phòng khám", "cơ sở", "bệnh viện", "trang thiết bị"],
  product: ["sản phẩm", "kem", "serum", "tinh chất"],
  testimonialShot: ["tin nhắn", "phản hồi", "feedback"],
  risk: ["cam kết", "100%", "khỏi hẳn", "vĩnh viễn", "tận gốc", "thần kỳ", "trẻ hơn 10 tuổi", "xóa sạch", "tuyệt đối", "duy nhất"],
};
const PRICE_RE2 = /(\d[\d.,]*\s?(?:k|đ|tr|triệu|vnđ|%))/i;
const vhas = (t, kws) => kws.some((k) => t.includes(k));
const vclamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const vrisk = (s) => (s >= 66 ? "high" : s >= 33 ? "medium" : "low");

function analyzeVisualFallback(ad) {
  const t = [ad.primary_text, ad.headline, ad.hook_text, ad.ad_snapshot_url, ad.thumbnail_url, ad.media_url]
    .filter(Boolean).join(" \n ").toLowerCase();
  const media = lc(ad.media_type);
  const creative_type = media.includes("video") ? "video" : (media.includes("carousel") || media.includes("dco") || media.includes("dpa")) ? "carousel" : media.includes("image") ? "image" : "unknown";
  const thumb = ad.thumbnail_url || "";
  const mediaUrl = ad.media_url || "";
  const hasAsset = !!(thumb || mediaUrl);
  const fmtHint = lc(ad.content_format);

  let visual_format = "unknown";
  if (vhas(t, VKW.beforeAfter) || fmtHint === "before_after") visual_format = "before_after";
  else if (vhas(t, VKW.doctor) || fmtHint === "doctor_explainer") visual_format = "doctor_expert";
  else if (vhas(t, VKW.testimonialShot)) visual_format = "testimonial_screenshot";
  else if (vhas(t, VKW.ugc) || fmtHint === "customer_testimonial" || fmtHint === "kol_review") visual_format = "ugc_selfie";
  else if (vhas(t, VKW.offer) || PRICE_RE2.test(t) || fmtHint === "offer_promotion") visual_format = "offer_banner";
  else if (vhas(t, VKW.luxury)) visual_format = "luxury_beauty";
  else if (vhas(t, VKW.clinic) || fmtHint === "facility_trust") visual_format = "clinic_room";
  else if (vhas(t, VKW.product)) visual_format = "product_packshot";
  else if (vhas(t, VKW.education) || fmtHint === "educational_post") visual_format = "educational";

  const ANGLE = { before_after: "transformation", doctor_expert: "authority", educational: "education", offer_banner: "promotion", luxury_beauty: "luxury", ugc_selfie: "social_proof", testimonial_screenshot: "social_proof" };
  const visual_angle = ANGLE[visual_format] || "unknown";

  const doctor_presence = vhas(t, VKW.doctor);
  const before_after_presence = visual_format === "before_after" || vhas(t, VKW.beforeAfter);
  const offer_visual_presence = vhas(t, VKW.offer) || PRICE_RE2.test(t);
  const ugcish = vhas(t, VKW.ugc) || vhas(t, VKW.testimonialShot);
  const text_overlay_presence = offer_visual_presence || before_after_presence || !!lc(ad.headline);
  const human_presence = doctor_presence || ugcish || before_after_presence || ["facial_rejuvenation", "lifting_firming"].includes(lc(ad.service_or_product));

  const clinical_score = vclamp((doctor_presence ? 55 : 0) + (vhas(t, VKW.education) ? 25 : 0) + (lc(ad.proof_point).includes("doctor") ? 20 : 0) + (vhas(t, VKW.clinic) ? 10 : 0));
  const beauty_luxury_score = vclamp((vhas(t, VKW.luxury) ? 50 : 0) + (lc(ad.proof_point).includes("kol") ? 30 : 0) + (visual_format === "luxury_beauty" ? 25 : 10));
  const ugc_score = vclamp((ugcish ? 55 : 0) + (fmtHint.includes("testimonial") ? 25 : 0) + (creative_type === "video" ? 10 : 0));
  const trust_signal_score = vclamp(clinical_score * 0.5 + ugc_score * 0.3 + (lc(ad.proof_point).includes("media") ? 20 : 0));
  const offer_visibility_score = vclamp((offer_visual_presence ? 50 : 0) + (PRICE_RE2.test(t) ? 30 : 0) + (t.includes("giá gốc") ? 15 : 0));
  const scroll_stop_score = vclamp((before_after_presence ? 40 : 0) + (offer_visibility_score > 60 ? 25 : 0) + (creative_type === "video" ? 20 : 10) + (vhas(t, VKW.luxury) ? 10 : 0));

  const risk_terms = VKW.risk.filter((k) => t.includes(k));
  const medical_claim_risk = vrisk(risk_terms.length * 30 + (doctor_presence && risk_terms.length ? 20 : 0));
  const before_after_risk = before_after_presence ? (risk_terms.length ? "high" : "medium") : "low";
  const promotion_claim_risk = vrisk((t.includes("giá gốc") ? 50 : 0) + (offer_visibility_score > 70 ? 30 : 0));
  const claim_risk_score = vclamp(risk_terms.length * 25 + (before_after_presence ? 20 : 0) + (promotion_claim_risk === "high" ? 20 : 0));
  const visual_risk_level = vrisk(claim_risk_score);
  const risk_reasons = [];
  if (risk_terms.length) risk_reasons.push(`Từ ngữ tuyệt đối: ${risk_terms.join(", ")}`);
  if (before_after_presence) risk_reasons.push("Có visual trước/sau (compliance)");
  if (promotion_claim_risk === "high") risk_reasons.push("Neo giá gốc / giảm sâu");

  let seryn_action = "monitor";
  if (visual_format === "offer_banner" || visual_angle === "promotion") seryn_action = "counter";
  else if (visual_format === "doctor_expert" || visual_format === "educational") seryn_action = "adapt";
  else if (before_after_presence && risk_terms.length) seryn_action = "avoid";
  else if (visual_format === "luxury_beauty") seryn_action = "counter";

  const summaryBits = [visual_format.replace(/_/g, " "), doctor_presence ? "có bác sĩ" : "", before_after_presence ? "before/after" : "", offer_visual_presence ? "nhấn ưu đãi" : ""].filter(Boolean);
  const visual_insight_summary = `Creative ${creative_type} dạng ${summaryBits.join(", ") || "chưa rõ"}.` + (hasAsset ? "" : " (limited analysis — no media asset)");

  const imageUrls = Array.isArray(ad.image_urls) && ad.image_urls.length ? ad.image_urls.map(String) : (thumb ? [String(thumb)] : []);
  const carousel = Array.isArray(ad.carousel_image_urls) ? ad.carousel_image_urls.map(String) : [];
  return {
    ad_id: String(ad.ad_id || ""), brand: String(ad.brand_name || ""), page_id: String(ad.page_id || ""),
    creative_type, media_url: mediaUrl, thumbnail_url: thumb, snapshot_url: ad.ad_snapshot_url || "",
    image_urls: JSON.stringify(imageUrls), video_preview_url: ad.video_preview_url || "", carousel_image_urls: JSON.stringify(carousel), has_media_asset: hasAsset,
    text_overlay_raw: "", text_overlay_summary: String(ad.headline || ad.hook_text || "").slice(0, 120),
    offer_from_visual: ad.offer_detected && ad.offer_detected !== "no_clear_offer" ? String(ad.offer_detected) : "",
    claim_from_visual: risk_terms.join("|"), risk_terms_from_visual: JSON.stringify(risk_terms),
    visual_format, visual_angle, human_presence, doctor_presence, before_after_presence, text_overlay_presence, offer_visual_presence,
    clinical_score, beauty_luxury_score, ugc_score, trust_signal_score, offer_visibility_score, scroll_stop_score,
    confidence_score: hasAsset ? 0.55 : 0.35, confidence_reason: hasAsset ? "Heuristic text + media hint." : "Heuristic text (chưa có media).",
    visual_risk_level, risk_reasons: JSON.stringify(risk_reasons), claim_risk_score, before_after_risk, medical_claim_risk, promotion_claim_risk,
    visual_insight_summary, seryn_action, last_seen_date: ad.week_date || "",
  };
}

function buildVisualRows(allAds, weekDate) {
  if (VISUAL_PROVIDER !== "heuristic") warn(`VISUAL_ANALYSIS_PROVIDER="${VISUAL_PROVIDER}" chưa hỗ trợ — dùng heuristic.`);
  const rows = allAds.filter((a) => a.ad_id).map((a) => {
    const v = { ...analyzeVisualFallback(a), last_seen_date: a.week_date || weekDate };
    // creative_signature: ưu tiên collation FB (gom biến thể cùng 1 ad) -> vân tay ảnh -> key heuristic.
    v.creative_signature = (a.collation_id ? `coll-${a.collation_id}` : "") || a.image_fingerprint || `${v.brand}|${v.visual_format}|${v.visual_angle}|${v.offer_from_visual || "no_offer"}`;
    return v;
  });
  // cluster_size: số ad cùng creative_signature (gom creative giống nhau).
  const sizes = {};
  for (const v of rows) sizes[v.creative_signature] = (sizes[v.creative_signature] || 0) + 1;
  for (const v of rows) v.cluster_size = sizes[v.creative_signature];
  return rows;
}

function buildBrandVisualSummary(visualRows, weekDate) {
  const byBrand = {};
  for (const v of visualRows) (byBrand[v.brand] ||= []).push(v);
  const r = (a, b) => (b > 0 ? Math.round((a / b) * 100) / 100 : 0);
  const avgv = (arr) => (arr.length ? Math.round(arr.reduce((s, n) => s + Number(n), 0) / arr.length) : 0);
  return Object.entries(byBrand).map(([brand, list]) => {
    const n = list.length;
    return {
      brand, week_date: weekDate, total_creatives: n,
      before_after_rate: r(list.filter((x) => x.before_after_presence).length, n),
      doctor_rate: r(list.filter((x) => x.doctor_presence).length, n),
      ugc_rate: r(list.filter((x) => x.visual_format === "ugc_selfie" || x.ugc_score >= 50).length, n),
      offer_banner_rate: r(list.filter((x) => x.visual_format === "offer_banner" || x.offer_visual_presence).length, n),
      high_risk_rate: r(list.filter((x) => x.visual_risk_level === "high").length, n),
      avg_clinical_score: avgv(list.map((x) => x.clinical_score)),
      avg_luxury_score: avgv(list.map((x) => x.beauty_luxury_score)),
      top_visual_formats: topCounts(list.map((x) => x.visual_format)),
      dominant_visual_angle: topCounts(list.map((x) => x.visual_angle)).split("|")[0] || "",
    };
  });
}

function buildVisualPatterns(visualRows, weekDate) {
  const groups = {};
  for (const v of visualRows) {
    const key = [v.brand, v.visual_format, v.visual_angle, v.offer_from_visual || "no_offer"].join("|");
    (groups[key] ||= []).push(v);
  }
  const out = [];
  let idx = 0;
  for (const [, list] of Object.entries(groups)) {
    if (list.length < 2 && list[0].visual_format === "unknown") continue;
    const rep = list[0];
    out.push({
      id: `vp-${rep.brand.split(" ")[0]}-${++idx}`, week_date: weekDate, brand: rep.brand,
      visual_format: rep.visual_format, visual_angle: rep.visual_angle, hook_type: "", offer_type: rep.offer_from_visual || "",
      ad_count: list.length, is_signal: list.length >= 3, representative_ad_id: rep.ad_id,
      summary: `${list.length} creative cùng ${String(rep.visual_format).replace(/_/g, " ")} / ${rep.visual_angle}${rep.offer_from_visual ? ` · ${rep.offer_from_visual}` : ""}.`,
      recommended_seryn_response: rep.seryn_action,
    });
  }
  return out.sort((a, b) => b.ad_count - a.ad_count);
}

/* ============================================================
   WEEKLY CHANGE INSIGHTS — phát hiện thay đổi chiến lược thật
   ============================================================ */
function calculateConfidence({ evidenceCount = 0, hasPreviousWeek = false, dataCompleteness = 1 }) {
  let c = 0.4 + Math.min(evidenceCount, 5) * 0.08 + (hasPreviousWeek ? 0.15 : 0);
  c = c * (0.6 + 0.4 * Math.max(0, Math.min(1, dataCompleteness)));
  return Math.round(Math.max(0.2, Math.min(0.95, c)) * 100) / 100;
}
function topOf(list, key) {
  const c = {};
  for (const x of list) { const v = String(x[key] || "").trim(); if (v && v !== "unknown") c[v] = (c[v] || 0) + 1; }
  const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : "";
}
function actionFromType(ct) {
  if (ct === "offer_changed" || ct === "brand_scaled_up") return "counter";
  if (ct === "service_focus_shifted" || ct === "hook_changed" || ct === "visual_format_shifted") return "monitor";
  if (ct === "new_campaign_theme" || ct === "same_concept_new_variants") return "adapt";
  if (ct === "page_inactive") return "monitor";
  return "monitor";
}

function generateWeeklyChangeInsights(currentAds, previousAds, currentVisual, previousVisual, snapshots, prevSnapByBrand, weekDate, prevWeek, crawlOk, pageOk) {
  const isOk = (brand) => (crawlOk ? crawlOk[brand] !== false : true); // crawl thất bại -> không kết luận dừng/giảm
  const pageIsOk = (pid) => (pageOk ? pageOk[String(pid)] === true : true); // chỉ kết luận page_inactive nếu page đó crawl OK
  const adsByBrand = {}; for (const a of currentAds) (adsByBrand[a.brand_name] ||= []).push(a);
  const prevByBrand = {}; for (const a of previousAds) (prevByBrand[a.brand_name] ||= []).push(a);
  const visByBrand = {}; for (const v of currentVisual) (visByBrand[v.brand] ||= []).push(v);
  const prevVisByBrand = {}; for (const v of previousVisual) (prevVisByBrand[v.brand] ||= []).push(v);
  const out = [];
  let n = 0;
  const push = (brand, change_type, severity, evidenceCount, summary, evidence, extra = {}) => {
    out.push({
      id: `wc-${slugId(brand)}-${change_type}-${++n}`, brand, week_start: weekDate, previous_week_start: prevWeek || "",
      change_type, severity, confidence_score: calculateConfidence({ evidenceCount, hasPreviousWeek: !!prevWeek, dataCompleteness: extra._dc ?? 1 }),
      summary, evidence, affected_ads: extra.affected_ads || "", previous_value: extra.previous_value || "", current_value: extra.current_value || "",
      recommended_action: extra.recommended_action || actionFromType(change_type),
    });
  };

  for (const snap of snapshots) {
    const brand = snap.brand_name;
    const cur = adsByBrand[brand] || [];
    const prev = prevByBrand[brand] || [];
    const prevSnap = prevSnapByBrand[brand];
    const curActive = Number(snap.total_active_ads || cur.length);
    const prevActive = prevSnap ? Number(prevSnap.total_active_ads || 0) : prev.length;

    // Scaling up/down
    if (prevSnap || prev.length) {
      const delta = curActive - prevActive;
      const pctChg = prevActive > 0 ? delta / prevActive : (curActive > 0 ? 1 : 0);
      if (delta >= 3 && pctChg >= 0.3) push(brand, "brand_scaled_up", pctChg >= 0.5 ? "high" : "medium", cur.length,
        `${brand} tăng quy mô quảng cáo.`, `Active ads ${prevActive} → ${curActive} (${delta >= 0 ? "+" : ""}${Math.round(pctChg * 100)}%).`, { previous_value: `${prevActive} ad`, current_value: `${curActive} ad` });
      else if (delta <= -3 && pctChg <= -0.3 && isOk(brand)) push(brand, "brand_scaled_down", pctChg <= -0.5 ? "high" : "medium", prev.length,
        `${brand} giảm quy mô quảng cáo.`, `Active ads ${prevActive} → ${curActive} (${Math.round(pctChg * 100)}%). Crawl brand này THÀNH CÔNG nên kết luận đáng tin.`, { previous_value: `${prevActive} ad`, current_value: `${curActive} ad` });
      else if (delta <= -3 && !isOk(brand))
        warn(`Bỏ qua kết luận 'scaled_down' cho "${brand}" vì crawl lỗi (carried_forward) — tránh kết luận sai.`);
    }

    // New page / page inactive
    const curPages = new Set(cur.map((a) => String(a.page_id)).filter(Boolean));
    const prevPages = new Set(prev.map((a) => String(a.page_id)).filter(Boolean));
    const newPages = [...curPages].filter((p) => !prevPages.has(p));
    const gonePages = [...prevPages].filter((p) => !curPages.has(p));
    if (newPages.length && prevPages.size) push(brand, "new_page_detected", "medium", newPages.length, `${brand} chạy ad qua page mới.`, `Page mới: ${newPages.join(", ")}.`, { current_value: newPages.join("|") });
    // page_inactive XÉT THEO TỪNG page_id: chỉ kết luận cho page crawl OK mà tuần này 0 ad.
    if (gonePages.length && prevPages.size) {
      const confirmed = gonePages.filter((p) => pageIsOk(p));
      const uncertain = gonePages.filter((p) => !pageIsOk(p));
      if (confirmed.length) push(brand, "page_inactive", "low", confirmed.length, `${brand} ngừng chạy ad ở page cũ.`, `Page crawl THÀNH CÔNG nhưng 0 ad: ${confirmed.join(", ")}.`, { previous_value: confirmed.join("|") });
      if (uncertain.length) warn(`"${brand}": ${uncertain.length} page crawl lỗi (${uncertain.join(", ")}) — KHÔNG kết luận page_inactive (partial crawl).`);
    }

    // Offer / hook / service shift (cần prev)
    if (prev.length) {
      const co = topOf(cur, "offer_detected"), po = topOf(prev, "offer_detected");
      if (co && po && co !== po) push(brand, "offer_changed", "medium", cur.filter((a) => a.offer_detected === co).length, `${brand} đổi ưu đãi chủ đạo.`, `Top offer "${po}" → "${co}".`, { previous_value: po, current_value: co });
      const ch = topOf(cur, "hook_type"), ph = topOf(prev, "hook_type");
      if (ch && ph && ch !== ph) push(brand, "hook_changed", "low", cur.filter((a) => a.hook_type === ch).length, `${brand} đổi hook chủ đạo.`, `Top hook "${ph}" → "${ch}".`, { previous_value: ph, current_value: ch });
      const cs = topOf(cur, "service_or_product"), ps = topOf(prev, "service_or_product");
      if (cs && ps && cs !== ps) push(brand, "service_focus_shifted", "medium", cur.filter((a) => a.service_or_product === cs).length, `${brand} dịch chuyển dịch vụ trọng tâm.`, `Top service "${ps}" → "${cs}".`, { previous_value: ps, current_value: cs });
    }

    // ---- Skin rejuvenation format/funnel mix shifts (section 6) ----
    if (prevSnap) {
      const cN = Number(snap.skin_rejuvenation_ads_count || 0);
      const cv = (k) => Number(snap[k] || 0), pv = (k) => Number(prevSnap[k] || 0);
      const up = (k) => cv(k) - pv(k);
      if (cN >= 3) {
        if (up("skin_rejuvenation_video_rate") >= 0.15)
          push(brand, "video_usage_increased", "medium", cv("skin_rejuvenation_video_ads"), `${brand} tăng dùng video cho trẻ hóa da.`, `Video rate ${pct(pv("skin_rejuvenation_video_rate"))} → ${pct(cv("skin_rejuvenation_video_rate"))}.`, { previous_value: pct(pv("skin_rejuvenation_video_rate")), current_value: pct(cv("skin_rejuvenation_video_rate")) });
        if (up("skin_rejuvenation_image_rate") >= 0.15)
          push(brand, "image_usage_increased", "low", cv("skin_rejuvenation_image_ads"), `${brand} tăng dùng ảnh tĩnh cho trẻ hóa da.`, `Image rate ${pct(pv("skin_rejuvenation_image_rate"))} → ${pct(cv("skin_rejuvenation_image_rate"))}.`, { previous_value: pct(pv("skin_rejuvenation_image_rate")), current_value: pct(cv("skin_rejuvenation_image_rate")) });
        if (up("skin_rejuvenation_messenger_rate") >= 0.15)
          push(brand, "messenger_usage_increased", "medium", cv("skin_rejuvenation_messenger_ads"), `${brand} đẩy mạnh Messenger cho trẻ hóa da.`, `Messenger rate ${pct(pv("skin_rejuvenation_messenger_rate"))} → ${pct(cv("skin_rejuvenation_messenger_rate"))}.`, { previous_value: pct(pv("skin_rejuvenation_messenger_rate")), current_value: pct(cv("skin_rejuvenation_messenger_rate")) });
        if (up("skin_rejuvenation_landing_page_conversion_rate") >= 0.15)
          push(brand, "landing_page_usage_increased", "medium", cv("skin_rejuvenation_landing_page_conversion_ads"), `${brand} chuyển sang landing page/conversion cho trẻ hóa da.`, `Landing page rate ${pct(pv("skin_rejuvenation_landing_page_conversion_rate"))} → ${pct(cv("skin_rejuvenation_landing_page_conversion_rate"))}.`, { previous_value: pct(pv("skin_rejuvenation_landing_page_conversion_rate")), current_value: pct(cv("skin_rejuvenation_landing_page_conversion_rate")) });

        const cf = snap.skin_rejuvenation_top_format, pf = prevSnap.skin_rejuvenation_top_format;
        if (cf && pf && cf !== "unknown" && pf !== "unknown" && cf !== pf)
          push(brand, "format_mix_changed", "medium", cN, `${brand} đổi format chủ đạo cho trẻ hóa da.`, `Top format "${pf}" → "${cf}".`, { previous_value: pf, current_value: cf });
        const co = snap.skin_rejuvenation_top_inferred_objective, po = prevSnap.skin_rejuvenation_top_inferred_objective;
        if (co && po && co !== "unknown" && po !== "unknown" && co !== po)
          push(brand, "objective_mix_changed", "medium", cN, `${brand} đổi mục tiêu funnel chủ đạo cho trẻ hóa da.`, `Top objective "${po}" → "${co}".`, { previous_value: po, current_value: co });
      }
      // Offer shift trong nhóm trẻ hóa da
      const skinCur = cur.filter((a) => a.service_category === SERVICE_CATEGORY);
      const skinPrev = prev.filter((a) => a.service_category === SERVICE_CATEGORY);
      if (skinCur.length >= 2 && skinPrev.length >= 2) {
        const so = topOf(skinCur, "offer_detected"), spo = topOf(skinPrev, "offer_detected");
        if (so && spo && so !== spo) push(brand, "skin_rejuvenation_offer_shift", "medium", skinCur.length, `${brand} đổi ưu đãi chủ đạo cho trẻ hóa da.`, `Top offer "${spo}" → "${so}".`, { previous_value: spo, current_value: so });
      }
    }

    // New campaign theme / same concept variants (từ ad mới tuần này)
    const newAds = cur.filter((a) => String(a.is_new_this_week) === "true");
    if (newAds.length >= 3) {
      const themeKey = (a) => `${a.service_or_product}|${a.hook_type}|${a.offer_detected}`;
      const counts = {};
      for (const a of newAds) counts[themeKey(a)] = (counts[themeKey(a)] || 0) + 1;
      const [topTheme, topCnt] = Object.entries(counts).sort((x, y) => y[1] - x[1])[0] || ["", 0];
      if (topCnt >= 3) {
        const sameAds = newAds.filter((a) => themeKey(a) === topTheme).map((a) => a.ad_id).slice(0, 8).join("|");
        const prevHasTheme = prev.some((a) => themeKey(a) === topTheme);
        if (!prevHasTheme) push(brand, "new_campaign_theme", "medium", topCnt, `${brand} tung chủ đề campaign mới.`, `${topCnt} ad mới cùng concept (${topTheme.replace(/\|/g, " · ")}), tuần trước chưa có.`, { affected_ads: sameAds });
        else push(brand, "same_concept_new_variants", "low", topCnt, `${brand} nhân nhiều biến thể cùng concept.`, `${topCnt} ad mới cùng concept (${topTheme.replace(/\|/g, " · ")}).`, { affected_ads: sameAds });
      }
    }

    // Visual format shift (confidence cap 0.7 nếu thiếu visual)
    const cv = visByBrand[brand] || [], pv = prevVisByBrand[brand] || [];
    if (cv.length && pv.length) {
      const cf = topOf(cv, "visual_format"), pf = topOf(pv, "visual_format");
      if (cf && pf && cf !== pf) {
        const ins = { previous_value: pf, current_value: cf, _dc: 0.7 };
        push(brand, "visual_format_shifted", "medium", cv.filter((x) => x.visual_format === cf).length, `${brand} dịch chuyển định dạng visual.`, `Top visual "${pf}" → "${cf}".`, ins);
      }
    } else if (cv.length && !pv.length) {
      // có visual tuần này nhưng thiếu tuần trước -> chỉ ghi nhận với confidence thấp nếu một format chiếm >=30% ad mới
      const newCv = cv.filter((x) => newAds.some((a) => a.ad_id === x.ad_id));
      const dominant = topOf(newCv, "visual_format");
      if (dominant && newCv.filter((x) => x.visual_format === dominant).length / Math.max(1, newCv.length) >= 0.3 && newCv.length >= 3) {
        push(brand, "visual_format_shifted", "low", newCv.length, `${brand}: visual mới ${dominant.replace(/_/g, " ")} chiếm tỉ trọng cao trong ad mới.`, `${dominant} ≥30% creative mới (thiếu dữ liệu visual tuần trước).`, { current_value: dominant, _dc: 0.5 });
      }
    }
  }
  return out;
}
function slugId(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24); }

/* ============================================================
   MAIN
   ============================================================ */
async function main() {
  console.log(`\nSERYN Weekly Spy Sync — provider=${PROVIDER}`);
  if (!SHEET_ID) fail("Thiếu GOOGLE_SHEET_ID.");
  const weekDate = currentMondayISO();
  console.log(`Sheet ID: ${SHEET_ID}\nWeek    : ${weekDate}\n`);

  const auth = buildAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // xác thực mở được Sheet + lấy danh sách tab
  let meta;
  try { meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID }); }
  catch (e) { fail(`Không mở được Google Sheet (đã Share Editor cho service account chưa?): ${e?.message || e}`); }
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);

  // đọc dữ liệu cũ TRƯỚC khi ghi đè (cho weekly change + cache incremental)
  const prevSnap = await readTabObjects(sheets, "Brand Weekly Snapshot");
  const prevAds = await readTabObjects(sheets, "Ad Level Analysis");
  const prevVisual = await readTabObjects(sheets, "Visual Analysis");
  const prevCache = await readTabObjects(sheets, "Ad Analysis Cache");
  const prevArchive = await readTabObjects(sheets, "Raw Ads Archive");
  const prevPattern = await readTabObjects(sheets, "Pattern Cache");
  const prevWeek = prevSnap[0]?.week_date || "";
  const prevSnapByBrand = {}; for (const r of prevSnap) prevSnapByBrand[r.brand_name] = r;
  const prevAdsByBrand = {}; for (const r of prevAds) (prevAdsByBrand[r.brand_name] ||= []).push(r);
  const prevAdIds = new Set(prevAds.map((r) => r.ad_id).filter(Boolean));
  const cacheById = {}; for (const r of prevCache) cacheById[r.ad_id] = r;
  const archiveFirstSeen = {}; for (const r of prevArchive) if (!archiveFirstSeen[r.ad_id]) archiveFirstSeen[r.ad_id] = r.first_seen_date || r.week_date;
  const patternFirstSeen = {}; for (const r of prevPattern) patternFirstSeen[r.pattern_hash] = r.first_seen_date;

  // Tự import đối thủ đã duyệt (Phát hiện đối thủ -> Competitors) trước khi spy.
  if (AUTO_IMPORT_APPROVED) {
    try {
      console.log("→ Tự import đối thủ đã duyệt vào watchlist trước khi spy…");
      const r = await importDiscovered();
      if (r && (r.created || r.updated)) console.log(`   (đã thêm ${r.created} / cập nhật ${r.updated} đối thủ từ Phát hiện đối thủ)\n`);
    } catch (e) {
      warn(`Auto-import đối thủ đã duyệt lỗi (bỏ qua, vẫn spy watchlist hiện tại): ${e?.message || e}`);
    }
  }

  const competitors = await loadCompetitors(sheets);
  if (!competitors.length) fail("Không có brand active hợp lệ để xử lý (kiểm tra tab `Competitors`).");
  console.log(`Brands active: ${competitors.length}\n`);

  /* ---- crawl run state ---- */
  const runId = crawlRunId(weekDate);
  const startedAt = nowISO();
  const crawlOkByBrand = {};
  const pageOk = {};            // page_id -> true nếu crawl page đó thành công
  const allPageLogs = [];
  let totalPages = 0, successPages = 0, failedPages = 0;
  let newCount = 0, changedCount = 0, reusedCount = 0, carriedCount = 0;
  const ANALYSIS_VER = `${ANALYSIS_VERSION}/t:${TEXT_PROMPT_VERSION}/v:${VISUAL_PROMPT_VERSION}`;
  const PROVIDER_KEY = `${PROVIDER}/${VISUAL_AI_PROVIDER}`;
  const archiveRows = [];

  /** CHECK-BEFORE-ANALYSIS: hash trước -> cache hit (+ version/provider khớp) thì reuse, không phân tích lại. */
  function analyzeWithCache(r, brand) {
    const hashes = hashAd(r);
    const c = cacheById[r.ad_id];
    const versionMatch = c && c.analysis_version === ANALYSIS_VER && c.analysis_provider === PROVIDER_KEY;
    const hit = !!versionMatch && c.content_hash === hashes.content_hash && c.visual_hash === hashes.visual_hash;
    let reuse = null;
    if (hit) { try { reuse = JSON.parse(c.text_analysis_json); } catch { reuse = null; } }
    const ad = analyzeAd(r, brand, weekDate, prevAdIds, { reuse, hashes });
    if (!c) { ad.analysis_status = "newly_analyzed"; ad.reused_from_cache = "false"; ad.last_analyzed_at = nowISO(); newCount++; }
    else if (hit) { ad.analysis_status = "reused_from_cache"; ad.reused_from_cache = "true"; ad.last_analyzed_at = c.last_analyzed_at || nowISO(); reusedCount++; }
    else { ad.analysis_status = "changed_reanalyzed"; ad.reused_from_cache = "false"; ad.last_analyzed_at = nowISO(); changedCount++; }
    ad.analysis_version = ANALYSIS_VER;
    return ad;
  }

  const allAds = [], snapshots = [], allScaled = [];
  for (const brand of competitors) {
    const { ads: raw, errored, pagesOk = 0, pagesFail = 0, pageLogs = [] } = await pullAds(brand);
    totalPages += pagesOk + pagesFail; successPages += pagesOk; failedPages += pagesFail;
    const crawlOk = !errored;
    crawlOkByBrand[brand.brand_name] = crawlOk;
    for (const pl of pageLogs) { pageOk[String(pl.page_id)] = pl.status === "ok"; allPageLogs.push({ crawl_run_id: runId, week_date: weekDate, ...pl }); }
    let ads;
    if (!raw.length && errored && (prevAdsByBrand[brand.brand_name] || []).length) {
      const carried = prevAdsByBrand[brand.brand_name];
      warn(`Brand "${brand.brand_name}": pull lỗi — giữ lại ${carried.length} ad tuần trước (carried_forward, KHÔNG kết luận dừng).`);
      ads = carried.map((r) => ({ ...r, week_date: weekDate, analysis_status: "carried_forward", reused_from_cache: "true", notes: ((r.notes || "") + " | carried_forward (crawl_failed)").trim() }));
      ads = scopeAds(ads, brand.brand_name); // chỉ giữ ad trẻ hóa da (kể cả dữ liệu carried cũ)
      carriedCount += ads.length;
    } else {
      if (!raw.length) warn(`Brand "${brand.brand_name}": 0 ad thu được (crawl ${crawlOk ? "OK" : "lỗi"}).`);
      ads = raw.map((r) => analyzeWithCache(r, brand));
      ads = scopeAds(ads, brand.brand_name); // PHẠM VI: chỉ căng da/trẻ hóa da mặt — loại dịch vụ khác trước khi cluster/thống kê
      ads = applyScale(ads);
      // raw archive — chỉ lưu ad trong phạm vi (đồng bộ với dataset, không lưu creative dịch vụ khác)
      const keptIds = new Set(ads.map((a) => a.ad_id));
      for (const r of raw) {
        const adId = r.ad_id || `${brand.brand_name}-${r.start_date}`;
        if (!keptIds.has(adId)) continue;
        const { _raw, _reused, ...rest } = r;
        archiveRows.push({
          crawl_run_id: runId, week_date: weekDate, brand: brand.brand_name, page_id: r.page_id, ad_id: r.ad_id,
          ...hashAd(r),
          status: r.status || "ACTIVE", source_provider: PROVIDER, source_country: SC_COUNTRY,
          first_seen_date: archiveFirstSeen[r.ad_id] || r.start_date || weekDate, last_seen_date: weekDate,
          raw_json: JSON.stringify(_raw || rest).slice(0, 8000),
        });
      }
    }
    const scaled = buildScaled(brand, ads, weekDate);
    snapshots.push(buildSnapshot(brand, ads, scaled, weekDate));
    allAds.push(...ads);
    allScaled.push(...scaled);
    console.log(`  • ${brand.brand_name}: ${ads.length} ad${crawlOk ? "" : " (crawl_failed)"}`);
  }

  const changes = buildChanges(snapshots, allAds, prevSnapByBrand, prevAdsByBrand, weekDate);
  const recs = buildRecommendations(allAds, allScaled, weekDate);

  // ---- Visual Intelligence + Weekly Change Insights ----
  const visualRows = buildVisualRows(allAds, weekDate);
  // gắn cache-status + hash từ ad-level sang visual (theo ad_id); missing_media/low_confidence ưu tiên cho visual
  const adById = {}; for (const a of allAds) adById[a.ad_id] = a;
  for (const v of visualRows) {
    const a = adById[v.ad_id] || {};
    v.content_hash = a.content_hash || ""; v.visual_hash = a.visual_hash || "";
    v.reused_from_cache = a.reused_from_cache || "false"; v.analysis_version = a.analysis_version || ANALYSIS_VER; v.last_analyzed_at = a.last_analyzed_at || nowISO();
    v.analysis_status = (v.has_media_asset === false || v.has_media_asset === "false")
      ? "missing_media"
      : (Number(v.confidence_score) < 0.5 ? "low_confidence" : (a.analysis_status || "newly_analyzed"));
  }
  const brandVisual = buildBrandVisualSummary(visualRows, weekDate);
  const visualPatterns = buildVisualPatterns(visualRows, weekDate);
  const changeInsights = generateWeeklyChangeInsights(allAds, prevAds, visualRows, prevVisual, snapshots, prevSnapByBrand, weekDate, prevWeek, crawlOkByBrand, pageOk);

  // ---- Cache rows (current) + MERGE với cache cũ (không mất cache của ad đã dừng) ----
  const visById = {}; for (const v of visualRows) visById[v.ad_id] = v;
  const curCacheRows = allAds.map((a) => {
    const v = visById[a.ad_id] || {};
    const old = cacheById[a.ad_id];
    return {
      ad_id: a.ad_id, brand: a.brand_name, page_id: a.page_id, content_hash: a.content_hash || "", visual_hash: a.visual_hash || "",
      analysis_version: a.analysis_version || ANALYSIS_VER, analysis_provider: PROVIDER_KEY,
      analysis_status: a.analysis_status || "newly_analyzed", reused_from_cache: a.reused_from_cache || "false",
      // text_analysis_json đúng shape computeTextAnalysis -> reuse trực tiếp lần sau
      text_analysis_json: JSON.stringify({ hook_type: a.hook_type, service_or_product: a.service_or_product, content_format: a.content_format, content_angle: a.content_angle, proof_point: a.proof_point, funnel_stage: a.funnel_stage, offer_detected: a.offer_detected, price_detected: a.price_detected }),
      visual_analysis_json: JSON.stringify({ visual_format: v.visual_format, seryn_action: v.seryn_action, clinical: v.clinical_score, risk: v.visual_risk_level, confidence: v.confidence_score }),
      first_seen_date: (old && old.first_seen_date) || archiveFirstSeen[a.ad_id] || a.start_date || weekDate,
      last_seen_date: weekDate,
      last_analyzed_at: a.last_analyzed_at || nowISO(),
    };
  });
  const curAdIds = new Set(curCacheRows.map((r) => r.ad_id));
  // giữ cache cũ của ad KHÔNG còn xuất hiện tuần này (đã dừng) — không mất kết quả phân tích.
  const keptOld = prevCache.filter((r) => r.ad_id && !curAdIds.has(r.ad_id));
  const mergedCache = [...curCacheRows, ...keptOld];
  // dedup theo ad_id + content_hash + visual_hash (an toàn nếu cache cũ có dòng trùng).
  const cacheRows = []; const _seenCacheKey = new Set();
  for (const r of mergedCache) {
    const k = `${r.ad_id}|${r.content_hash}|${r.visual_hash}`;
    if (_seenCacheKey.has(k)) continue; _seenCacheKey.add(k); cacheRows.push(r);
  }

  // ---- Historical snapshots (append) ----
  const histRows = snapshots.map((s) => {
    const brandAds = allAds.filter((a) => a.brand_name === s.brand_name);
    const cnt = (st) => brandAds.filter((a) => a.analysis_status === st).length;
    const vfs = visualRows.filter((v) => v.brand === s.brand_name);
    return {
      week_date: weekDate, brand: s.brand_name, active_ads_count: s.total_active_ads,
      new_ads_count: cnt("newly_analyzed"), stopped_ads_count: s.stopped_ads_count || 0,
      changed_ads_count: cnt("changed_reanalyzed"), reused_ads_count: cnt("reused_from_cache"),
      top_service: topOf(brandAds, "service_or_product"), top_hook: topOf(brandAds, "hook_type"), top_offer: topOf(brandAds, "offer_detected"),
      top_visual_format: topOf(vfs, "visual_format"), crawl_status: crawlOkByBrand[s.brand_name] ? "ok" : "crawl_failed",
      snapshot_json: JSON.stringify(s).slice(0, 8000),
    };
  });

  // ---- Pattern cache ----
  const pgroups = {};
  for (const a of allAds) {
    const v = visById[a.ad_id] || {};
    const key = [a.brand_name, a.service_or_product, a.hook_type, a.offer_detected, v.visual_format || "unknown", v.visual_angle || "unknown"].join("|");
    (pgroups[key] ||= []).push({ a, v });
  }
  const patternRows = Object.entries(pgroups).map(([, list]) => {
    const { a, v } = list[0];
    const phash = buildPatternHash(a.brand_name, a.service_or_product, a.hook_type, a.offer_detected, v.visual_format || "unknown", v.visual_angle || "unknown");
    const active = list.filter((x) => String(x.a.status).toUpperCase() === "ACTIVE").length;
    const avgDays = Math.round(list.reduce((s, x) => s + Number(x.a.days_active || 0), 0) / list.length);
    return {
      pattern_id: `pt-${phash}`, pattern_hash: phash, brand: a.brand_name, service_type: a.service_or_product, hook_type: a.hook_type,
      offer_type: a.offer_detected, visual_format: v.visual_format || "unknown", visual_angle: v.visual_angle || "unknown",
      first_seen_date: patternFirstSeen[phash] || weekDate, last_seen_date: weekDate, ads_count: list.length, active_days_avg: avgDays,
      example_ads: list.slice(0, 5).map((x) => x.a.ad_id).join("|"), scale_signal: active >= 3 ? "true" : "false",
    };
  }).sort((x, y) => Number(y.ads_count) - Number(x.ads_count));

  const finishedAt = nowISO();
  const crawlRunRow = {
    crawl_run_id: runId, run_id: runId, run_type: RUN_TYPE.weeklySpy, started_at: startedAt, finished_at: finishedAt,
    week_date: weekDate, provider: PROVIDER, country: SC_COUNTRY, geo: "Vietnam", service_category: SERVICE_CATEGORY,
    total_brands: competitors.length, total_pages: totalPages, success_pages: successPages, failed_pages: failedPages,
    total_ads_fetched: allAds.length, new_ads_count: newCount, changed_ads_count: changedCount, reused_ads_count: reusedCount,
    analyzed_ads_count: newCount + changedCount, carried_forward_count: carriedCount,
    status: failedPages === 0 ? "ok" : (successPages === 0 ? "failed" : "partial"), error_summary: warnings.slice(0, 5).join(" | "),
  };

  console.log(`\nGhi Google Sheets:`);
  await writeTab(sheets, titles, "Brand Weekly Snapshot", HEADERS.snapshot, snapshots);
  await writeTab(sheets, titles, "Ad Level Analysis", HEADERS.ad, allAds);
  await writeTab(sheets, titles, "Scaled Content Analysis", HEADERS.scaled, allScaled);
  await writeTab(sheets, titles, "Weekly Strategy Change", HEADERS.change, changes);
  // SERYN Content Recommendations: GIỮ LẠI row do Exa market research sync vào
  // (source != weekly_spy) — chỉ ghi đè phần weekly, tránh xoá opportunity Exa.
  const prevRecs = await readTabObjects(sheets, "SERYN Content Recommendations");
  const preservedRecs = prevRecs.filter((r) => String(r.source || "").trim() && String(r.source).trim() !== RUN_TYPE.weeklySpy);
  await writeTab(sheets, titles, "SERYN Content Recommendations", HEADERS.rec, [...recs, ...preservedRecs]);
  await writeTab(sheets, titles, "Visual Analysis", HEADERS.visual, visualRows);
  await writeTab(sheets, titles, "Brand Visual Summary", HEADERS.brandVisual, brandVisual);
  await writeTab(sheets, titles, "Visual Pattern Analysis", HEADERS.visualPattern, visualPatterns);
  await writeTab(sheets, titles, "Weekly Change Insights", HEADERS.changeInsight, changeInsights);
  await writeTab(sheets, titles, "Ad Analysis Cache", HEADERS.cache, cacheRows);
  await writeTab(sheets, titles, "Pattern Cache", HEADERS.patternCache, patternRows);
  await appendTab(sheets, titles, "Raw Ads Archive", HEADERS.rawArchive, archiveRows);
  await appendTab(sheets, titles, "Historical Weekly Snapshots", HEADERS.historical, histRows);
  await appendTab(sheets, titles, "Crawl Runs", HEADERS.crawlRuns, [crawlRunRow]);
  await appendTab(sheets, titles, "Page Crawl Logs", HEADERS.pageCrawlLogs, allPageLogs);

  const aiSaved = reusedCount + carriedCount; // ad không cần gọi AI lại
  console.log(`\nXong. ${snapshots.length} brand · ${allAds.length} ad · ${newCount} mới · ${changedCount} đổi · ${reusedCount} reuse-cache · ${carriedCount} carried.`);
  console.log(`Incremental: ${aiSaved}/${allAds.length} ad KHÔNG cần phân tích lại (ước tính tiết kiệm ${aiSaved} lượt AI nếu bật VISUAL_AI_PROVIDER).`);
  console.log(`Crawl: ${successPages}/${totalPages} page OK, ${failedPages} lỗi · run ${runId} (${crawlRunRow.status}).`);
  if (warnings.length) console.log(`Cảnh báo: ${warnings.length} (xem log [!] phía trên).`);

  // Đẩy datasets lên Supabase cho dashboard đọc (auto, nếu đã cấu hình SUPABASE_*).
  if (supabaseConfigured()) {
    try { console.log(`\n→ Đẩy dữ liệu lên Supabase…`); await syncSheetToSupabase(); }
    catch (e) { warn(`Đẩy Supabase lỗi (Sheet vẫn OK): ${e?.message || e}`); }
  }
  console.log(`→ Dashboard: đọc từ Supabase (hoặc bấm "Refresh Online Data").`);
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));
