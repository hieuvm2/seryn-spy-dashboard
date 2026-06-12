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
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const PROVIDER = (process.env.ADS_SOURCE_PROVIDER || "mock").trim().toLowerCase();

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

/* ============================================================
   COMPETITORS — đọc watchlist
   ============================================================ */
const DEFAULT_COMPETITORS = [
  { brand_name: "Bệnh viện JW Hàn Quốc", page_ids: "400844936646543|101055868985301", page_urls: "https://www.facebook.com/benhvienjw.vn", active: "TRUE", notes: "default" },
  { brand_name: "Viện Thẩm Mỹ LG Clinic", page_ids: "138495609852248", page_urls: "https://www.facebook.com/vienthammylgclinic", active: "TRUE", notes: "default" },
  { brand_name: "Bệnh viện Thẩm mỹ Kangnam", page_ids: "359285057508884", page_urls: "https://www.facebook.com/Thammykangnam", active: "TRUE", notes: "default" },
  { brand_name: "Thẩm mỹ viện Ngọc Dung", page_ids: "372398605948395", page_urls: "https://www.facebook.com/ngocdungbeautycenter", active: "TRUE", notes: "default" },
  { brand_name: "Pensilia Beauty Clinic", page_ids: "108600987972847", page_urls: "https://www.facebook.com/pensilia", active: "TRUE", notes: "default" },
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

async function pullAds(brand) {
  if (PROVIDER === "mock") return mockAdsForBrand(brand);
  if (PROVIDER === "custom") return customAdsForBrand(brand);
  warn(`ADS_SOURCE_PROVIDER="${PROVIDER}" không hỗ trợ — không bịa dữ liệu, bỏ qua "${brand.brand_name}".`);
  return [];
}

/* ============================================================
   ANALYZE — raw ad -> Ad Level row
   ============================================================ */
function analyzeAd(raw, brand, weekDate, prevAdIds) {
  const text = [raw.headline, raw.primary_text, raw.description].join(" \n ");
  const service = matchFirst(text, SERVICE_KEYWORDS, "unknown");
  const format = matchFirst(text, FORMAT_KEYWORDS, "unknown");
  const hook = matchFirst(text, HOOK_KEYWORDS, "unknown");
  const angle = ANGLE_BY_HOOK[hook] || "unknown";
  const proof = PROOF_BY_FORMAT[format] || "unknown";
  const funnel = FUNNEL_BY_HOOK[hook] || "consideration";
  const days = daysActive(raw.start_date);
  const sc = scaleByDuration(days);
  const adId = raw.ad_id || `${brand.brand_name}-${raw.start_date}`;
  return {
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
    hook_type: hook,
    service_or_product: service,
    price_detected: detectPrice(text),
    offer_detected: detectOffer(text),
    content_format: format,
    content_angle: angle,
    proof_point: proof,
    cta: raw.cta || "",
    funnel_stage: funnel,
    is_new_this_week: prevAdIds.has(adId) ? "false" : "true",
    was_seen_previous_week: prevAdIds.has(adId) ? "true" : "false",
    is_likely_scaled: "false", // điều chỉnh sau khi cluster
    scale_level: sc.level,
    scale_reason: "",
    notes: "",
    _scaleLabel: sc.label,
  };
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
    a.scale_reason = likely ? `likely scaled based on duration and repetition (${bits.join(", ")})` : `${bits.join(", ")}`;
    delete a._scaleLabel;
  }
  return ads;
}

/* ============================================================
   AGGREGATE — Snapshot / Scaled / Recommendations
   ============================================================ */
