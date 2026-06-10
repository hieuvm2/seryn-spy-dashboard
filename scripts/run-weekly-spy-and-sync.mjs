/* ============================================================
   SERYN Spy — Local pipeline: MOCK data -> Google Sheets
   Chạy: npm run spy:sync   (trên máy local, KHÔNG dùng ở frontend)

   - Sinh dữ liệu spy ads MẪU/MOCK đúng schema 5 bảng.
   - Ghi lên Google Sheets bằng Google Sheets API (service account).
   - Đọc cấu hình từ .env: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_FILE.

   Bước này CHỈ test pipeline ghi Sheet — chưa pull ads thật.
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SA_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/** week_date = thứ Hai của tuần hiện tại (YYYY-MM-DD). */
function currentMonday() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Mon
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
const WEEK = currentMonday();

function fail(msg) {
  console.error("\n[X] " + msg + "\n");
  process.exit(1);
}

/* ---------------- kiểm tra cấu hình ---------------- */
if (!SHEET_ID) fail("Thiếu GOOGLE_SHEET_ID trong .env. Hãy copy .env.example thành .env và điền.");
if (!SA_FILE) fail("Thiếu GOOGLE_SERVICE_ACCOUNT_FILE trong .env (đường dẫn file service account JSON).");
if (!fs.existsSync(SA_FILE)) {
  fail(
    `Không tìm thấy service account JSON tại:\n   ${SA_FILE}\n\n` +
    "  → Tạo Service Account ở Google Cloud Console, bật Google Sheets API,\n" +
    "    tải file JSON về đúng đường dẫn trên (đặt NGOÀI repo, vd thư mục secrets/).\n" +
    "  → Mở file JSON lấy 'client_email' và Share Google Sheet (quyền Editor) cho email đó.\n" +
    "  Xem chi tiết: docs/GOOGLE_SHEETS_LOCAL_SYNC.md"
  );
}

/* ---------------- headers (đúng schema) ---------------- */
const HEADERS = {
  snapshot: "week_date,brand_name,page_urls,page_ids,total_active_ads,total_ads_collected,num_pages_running,services_running,prices_detected,offers_detected,main_content_formats,main_hooks,main_angles,main_proof_points,main_ctas,scaled_content_count,new_ads_count,stopped_ads_count,content_strategy_summary,weekly_change_summary,seryn_opportunity".split(","),
  ads: "week_date,brand_name,page_id,page_name,ad_id,ad_snapshot_url,status,start_date,days_active,media_type,platforms,headline,primary_text,hook_text,hook_type,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,cta,funnel_stage,is_new_this_week,was_seen_previous_week,is_likely_scaled,scale_level,scale_reason,notes".split(","),
  scaled: "week_date,brand_name,content_cluster_id,representative_ad_id,representative_hook,service_or_product,price_detected,offer_detected,content_format,content_angle,proof_point,number_of_similar_ads,longest_days_active,average_days_active,scale_level,why_it_is_scaling,competitor_strategy_interpretation,seryn_should_copy_adapt_counter_avoid,seryn_reframe".split(","),
  changes: "week_date,brand_name,active_ads_change,new_ads_count,stopped_ads_count,new_services_detected,removed_services,new_offers_detected,removed_offers,new_content_angles,removed_content_angles,scaled_content_new,scaled_content_still_running,strategic_change_type,change_summary,seryn_implication".split(","),
  recs: "week_date,recommendation_type,market_signal,competitor_evidence,seryn_content_niche,suggested_content_format,suggested_hook,content_style,main_message,proof_to_use,cta,kpi,priority".split(","),
};

const MOCK_TAG = "[MOCK] dữ liệu mẫu để test pipeline — chưa phải ads thật";

/* ---------------- MOCK data (5 brand) ---------------- */
const W = WEEK;

