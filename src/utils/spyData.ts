/* ============================================================
   SERYN Spy Ads — data utilities
   CSV parsing (Vietnamese-safe), localStorage, table merge.
   ============================================================ */
import type { SpyDashboardData, SpyTableName, DataSourceType } from "../types";

const STORAGE_KEY = "seryn_spy_dashboard_data_v2";

/** Map a SpyDashboardData key to the signature column found in its CSV header. */
export const TABLE_SIGNATURES: Record<SpyTableName, string> = {
  brandWeeklySnapshot: "total_active_ads",
  adLevelAnalysis: "ad_snapshot_url",
  scaledContentAnalysis: "content_cluster_id",
  weeklyStrategyChange: "strategic_change_type",
  serynContentRecommendations: "recommendation_type",
};

export const TABLE_LABELS: Record<SpyTableName, string> = {
  brandWeeklySnapshot: "Tổng hợp tuần theo đối thủ",
  adLevelAnalysis: "Phân tích từng quảng cáo",
  scaledContentAnalysis: "Nội dung đang nhân rộng",
  weeklyStrategyChange: "Thay đổi chiến lược tuần",
  serynContentRecommendations: "Gợi ý nội dung cho SERYN",
};

/** Cột bắt buộc của mỗi dataset (Data Health Check). KHÔNG đổi schema gốc. */
export const REQUIRED_COLUMNS: Record<SpyTableName, string[]> = {
  brandWeeklySnapshot: [
    "week_date", "brand_name", "total_active_ads", "services_running",
    "offers_detected", "main_content_formats", "main_angles", "scaled_content_count",
  ],
  adLevelAnalysis: [
    "week_date", "brand_name", "ad_id", "start_date", "days_active", "hook_text",
    "service_or_product", "content_format", "content_angle", "is_likely_scaled", "scale_level",
  ],
  scaledContentAnalysis: [
    "week_date", "brand_name", "representative_hook", "service_or_product", "content_format",
    "content_angle", "number_of_similar_ads", "longest_days_active", "scale_level",
    "why_it_is_scaling", "seryn_reframe",
  ],
  weeklyStrategyChange: [
    "week_date", "brand_name", "active_ads_change", "new_ads_count", "stopped_ads_count",
    "strategic_change_type", "change_summary", "seryn_implication",
  ],
  serynContentRecommendations: [
    "week_date", "recommendation_type", "market_signal", "competitor_evidence",
    "seryn_content_niche", "suggested_content_format", "suggested_hook", "content_style",
    "main_message", "proof_to_use", "cta", "priority",
  ],
};

export type DataHealthRow = {
  key: SpyTableName;
  label: string;
  loaded: boolean;
  rows: number;
  missingCols: string[];
};

/** Kiểm tra sức khỏe dữ liệu: loaded/missing, số dòng, cột bắt buộc còn thiếu. */
export function checkDataHealth(data: SpyDashboardData): DataHealthRow[] {
  return (Object.keys(REQUIRED_COLUMNS) as SpyTableName[]).map((key) => {
    const arr = ((data[key] as unknown) as Record<string, unknown>[]) || [];
    const rows = arr.length;
    const loaded = rows > 0;
    let missingCols: string[];
    if (loaded) {
      const present = new Set<string>();
      arr.forEach((row) => Object.keys(row).forEach((k) => present.add(k.toLowerCase())));
      missingCols = REQUIRED_COLUMNS[key].filter((c) => !present.has(c.toLowerCase()));
    } else {
      missingCols = REQUIRED_COLUMNS[key].slice();
    }
    return { key, label: TABLE_LABELS[key], loaded, rows, missingCols };
  });
}

/* ---------------- Lịch sử snapshot theo tuần ---------------- */
export const WEEKLY_HISTORY_KEY = "seryn_spy_weekly_history_v1";

