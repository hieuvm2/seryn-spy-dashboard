/* ============================================================
   SERYN Spy — Việt hóa text sinh ra từ pipeline (server-side)
   ------------------------------------------------------------
   Nguyên tắc: schema/field/enum GIỮ tiếng Anh trong dữ liệu máy đọc;
   nhưng mọi chuỗi NARRATIVE + chuỗi hiển thị ("key (count)") trong
   Weekly/Monthly Reports, Weekly_Summary, Action_Plan phải là tiếng Việt
   ngay từ lúc sinh — dashboard không phải dịch đuổi.

   GIỮ ĐỒNG BỘ nhãn với frontend src/utils/spyData.ts (VI_LABELS).
   Từ tiếng Anh được phép giữ (jargon đội đã quen): ads/ad, hook, CTA,
   video, Messenger, Facebook, inbox, KOL, UGC, combo, spa, landing page
   (dịch "trang đích" khi đứng trong câu), tên riêng/brand/máy móc.
   ============================================================ */

/** Nhãn tiếng Việt cho enum (con của VI_LABELS frontend — phần pipeline dùng). */
export const VI_ENUM = {
  // content_format
  doctor_explainer: "bác sĩ giải thích", before_after: "trước / sau", offer_promotion: "khuyến mãi",
  service_demo: "demo dịch vụ", customer_testimonial: "khách hàng kể", kol_review: "KOL đánh giá",
  educational_post: "bài giáo dục", problem_solution: "vấn đề – giải pháp", technology_proof: "chứng minh công nghệ",
  facility_trust: "cơ sở vật chất", consultation_lead: "dẫn tư vấn", seasonal_campaign: "chiến dịch theo mùa",
  ugc_style: "khách tự quay",
  // hook_type / angle
  problem_led: "khơi vấn đề", fear_based: "đánh vào nỗi sợ", doctor_authority: "uy tín bác sĩ",
  offer_led: "dẫn bằng ưu đãi", consultation_led: "dẫn tư vấn", transformation_led: "lột xác",
  social_proof: "bằng chứng số đông", curiosity: "tò mò", education_led: "giáo dục",
  premium_positioning: "định vị cao cấp", transformation: "lột xác", medical_authority: "uy tín y khoa",
  education: "giáo dục", price_promotion: "khuyến mãi giá", fear_aging: "khơi sợ lão hóa",
  premium: "cao cấp", consultation: "tư vấn", urgency: "tạo gấp gáp",
  // service
  skin_analysis: "phân tích da", facial_rejuvenation: "trẻ hóa da mặt", skin_rejuvenation: "trẻ hóa da",
  melasma_treatment: "trị nám", pigmentation_treatment: "trị sắc tố", acne_treatment: "trị mụn",
  laser_treatment: "điều trị laser", collagen_stimulation: "kích thích collagen",
  lifting_firming: "nâng cơ / căng da", filler_botox: "filler / botox", facial_contouring: "tạo đường nét mặt",
  body_slimming: "giảm béo", hair_removal: "triệt lông", surgery: "phẫu thuật",
  dental_aesthetics: "nha khoa thẩm mỹ", anti_aging_consultation: "tư vấn chống lão hóa",
  hormone_biology_assessment: "đánh giá nền tảng sinh học", nutrition_lifestyle: "dinh dưỡng / lối sống",
  // ad_format / objective / funnel
  image: "ảnh", video: "video", carousel: "carousel (nhiều ảnh)", collection: "collection", text_only: "chỉ chữ",
  messenger: "nhắn tin (Messenger)", landing_page_conversion: "trang đích / chuyển đổi",
  lead_form: "form thu lead", phone_call: "gọi điện", website_traffic: "kéo traffic web",
  engagement: "tương tác", branding: "thương hiệu",
  awareness: "nhận biết", consideration: "cân nhắc", conversion: "chuyển đổi", retargeting: "tiếp thị lại",
  // strategic_change_type
  came_online: "bắt đầu chạy QC", still_dark: "vẫn im ắng", went_dark: "ngừng chạy QC", stable: "ổn định",
  stable_creative_refresh: "ổn định, xoay nội dung", rotating_creative: "xoay vòng mẫu quảng cáo",
  scaling_up: "đang tăng tốc", scaling_down: "đang giảm tốc", offer_shift: "đổi ưu đãi",
  format_shift: "đổi định dạng", baseline_week: "tuần nền",
  first_week_no_comparison_available: "tuần đầu, chưa có so sánh",
  // action / priority
  copy: "học theo", adapt: "điều chỉnh", counter: "phản đòn", avoid: "tránh", monitor: "theo dõi",
  copy_structure: "học cấu trúc", adapt_angle: "điều chỉnh góc", counter_positioning: "phản định vị",
  avoid_due_to_risk: "tránh (rủi ro)", test_now: "test ngay", ignore: "bỏ qua",
  high: "cao", medium: "trung bình", low: "thấp",
  // visual
  offer_banner: "banner ưu đãi", ugc_selfie: "UGC / tự quay", doctor_expert: "bác sĩ chuyên môn",
  clinic_room: "không gian phòng khám", product_packshot: "sản phẩm / thiết bị",
  testimonial_screenshot: "ảnh chụp review", luxury_beauty: "làm đẹp cao cấp",
  // insight_type (Action Plan)
  data_quality_warning: "cảnh báo chất lượng dữ liệu", competitor_scaling: "đối thủ tăng tốc",
  hook_trend: "xu hướng hook", offer_trend: "xu hướng ưu đãi", creative_format_trend: "xu hướng định dạng",
  skill_psychology: "phân tích tâm lý", skill_offer: "phân tích ưu đãi",
  skill_strategy: "phân tích chiến lược", skill_creative: "đề xuất sáng tạo",
  unknown: "chưa rõ",
};