const snapshotRows = [
  { week_date: W, brand_name: "Bệnh viện JW Hàn Quốc", page_urls: "https://www.facebook.com/benhvienjw.vn", page_ids: "400844936646543|101055868985301", total_active_ads: 58, total_ads_collected: 58, num_pages_running: 2, services_running: "facial_rejuvenation|lifting_firming|surgery", prices_detected: "trợ giá 7-20 triệu", offers_detected: "trợ giá theo triệu|miễn phí 100%", main_content_formats: "doctor_explainer|customer_testimonial", main_hooks: "doctor_authority|education_led", main_angles: "medical_authority|education", main_proof_points: "doctor_expert|customer_testimonial", main_ctas: "Send Message|Call Now", scaled_content_count: 2, new_ads_count: 9, stopped_ads_count: 10, content_strategy_summary: MOCK_TAG + " — Bác sĩ Tú Dung dẫn dắt, giáo dục y khoa.", weekly_change_summary: "−1 ad, ổn định, xoay creative.", seryn_opportunity: "Lên tầng nền tảng sinh học toàn thân để khác biệt với JW." },
  { week_date: W, brand_name: "Viện Thẩm Mỹ LG Clinic", page_urls: "https://www.facebook.com/vienthammylgclinic", page_ids: "138495609852248", total_active_ads: 50, total_ads_collected: 50, num_pages_running: 1, services_running: "pigmentation_treatment|lifting_firming|hair_removal", prices_detected: "449K|600K", offers_detected: "449K (gốc 5.000K)|10 buổi 600K", main_content_formats: "offer_promotion|technology_proof", main_hooks: "offer_led|transformation_led", main_angles: "price_promotion|technology", main_proof_points: "technology_machine|price_proof|guarantee", main_ctas: "Send Message|Sign Up", scaled_content_count: 1, new_ads_count: 22, stopped_ads_count: 22, content_strategy_summary: MOCK_TAG + " — Giá sốc + công nghệ + guarantee.", weekly_change_summary: "Giữ 50 ad, xoay creative.", seryn_opportunity: "Phản đề 'xóa sạch' bằng cải thiện đo lường được; không đua giá." },
  { week_date: W, brand_name: "Bệnh viện Thẩm mỹ Kangnam", page_urls: "https://www.facebook.com/Thammykangnam", page_ids: "359285057508884", total_active_ads: 50, total_ads_collected: 50, num_pages_running: 1, services_running: "facial_rejuvenation|facial_contouring|filler_botox", prices_detected: "unknown", offers_detected: "trợ giá theo buổi", main_content_formats: "before_after|doctor_explainer|kol_review", main_hooks: "transformation_led|doctor_authority", main_angles: "transformation|medical_authority", main_proof_points: "before_after|doctor_expert|KOL_celebrity", main_ctas: "Send Message", scaled_content_count: 1, new_ads_count: 26, stopped_ads_count: 24, content_strategy_summary: MOCK_TAG + " — Transformation + medical authority; mạnh trẻ hóa mắt.", weekly_change_summary: "+2 ad, xoay creative.", seryn_opportunity: "Adapt giáo dục trẻ hóa vùng mắt không phẫu thuật theo cấu trúc." },
  { week_date: W, brand_name: "Thẩm mỹ viện Ngọc Dung", page_urls: "https://www.facebook.com/ngocdungbeautycenter", page_ids: "372398605948395", total_active_ads: 0, total_ads_collected: 0, num_pages_running: 0, services_running: "unknown", prices_detected: "unknown", offers_detected: "unknown", main_content_formats: "unknown", main_hooks: "unknown", main_angles: "unknown", main_proof_points: "unknown", main_ctas: "unknown", scaled_content_count: 0, new_ads_count: 0, stopped_ads_count: 0, content_strategy_summary: MOCK_TAG + " — Không có ad active (still_dark).", weekly_change_summary: "still_dark (0 → 0).", seryn_opportunity: "Tận dụng giai đoạn im ắng để phủ nội dung giáo dục nền tảng sinh học." },
  { week_date: W, brand_name: "Pensilia Beauty Clinic", page_urls: "https://www.facebook.com/pensilia", page_ids: "108600987972847", total_active_ads: 8, total_ads_collected: 8, num_pages_running: 1, services_running: "facial_rejuvenation|acne_treatment", prices_detected: "299K", offers_detected: "combo trải nghiệm 299K", main_content_formats: "customer_testimonial|offer_promotion", main_hooks: "social_proof|offer_led", main_angles: "personal_confidence|price_promotion", main_proof_points: "customer_testimonial|clinic_facility", main_ctas: "Send Message", scaled_content_count: 1, new_ads_count: 3, stopped_ads_count: 1, content_strategy_summary: MOCK_TAG + " — Spa-clinic nhỏ, KOC review + combo trải nghiệm.", weekly_change_summary: "+2 ad (mock).", seryn_opportunity: "Khác biệt bằng chiều sâu y khoa & cá nhân hóa thay vì combo đại trà." },
];