export function loadWeeklyHistory(): Record<string, SpyDashboardData> {
  try {
    const raw = localStorage.getItem(WEEKLY_HISTORY_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

/** Lưu snapshot hiện tại vào lịch sử, keyed theo week_date. Trả về week_date đã lưu (hoặc null). */
export function saveWeekToHistory(data: SpyDashboardData): string | null {
  const wk = data.brandWeeklySnapshot && data.brandWeeklySnapshot[0]
    ? String(data.brandWeeklySnapshot[0].week_date || "").trim()
    : "";
  if (!wk || isMissing(wk)) return null;
  try {
    const hist = loadWeeklyHistory();
    hist[wk] = data;
    localStorage.setItem(WEEKLY_HISTORY_KEY, JSON.stringify(hist));
    return wk;
  } catch {
    return null;
  }
}

/** Danh sách tuần đã lưu, mới nhất trước. */
export function getHistoryWeeks(): string[] {
  return Object.keys(loadWeeklyHistory()).sort((a, b) => (a < b ? 1 : -1));
}

export function clearWeeklyHistory(): void {
  try { localStorage.removeItem(WEEKLY_HISTORY_KEY); } catch { /* noop */ }
}

/* ---------------- Nguồn dữ liệu (DEMO / CSV / FOLDER / SHEET) ---------------- */
const SOURCE_KEY = "seryn_spy_source_v2";

export const SOURCE_LABELS: Record<DataSourceType, string> = {
  demo: "DỮ LIỆU MẪU",
  "local-csv": "CSV THỦ CÔNG",
  "online-sheet": "GOOGLE SHEETS",
  "online-supabase": "SUPABASE",
  "offline-cache": "BẢN OFFLINE",
};

export function saveSourceType(src: DataSourceType): void {
  try { localStorage.setItem(SOURCE_KEY, src); } catch { /* noop */ }
}
export function loadSourceType(): DataSourceType | null {
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    return v === "demo" || v === "local-csv" || v === "online-sheet" || v === "offline-cache" ? v : null;
  } catch {
    return null;
  }
}
export function clearSourceType(): void {
  try { localStorage.removeItem(SOURCE_KEY); } catch { /* noop */ }
}

/** Parse CSV text into row objects. Handles quoted fields, escaped quotes,
 *  CRLF, a UTF-8 BOM and Vietnamese characters. Never throws on ragged rows. */
export function parseCSV(text: string): Record<string, string>[] {
  if (!text) return [];
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* skip */
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const clean = rows.filter(
    (r) => r.length > 1 || (r.length === 1 && r[0].trim() !== "")
  );
  if (!clean.length) return [];

  const header = clean[0].map((h) => String(h || "").trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < clean.length; r++) {
    const raw = clean[r];
    if (!raw || raw.every((v) => String(v).trim() === "")) continue;
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = i < raw.length ? String(raw[i]).trim() : "";
    });
    out.push(obj);
  }
  return out;
}

