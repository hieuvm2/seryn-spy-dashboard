/* ============================================================
   SERYN Spy — Market Research detectors + scoring (server-side)
   ------------------------------------------------------------
   Rule-based extraction từ text nguồn Exa. KHÔNG bịa số liệu.
   Mọi hàm trả string "a|b|c" (Sheet-friendly) hoặc số.
   ============================================================ */

const lc = (s) => String(s || "").toLowerCase();
const uniqJoin = (arr) => [...new Set(arr.filter(Boolean).map((x) => String(x).trim()).filter(Boolean))].join("|");

const SERVICE_TERMS = [
  ["melasma_treatment", ["nám", "melasma", "tàn nhang", "sạm da"]],
  ["acne_treatment", ["mụn", "acne", "trị mụn", "thâm mụn"]],
  ["skin_rejuvenation", ["trẻ hóa", "rejuvenation", "căng bóng", "tái tạo da", "anti-aging", "lão hóa"]],
  ["laser_treatment", ["laser", "pico", "fractional", "co2"]],
  ["filler_botox", ["filler", "botox", "tiêm chất làm đầy", "thon gọn hàm"]],
  ["facial_spa", ["chăm sóc da", "facial", "spa", "điện di", "massage mặt"]],
  ["skin_booster", ["skin booster", "meso", "mesotherapy", "profhilo", "dưỡng ẩm chuyên sâu"]],
  ["body_slimming", ["giảm béo", "giảm mỡ", "slimming", "hút mỡ", "coolsculpting", "body"]],
  ["wellness_beauty", ["wellness", "detox", "thải độc", "iv drip", "truyền trắng", "phục hồi"]],
];

const PRICE_TOKEN = /(\d[\d.,]*\s?(?:k|K|đ|tr|triệu|VNĐ|vnđ|VND|%))/g;
const OFFER_WORDS = ["giảm", "ưu đãi", "tặng", "miễn phí", "combo", "trọn gói", "khuyến mãi", "flash sale", "ưu đãi", "voucher", "deal"];
const CLAIM_WORDS = ["cam kết", "hiệu quả", "an toàn", "không xâm lấn", "công nghệ", "độc quyền", "fda", "chuẩn y khoa", "bác sĩ", "chuyên gia", "số 1", "hàng đầu"];
const PROBLEM_WORDS = ["nám", "mụn", "lão hóa", "chảy xệ", "thâm", "sẹo", "lỗ chân lông", "da khô", "da dầu", "nếp nhăn", "béo", "mỡ thừa", "rụng tóc"];
const TREND_WORDS = ["xu hướng", "trend", "tăng trưởng", "growth", "bùng nổ", "phổ biến", "nhu cầu", "demand", "thịnh hành", "gen z", "viral"];
const GROWTH_WORDS = ["tăng trưởng", "growth", "cagr", "tăng", "increase", "mở rộng", "expand", "bùng nổ", "double", "gấp đôi"];
const AUDIENCE_WORDS = ["phụ nữ", "gen z", "millennial", "văn phòng", "trung niên", "nam giới", "phái đẹp", "khách hàng", "độ tuổi", "u30", "u40"];
const LOCATION_WORDS = ["hà nội", "hồ chí minh", "tphcm", "sài gòn", "đà nẵng", "việt nam", "vietnam", "cầu giấy", "quận 1", "quận 3", "thủ đức", "bình dương"];
// số kèm đơn vị thị trường (USD/tỷ/triệu đô...) — directional only
const MARKET_NUMBER = /(\$?\s?\d[\d.,]*\s?(?:tỷ|ty|triệu|million|billion|bn|tr|usd|đô|%|cagr))/gi;

function detectByTerms(text, table) {
  const t = lc(text);
  const out = [];
  for (const [key, terms] of table) {
    if (terms.some((w) => t.includes(w))) out.push(key);
  }
  return out;
}
function detectWords(text, words) {
  const t = lc(text);
  return words.filter((w) => t.includes(lc(w)));
}

export function detectServices(text) { return uniqJoin(detectByTerms(text, SERVICE_TERMS)); }
export function detectOffers(text) { return uniqJoin(detectWords(text, OFFER_WORDS)); }
export function detectPrices(text) { return uniqJoin((String(text || "").match(PRICE_TOKEN) || []).slice(0, 12)); }
export function detectClaims(text) { return uniqJoin(detectWords(text, CLAIM_WORDS)); }
export function detectCustomerProblems(text) { return uniqJoin(detectWords(text, PROBLEM_WORDS)); }
export function detectTrendKeywords(text) { return uniqJoin(detectWords(text, TREND_WORDS)); }
export function detectLocations(text) { return uniqJoin(detectWords(text, LOCATION_WORDS)); }
export function detectTargetAudience(text) { return uniqJoin(detectWords(text, AUDIENCE_WORDS)); }
export function detectGrowthClaims(text) { return uniqJoin(detectWords(text, GROWTH_WORDS)); }
export function detectMarketNumbers(text) { return uniqJoin((String(text || "").match(MARKET_NUMBER) || []).slice(0, 12)); }

/** Gộp toàn bộ detector cho 1 normalized result (dùng chung). */
export function detectAll(result, ctx = {}) {
  const text = [result.title, result.summary, (result.highlights || []).join(" "), result.text].join(" \n ");
  return {
    detected_services: detectServices(text),
    detected_offers: detectOffers(text),
    detected_prices: detectPrices(text),
    detected_claims: detectClaims(text),
    detected_customer_problems: detectCustomerProblems(text),
    detected_trend_keywords: detectTrendKeywords(text),
    detected_locations: detectLocations(text),
    detected_target_audience: detectTargetAudience(text),
    detected_growth_claims: detectGrowthClaims(text),
    detected_market_numbers: detectMarketNumbers(text),
    relevance_score: calculateRelevanceScore(result, ctx),
    credibility_score: calculateCredibilityScore(result),
  };
}

/** 0–1: nguồn càng khớp service_category + geo + có offer/trend càng cao. */
export function calculateRelevanceScore(result, ctx = {}) {
  const text = lc([result.title, result.summary, (result.highlights || []).join(" "), result.text].join(" "));
  let s = 0.2;
  const services = detectServices(text);
  const geo = lc(ctx.geo || "");
  if (services) s += 0.25;
  if (ctx.serviceCategory && ctx.serviceCategory !== "all" && services.includes(ctx.serviceCategory)) s += 0.15;
  if (geo && (text.includes(geo) || text.includes("việt nam") || text.includes("vietnam"))) s += 0.15;
  if (detectOffers(text)) s += 0.1;
  if (detectTrendKeywords(text) || detectGrowthClaims(text)) s += 0.1;
  if (detectMarketNumbers(text)) s += 0.05;
  if (typeof result.score === "number") s = s * 0.7 + Math.min(1, result.score) * 0.3;
  return Math.round(Math.min(1, s) * 100) / 100;
}

/** 0–1: report/government/news cao; clinic/blog vừa; social/review thấp hơn. */
export function calculateCredibilityScore(result) {
  const map = {
    government: 0.95, report: 0.9, news: 0.8,
    clinic_website: 0.6, competitor_landing_page: 0.55, blog: 0.5,
    review_site: 0.45, social_page: 0.4, unknown: 0.35,
  };
  let s = map[result.source_type] ?? 0.4;
  if (result.published_date) s += 0.03;
  if ((result.text || "").length > 1500) s += 0.02;
  return Math.round(Math.min(1, s) * 100) / 100;
}
