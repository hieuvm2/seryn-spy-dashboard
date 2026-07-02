/* ============================================================
   SERYN Spy Ads — lớp hiển thị tiếng Việt.
   Dịch enum (schema tiếng Anh) + free-text server sinh ra sang tiếng Việt
   lúc hiển thị. Dữ liệu gốc giữ nguyên enum để tương thích CSV/Sheet.
   Pipeline thêm enum mới -> thêm nhãn ở đây.
   ============================================================ */
import { isMissing } from "./spyData";

/** Bảng dịch nhãn enum (schema tiếng Anh) -> hiển thị tiếng Việt. */
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