/** Coerce anything to a finite number; non-numeric -> 0. */
export function normalizeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = parseFloat(String(value).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Split a pipe/comma/semicolon-separated cell into clean chips. */
export function splitChips(value?: string): string[] {
  if (!value) return [];
  const t = String(value).trim();
  if (!t || isMissing(t)) return [];
  return t
    .split(/[|;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Chip đầu tiên trong chuỗi "a|b|c" (rỗng nếu không có). */
export function firstChip(value?: string): string {
  return splitChips(value)[0] ?? "";
}

/** True when a value should be treated as "no data". */
export function isMissing(v: unknown): boolean {
  const t = String(v == null ? "" : v)
    .trim()
    .toLowerCase();
  return (
    t === "" ||
    t === "unknown" ||
    t === "missing_data" ||
    t === "none" ||
    t === "first_week_no_comparison_available"
  );
}

/** Display helper: trả về giá trị hoặc "chưa rõ". */
export function orUnknown(v: unknown): string {
  return isMissing(v) ? "chưa rõ" : String(v).trim();
}

/** Bảng dịch nhãn enum (schema tiếng Anh) -> hiển thị tiếng Việt.
 *  Dữ liệu gốc giữ nguyên enum để tương thích CSV; chỉ đổi phần hiển thị. */
const VI_LABELS: Record<string, string> = {
  // content_format
  doctor_explainer: "Bác sĩ giải thích",
  before_after: "Trước / sau",
  offer_promotion: "Khuyến mãi",
  service_demo: "Demo dịch vụ",
  customer_testimonial: "Khách hàng kể",
  kol_review: "KOL đánh giá",
  educational_post: "Bài giáo dục",
  problem_solution: "Vấn đề – giải pháp",
  technology_proof: "Chứng minh công nghệ",
  facility_trust: "Cơ sở vật chất",
  consultation_lead: "Dẫn tư vấn",
  seasonal_campaign: "Chiến dịch theo mùa",
  ugc_style: "Khách tự quay",
  // hook_type / angle
  problem_led: "Khơi vấn đề",
  fear_based: "Dựa nỗi sợ",
  insight_led: "Khơi sự thật ngầm",
  doctor_authority: "Uy tín bác sĩ",
  offer_led: "Dẫn bằng ưu đãi",
  consultation_led: "Dẫn tư vấn",
  transformation_led: "Lột xác",
  social_proof: "Bằng chứng số đông",
  curiosity: "Tò mò",
  education_led: "Giáo dục",
  premium_positioning: "Định vị cao cấp",
  transformation: "Lột xác",
  medical_authority: "Uy tín y khoa",
  education: "Giáo dục",
  price_promotion: "Khuyến mãi giá",
  urgency: "Tạo gấp gáp",
  celebrity_proof: "Người nổi tiếng",
  premium_luxury: "Sang trọng cao cấp",
  technology: "Công nghệ",
  safety: "An toàn",
  personal_confidence: "Tự tin cá nhân",
  natural_rejuvenation: "Trẻ hóa tự nhiên",
  biological_foundation: "Nền tảng sinh học",
  // service_or_product
  skin_analysis: "Phân tích da",
  facial_rejuvenation: "Trẻ hóa da mặt",
  // ---- Exa detected_services (khác bộ service_or_product) ----
  skin_rejuvenation: "Trẻ hóa da",
  skin_booster: "Skin booster",
  facial_spa: "Chăm sóc da mặt",
  wellness_beauty: "Thẩm mỹ wellness",
  melasma_treatment: "Trị nám",
  pigmentation_treatment: "Trị sắc tố",
  acne_treatment: "Trị mụn",
  laser_treatment: "Điều trị laser",
  collagen_stimulation: "Kích thích collagen",
  lifting_firming: "Nâng cơ / căng da",
  filler_botox: "Filler / Botox",
  facial_contouring: "Tạo đường nét mặt",
  body_slimming: "Giảm béo",
  hair_removal: "Triệt lông",
  surgery: "Phẫu thuật",
  dental_aesthetics: "Nha khoa thẩm mỹ",
  anti_aging_consultation: "Tư vấn chống lão hóa",
  hormone_biology_assessment: "Đánh giá nền tảng sinh học",
  nutrition_lifestyle: "Dinh dưỡng / lối sống",
  // proof_point
  doctor_expert: "Bác sĩ chuyên môn",
  "kol_celebrity": "KOL / người nổi tiếng",
  technology_machine: "Công nghệ / máy móc",
  clinic_facility: "Cơ sở phòng khám",
  certificate_license: "Chứng nhận / giấy phép",
  scientific_explanation: "Giải thích khoa học",
  media_coverage: "Báo chí đưa tin",
  social_count: "Lượt tương tác",
  guarantee: "Cam kết / bảo hành",
  price_proof: "Bằng chứng giá",
  no_clear_proof: "Chưa rõ bằng chứng",
  customer_context: "Bối cảnh khách hàng",
  // cta
  "send message": "Nhắn tin",
  "call now": "Gọi ngay",
  "sign up": "Đăng ký",
  "learn more": "Tìm hiểu thêm",
  "book now": "Đặt lịch",
  "contact us": "Liên hệ",
  "get offer": "Nhận ưu đãi",
  comment: "Bình luận",
  // copy/adapt/counter/avoid
  copy: "Học theo",
  adapt: "Điều chỉnh",
  counter: "Phản đòn",
  avoid: "Tránh",
  monitor: "Theo dõi",
  // strategic_change_type
  came_online: "Bắt đầu chạy QC",
  still_dark: "Vẫn im ắng",
  went_dark: "Ngừng chạy QC",
  stable: "Ổn định",
  stable_creative_refresh: "Ổn định, xoay nội dung",
  scaling_up: "Đang tăng tốc",
  scaling_down: "Đang giảm tốc",
  offer_shift: "Đổi ưu đãi",
  format_shift: "Đổi định dạng",
  baseline_week: "Tuần nền",
  // recommendation_type
  content_format: "Định dạng nội dung",
  counter_offer: "Phản đòn ưu đãi",
  proof_strategy: "Chiến lược bằng chứng",
  niche_whitespace: "Ngách bỏ trống",
  format_test: "Thử định dạng",
  // priority
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
  // ---- Hook Intelligence: hook_category ----
  pain_point: "Khơi nỗi đau",
  desire_outcome: "Khơi mong muốn",
  authority: "Uy tín chuyên môn",
  fear_loss_aversion: "Sợ mất / hối tiếc",
  myth_busting: "Vạch lầm tưởng",
  mistake_warning: "Cảnh báo sai lầm",
  comparison: "So sánh",
  testimonial: "Lời chứng thực",
  diagnosis_problem: "Chẩn đoán tình trạng",
  consultation_invite: "Mời tư vấn",
  // ---- hook_formula ----
  question_hook: "Mở bằng câu hỏi",
  mistake_hook: "Mở bằng sai lầm",
  secret_hook: "Mở bằng bí mật",
  doctor_explains: "Bác sĩ giải thích",
  customer_story: "Câu chuyện khách hàng",
  limited_offer: "Ưu đãi giới hạn",
  free_consultation: "Tư vấn miễn phí",
  myth_vs_truth: "Lầm tưởng vs sự thật",
  comparison_hook: "Mở bằng so sánh",
  checklist_hook: "Mở bằng danh sách",
  symptom_diagnosis: "Chẩn đoán dấu hiệu",
  result_promise: "Hứa kết quả",
  fear_to_relief: "Lo lắng → an tâm",
  aspiration_identity: "Khát vọng / bản sắc",
  // ---- hook_angle ----
  medical_trust: "Niềm tin y khoa",
  beauty_transformation: "Biến đổi nhan sắc",
  natural_youth: "Trẻ trung tự nhiên",
  anti_aging: "Chống lão hóa",
  confidence_recovery: "Lấy lại tự tin",
  expert_consultation: "Tư vấn chuyên gia",
  technology_based: "Dựa trên công nghệ",
  social_proof_led: "Dẫn bằng số đông",
  problem_diagnosis: "Chẩn đoán vấn đề",
  // ---- hook_subcategory ----
  postpartum_skin: "Da sau sinh",
  aging_skin: "Da lão hóa",
  sagging_skin: "Da chảy xệ",
  dull_skin: "Da xỉn màu",
  wrinkles_fine_lines: "Nếp nhăn",
  melasma_dark_spots: "Nám / thâm sạm",
  acne_scars: "Sẹo mụn",
  large_pores: "Lỗ chân lông to",
  sensitive_skin: "Da nhạy cảm",
  lost_confidence: "Mất tự tin",
  event_ready_beauty: "Đẹp cho sự kiện",
  doctor_consultation: "Tư vấn bác sĩ",
  free_skin_check: "Soi da miễn phí",
  before_after_result: "Kết quả trước/sau",
  technology_authority: "Uy tín công nghệ",
  // ---- ad_format ----
  image: "Ảnh",
  video: "Video",
  carousel: "Carousel (nhiều ảnh)",
  collection: "Collection",
  text_only: "Chỉ chữ",
  // ---- inferred_objective ----
  messenger: "Nhắn tin (Messenger)",
  landing_page_conversion: "Landing / chuyển đổi",
  lead_form: "Form thu lead",
  phone_call: "Gọi điện",
  website_traffic: "Kéo traffic web",
  engagement: "Tương tác",
  branding: "Thương hiệu",
  // ---- emotional_trigger ----
  fear: "Nỗi sợ",
  hope: "Hy vọng",
  trust: "Niềm tin",
  vanity: "Tự tôn nhan sắc",
  belonging: "Thuộc về số đông",
  relief: "An tâm",
  aspiration: "Khát vọng",
  // ---- scale_signal ----
  none: "Chưa có tín hiệu",
  early_signal: "Tín hiệu sớm",
  repeated_signal: "Lặp lại",
  strong_persistence_signal: "Bền vững (mạnh)",
  evergreen_persistence_signal: "Evergreen (rất bền)",
  // ---- recommended_seryn_action (hook) ----
  copy_structure: "Học cấu trúc",
  adapt_angle: "Điều chỉnh góc",
  counter_positioning: "Phản định vị",
  avoid_due_to_risk: "Tránh (rủi ro)",
  test_now: "Test ngay",
  // ---- content_angle (weekly-spy) còn thiếu ----
  fear_aging: "Khơi sợ lão hóa",
  premium: "Cao cấp",
  consultation: "Tư vấn",
  // ---- funnel_stage ----
  awareness: "Nhận biết",
  consideration: "Cân nhắc",
  conversion: "Chuyển đổi",
  retargeting: "Tiếp thị lại",
  // ---- visual_format / visual_angle ----
  ugc_selfie: "UGC / tự quay",
  clinic_room: "Không gian phòng khám",
  product_packshot: "Sản phẩm / thiết bị",
  testimonial_screenshot: "Ảnh chụp review",
  offer_banner: "Banner ưu đãi",
  luxury_beauty: "Làm đẹp cao cấp",
  educational: "Giáo dục",
  promotion: "Khuyến mãi",
  luxury: "Sang trọng",
  unknown: "Chưa rõ",
  // ---- status / meta hiển thị ----
  active: "Đang chạy",
  own: "Thương hiệu SERYN",
  facebook: "Facebook",
  demo: "Dữ liệu mẫu",
  hook_intelligence: "Hook Intelligence",
  weekly: "Tuần",
  monthly: "Tháng",
  // ---- change_type (Weekly Change Insights) ----
  new_page_detected: "Phát hiện page mới",
  service_focus_shifted: "Đổi trọng tâm dịch vụ",
  offer_changed: "Thay đổi ưu đãi",
  same_concept_new_variants: "Biến thể mới cùng concept",
  // ---- recommended_action bổ sung ----
  ignore: "Bỏ qua",
  // ---- recommendation_type bổ sung ----
  hook_content_opportunity: "Cơ hội nội dung từ hook",
  // ---- trạng thái đối thủ / crawl run (badge Cấu hình đối thủ, Discovery) ----
  ok: "Sẵn sàng",
  inactive: "Ngưng",
  needs_page_id: "Thiếu page_id",
  crawl_error: "Lỗi crawl",
  success: "Thành công",
  failed: "Thất bại",
  partial: "Một phần",
  running: "Đang chạy",
  // ---- category đối thủ (free-form) ----
  hospital: "Bệnh viện",
  spa: "Spa",
  clinic: "Phòng khám",
  // ---- testType (SerynBenchmark "Test tuần này") ----
  "content angle": "Angle nội dung",
  offer: "Ưu đãi",
  format: "Định dạng",
  funnel: "Funnel",
  visual: "Visual",
  cta: "CTA",
};

/** Dịch một token enum sang tiếng Việt (giữ nguyên nếu không có trong bảng). */
export function viLabel(value?: string): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (isMissing(raw)) return "chưa rõ";
  return VI_LABELS[raw.toLowerCase()] || raw;
}

/** Có phải giá trị "rỗng nghĩa" (unknown / no_clear / chưa rõ) không -> để ẩn chip. */
export function isMeaningful(value?: unknown): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  return !!s && s !== "unknown" && s !== "chưa rõ" && s !== "no_clear_offer" && s !== "no_clear_proof" && s !== "none" && s !== "n/a";
}

/* Cụm tiếng Anh do script server sinh ra (dữ liệu cũ trên Sheet) -> dịch lúc hiển thị.
   Áp cho free-text như why_it_is_scaling / seryn_reframe / scale_reason. */
const FREE_TEXT_EN: Array<[RegExp, string]> = [
  [/likely scaled based on duration and repetition/gi, "Có thể đang nhân rộng dựa trên thời lượng + lặp lại"],
  [/\bcủa unknown\b/gi, ""],
  [/\bunknown\b/gi, "dịch vụ chăm sóc da"],
  [/\bfacial rejuvenation\b/gi, "trẻ hóa da"],
  [/\bfacial contouring\b/gi, "tạo đường nét gương mặt"],
  [/\bpigmentation treatment\b/gi, "điều trị sắc tố"],
  [/\bmelasma treatment\b/gi, "điều trị nám"],
  [/\bacne treatment\b/gi, "điều trị mụn"],
  [/\blaser treatment\b/gi, "điều trị laser"],
  [/\bcollagen stimulation\b/gi, "kích thích collagen"],
  [/\blifting firming\b/gi, "nâng cơ săn chắc da"],
  [/\bfiller botox\b/gi, "filler/botox"],
  [/\bbody slimming\b/gi, "giảm béo"],
  [/\bhair removal\b/gi, "triệt lông"],
  [/\bdental aesthetics\b/gi, "thẩm mỹ răng"],
  [/\banti aging consultation\b/gi, "chống lão hóa"],
  [/\bhormone biology assessment\b/gi, "đánh giá nền tảng sinh học"],
  [/\bnutrition lifestyle\b/gi, "dinh dưỡng & lối sống"],
  [/\bskin analysis\b/gi, "phân tích da"],
  [/\bskin rejuvenation\b/gi, "trẻ hóa da"],
  // ---- cụm hay gặp trong báo cáo tuần/tháng (key_competitor_moves, patterns, implications...) ----
  [/\bactive ads\b/gi, "ads đang chạy"],
  [/\btop movers\b/gi, "biến động mạnh nhất"],
  [/\boffer banner\b/gi, "banner ưu đãi"],
  [/\bchurn creative\b/gi, "tốc độ thay creative"],
  [/\bangle authority\b/gi, "góc uy tín chuyên môn"],
  [/\bsocial proof\b/gi, "bằng chứng số đông"],
  [/\bbefore[\/ -]?after\b/gi, "trước/sau"],
  [/\bfear[- ]based\b/gi, "đánh vào nỗi sợ"],
  [/\bprice war\b/gi, "đua giá"],
  [/\bwhitespace\b/gi, "khoảng trống thị trường"],
  [/\beducation\b/gi, "giáo dục"],
  [/\btransformation\b/gi, "lột xác"],
  [/\burgency\b/gi, "tạo cấp bách"],
  [/\bauthority\b/gi, "uy tín chuyên môn"],
  [/\[high\]/gi, "[Ưu tiên cao]"],
  [/\[medium\]/gi, "[Trung bình]"],
  [/\[low\]/gi, "[Thấp]"],
  [/^Counter\b/g, "Phản đòn:"],
  [/^Adapt\b/g, "Học hỏi:"],
  [/^Copy\b/g, "Áp dụng:"],
  [/^Avoid\b/g, "Tránh:"],
  [/^Monitor\b/g, "Theo dõi:"],
];
/** Dịch các cụm tiếng Anh đã biết trong free-text (giữ phần còn lại nguyên văn). */
export function humanizeText(value?: string): string {
  let s = String(value ?? "");
  if (!s) return s;
  for (const [re, vi] of FREE_TEXT_EN) s = s.replace(re, vi);
  // Dịch token snake_case (vd doctor_explainer, offer_led) nếu có nhãn tiếng Việt.
  s = s.replace(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/gi, (tok) => {
    const vi = VI_LABELS[tok.toLowerCase()];
    return vi || tok;
  });
  return s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
}

/** Detect which spy table a parsed CSV belongs to (by header signature). */
export function detectTable(rows: Record<string, string>[]): SpyTableName | null {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]).map((c) => c.toLowerCase());
  for (const key of Object.keys(TABLE_SIGNATURES) as SpyTableName[]) {
    if (cols.includes(TABLE_SIGNATURES[key])) return key;
  }
  return null;
}

