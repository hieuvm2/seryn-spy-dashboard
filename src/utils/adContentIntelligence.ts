/* ============================================================
   SERYN — Ad Content Intelligence (phân tích content quảng cáo đối thủ)
   ------------------------------------------------------------
   Thay "Hook Intelligence" làm trung tâm. Dựng content pattern theo brand từ
   scaledContentAnalysis (chính) + adLevelAnalysis + brandWeeklySnapshot +
   visual + recommendations. Hook chỉ là 1 phần (opening line).

   contentScore là TÍN HIỆU từ dữ liệu ads (số lần lặp + thời gian chạy…),
   KHÔNG phải CPA/ROAS/hiệu quả bán thật. Không bịa số liệu.
   ============================================================ */
import type { SpyDashboardData, AdLevelAnalysis } from "../types";
import { viLabel, isMeaningful, humanizeText } from "./spyData";
import { getBrandScaledContent, getBrandAds, getBrandSnapshot, getBrandVisualSummary } from "./brandIntelligence";

/* ---------- types ---------- */
export type AdContentPsychology = {
  customerPain: string; customerDesire: string; beliefTrigger: string; objectionHandled: string;
  emotionalTrigger: string; awarenessStage: string; whyItMayWork: string; riskNote: string;
};
export type AdContentBreakdown = {
  openingLine: string; mainMessage: string; mechanism: string; proofElement: string;
  offerElement: string; urgencyElement: string; ctaElement: string; contentStructure: string[];
};
export type SerynContentResponse = {
  suggestedAngle: string; counterPositioning: string; safeRewrite: string; premiumRewrite: string;
  shortAdCopy: string; videoScriptOutline: string[]; visualDirection: string; recommendedCTA: string;
  complianceWarning: string; recommendedAction: "Adapt" | "Counter" | "Monitor" | "Avoid" | "Test Safe Version";
};
export type AdContentIntelligence = {
  id: string; brandName: string;
  contentText: string; contentSummary: string;
  serviceCategory: string; treatmentType: string;
  contentAngle: string; painPoint: string; desiredOutcome: string;
  offerDetected: string; priceDetected: string; proofType: string; cta: string;
  adFormat: "image" | "video" | "carousel" | "unknown";
  inferredObjective: "messenger" | "lead_form" | "landing_page_conversion" | "phone_call" | "awareness" | "unknown";
  visualAngle: string; visualFormat: string;
  thumbnailUrl?: string;
  adsCount: number; activeDays: number; exampleAdIds: string[]; exampleAdUrls: string[];
  repetitionSignal: "Low" | "Medium" | "High";
  scaleSignal: "Weak Signal" | "Repeated Content" | "Long-running Content" | "Strong Content Pattern";
  riskLevel: "Low" | "Medium" | "High";
  contentScore: number;
  psychology: AdContentPsychology;
  contentBreakdown: AdContentBreakdown;
  serynResponse: SerynContentResponse;
};