const adsRows = [
  { week_date: W, brand_name: "Bệnh viện JW Hàn Quốc", page_id: "101055868985301", page_name: "TS.BS Nguyễn Phan Tú Dung - BV JW", ad_id: "MOCK-JW-001", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-JW-001", status: "ACTIVE", start_date: "2026-03-20", days_active: 90, media_type: "video", platforms: "Facebook|Instagram", headline: "Bác sĩ Tú Dung phân tích cấu trúc gương mặt", primary_text: "Mỗi gương mặt có cấu trúc riêng — bác sĩ phân tích trước khi can thiệp.", hook_text: "Trẻ hóa không bắt đầu từ việc chọn liệu trình, mà từ việc hiểu cấu trúc của bạn", hook_type: "doctor_authority", service_or_product: "facial_rejuvenation", price_detected: "unknown", offer_detected: "tư vấn miễn phí", content_format: "doctor_explainer", content_angle: "medical_authority", proof_point: "doctor_expert", cta: "Send Message", funnel_stage: "consideration", is_new_this_week: "false", was_seen_previous_week: "true", is_likely_scaled: "true", scale_level: 4, scale_reason: "evergreen >60 ngày + nhiều biến thể", notes: MOCK_TAG },
  { week_date: W, brand_name: "Bệnh viện JW Hàn Quốc", page_id: "400844936646543", page_name: "Bệnh Viện JW", ad_id: "MOCK-JW-002", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-JW-002", status: "ACTIVE", start_date: "2026-05-30", days_active: 12, media_type: "image", platforms: "Facebook", headline: "Giải mã gen — hiểu cơ thể trước khi trẻ hóa", primary_text: "Tầm soát nền tảng sinh học cá nhân hóa.", hook_text: "Hiểu cơ thể trước khi quyết định can thiệp", hook_type: "education_led", service_or_product: "hormone_biology_assessment", price_detected: "chỉ từ 2 triệu", offer_detected: "miễn phí 100%", content_format: "educational_post", content_angle: "education", proof_point: "media_coverage", cta: "Send Message", funnel_stage: "awareness", is_new_this_week: "true", was_seen_previous_week: "false", is_likely_scaled: "false", scale_level: 1, scale_reason: "days_active<14 (testing)", notes: MOCK_TAG },
  { week_date: W, brand_name: "Viện Thẩm Mỹ LG Clinic", page_id: "138495609852248", page_name: "Viện Thẩm Mỹ LG Clinic", ad_id: "MOCK-LG-001", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-LG-001", status: "ACTIVE", start_date: "2026-04-28", days_active: 44, media_type: "image", platforms: "Facebook|Instagram", headline: "Trị nám chỉ 449K", hook_text: "Trị nám chỉ 449K (Gốc 5.000K)", primary_text: "Ưu đãi giới hạn.", hook_type: "offer_led", service_or_product: "pigmentation_treatment", price_detected: "449K", offer_detected: "449K (gốc 5.000K)", content_format: "offer_promotion", content_angle: "price_promotion", proof_point: "price_proof", cta: "Send Message", funnel_stage: "conversion", is_new_this_week: "false", was_seen_previous_week: "true", is_likely_scaled: "true", scale_level: 3, scale_reason: "30-59 ngày + offer lặp", notes: MOCK_TAG },
  { week_date: W, brand_name: "Viện Thẩm Mỹ LG Clinic", page_id: "138495609852248", page_name: "Viện Thẩm Mỹ LG Clinic", ad_id: "MOCK-LG-002", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-LG-002", status: "ACTIVE", start_date: "2026-05-15", days_active: 27, media_type: "video", platforms: "Facebook", headline: "CFU Élife nâng cơ", primary_text: "Nâng cơ viền hàm công nghệ mới.", hook_text: "Nâng cơ không xâm lấn — viền hàm gọn hơn", hook_type: "transformation_led", service_or_product: "lifting_firming", price_detected: "unknown", offer_detected: "trợ giá", content_format: "technology_proof", content_angle: "technology", proof_point: "technology_machine", cta: "Sign Up", funnel_stage: "consideration", is_new_this_week: "true", was_seen_previous_week: "false", is_likely_scaled: "true", scale_level: 2, scale_reason: "14-29 ngày", notes: MOCK_TAG },
  { week_date: W, brand_name: "Bệnh viện Thẩm mỹ Kangnam", page_id: "359285057508884", page_name: "Thẩm mỹ Kangnam", ad_id: "MOCK-KN-001", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-KN-001", status: "ACTIVE", start_date: "2026-05-18", days_active: 24, media_type: "video", platforms: "Facebook|Instagram", headline: "Cắt mí 30 phút - đôi mắt trẻ trung", primary_text: "Kết quả tự nhiên, ít sưng.", hook_text: "Đôi mắt trẻ trung tự nhiên sau 30 phút", hook_type: "transformation_led", service_or_product: "facial_rejuvenation", price_detected: "unknown", offer_detected: "trợ giá theo buổi", content_format: "before_after", content_angle: "transformation", proof_point: "before_after", cta: "Send Message", funnel_stage: "conversion", is_new_this_week: "true", was_seen_previous_week: "false", is_likely_scaled: "true", scale_level: 2, scale_reason: "14-29 ngày + format lặp", notes: MOCK_TAG },
  { week_date: W, brand_name: "Bệnh viện Thẩm mỹ Kangnam", page_id: "359285057508884", page_name: "Thẩm mỹ Kangnam", ad_id: "MOCK-KN-002", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-KN-002", status: "ACTIVE", start_date: "2026-04-10", days_active: 62, media_type: "image", platforms: "Facebook", headline: "Combo trẻ hóa đôi mắt", primary_text: "KOL chia sẻ hành trình.", hook_text: "Hành trình trẻ hóa đôi mắt cùng Kangnam", hook_type: "social_proof", service_or_product: "facial_rejuvenation", price_detected: "unknown", offer_detected: "combo ưu đãi", content_format: "kol_review", content_angle: "celebrity_proof", proof_point: "KOL_celebrity", cta: "Send Message", funnel_stage: "consideration", is_new_this_week: "false", was_seen_previous_week: "true", is_likely_scaled: "true", scale_level: 4, scale_reason: "evergreen + KOL lặp", notes: MOCK_TAG },
  { week_date: W, brand_name: "Pensilia Beauty Clinic", page_id: "108600987972847", page_name: "Pensilia", ad_id: "MOCK-PEN-001", ad_snapshot_url: "https://www.facebook.com/ads/library/?id=MOCK-PEN-001", status: "ACTIVE", start_date: "2026-05-22", days_active: 20, media_type: "image", platforms: "Facebook", headline: "Combo chăm da trải nghiệm 299K", primary_text: "Khách hàng review thực tế.", hook_text: "Làn da khỏe hơn sau buổi đầu tiên", hook_type: "social_proof", service_or_product: "facial_rejuvenation", price_detected: "299K", offer_detected: "combo trải nghiệm 299K", content_format: "customer_testimonial", content_angle: "personal_confidence", proof_point: "customer_testimonial", cta: "Send Message", funnel_stage: "conversion", is_new_this_week: "true", was_seen_previous_week: "false", is_likely_scaled: "true", scale_level: 2, scale_reason: "14-29 ngày", notes: MOCK_TAG },
];

const scaledRows = [
  { week_date: W, brand_name: "Bệnh viện JW Hàn Quốc", content_cluster_id: "MOCK-JW-CL-01", representative_ad_id: "MOCK-JW-001", representative_hook: "Trẻ hóa bắt đầu từ việc hiểu cấu trúc của bạn", service_or_product: "facial_rejuvenation", price_detected: "unknown", offer_detected: "tư vấn miễn phí", content_format: "doctor_explainer", content_angle: "medical_authority", proof_point: "doctor_expert", number_of_similar_ads: 9, longest_days_active: 90, average_days_active: 55, scale_level: 4, why_it_is_scaling: "Evergreen >60 ngày + bác sĩ Tú Dung KOL", competitor_strategy_interpretation: "Uy tín bác sĩ + giáo dục y khoa dài hạn", seryn_should_copy_adapt_counter_avoid: "adapt", seryn_reframe: MOCK_TAG + " — Dùng đội ngũ đa chuyên khoa thay vì sùng bái cá nhân." },
  { week_date: W, brand_name: "Bệnh viện JW Hàn Quốc", content_cluster_id: "MOCK-JW-CL-02", representative_ad_id: "MOCK-JW-002", representative_hook: "Hiểu cơ thể trước khi quyết định can thiệp", service_or_product: "hormone_biology_assessment", price_detected: "chỉ từ 2 triệu", offer_detected: "miễn phí 100%", content_format: "educational_post", content_angle: "education", proof_point: "media_coverage", number_of_similar_ads: 4, longest_days_active: 25, average_days_active: 18, scale_level: 2, why_it_is_scaling: "Cụm giải mã gen mới nổi", competitor_strategy_interpretation: "Chạm nền tảng sinh học ở góc tầm soát bệnh", seryn_should_copy_adapt_counter_avoid: "counter", seryn_reframe: MOCK_TAG + " — SERYN sở hữu nền tảng sinh học cho trẻ hóa (không phải tầm soát bệnh)." },
  { week_date: W, brand_name: "Viện Thẩm Mỹ LG Clinic", content_cluster_id: "MOCK-LG-CL-01", representative_ad_id: "MOCK-LG-001", representative_hook: "Trị nám chỉ 449K (Gốc 5.000K)", service_or_product: "pigmentation_treatment", price_detected: "449K", offer_detected: "449K (gốc 5.000K)", content_format: "offer_promotion", content_angle: "price_promotion", proof_point: "price_proof", number_of_similar_ads: 12, longest_days_active: 44, average_days_active: 30, scale_level: 3, why_it_is_scaling: "30-59 ngày + offer/giá lặp nhiều biến thể", competitor_strategy_interpretation: "Giá sốc + neo giá gốc kéo lead", seryn_should_copy_adapt_counter_avoid: "counter", seryn_reframe: MOCK_TAG + " — Không đua giá; cải thiện đo lường được, chỉ định cá nhân hóa." },
  { week_date: W, brand_name: "Bệnh viện Thẩm mỹ Kangnam", content_cluster_id: "MOCK-KN-CL-01", representative_ad_id: "MOCK-KN-002", representative_hook: "Hành trình trẻ hóa đôi mắt cùng Kangnam", service_or_product: "facial_rejuvenation", price_detected: "unknown", offer_detected: "combo ưu đãi", content_format: "kol_review", content_angle: "celebrity_proof", proof_point: "KOL_celebrity", number_of_similar_ads: 6, longest_days_active: 62, average_days_active: 40, scale_level: 4, why_it_is_scaling: "KOL lặp nhiều biến thể", competitor_strategy_interpretation: "Proof KOL + transformation vùng mắt", seryn_should_copy_adapt_counter_avoid: "adapt", seryn_reframe: MOCK_TAG + " — Trẻ hóa vùng mắt theo cấu trúc, ưu tiên giải pháp nhẹ." },
  { week_date: W, brand_name: "Pensilia Beauty Clinic", content_cluster_id: "MOCK-PEN-CL-01", representative_ad_id: "MOCK-PEN-001", representative_hook: "Làn da khỏe hơn sau buổi đầu tiên", service_or_product: "facial_rejuvenation", price_detected: "299K", offer_detected: "combo trải nghiệm 299K", content_format: "customer_testimonial", content_angle: "personal_confidence", proof_point: "customer_testimonial", number_of_similar_ads: 3, longest_days_active: 20, average_days_active: 15, scale_level: 2, why_it_is_scaling: "Cụm review nhỏ đang lặp", competitor_strategy_interpretation: "Spa nhỏ dùng KOC + combo giá mềm", seryn_should_copy_adapt_counter_avoid: "monitor", seryn_reframe: MOCK_TAG + " — Theo dõi; khác biệt bằng chiều sâu y khoa." },
];

const changeRows = [
  { week_date: W, brand_name: "Bệnh viện JW Hàn Quốc", active_ads_change: "-1", new_ads_count: 9, stopped_ads_count: 10, new_services_detected: "hormone_biology_assessment", removed_services: "none", new_offers_detected: "miễn phí 100%", removed_offers: "none", new_content_angles: "education", removed_content_angles: "none", scaled_content_new: "MOCK-JW-CL-02", scaled_content_still_running: "MOCK-JW-CL-01", strategic_change_type: "format_shift", change_summary: MOCK_TAG + " — Dịch sang giải mã gen/tầm soát.", seryn_implication: "Khoảng trống trẻ hóa nền tảng sinh học rộng thêm — own ngay." },
  { week_date: W, brand_name: "Viện Thẩm Mỹ LG Clinic", active_ads_change: "+0", new_ads_count: 22, stopped_ads_count: 22, new_services_detected: "lifting_firming", removed_services: "none", new_offers_detected: "none", removed_offers: "none", new_content_angles: "technology", removed_content_angles: "none", scaled_content_new: "none", scaled_content_still_running: "MOCK-LG-CL-01", strategic_change_type: "stable_creative_refresh", change_summary: MOCK_TAG + " — Giữ quy mô, xoay creative.", seryn_implication: "Avoid sân giá sốc; chiếm khoảng trống trẻ hóa cao cấp." },
  { week_date: W, brand_name: "Bệnh viện Thẩm mỹ Kangnam", active_ads_change: "+2", new_ads_count: 26, stopped_ads_count: 24, new_services_detected: "filler_botox", removed_services: "none", new_offers_detected: "none", removed_offers: "none", new_content_angles: "transformation", removed_content_angles: "none", scaled_content_new: "none", scaled_content_still_running: "MOCK-KN-CL-01", strategic_change_type: "stable_creative_refresh", change_summary: MOCK_TAG + " — +2 ad, xoay creative trẻ hóa mắt.", seryn_implication: "Adapt giáo dục trẻ hóa vùng mắt không phẫu thuật." },
  { week_date: W, brand_name: "Thẩm mỹ viện Ngọc Dung", active_ads_change: "0", new_ads_count: 0, stopped_ads_count: 0, new_services_detected: "none", removed_services: "none", new_offers_detected: "none", removed_offers: "none", new_content_angles: "none", removed_content_angles: "none", scaled_content_new: "none", scaled_content_still_running: "none", strategic_change_type: "still_dark", change_summary: MOCK_TAG + " — Vẫn 0 ad.", seryn_implication: "Theo dõi; tận dụng giai đoạn im ắng." },
  { week_date: W, brand_name: "Pensilia Beauty Clinic", active_ads_change: "+2", new_ads_count: 3, stopped_ads_count: 1, new_services_detected: "acne_treatment", removed_services: "none", new_offers_detected: "combo trải nghiệm 299K", removed_offers: "none", new_content_angles: "personal_confidence", removed_content_angles: "none", scaled_content_new: "MOCK-PEN-CL-01", scaled_content_still_running: "none", strategic_change_type: "came_online", change_summary: MOCK_TAG + " — Tăng nhẹ, KOC review.", seryn_implication: "Monitor; khác biệt bằng chiều sâu y khoa." },
];

const recsRows = [
  { week_date: W, recommendation_type: "content_format", market_signal: MOCK_TAG + " — doctor_explainer là format scale bền nhất.", competitor_evidence: "JW (Tú Dung), Kangnam (Dr.Mark), LG (CFU Élife).", seryn_content_niche: "Giáo dục trẻ hóa từ nền tảng sinh học", suggested_content_format: "doctor_explainer (video bác sĩ 60-90s)", suggested_hook: "Có những dấu hiệu lão hóa không bắt đầu từ da.", content_style: "Khoa học, điềm tĩnh, bác sĩ lắng nghe", main_message: "Trẻ hóa bền vững cần đánh giá nền tảng sinh học trước khi chọn liệu trình.", proof_to_use: "doctor_expert|scientific_explanation", cta: "Đặt lịch đánh giá nền tảng sinh học", kpi: "thumb-stop rate; message-to-booking", priority: "High" },
  { week_date: W, recommendation_type: "counter_offer", market_signal: MOCK_TAG + " — thị trường bão hòa giá sốc.", competitor_evidence: "LG 449K, Pensilia 299K combo.", seryn_content_niche: "Định vị premium không giảm sốc", suggested_content_format: "educational_post (carousel so sánh)", suggested_hook: "Một gương mặt tươi hơn không nhất thiết phải là một gương mặt khác đi.", content_style: "Tự tin, không áp lực, không FOMO", main_message: "Giá trị nằm ở chẩn đoán đúng và kết quả tự nhiên bền vững.", proof_to_use: "doctor_expert|customer_context", cta: "Tìm hiểu thêm", kpi: "CTR; lead quality", priority: "High" },
  { week_date: W, recommendation_type: "niche_whitespace", market_signal: MOCK_TAG + " — mảng nền tảng sinh học gần như trống.", competitor_evidence: "Chỉ JW chạm tới qua giải mã gen (tầm soát bệnh).", seryn_content_niche: "Phân tích gương mặt & nền tảng sinh học", suggested_content_format: "consultation_lead (landing + form)", suggested_hook: "Không phải là làm nhiều hơn. Đôi khi là chỉ định đúng hơn.", content_style: "Chuẩn xác y khoa, cá nhân hóa", main_message: "SERYN sở hữu bước đánh giá nền tảng sinh học như điểm khác biệt cốt lõi.", proof_to_use: "scientific_explanation|doctor_expert", cta: "Đặt lịch phân tích gương mặt", kpi: "cost per qualified lead", priority: "High" },
  { week_date: W, recommendation_type: "proof_strategy", market_signal: MOCK_TAG + " — KOL proof scale ở phân khúc cao cấp.", competitor_evidence: "Kangnam (KOL), Pensilia (KOC).", seryn_content_niche: "Bằng chứng có giải thích y khoa", suggested_content_format: "kol_review kèm phân tích bác sĩ", suggested_hook: "Trẻ hóa bền vững bắt đầu từ việc hiểu đúng điều gì đang thay đổi bên trong cơ thể.", content_style: "Editorial cao cấp, ấm, không hào nhoáng", main_message: "Câu chuyện khách hàng + lý giải cơ chế bác sĩ.", proof_to_use: "customer_testimonial|doctor_expert", cta: "Khám phá lộ trình phù hợp với cơ thể bạn", kpi: "video hold rate; booking rate", priority: "Medium" },
  { week_date: W, recommendation_type: "format_test", market_signal: MOCK_TAG + " — trẻ hóa vùng mắt theo cấu trúc chạy bền.", competitor_evidence: "Kangnam cụm mí/bọng mắt; JW Midface.", seryn_content_niche: "Trẻ hóa vùng mắt theo cấu trúc", suggested_content_format: "doctor_explainer ngắn (Reel 30-45s)", suggested_hook: "Vùng mắt thường là nơi tuổi tác lên tiếng đầu tiên — nhưng không phải lúc nào câu trả lời cũng là dao kéo.", content_style: "Nhẹ nhàng, lý trí, bác sĩ tư vấn", main_message: "Đánh giá vùng mắt trước khi quyết định can thiệp.", proof_to_use: "doctor_expert|technology_machine", cta: "Trao đổi với đội ngũ chuyên môn", kpi: "CTR; message-to-booking", priority: "Medium" },
];

const DATASETS = [
  { sheet: "Brand Weekly Snapshot", headers: HEADERS.snapshot, rows: snapshotRows },
  { sheet: "Ad Level Analysis", headers: HEADERS.ads, rows: adsRows },
  { sheet: "Scaled Content Analysis", headers: HEADERS.scaled, rows: scaledRows },
  { sheet: "Weekly Strategy Change", headers: HEADERS.changes, rows: changeRows },
  { sheet: "SERYN Content Recommendations", headers: HEADERS.recs, rows: recsRows },
];

/* ---------------- Google Sheets I/O ---------------- */
function toMatrix(headers, objs) {
  return objs.map((o) => headers.map((h) => (o[h] == null ? "" : String(o[h]))));
}

async function writeSheet(sheets, titles, name, headers, rows) {
  // tạo tab nếu chưa có
  if (!titles.includes(name)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
    titles.push(name);
  }
  // clear toàn bộ giá trị cũ
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${name}'` });
  // ghi header (dòng 1) + data (từ dòng 2), UTF-8, RAW (giữ nguyên text tiếng Việt/ngày)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${name}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers, ...rows] },
  });
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: SA_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`\nSERYN Spy — sync MOCK -> Google Sheets`);
  console.log(`Sheet ID : ${SHEET_ID}`);
  console.log(`week_date: ${WEEK}`);
  console.log(`(dữ liệu MOCK để test pipeline — chưa phải ads thật)\n`);

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  } catch (e) {
    fail(
      `Không mở được Google Sheet (${SHEET_ID}).\n  → Kiểm tra GOOGLE_SHEET_ID đúng chưa, và đã Share Sheet (Editor) cho client_email của service account chưa?\n  Chi tiết lỗi: ${e?.message || e}`
    );
  }
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);

  let total = 0;
  let okCount = 0;
  for (const ds of DATASETS) {
    try {
      await writeSheet(sheets, titles, ds.sheet, ds.headers, toMatrix(ds.headers, ds.rows));
      console.log(`  [OK] ${ds.sheet}: ghi ${ds.rows.length} dòng dữ liệu (+1 dòng header)`);
      total += ds.rows.length;
      okCount++;
    } catch (e) {
      console.error(`  [X]  ${ds.sheet}: ${e?.message || e}`);
    }
  }

  console.log(`\nXong: ${okCount}/${DATASETS.length} tab, tổng ${total} dòng dữ liệu.`);
  console.log(`→ Mở Google Sheet kiểm tra, rồi bấm "Refresh Online Data" trên dashboard.`);
  if (okCount < DATASETS.length) process.exit(1);
}

main().catch((e) => fail(e?.message || String(e)));