/** Replace one table inside the dataset, leaving the others intact. */
export function mergeImportedTable(
  data: SpyDashboardData,
  tableName: SpyTableName,
  rows: Record<string, string>[]
): SpyDashboardData {
  return { ...data, [tableName]: rows as never };
}

export function loadSpyDataFromLocalStorage(): SpyDashboardData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.brandWeeklySnapshot)) {
      return parsed as SpyDashboardData;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSpyDataToLocalStorage(data: SpyDashboardData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Không lưu được dữ liệu spy vào localStorage:", e);
  }
}

export function clearSpyDataLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Không xóa được localStorage:", e);
  }
}

/** Count frequency of chip values across a column, sorted desc. */
export function countChips(
  rows: Array<Record<string, any>>,
  field: string
): { label: string; n: number }[] {
  const map: Record<string, { label: string; n: number }> = {};
  rows.forEach((r) => {
    splitChips(r[field]).forEach((item) => {
      const k = item.toLowerCase();
      if (!map[k]) map[k] = { label: item, n: 0 };
      map[k].n++;
    });
  });
  return Object.values(map).sort((a, b) => b.n - a.n);
}

/** Scale-level metadata for badges. */
export function scaleMeta(level: unknown): { label: string; tone: "slate" | "sky" | "amber" | "rose" } {
  const n = normalizeNumber(level);
  switch (n) {
    case 1:
      return { label: "Tín hiệu yếu", tone: "slate" };
    case 2:
      return { label: "Tín hiệu lặp lại", tone: "sky" };
    case 3:
      return { label: "Tín hiệu mạnh", tone: "amber" };
    case 4:
      return { label: "Chạy dài ngày (bền)", tone: "rose" };
    default:
      return { label: "Cần theo dõi", tone: "slate" };
  }
}

export { STORAGE_KEY };

/* Nguồn dữ liệu: Google Sheets (online) hoặc nhập CSV thủ công. Tính năng
   "đọc cả thư mục project" (File System Access API) đã được gỡ — chỉ chạy
   được trên máy cá nhân và không dùng được trên bản online. */