/* ---------- helpers ---------- */
const lc = (s?: string) => String(s || "").toLowerCase();
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(n)));
const cap = (s?: string) => { const x = String(s || ""); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
function hashSeed(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const pick = <T,>(list: T[], seed: string): T => list[hashSeed(seed) % list.length];

const SKIN_RE = /trẻ hóa|căng bóng|tái tạo|nâng cơ|săn chắc|hifu|thermage|ultherapy|\brf\b|laser|exosome|collagen|skin booster|meso|chảy xệ|lão hóa|nếp nhăn|nám|thâm|xỉn|lỗ chân lông|da/i;

/* ---------- compliance ---------- */
const BANNED: Array<[RegExp, string]> = [
  [/trẻ (hơn|ra)\s*\d+\s*tuổi|trẻ\s*\d+\s*tuổi/gi, "hỗ trợ cải thiện dấu hiệu tuổi tác"],
  [/xóa (sạch|hết)|sạch (nám|nhăn)/gi, "giúp làm mờ rõ hơn"],
  [/(trị )?dứt điểm|tận gốc|khỏi hẳn|chữa khỏi/gi, "hỗ trợ cải thiện theo liệu trình"],
  [/vĩnh viễn|mãi mãi/gi, "duy trì lâu dài hơn cùng chăm sóc đúng"],
  [/100%|hiệu quả tuyệt đối|cam kết (kết quả|khỏi|hết)/gi, "kết quả tùy tình trạng da"],
  [/không rủi ro/gi, "cần tư vấn để hiểu phù hợp"],
  [/lột xác|thần kỳ|kỳ diệu/gi, "cải thiện rõ nét, tự nhiên"],
];
function sanitize(text: string): string { let s = String(text || ""); for (const [re, v] of BANNED) s = s.replace(re, v); return s.trim(); }

/* ---------- detectors (rule-based) ---------- */
const ANGLE_RULES: Array<[string, RegExp]> = [
  ["offer_promotion", /ưu đãi|giảm|tặng|combo|chỉ từ|miễn phí|khuyến mãi|trợ giá|đồng giá|sale|\boff\b|\d+\s*k\b|\d+%/i],
  ["urgency", /hôm nay|tháng này|số lượng có hạn|lịch trống|ưu đãi cuối|duy nhất|nhanh tay|giờ vàng/i],
  ["authority_expert", /bác sĩ|chuyên gia|phác đồ|soi da|chỉ định|liệu trình|ts\.?\s*bs|y khoa/i],
  ["technology_mechanism", /công nghệ|máy|\brf\b|hifu|thermage|ultherapy|laser|collagen|exosome|sóng|ánh sáng/i],
  ["social_proof", /khách hàng|feedback|review|case|trước sau|testimonial|chia sẻ|cảm nhận|đánh giá/i],
  ["education", /vì sao|nguyên nhân|sai lầm|hiểu đúng|cách chăm sóc|bạn có biết|tại sao|là gì/i],
  ["safety_objection", /không đau|không xâm lấn|không nghỉ dưỡng|an toàn|nhẹ nhàng/i],
  ["transformation", /trẻ hóa|căng bóng|nâng cơ|săn chắc|cải thiện|phục hồi|tươi trẻ|tái tạo/i],
  ["pain_problem", /nám|nhăn|chảy xệ|lão hóa|da yếu|da xấu|da chùng|thâm|xỉn|sạm/i],
  ["premium_positioning", /cá nhân hóa|chuyên sâu|cao cấp|chuẩn y khoa|tự nhiên|đẳng cấp/i],
];
const ANGLE_VI: Record<string, string> = {
  offer_promotion: "Khuyến mãi / ưu đãi", urgency: "Tạo cấp bách", authority_expert: "Uy tín chuyên môn",
  technology_mechanism: "Công nghệ / cơ chế", social_proof: "Bằng chứng số đông", education: "Giáo dục",
  safety_objection: "An toàn / gỡ lo ngại", transformation: "Biến đổi / trẻ hóa", pain_problem: "Khơi nỗi đau",
  premium_positioning: "Định vị cao cấp", unknown: "Chưa rõ",
};
export function classifyContentAngle(text: string): string {
  const t = lc(text);
  for (const [a, re] of ANGLE_RULES) if (re.test(t)) return a;
  return "unknown";
}
// Gấp các giá trị content_angle thô (từ data) về đúng 10 enum chuẩn.
function normalizeAngle(raw: string): string {
  const r = lc(raw).trim();
  if (!r || r === "unknown") return "unknown";
  if (ANGLE_VI[r]) return r;
  const ALIAS: Array<[string, RegExp]> = [
    ["offer_promotion", /price|promo|giá|ưu đãi|khuyến|discount|deal/],
    ["urgency", /urgen|scarcit|cấp bách|limited|han|gấp/],
    ["authority_expert", /author|expert|doctor|bác sĩ|chuyên gia|medical|y khoa/],
    ["technology_mechanism", /tech|mechan|công nghệ|machine|device/],
    ["social_proof", /social|proof|review|testimon|feedback|trước sau|before.?after/],
    ["education", /educat|myth|giáo dục|how.?to|guide|hiểu/],
    ["safety_objection", /safe|objection|an toàn|painless|không đau|risk/],
    ["transformation", /transform|result|biến đổi|trẻ hóa|outcome/],
    ["pain_problem", /pain|problem|nỗi đau|fear|lão hóa|nám|nhăn/],
    ["premium_positioning", /premium|luxury|cao cấp|đẳng cấp|positioning/],
  ];
  for (const [a, re] of ALIAS) if (re.test(r)) return a;
  return "unknown";
}

const PAIN_MAP: Array<[string, RegExp]> = [
  ["da chảy xệ", /chảy xệ|chùng|nhão|sụp/i], ["nếp nhăn", /nếp nhăn|vết nhăn|rãnh/i],
  ["da lão hóa", /lão hóa|tuổi tác|già/i], ["nám/thâm sạm", /nám|tàn nhang|thâm|sạm|đốm nâu/i],
  ["da xỉn màu", /xỉn|kém sắc|tối màu/i], ["lỗ chân lông to", /lỗ chân lông/i],
  ["da kém săn chắc", /kém săn chắc|kém đàn hồi|thiếu collagen/i],
];
export function detectPainPoint(text: string): string {
  const t = lc(text);
  for (const [p, re] of PAIN_MAP) if (re.test(t)) return p;
  return "dấu hiệu lão hóa da";
}
const DESIRE_MAP: Array<[string, RegExp]> = [
  ["da căng bóng", /căng bóng|căng mịn/i], ["da săn chắc, nâng cơ", /săn chắc|nâng cơ|đàn hồi/i],
  ["da sáng mịn", /sáng mịn|rạng rỡ|sáng da/i], ["da trẻ trung tự nhiên", /trẻ trung|tươi trẻ|trẻ hóa|thanh xuân/i],
];
export function detectDesiredOutcome(text: string): string {
  const t = lc(text);
  for (const [d, re] of DESIRE_MAP) if (re.test(t)) return d;
  return "làn da trẻ trung, căng bóng";
}
export function detectProofType(text: string): string {
  const t = lc(text);
  if (/bác sĩ|chuyên gia|ts\.?\s*bs|y khoa|phác đồ/.test(t)) return "Bác sĩ / chuyên gia";
  if (/công nghệ|máy|hifu|thermage|laser|\brf\b|fda/.test(t)) return "Công nghệ / máy móc";
  if (/khách hàng|review|testimonial|trước sau|case|cảm nhận/.test(t)) return "Khách hàng / case";
  if (/giá|ưu đãi|combo/.test(t)) return "Bằng chứng giá";
  return "Chưa rõ";
}
const PRICE_RE = /(\d[\d.,]*\s?(?:k|K|đ|tr|triệu|VNĐ|vnđ|%))/;
export function detectOffer(text: string): string {
  const t = String(text || "");
  const words = ["miễn phí", "giảm", "ưu đãi", "tặng", "combo", "trợ giá", "đồng giá", "chỉ từ", "khuyến mãi"];
  const w = words.find((x) => lc(t).includes(x));
  const price = (t.match(PRICE_RE) || [])[0];
  if (w && price) return `${w} ${price}`;
  return w || price || "";
}
export function detectCTA(text: string): string {
  const t = lc(text);
  if (/nhắn tin|inbox|nhắn ngay/.test(t)) return "Nhắn tin";
  if (/đặt lịch|booking|đăng ký lịch/.test(t)) return "Đặt lịch";
  if (/gọi|hotline|call/.test(t)) return "Gọi ngay";
  if (/đăng ký|nhận tư vấn|để lại/.test(t)) return "Đăng ký / để lại thông tin";
  if (/tìm hiểu|xem thêm/.test(t)) return "Tìm hiểu thêm";
  return "";
}
export function inferObjectiveFromContent(text: string, url?: string): AdContentIntelligence["inferredObjective"] {
  const t = lc(text + " " + (url || ""));
  if (/m\.me|messenger|nhắn tin|inbox|chat/.test(t)) return "messenger";
  if (/tel:|gọi|hotline|call/.test(t)) return "phone_call";
  if (/lead|đăng ký|form|để lại (thông tin|sđt)/.test(t)) return "lead_form";
  if (/dat-lich|đặt lịch|booking|landing|mua|checkout|^https?:\/\//.test(t)) return "landing_page_conversion";
  if (/tìm hiểu|xem thêm/.test(t)) return "awareness";
  return "unknown";
}

function adFormatOf(s: string): AdContentIntelligence["adFormat"] {
  const m = lc(s);
  if (/video|reel/.test(m)) return "video";
  if (/carousel|album/.test(m)) return "carousel";
  if (/image|photo|img|offer_promotion|before_after|doctor/.test(m)) return "image";
  return "unknown";
}

/* ---------- scale / risk ---------- */
function scaleSignalOf(adsCount: number, activeDays: number): AdContentIntelligence["scaleSignal"] {
  if (adsCount >= 5 || activeDays >= 60) return "Strong Content Pattern";
  if (activeDays >= 30) return "Long-running Content";
  if (adsCount >= 3) return "Repeated Content";
  return "Weak Signal";
}
function repetitionOf(adsCount: number): AdContentIntelligence["repetitionSignal"] {
  return adsCount >= 5 ? "High" : adsCount >= 3 ? "Medium" : "Low";
}
function riskOf(text: string, offer: string, beforeAfter: boolean): AdContentIntelligence["riskLevel"] {
  const t = lc(text + " " + offer);
  let score = 0;
  if (/trẻ (hơn|ra)?\s*\d+\s*tuổi|xóa sạch|dứt điểm|100%|cam kết|vĩnh viễn|khỏi hẳn|lột xác|thần kỳ/.test(t)) score += 60;
  if (/giảm\s*[5-9]\d%|đồng giá|giá sốc/.test(t)) score += 25;
  if (beforeAfter) score += 25;
  return score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";
}

/* ---------- content score ---------- */
export function calculateContentScore(item: Partial<AdContentIntelligence>): number {
  const ads = num(item.adsCount);
  const days = num(item.activeDays);
  const repetitionScore = clamp(ads * 18);
  const activeDaysScore = days >= 60 ? 100 : days >= 30 ? 75 : days >= 14 ? 50 : days >= 7 ? 30 : days > 0 ? 15 : 20;
  const brandFocusScore = SKIN_RE.test(`${item.contentText} ${item.serviceCategory} ${item.treatmentType}`) ? 90 : 50;
  const offerClarityScore = isMeaningful(item.offerDetected) ? (isMeaningful(item.priceDetected) ? 95 : 80) : 30;
  const proofStrengthScore = item.proofType && item.proofType !== "Chưa rõ" ? 70 : 25;
  const funnelClarityScore = item.inferredObjective && item.inferredObjective !== "unknown" ? 80 : 35;
  const riskAdjustment = item.riskLevel === "High" ? 0 : item.riskLevel === "Medium" ? 50 : 100;
  return clamp(
    repetitionScore * 0.25 + activeDaysScore * 0.2 + brandFocusScore * 0.15 +
    offerClarityScore * 0.15 + proofStrengthScore * 0.1 + funnelClarityScore * 0.1 + riskAdjustment * 0.05,
  );
}

/* ---------- psychology ---------- */
const EMO: Record<string, string> = {
  offer_promotion: "Khẩn trương (ưu đãi)", urgency: "Khẩn trương", authority_expert: "Tin tưởng",
  technology_mechanism: "Tin tưởng (khoa học)", social_proof: "Thuộc về số đông", education: "Tò mò / tin tưởng",
  safety_objection: "An tâm", transformation: "Khát vọng", pain_problem: "Lo lắng → mong giải pháp",
  premium_positioning: "Khát vọng cao cấp", unknown: "Hy vọng",
};
const AWARE: Record<string, string> = {
  education: "Problem-aware", pain_problem: "Problem-aware", transformation: "Solution-aware",
  technology_mechanism: "Solution-aware", authority_expert: "Solution-aware", social_proof: "Consideration",
  offer_promotion: "Product-aware", urgency: "Product-aware", safety_objection: "Consideration",
  premium_positioning: "Consideration", unknown: "Problem-aware",
};
export function buildContentPsychology(item: Partial<AdContentIntelligence>): AdContentPsychology {
  const angle = String(item.contentAngle || "unknown");
  const pain = item.painPoint || "dấu hiệu lão hóa da";
  const desire = item.desiredOutcome || "làn da trẻ trung";
  const proof = String(item.proofType || "");
  const belief = /bác sĩ|chuyên gia/.test(lc(proof)) ? "Uy tín chuyên môn" :
    /công nghệ|máy/.test(lc(proof)) ? "Công nghệ / khoa học" :
    /khách hàng|case/.test(lc(proof)) ? "Bằng chứng xã hội" :
    isMeaningful(item.offerDetected) ? "Giá / ưu đãi" : "Tư vấn cá nhân hóa";
  const t = lc(item.contentText);
  const objection = /không xâm lấn|không đau|không nghỉ dưỡng/.test(t) ? "Lo ngại an toàn / nghỉ dưỡng" :
    /bác sĩ|soi da|phác đồ/.test(t) ? "Lo ngại độ tin cậy / cần chẩn đoán" :
    isMeaningful(item.offerDetected) ? "Lo ngại chi phí" : "Giúp khách hiểu rõ tình trạng da trước khi quyết định";
  const days = num(item.activeDays);
  const why = `Pattern này đáng chú ý: ${num(item.adsCount)} nội dung tương tự` +
    (days ? `, chạy bền tới ${days} ngày` : "") +
    `, dùng góc ${ANGLE_VI[angle] || angle} quanh "${pain}" ở giai đoạn ${AWARE[angle] || "Problem-aware"}. ` +
    "Đây là tín hiệu từ dữ liệu ads, không phải hiệu quả chuyển đổi.";
  const r = item.riskLevel;
  const riskNote = r === "High" ? "Rủi ro claim CAO — chỉ dùng bản an toàn, tránh mọi claim mạnh."
    : r === "Medium" ? "Có rủi ro claim — review câu chữ trước khi chạy." : "Rủi ro thấp — vẫn tránh claim tuyệt đối.";
  return {
    customerPain: cap(pain), customerDesire: cap(desire), beliefTrigger: belief, objectionHandled: objection,
    emotionalTrigger: EMO[angle] || "Hy vọng", awarenessStage: AWARE[angle] || "Problem-aware", whyItMayWork: why, riskNote,
  };
}

/* ---------- breakdown ---------- */
export function buildContentBreakdown(item: Partial<AdContentIntelligence>): AdContentBreakdown {
  const text = String(item.contentText || "");
  const opening = text.split(/[.!?\n|]/)[0]?.trim().slice(0, 90) || "N/A";
  const pain = item.painPoint || "dấu hiệu lão hóa da";
  const desire = item.desiredOutcome || "làn da trẻ trung";
  return {
    openingLine: opening,
    mainMessage: text ? humanizeText(text).slice(0, 140) : `Đối thủ truyền thông quanh ${pain} hướng tới ${desire}.`,
    mechanism: item.treatmentType && isMeaningful(item.treatmentType) ? viLabel(String(item.treatmentType)) : (item.proofType === "Công nghệ / máy móc" ? "Công nghệ / thiết bị" : "Chưa rõ cơ chế"),
    proofElement: item.proofType || "Chưa rõ",
    offerElement: isMeaningful(item.offerDetected) ? String(item.offerDetected) : "Không offer rõ",
    urgencyElement: /hôm nay|có hạn|cuối|giờ vàng|duy nhất/.test(lc(text)) ? "Có yếu tố cấp bách" : "Không",
    ctaElement: item.cta && isMeaningful(item.cta) ? String(item.cta) : "Chưa rõ CTA",
    contentStructure: [
      `Mở: ${ANGLE_VI[String(item.contentAngle)] || "tiếp cận"}`,
      `Vấn đề: ${pain}`,
      item.proofType && item.proofType !== "Chưa rõ" ? `Bằng chứng: ${item.proofType}` : "Bằng chứng: chưa rõ",
      isMeaningful(item.offerDetected) ? `Ưu đãi: ${item.offerDetected}` : "Ưu đãi: không nhấn",
      `CTA → ${item.inferredObjective === "messenger" ? "Messenger" : item.inferredObjective === "landing_page_conversion" ? "Landing/booking" : item.cta || "tư vấn"}`,
    ],
  };
}

/* ---------- SERYN response ---------- */
export function buildSerynContentResponse(item: Partial<AdContentIntelligence>): SerynContentResponse {
  const angle = String(item.contentAngle || "unknown");
  const pain = item.painPoint || "dấu hiệu lão hóa da";
  const desire = item.desiredOutcome || "làn da trẻ trung, căng bóng";
  const seed = `${item.brandName}|${item.contentText}|${angle}`;
  const beforeAfter = String(item.visualFormat || "").includes("before_after");
  const isOffer = angle === "offer_promotion" || isMeaningful(item.offerDetected);
  const isFear = angle === "pain_problem";
  const isDoctor = angle === "authority_expert";
  const isEdu = angle === "education";

  let recommendedAction: SerynContentResponse["recommendedAction"] = "Monitor";
  let counter = "";
  let suggestedAngle = "";
  if (item.riskLevel === "High") { recommendedAction = "Avoid"; }
  if (isOffer) {
    recommendedAction = item.riskLevel === "High" ? "Avoid" : "Counter";
    suggestedAngle = "Giá trị thay vì giá rẻ: soi da & phác đồ cá nhân hóa";
    counter = `Không đua ${item.offerDetected ? `"${item.offerDetected}"` : "giảm giá"} — SERYN chuyển trục sang soi da cá nhân hóa, tư vấn chuyên sâu, phác đồ phù hợp tình trạng da; nhấn giá trị an toàn, tinh tế.`;
  } else if (beforeAfter) {
    recommendedAction = "Test Safe Version";
    suggestedAngle = "Quy trình + bác sĩ phân tích, kết quả tự nhiên";
    counter = "Không lạm dụng before/after; SERYN dùng case nhẹ nhàng, quy trình, bác sĩ phân tích, ghi rõ 'kết quả tùy cơ địa'.";
  } else if (isDoctor) {
    recommendedAction = "Adapt";
    suggestedAngle = "Bác sĩ giải thích cơ chế + soi da trước tư vấn";
    counter = "Học cấu trúc uy tín: bác sĩ/chuyên viên giải thích cơ chế, soi da trước khi tư vấn; không cam kết kết quả tuyệt đối.";
  } else if (isFear) {
    recommendedAction = "Counter";
    suggestedAngle = "Nói về dấu hiệu tuổi tác bằng tone tinh tế";
    counter = `Không hù dọa về ${pain}; SERYN nói tinh tế về dấu hiệu tuổi tác, tập trung giải pháp và hiểu đúng nền da.`;
  } else if (isEdu) {
    recommendedAction = "Adapt";
    suggestedAngle = "Myth-busting / hiểu đúng trẻ hóa da";
    counter = `Adapt giáo dục: '3 dấu hiệu nền da yếu', 'vì sao da chảy xệ sau 30', hiểu đúng trẻ hóa — dẫn tới soi da.`;
  } else {
    recommendedAction = "Adapt";
    suggestedAngle = `Giáo dục nền tảng sinh học quanh ${pain}`;
    counter = "Giữ góc tiếp cận, đổi sang tông khoa học & cá nhân hóa của SERYN.";
  }

  const safeRewrite = sanitize(pick([
    `Hỗ trợ cải thiện ${pain}; kết quả tùy tình trạng da. Cần soi da/tư vấn trước khi chọn liệu trình.`,
    `Giúp da trông săn chắc và tươi tắn hơn — cá nhân hóa theo nền da của bạn.`,
  ], seed));
  const premiumRewrite = sanitize(pick([
    `Tại SERYN, mỗi lộ trình cho ${pain} bắt đầu từ soi da & đọc hiểu nền tảng sinh học — hướng tới ${desire} một cách tự nhiên, hài hòa.`,
    `Không vội vàng, không đại trà: bác sĩ SERYN đánh giá nền da trước khi đề xuất giải pháp phù hợp.`,
  ], seed));
  const shortAdCopy = sanitize(`${cap(pain)}? Hiểu đúng nền da là bước đầu — đặt lịch soi da để được tư vấn cá nhân hóa cùng SERYN.`);
  const recommendedCTA = item.inferredObjective === "messenger" ? "Nhắn tin tư vấn da" : item.inferredObjective === "phone_call" ? "Gọi nhận tư vấn" : "Đặt lịch soi da";

  return {
    suggestedAngle, counterPositioning: counter, safeRewrite, premiumRewrite, shortAdCopy, recommendedCTA,
    videoScriptOutline: [
      `[0–3s] Khơi đúng ${pain} bằng hình ảnh thật, tông điềm tĩnh (không hù dọa).`,
      `[3–10s] Bác sĩ/chuyên viên giải thích ngắn vì sao cần hiểu nền da trước.`,
      `[10–25s] SERYN soi da & cá nhân hóa lộ trình hướng tới ${desire}.`,
      `[CTA] ${recommendedCTA} — kết quả tùy tình trạng da.`,
    ],
    visualDirection: beforeAfter
      ? "Tránh before/after cường điệu; ưu tiên khoảnh khắc soi da/bác sĩ, tông quiet luxury."
      : "Quiet luxury, clinic clean, da thật, ánh sáng dịu; có khoảnh khắc soi da/bác sĩ.",
    complianceWarning: item.riskLevel === "High" ? "Không dùng claim mạnh; chỉ dùng bản Safe Rewrite."
      : item.riskLevel === "Medium" ? "Review câu chữ trước khi chạy; tránh claim tuyệt đối." : "Vẫn tránh claim tuyệt đối; ghi 'kết quả tùy cơ địa'.",
    recommendedAction,
  };
}

/* ---------- builders ---------- */
function exampleAdsFor(brandAds: AdLevelAnalysis[], serviceCat: string, fmt: string, repId?: string): { ids: string[]; urls: string[] } {
  const matched = brandAds.filter((a) =>
    (repId && String(a.ad_id) === repId) || (serviceCat && a.service_or_product === serviceCat) || (fmt && a.content_format === fmt),
  );
  const pool = matched.length ? matched : brandAds;
  const ids: string[] = [], urls: string[] = [];
  if (repId) ids.push(repId);
  for (const a of pool.slice(0, 5)) { if (a.ad_id && !ids.includes(String(a.ad_id))) ids.push(String(a.ad_id)); if (a.ad_snapshot_url) urls.push(String(a.ad_snapshot_url)); }
  return { ids, urls };
}

/** Map ad_id -> thumbnail (thumbnail/media/image/video preview) từ visualAnalysis.
 *  Memo theo tham chiếu `data` để BrandsView gọi cho ~23 brand không dựng lại index. */
const _thumbIndexCache = new WeakMap<SpyDashboardData, Map<string, string>>();
function buildThumbIndex(data: SpyDashboardData): Map<string, string> {
  const cached = _thumbIndexCache.get(data);
  if (cached) return cached;
  const m = new Map<string, string>();
  for (const v of (data.visualAnalysis ?? [])) {
    if (!v.ad_id) continue;
    const t = v.thumbnail_url || v.media_url || (v.image_urls && v.image_urls[0]) || v.video_preview_url;
    if (t) m.set(String(v.ad_id), String(t));
  }
  _thumbIndexCache.set(data, m);
  return m;
}
const isTrueish = (v: unknown) => v === true || /^(true|yes|1|active|đang|có)/i.test(String(v ?? "").trim());

export function buildAdContentIntelligenceForBrand(brandName: string, data: SpyDashboardData, limit = 10): AdContentIntelligence[] {
  const scaled = getBrandScaledContent(brandName, data);
  const ads = getBrandAds(brandName, data);
  const snap = getBrandSnapshot(brandName, data);
  const visual = getBrandVisualSummary(brandName, data);
  const visualAngle = visual?.dominant_visual_angle ? String(visual.dominant_visual_angle) : "";
  const visualFormat = visual?.top_visual_formats ? String(visual.top_visual_formats).split("|")[0] : "";
  const beforeAfter = num(visual?.before_after_rate) >= 0.3;
  const thumbIndex = buildThumbIndex(data);

  // Mỗi nguồn = 1 quảng cáo/nội dung tiêu biểu. `ads` = số lượng QC chạy (số ad
  // tương tự trong cụm) → dùng để xếp hạng "số lượng QC nhiều nhất".
  type Src = { text: string; service: string; format: string; angle: string; offer: string; price: string; proof: string; cta: string; ads: number; days: number; id: string; repId: string };
  const sources: Src[] = [];
  const seenHooks = new Set<string>();
  const seenAdIds = new Set<string>();
  const hookKey = (s: string) => lc(s).replace(/[^a-z0-9à-ỹ ]/gi, "").slice(0, 60).trim();

  // 1) Nguồn chính: cụm nội dung nhân rộng (scaled), số ad tương tự = số lượng QC.
  for (let i = 0; i < scaled.length; i++) {
    const c = scaled[i];
    const text = String(c.representative_hook || "");
    const repId = String(c.representative_ad_id || "");
    const hk = hookKey(text);
    if (hk) { if (seenHooks.has(hk)) continue; seenHooks.add(hk); }
    if (repId) seenAdIds.add(repId);
    sources.push({
      text, service: String(c.service_or_product || ""), format: String(c.content_format || ""),
      angle: String(c.content_angle || ""), offer: String(c.offer_detected || ""), price: String(c.price_detected || ""),
      proof: String(c.proof_point || ""), cta: "",
      ads: num(c.number_of_similar_ads) || 1, days: num(c.longest_days_active),
      id: String(c.content_cluster_id || c.representative_ad_id || `sc-${i}`), repId,
    });
  }

  // 2) Bổ sung quảng cáo lẻ tốt nhất (ad-level) cho đủ ~limit — ưu tiên ad nhân
  //    rộng / chạy dài ngày / đang active. Bỏ trùng hook & ad đã có ở cụm.
  if (sources.length < limit && ads.length) {
    const ranked = ads.slice().sort((x, y) =>
      (num(y.scale_level) * 20 + (isTrueish(y.is_likely_scaled) ? 30 : 0) + Math.min(num(y.days_active), 60)) -
      (num(x.scale_level) * 20 + (isTrueish(x.is_likely_scaled) ? 30 : 0) + Math.min(num(x.days_active), 60)),
    );
    for (const a of ranked) {
      if (sources.length >= limit + 4) break;
      const adId = String(a.ad_id || "");
      if (adId && seenAdIds.has(adId)) continue;
      const text = String(a.hook_raw_text || a.hook_text || a.headline || "");
      if (!text) continue; // bỏ ad không có nội dung để hiển thị (tránh card trống)
      const hk = hookKey(text);
      if (seenHooks.has(hk)) continue;
      seenHooks.add(hk);
      if (adId) seenAdIds.add(adId);
      sources.push({
        text, service: String(a.service_or_product || ""), format: String(a.ad_format || a.media_type || ""),
        angle: String(a.content_angle || ""), offer: String(a.offer_detected || ""), price: String(a.price_detected || ""),
        proof: String(a.proof_point || ""), cta: String(a.cta || ""),
        ads: 1, days: num(a.days_active), // ad lẻ = 1 QC (adsCount = số lượng QC thật, không phải scale_level)
        id: adId || `ad-${sources.length}`, repId: adId,
      });
    }
  }

  const out = sources.map((s) => {
    const text = s.text;
    const classified = classifyContentAngle(text);
    const angle = classified !== "unknown" ? classified : normalizeAngle(s.angle || "");
    const pain = detectPainPoint(text);
    const desire = detectDesiredOutcome(text);
    const proof = detectProofType(text) !== "Chưa rõ" ? detectProofType(text) : (isMeaningful(s.proof) ? viLabel(s.proof) : "Chưa rõ");
    const offer = detectOffer(text) || (isMeaningful(s.offer) ? s.offer : "");
    const cta = detectCTA(text) || (isMeaningful(s.cta) ? s.cta : "");
    const adFormat = adFormatOf(s.format || text);
    const objective = inferObjectiveFromContent(`${text} ${cta}`, "") !== "unknown"
      ? inferObjectiveFromContent(`${text} ${cta}`, "")
      : (snap?.skin_rejuvenation_top_inferred_objective && snap.skin_rejuvenation_top_inferred_objective !== "unknown" ? snap.skin_rejuvenation_top_inferred_objective as AdContentIntelligence["inferredObjective"] : "unknown");
    const risk = riskOf(text, offer, beforeAfter && angle === "social_proof");
    const ex = exampleAdsFor(ads, s.service, s.format, s.repId);
    const thumbnailUrl = [s.repId, ...ex.ids].map((id) => thumbIndex.get(String(id))).find(Boolean);

    const base: Partial<AdContentIntelligence> = {
      brandName, contentText: text,
      contentSummary: text ? humanizeText(text).slice(0, 120) : `Content ${ANGLE_VI[angle] || angle} quanh ${pain}`,
      serviceCategory: isMeaningful(s.service) ? viLabel(s.service) : "Trẻ hóa da",
      treatmentType: s.service, contentAngle: angle, painPoint: pain, desiredOutcome: desire,
      offerDetected: offer, priceDetected: isMeaningful(s.price) ? s.price : "", proofType: proof, cta,
      adFormat, inferredObjective: objective,
      visualAngle: visualAngle ? viLabel(visualAngle) : "", visualFormat: visualFormat, thumbnailUrl,
      adsCount: s.ads, activeDays: s.days, exampleAdIds: ex.ids, exampleAdUrls: ex.urls,
      repetitionSignal: repetitionOf(s.ads), scaleSignal: scaleSignalOf(s.ads, s.days), riskLevel: risk,
    };
    const item: AdContentIntelligence = {
      id: s.id, ...base,
      contentScore: calculateContentScore(base),
      psychology: buildContentPsychology(base),
      contentBreakdown: buildContentBreakdown(base),
      serynResponse: buildSerynContentResponse(base),
    } as AdContentIntelligence;
    return item;
  });

  // Xếp theo SỐ LƯỢNG QC nhiều nhất, rồi tới content signal.
  return out
    .sort((a, b) => (b.adsCount - a.adsCount) || (b.contentScore - a.contentScore))
    .slice(0, limit);
}

export { ANGLE_VI };