/** Cụm tiếng Anh hay lọt vào narrative -> tiếng Việt (regex, áp theo thứ tự). */
const VI_PHRASES = [
  [/\bactive ads\b/gi, "ads đang chạy"],
  [/\btop movers?\b/gi, "biến động mạnh nhất"],
  [/\bvalue[- ]?frame\b/gi, "khung giá trị"],
  [/\bprice[- ]?frame\b/gi, "khung giá"],
  [/\bfree[- ]?frame\b/gi, "khung miễn phí"],
  [/\bvalue[- ]?reframe\b/gi, "đổi khung sang giá trị"],
  [/\bcounter[- ]?creative\b/gi, "mẫu quảng cáo phản đòn"],
  [/\bcounter[- ]?offer\b/gi, "ưu đãi phản đòn"],
  [/\bcounter[- ]?positioning\b/gi, "phản định vị"],
  [/\bcreatives?\b/gi, "mẫu quảng cáo"],
  [/\bconcepts?\b/gi, "ý tưởng"],
  [/\bformats?\b/gi, "định dạng"],
  [/\bangles?\b/gi, "góc tiếp cận"],
  [/\bfunnel\b/gi, "phễu"],
  [/\bobjectives?\b/gi, "mục tiêu"],
  [/\bbenchmark\b/gi, "so chuẩn"],
  [/\bscaling\b/gi, "nhân rộng"],
  [/\bswap\b/gi, "thay thế"],
  [/\bwhitespace\b/gi, "khoảng trống thị trường"],
  [/\bloss[- ]?leader\b/gi, "giá mồi chịu lỗ"],
  [/\blead[- ]?gen\b/gi, "kéo khách tiềm năng"],
  [/\banti[- ]?pressure\b/gi, "không áp lực chốt sale"],
  [/\bquiet luxury\b/gi, "sang trọng kín đáo"],
  [/\bcalm science\b/gi, "khoa học điềm tĩnh"],
  [/\bself[- ]?worth\b/gi, "giá trị tự thân"],
  [/\bdiagnosis[- ]?reframe\b/gi, "đổi khung chẩn đoán"],
  [/\bresult promise\b/gi, "lời hứa kết quả"],
  [/\bbrand[- ]?led\b/gi, "dẫn bằng thương hiệu"],
  [/\bauthority[- ]?first\b/gi, "uy tín trước tiên"],
  [/\bevergreen\b/gi, "chạy bền dài hạn"],
  [/\bday[- ]?7\b/gi, "ngày thứ 7"],
  [/\blanding pages?\b/gi, "trang đích"],
  [/\btestimonials?\b/gi, "lời chứng thực"],
  [/\bsocial proof\b/gi, "bằng chứng số đông"],
  [/\bbefore[\/ -]?after\b/gi, "trước/sau"],
  [/\bfear[- ]based\b/gi, "đánh vào nỗi sợ"],
  [/\bprice war\b/gi, "đua giá"],
  [/\[high\]/gi, "[Ưu tiên cao]"],
  [/\[medium\]/gi, "[Trung bình]"],
  [/\[low\]/gi, "[Thấp]"],
  // ---- bổ sung từ đợt quét dữ liệu cũ ----
  [/\bblitz\b/gi, "bung ồ ạt"],
  [/\bvolume\b/gi, "số lượng"],
  [/\bexplainer\b/gi, "giải thích"],
  [/\bdoctor expert\b/gi, "bác sĩ chuyên môn"],
  [/\bugc selfie\b/gi, "khách tự quay"],
  [/\btop new ads\b/gi, "các ad mới nổi bật"],
  [/\bad active\b/gi, "ad đang chạy"],
  [/\bvalue equation\b/gi, "phương trình giá trị"],
  [/\bvalue[- ]?led\b/gi, "dẫn bằng giá trị"],
  [/\bshame[- ]?based\b/gi, "khung chê bai"],
  [/\boffer[- ]?variant\b/gi, "biến thể ưu đãi"],
  [/\bdeliverable\b/gi, "sản phẩm cầm về"],
  [/\boverride\b/gi, "phủ quyết"],
  [/\breframe\b/gi, "đổi khung"],
  [/\blaunch\b/gi, "ra mắt"],
  [/\bgrowth\b/gi, "tăng trưởng"],
  [/\btesting\b/gi, "thử nghiệm"],
  [/\bconversion\b/gi, "chuyển đổi"],
  [/\bstatic\b/gi, "ảnh tĩnh"],
  [/\bpremium\b/gi, "cao cấp"],
  [/\bscaled?\b/gi, "nhân rộng"],
  [/\bpromise\b/gi, "lời hứa"],
  [/\bcounter\b/gi, "phản đòn"],
  [/\boffers?\b/gi, "ưu đãi"],
  [/\bimage\b/gi, "ảnh"],
  [/\bactive ads?\b/gi, "ad đang chạy"],
  [/\bactive\b/gi, "đang chạy"],
  [/\bconsultation\b/gi, "tư vấn"],
  [/\bpromotions?\b/gi, "khuyến mãi"],
  [/\bcopy\b/gi, "học theo"],
  [/\bhook_type=/gi, "hook "],
  [/\bformat=/gi, "định dạng "],
];