const HEADERS = {
  ad: "week_date,brand_name,page_id,page_name,ad_id,ad_snapshot_url,status,start_date,days_active,media_type,platforms,headline,primary_text,hook_text,hook_type,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,cta,funnel_stage,is_new_this_week,was_seen_previous_week,is_likely_scaled,scale_level,scale_reason,notes".split(","),
  snapshot: "week_date,brand_name,page_urls,page_ids,total_active_ads,total_ads_collected,num_pages_running,services_running,prices_detected,offers_detected,main_content_formats,main_hooks,main_angles,main_proof_points,main_ctas,scaled_content_count,new_ads_count,stopped_ads_count,content_strategy_summary,weekly_change_summary,seryn_opportunity".split(","),
  scaled: "week_date,brand_name,content_cluster_id,representative_ad_id,representative_hook,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,number_of_similar_ads,longest_days_active,average_days_active,scale_level,why_it_is_scaling,competitor_strategy_interpretation,seryn_should_copy_adapt_counter_avoid,seryn_reframe".split(","),
  change: "week_date,brand_name,active_ads_change,new_ads_count,stopped_ads_count,new_services_detected,removed_services,new_offers_detected,removed_offers,new_content_angles,removed_content_angles,scaled_content_new,scaled_content_still_running,strategic_change_type,change_summary,seryn_implication".split(","),
  rec: "week_date,recommendation_type,market_signal,competitor_evidence,seryn_content_niche,suggested_content_format,suggested_hook,content_style,main_message,proof_to_use,cta,kpi,priority".split(","),
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
      why_it_is_scaling: `likely scaled based on duration and repetition (${maxDays}d, ${group.length} biến thể)`,
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
function serynReframe(ad, action) {
  const svc = String(ad.service_or_product || "dịch vụ").replace(/_/g, " ");
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

  // đọc dữ liệu cũ TRƯỚC khi ghi đè (cho weekly change)
  const prevSnap = await readTabObjects(sheets, "Brand Weekly Snapshot");
  const prevAds = await readTabObjects(sheets, "Ad Level Analysis");
  const prevSnapByBrand = {}; for (const r of prevSnap) prevSnapByBrand[r.brand_name] = r;
  const prevAdsByBrand = {}; for (const r of prevAds) (prevAdsByBrand[r.brand_name] ||= []).push(r);
  const prevAdIds = new Set(prevAds.map((r) => r.ad_id).filter(Boolean));

  const competitors = await loadCompetitors(sheets);
  if (!competitors.length) fail("Không có brand active hợp lệ để xử lý (kiểm tra tab `Competitors`).");
  console.log(`Brands active: ${competitors.length}\n`);

  const allAds = [], snapshots = [], allScaled = [];
  for (const brand of competitors) {
    const raw = await pullAds(brand);
    if (!raw.length) { warn(`Brand "${brand.brand_name}": 0 ad thu được.`); }
    let ads = raw.map((r) => analyzeAd(r, brand, weekDate, prevAdIds));
    ads = applyScale(ads);
    const scaled = buildScaled(brand, ads, weekDate);
    snapshots.push(buildSnapshot(brand, ads, scaled, weekDate));
    allAds.push(...ads);
    allScaled.push(...scaled);
    console.log(`  • ${brand.brand_name}: ${ads.length} ad, ${scaled.length} cụm scale`);
  }

  const changes = buildChanges(snapshots, allAds, prevSnapByBrand, prevAdsByBrand, weekDate);
  const recs = buildRecommendations(allAds, allScaled, weekDate);

  console.log(`\nGhi Google Sheets:`);
  await writeTab(sheets, titles, "Brand Weekly Snapshot", HEADERS.snapshot, snapshots);
  await writeTab(sheets, titles, "Ad Level Analysis", HEADERS.ad, allAds);
  await writeTab(sheets, titles, "Scaled Content Analysis", HEADERS.scaled, allScaled);
  await writeTab(sheets, titles, "Weekly Strategy Change", HEADERS.change, changes);
  await writeTab(sheets, titles, "SERYN Content Recommendations", HEADERS.rec, recs);

  console.log(`\nXong. ${snapshots.length} brand · ${allAds.length} ad · ${allScaled.length} cụm scale · ${recs.length} gợi ý.`);
  if (warnings.length) console.log(`Cảnh báo: ${warnings.length} (xem log [!] phía trên).`);
  console.log(`→ Dashboard Vercel: bấm "Refresh Online Data" (hoặc reload) để thấy dữ liệu mới.`);
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));