const str = (v) => (v === undefined || v === null ? "" : String(v));

/** Dịch 1 token enum (giữ nguyên nếu không có nhãn). */
export function viEnum(token) {
  const t = str(token).trim();
  return VI_ENUM[t.toLowerCase()] || t;
}

/** Việt hóa free-text: dịch cụm đã biết + token snake_case có nhãn. */
export function viText(text) {
  let s = str(text);
  if (!s) return s;
  for (const [re, vi] of VI_PHRASES) s = s.replace(re, vi);
  s = s.replace(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/gi, (tok) => VI_ENUM[tok.toLowerCase()] || tok);
  return s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
}

/** Việt hóa chuỗi "key (count) | key (count)" — dịch phần key, giữ (count). */
export function viTopList(value) {
  return str(value)
    .split("|")
    .map((item) => {
      const m = item.trim().match(/^(.*?)\s*(\([^)]*\))?$/);
      if (!m) return item.trim();
      const key = viEnum(m[1].trim()) || m[1].trim();
      return m[2] ? `${key} ${m[2]}` : key;
    })
    .filter(Boolean)
    .join(" | ");
}

/** Từ tiếng Anh ĐƯỢC PHÉP còn lại trong text tiếng Việt (jargon đội quen dùng / tên riêng). */
const EN_WHITELIST = new Set([
  "ads", "ad", "hook", "hooks", "cta", "video", "videos", "livestream", "live", "messenger", "facebook",
  "inbox", "kol", "koc", "ugc", "combo", "spa", "clinic", "beauty", "center", "house", "group",
  "demo", "review", "reviews", "email", "web", "website", "page", "pages", "fanpage", "traffic",
  "lead", "leads", "form", "carousel", "collection", "banner", "story", "reels", "feed",
  "hifu", "thermage", "ultherapy", "rf", "laser", "pico", "fotona", "sofwave", "collagen", "exosome",
  "meso", "mesotherapy", "filler", "botox", "skin", "booster", "detox", "peel", "spy", "top",
  "seryn", "vs", "test", "voucher", "deal", "sale", "black", "friday", "noel", "vip",
  "crawl", "brand", "brands", "spend", "roas", "cpa", "weekly", "monthly",
  "fomo", "claim", "claims", "selfie", "own", "brief", "sejung", "aqua", "mega",
  "strategy", "psych", "creative", // tham chiếu file phân tích (strategy.md, psych.md, creative.md)
]);

/**
 * Quét chuỗi tìm từ tiếng Anh KHÔNG nằm trong whitelist (chốt chặn leak, chỉ để warn).
 * Tách TỪ NGUYÊN VẸN theo ranh giới Unicode (từ có dấu = tiếng Việt, bỏ qua);
 * từ thuần ASCII chỉ bị nghi là tiếng Anh khi mang đặc điểm KHÔNG THỂ có trong
 * âm tiết tiếng Việt không dấu: chứa f/j/w/z, chữ đôi (ee/ll...), cụm phụ âm đầu
 * ngoài bộ VN (st/sp/br/cr...), hoặc hậu tố Anh (-ing/-tion/-ment/-ed...).
 */
export function findEnglishLeaks(text) {
  const s = str(text);
  if (!s) return [];
  const words = s.split(/[^\p{L}_-]+/u).filter(Boolean);
  const leaks = new Set();
  const EN_SIGNAL = new RegExp([
    "[fjwz]",                                   // phụ âm không có trong tiếng Việt
    "([a-z])\\1",                               // chữ đôi (ee, ll, ss, oo...)
    "^(s[tpckml]|b[lr]|c[lr]|d[rw]|f[lr]|g[lr]|p[lr]|str|scr|spr|wh)", // cụm phụ âm đầu ngoài bộ VN
    "(ing|tion|sion|ment|ness|ship|able|ible|ally|ed|ive)$",           // hậu tố Anh
  ].join("|"), "i");
  for (const w of words) {
    if (!/^[A-Za-z][A-Za-z_-]{2,}$/.test(w)) continue; // có dấu / quá ngắn -> bỏ
    if (/^[a-z]+[A-Z]/.test(w)) continue; // camelCase = tên dataset/schema (được phép)
    const lw = w.toLowerCase();
    if (EN_WHITELIST.has(lw)) continue;
    if (VI_ENUM[lw]) { leaks.add(w); continue; } // enum có nhãn mà chưa dịch
    if (lw.includes("_")) continue; // snake_case không có nhãn = tên field/schema (được phép)
    if (EN_SIGNAL.test(lw)) leaks.add(w);
  }
  return [...leaks];
}
