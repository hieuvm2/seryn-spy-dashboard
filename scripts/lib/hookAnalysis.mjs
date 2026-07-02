/* ============================================================
   SERYN Spy — Hook Intelligence engine (server-side, heuristic)
   ------------------------------------------------------------
   PHẠM VI: trẻ hóa da (skin_rejuvenation).
   - analyzeHook(ad)         -> các field hook_* + scoring + evidence
   - claimSafe(text)         -> { claim_risk_level, avoid_phrases, claim_safe_version }
   - scaleSignal(...)        -> enum tín hiệu lặp/bền (KHÔNG dùng "winning")
   - generateAdContent(...)  -> content chạy ads (VI, an toàn claim)

   Quy ước thuật ngữ: scaling signal / repeated hook pattern /
   persistence signal / competitor hook signal / content opportunity.
   KHÔNG copy nguyên văn đối thủ — chỉ học structure/angle.
   ============================================================ */

const lc = (s) => String(s || "").toLowerCase();
const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(n)));
const round2 = (n) => Math.round(n * 100) / 100;
const has = (t, re) => re.test(t);
export function hashSeed(s) { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
const pick = (list, seed) => list[hashSeed(seed) % list.length];

/* ---------- enums ---------- */
export const SCALE_SIGNAL = ["none", "early_signal", "repeated_signal", "strong_persistence_signal", "evergreen_persistence_signal"];

/* ---------- keyword tables (ưu tiên theo thứ tự) ---------- */
const RE = {
  offer: /giảm|ưu đãi|khuyến mãi|trợ giá|đồng giá|chỉ từ|chỉ còn|miễn phí|combo|trọn gói|tặng|sale|\boff\b|voucher|\d+\s*k\b|\d+%|\d+\s*(triệu|tr)\b/i,
  urgency: /hôm nay|duy nhất|số lượng có hạn|nhanh tay|kẻo lỡ|cuối cùng|hạn chót|sắp hết|giờ vàng|chốt ngay/i,
  fear: /đừng để|coi chừng|cảnh báo|nguy cơ|hối hận|quá muộn|tàn phá|báo động|đáng sợ/i,
  mistake: /sai lầm|đừng (tự|mua|chọn|làm)|tránh (xa|ngay)|nhầm lẫn|lưu ý/i,
  myth: /sự thật|lầm tưởng|hiểu lầm|đừng tin|thực hư|có thật|vạch trần|bóc/i,
  comparison: /so sánh|khác nhau|\bvs\b|hay hơn|tốt hơn|nên chọn|loại nào/i,
  transformation: /lột xác|trước sau|before after|before\/after|thay đổi diện mạo|sau \d+\s*(buổi|tuần|tháng|liệu trình)|kết quả sau|lên hương/i,
  testimonial: /câu chuyện|chia sẻ của|hành trình của|cô\b|chị\b.*(đã|từng)|trải nghiệm của/i,
  social: /khách hàng|review|đánh giá|hàng (nghìn|ngàn)|tin tưởng|5 sao|cảm nhận|được chọn/i,
  authority: /bác sĩ|chuyên gia|ts\.?\s*bs|bs\.|y khoa|phác đồ|độc quyền|chuẩn (fda|y khoa|quốc tế)|nghiên cứu/i,
  tech: /hifu|thermage|ultherapy|laser|\brf\b|exosome|mesotherapy|collagen|máy|công nghệ|sofwave|pico/i,
  consult: /tư vấn|đặt lịch|soi da|kiểm tra da|đăng ký|nhận tư vấn|miễn phí soi|khám da/i,
  diagnosis: /tình trạng da|da bạn đang|dấu hiệu|bạn có đang|nhận biết|da của bạn/i,
  education: /vì sao|tại sao|bạn có biết|cơ chế|kiến thức|hiểu đúng|giải thích|là gì/i,
  curiosity: /bí mật|điều ít ai|bất ngờ|ít người biết|không ngờ/i,
  pain: /chảy xệ|lão hóa|nếp nhăn|xỉn màu|xỉn|kém đàn hồi|kém săn chắc|nám|tàn nhang|thâm|sạm|lỗ chân lông|da khô|da kém|chùng nhão|da mặt (lão|nhăn)/i,
  desire: /căng bóng|trẻ trung|trẻ hóa|tươi trẻ|sáng mịn|săn chắc|rạng rỡ|thanh xuân|trẻ lâu|tự tin/i,
  checklist: /\b\d+\s*(cách|bước|dấu hiệu|lý do|công nghệ|phương pháp|sai lầm|điều)\b/i,
};

const PAIN_MAP = [
  ["da chảy xệ", /chảy xệ|chùng|nhão/i],
  ["nếp nhăn", /nếp nhăn|vết nhăn|rãnh nhăn/i],
  ["da lão hóa", /lão hóa|tuổi tác|già đi/i],
  ["da xỉn màu", /xỉn|kém sắc|tối màu|thiếu sức sống/i],
  ["nám/thâm sạm", /nám|tàn nhang|đốm nâu|sạm|thâm/i],
  ["da kém đàn hồi", /kém đàn hồi|kém săn chắc|thiếu collagen/i],
  ["lỗ chân lông to", /lỗ chân lông/i],
  ["da khô/thiếu nước", /da khô|thiếu nước|mất nước/i],
];
const DESIRE_MAP = [
  ["da căng bóng", /căng bóng|căng mịn/i],
  ["da trẻ trung tự nhiên", /trẻ trung|tươi trẻ|trẻ hóa|thanh xuân/i],
  ["da săn chắc, nâng cơ", /săn chắc|nâng cơ|đàn hồi/i],
  ["da sáng mịn rạng rỡ", /sáng mịn|rạng rỡ|sáng da/i],
  ["sự tự tin", /tự tin/i],
];
const SUBCATEGORY_MAP = [
  ["sagging_skin", /chảy xệ|chùng|nhão/i],
  ["wrinkles_fine_lines", /nếp nhăn|vết nhăn/i],
  ["aging_skin", /lão hóa|tuổi tác|già/i],
  ["dull_skin", /xỉn|kém sắc|tối màu/i],
  ["melasma_dark_spots", /nám|tàn nhang|đốm nâu|sạm|thâm/i],
  ["large_pores", /lỗ chân lông/i],
  ["acne_scars", /sẹo|rỗ/i],
  ["sensitive_skin", /nhạy cảm|kích ứng/i],
  ["postpartum_skin", /sau sinh|bỉm sữa/i],
  ["event_ready_beauty", /tết|cưới|sự kiện|dự tiệc|hẹn/i],
  ["free_skin_check", /soi da miễn phí|miễn phí soi|kiểm tra da miễn phí/i],
  ["doctor_consultation", /bác sĩ tư vấn|tư vấn bác sĩ|gặp bác sĩ/i],
  ["limited_offer", RE.offer],
  ["before_after_result", /trước sau|before after|kết quả sau/i],
  ["customer_story", /câu chuyện|chia sẻ|khách hàng/i],
  ["technology_authority", RE.tech],
  ["lost_confidence", /tự ti|mất tự tin/i],
];

function firstMatch(table, text, fallback = "unknown") {
  for (const [label, re] of table) if (re.test(text)) return label;
  return fallback;
}

/* ---------- category / formula / angle ---------- */
function detectCategory(t) {
  if (has(t, RE.offer)) return "offer_promotion";
  if (has(t, RE.urgency)) return "urgency";
  if (has(t, RE.fear)) return "fear_loss_aversion";
  if (has(t, RE.mistake)) return "mistake_warning";
  if (has(t, RE.myth)) return "myth_busting";
  if (has(t, RE.transformation)) return "transformation";
  if (has(t, RE.comparison)) return "comparison";
  if (has(t, RE.testimonial)) return "testimonial";
  if (has(t, RE.authority)) return "authority";
  if (has(t, RE.consult)) return "consultation_invite";
  if (has(t, RE.diagnosis)) return "diagnosis_problem";
  if (has(t, RE.social)) return "social_proof";
  if (has(t, RE.education)) return "education";
  if (has(t, RE.curiosity) || /\?\s*$/.test(t)) return "curiosity";
  if (has(t, RE.desire)) return "desire_outcome";
  if (has(t, RE.pain)) return "pain_point";
  return "unknown";
}
function detectFormula(t) {
  if (/\?\s*$/.test(t) || /^(vì sao|tại sao|bạn có|liệu|có nên|đã bao giờ)/i.test(t)) return "question_hook";
  if (has(t, RE.mistake)) return "mistake_hook";
  if (has(t, RE.myth)) return "myth_vs_truth";
  if (/bí mật|ít ai biết|không ngờ/i.test(t)) return "secret_hook";
  if (/bác sĩ.*(giải thích|chia sẻ|nói|phân tích)|góc nhìn y khoa|dưới góc nhìn/i.test(t)) return "doctor_explains";
  if (has(t, RE.testimonial)) return "customer_story";
  if (/miễn phí (tư vấn|soi)|soi da miễn phí|tư vấn miễn phí/i.test(t)) return "free_consultation";
  if (has(t, RE.offer)) return "limited_offer";
  if (has(t, RE.comparison)) return "comparison_hook";
  if (has(t, RE.checklist)) return "checklist_hook";
  if (has(t, RE.diagnosis)) return "symptom_diagnosis";
  if (/trước sau|before after/i.test(t)) return "before_after";
  if (/sau \d+|kết quả|cải thiện|giúp da/i.test(t)) return "result_promise";
  if (has(t, RE.fear)) return "fear_to_relief";
  if (/xứng đáng|là chính mình|phiên bản|phụ nữ (hiện đại|thông minh)/i.test(t)) return "aspiration_identity";
  if (has(t, RE.pain)) return "problem_solution";
  return "unknown";
}
function detectAngle(t) {
  if (has(t, RE.offer)) return "offer_led";
  if (has(t, RE.tech)) return "technology_based";
  if (has(t, RE.authority)) return "medical_trust";
  if (has(t, RE.consult)) return "expert_consultation";
  if (has(t, RE.diagnosis)) return "problem_diagnosis";
  if (has(t, RE.education)) return "education_led";
  if (has(t, RE.social) || has(t, RE.testimonial)) return "social_proof_led";
  if (has(t, RE.transformation)) return "beauty_transformation";
  if (/lão hóa|chống lão/i.test(t)) return "anti_aging";
  if (/tự nhiên|trẻ trung tự nhiên/i.test(t)) return "natural_youth";
  if (/tự tin|tự ti/i.test(t)) return "confidence_recovery";
  return "unknown";
}
function detectEmotion(cat) {
  return ({
    fear_loss_aversion: "fear", mistake_warning: "fear", urgency: "urgency",
    offer_promotion: "urgency", transformation: "aspiration", desire_outcome: "aspiration",
    authority: "trust", education: "trust", consultation_invite: "trust",
    diagnosis_problem: "relief", social_proof: "belonging", testimonial: "belonging",
    curiosity: "curiosity", myth_busting: "curiosity", comparison: "curiosity",
    pain_point: "relief", unknown: "hope",
  })[cat] || "hope";
}

/* ---------- claim risk / safe ---------- */
const RISKY = [
  [/trẻ (hơn|ra)\s*\d+\s*tuổi|trẻ\s*\d+\s*tuổi/i, 35, "hỗ trợ cải thiện dấu hiệu lão hóa"],
  [/xóa (sạch|hết)|hết (hẳn|sạch)|sạch (nám|nhăn)/i, 30, "giúp làm mờ và cải thiện rõ rệt hơn"],
  [/dứt điểm|tận gốc|trị (dứt|tận)|đặc trị|chữa khỏi/i, 30, "hỗ trợ điều trị, cải thiện theo liệu trình"],
  [/vĩnh viễn|mãi mãi|không bao giờ/i, 25, "duy trì kết quả lâu dài hơn cùng chăm sóc đúng cách"],
  [/100%|tuyệt đối|đảm bảo|cam kết (kết quả|khỏi|hết)/i, 25, "kết quả tùy cơ địa và tình trạng da"],
  [/thần kỳ|kỳ diệu|lột xác|thay da đổi thịt/i, 20, "cải thiện rõ nét, tự nhiên"],
  [/giảm\s*[5-9]\d%|giảm 100%|đồng giá|giá sốc|rẻ nhất/i, 15, "ưu đãi minh bạch, tư vấn theo nhu cầu"],
  [/chữa (bệnh)|trị (bệnh|nám) (dứt|tận)/i, 25, "hỗ trợ cải thiện tình trạng da"],
];
/** { claim_risk_level, claim_risk_score, avoid_phrases, claim_safe_version } */
export function claimSafe(text) {
  const t = String(text || "");
  let score = 0; const avoid = []; let safe = t;
  for (const [re, pts, repl] of RISKY) {
    const m = t.match(re);
    if (m) { score += pts; avoid.push(m[0]); safe = safe.replace(re, repl); }
  }
  score = clamp(score, 0, 100);
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { claim_risk_level: level, claim_risk_score: score, avoid_phrases: [...new Set(avoid)].join(" | "), claim_safe_version: safe.trim() };
}

/* ---------- per-ad hook analysis ---------- */
const FUNNEL_BY_CATEGORY = {
  offer_promotion: "conversion", urgency: "conversion", consultation_invite: "conversion",
  transformation: "consideration", social_proof: "consideration", testimonial: "consideration",
  authority: "consideration", comparison: "consideration",
  education: "awareness", curiosity: "awareness", myth_busting: "awareness",
  pain_point: "awareness", fear_loss_aversion: "awareness", mistake_warning: "awareness",
  diagnosis_problem: "awareness", desire_outcome: "awareness", unknown: "unknown",
};

/**
 * Phân tích sâu 1 hook. ad: { hook_text|headline|primary_text, hook_type,
 * service_or_product, offer_detected, proof_point, content_format, days_active,
 * inferred_objective, funnel_stage }
 */
export function analyzeHook(ad = {}) {
  const raw = String(ad.hook_text || ad.headline || ad.primary_text || "").trim();
  const t = lc(raw);
  const norm = t.replace(/["“”'’]/g, "").replace(/\s+/g, " ").trim();

  const category = detectCategory(t);
  const subcategory = firstMatch(SUBCATEGORY_MAP, t, "unknown");
  const formula = detectFormula(t);
  const angle = detectAngle(t);
  const pain = firstMatch(PAIN_MAP, t, category === "pain_point" ? "dấu hiệu lão hóa da" : "unknown");
  const desire = firstMatch(DESIRE_MAP, t, "da trẻ trung, căng bóng");
  const emotion = detectEmotion(category);
  const offerLinked = has(t, RE.offer) || (!!ad.offer_detected && !/no_clear_offer|unknown/i.test(String(ad.offer_detected)));
  const proofType = ad.proof_point && !/no_clear_proof|unknown/i.test(String(ad.proof_point)) ? String(ad.proof_point) : (has(t, RE.authority) ? "doctor_expert" : has(t, RE.tech) ? "technology_machine" : "no_clear_proof");
  const audience = /sau sinh|bỉm sữa/i.test(t) ? "phụ nữ sau sinh" : /u4\d|trung niên|tuổi 4/i.test(t) ? "phụ nữ trung niên (U40+)" : /u3\d|gen z|trẻ/i.test(t) ? "phụ nữ trẻ (U30)" : /nam giới|đàn ông/i.test(t) ? "nam giới" : "phụ nữ quan tâm trẻ hóa da (U30–U45)";

  const funnel = ad.funnel_stage && ad.funnel_stage !== "unknown" ? String(ad.funnel_stage) : (FUNNEL_BY_CATEGORY[category] || "unknown");
  const promise = desire !== "unknown" ? `Giúp ${desire} một cách tự nhiên, có cơ sở khoa học` : "Cải thiện làn da theo hướng tự nhiên, cá nhân hóa";

  // scoring
  const len = raw.length;
  const clarity = clamp(40 + (len >= 16 && len <= 90 ? 30 : 0) + (len > 140 ? -25 : 0) + (/[•|]{2,}|!!!|🔥{2,}/.test(raw) ? -10 : 10));
  const hasNum = /\d/.test(raw);
  const specificity = clamp(30 + (hasNum ? 25 : 0) + (has(t, RE.tech) ? 20 : 0) + (pain !== "unknown" ? 15 : 0) + (/\d+\s*(buổi|tuần|tháng|ngày|liệu trình)/i.test(t) ? 10 : 0));
  const urgency = clamp((has(t, RE.urgency) ? 50 : 0) + (has(t, RE.offer) ? 30 : 0) + (/\?\s*$/.test(t) ? 0 : 0));
  const trust = clamp((has(t, RE.authority) ? 45 : 0) + (proofType !== "no_clear_proof" ? 25 : 0) + (has(t, RE.tech) ? 15 : 0) + (has(t, RE.education) ? 10 : 0));
  const risk = claimSafe(raw);
  const emotionalScore = emotion === "hope" ? 20 : 55;
  const days = Number(ad.days_active) || 0;
  const daysBucket = days >= 60 ? 25 : days >= 30 ? 18 : days >= 14 ? 10 : days > 0 ? 5 : 0;
  const formatSupport = ad.content_format && ad.content_format !== "unknown" ? 8 : 0;
  const strength = clamp(
    clarity * 0.2 + specificity * 0.22 + emotionalScore * 0.16 +
    (proofType !== "no_clear_proof" ? 12 : 0) + (offerLinked ? 8 : 0) + daysBucket + formatSupport,
  );

  // confidence: dữ liệu càng đủ càng cao; thiếu active_days/text -> thấp
  let conf = 0.35;
  if (raw.length >= 12) conf += 0.2;
  if (days > 0) conf += 0.2; else conf -= 0.05;
  if (ad.content_format && ad.content_format !== "unknown") conf += 0.1;
  if (ad.inferred_objective && ad.inferred_objective !== "unknown") conf += 0.1;
  if (category !== "unknown") conf += 0.1;
  const confidence = round2(Math.max(0.1, Math.min(0.9, conf)));

  const evidence = [
    `category=${category}`, `formula=${formula}`, `angle=${angle}`,
    days ? `active_days=${days}` : "active_days=unknown",
    offerLinked ? "offer_linked" : "no_offer",
    proofType !== "no_clear_proof" ? `proof=${proofType}` : "no_proof",
  ].join(" · ");

  return {
    hook_raw_text: raw,
    hook_normalized: norm,
    hook_category: category,
    hook_subcategory: subcategory,
    hook_formula: formula,
    hook_emotional_trigger: emotion,
    hook_pain_point: pain,
    hook_desired_outcome: desire,
    hook_promise: promise,
    hook_proof_type: proofType,
    hook_offer_linked: offerLinked ? "TRUE" : "FALSE",
    hook_target_audience: audience,
    hook_funnel_stage: funnel,
    hook_angle: angle,
    hook_strength_score: strength,
    hook_clarity_score: clarity,
    hook_specificity_score: specificity,
    hook_urgency_score: urgency,
    hook_trust_score: trust,
    hook_risk_score: risk.claim_risk_score,
    hook_confidence_score: confidence,
    hook_evidence: evidence,
    _claim: risk,
  };
}

/* ---------- cluster scale signal ---------- */
export function scaleSignal({ adsCount = 0, brandsUsing = 0, avgActiveDays = 0, hasDays = true }) {
  if (avgActiveDays >= 60 && hasDays) return "evergreen_persistence_signal";
  if ((adsCount >= 5 || brandsUsing >= 2 || (avgActiveDays >= 30 && hasDays))) return "strong_persistence_signal";
  if (adsCount >= 3) return "repeated_signal";
  if (adsCount >= 2) return "early_signal";
  return "none";
}

/* ---------- content generator (VI, an toàn claim) ---------- */
const CTA_POOL = ["Nhắn tin tư vấn", "Đặt lịch soi da", "Nhận tư vấn da", "Kiểm tra tình trạng da", "Xem liệu trình phù hợp", "Đặt lịch đánh giá nền tảng sinh học"];

/**
 * Sinh content chạy ads từ 1 hook cluster (đã an toàn claim, không copy đối thủ).
 * cluster: { hook_pattern, pain_point, desired_outcome, hook_angle, hook_category,
 *   service_category, top_offer_linked, top_proof_type, top_ad_format, top_inferred_objective }
 */
export function generateAdContent(cluster) {
  const pain = cluster.pain_point && cluster.pain_point !== "unknown" ? cluster.pain_point : "dấu hiệu lão hóa da";
  const desire = cluster.desired_outcome && cluster.desired_outcome !== "unknown" ? cluster.desired_outcome : "làn da trẻ trung, căng bóng";
  const seed = cluster.hook_cluster_id || cluster.hook_pattern || `${pain}|${desire}`;
  const obj = String(cluster.top_inferred_objective || "");
  const fmt = String(cluster.top_ad_format || "");

  const short = pick([
    `Bạn đang băn khoăn về ${pain}? Hiểu đúng tình trạng da là bước đầu để ${desire}. Nhắn tin để được bác sĩ tư vấn.`,
    `${cap(desire)} bắt đầu từ việc hiểu nền tảng da của chính bạn — không phải từ một liệu trình đại trà. Đặt lịch soi da cùng SERYN.`,
  ], seed);

  const medium = pick([
    `${cap(pain)} là điều nhiều người gặp khi da thay đổi theo thời gian.\nỞ SERYN, bác sĩ đánh giá nền tảng sinh học của làn da bạn trước, rồi mới đề xuất lộ trình phù hợp để ${desire}.\nKết quả tùy cơ địa và tình trạng da. Nhắn tin để được tư vấn cá nhân hóa.`,
    `Thay vì lo lắng về ${pain}, hãy bắt đầu bằng một buổi soi da để hiểu da bạn đang ở giai đoạn nào.\nSERYN ưu tiên cải thiện tự nhiên, bền vững thay vì hiệu ứng tức thời, hướng tới ${desire}.\nĐặt lịch đánh giá nền tảng sinh học cùng đội ngũ chuyên môn.`,
  ], seed);

  const long = pick([
    `Có thể bạn từng thử nhiều cách cho ${pain} nhưng chưa thấy phù hợp.\n\nĐiều SERYN tin là: mỗi làn da có một "nền tảng sinh học" riêng — tuổi da, độ đàn hồi, sắc tố, thói quen sống đều khác nhau. Vì vậy cùng một công nghệ, kết quả mỗi người mỗi khác.\n\nỞ SERYN, bác sĩ sẽ soi da và đánh giá nền tảng sinh học trước, sau đó cá nhân hóa lộ trình hướng tới ${desire} — tự nhiên, có cơ sở khoa học, và bền vững.\n\nKết quả tùy cơ địa và tình trạng da. Nếu bạn muốn hiểu rõ làn da của mình, hãy nhắn tin hoặc đặt lịch soi da để trao đổi với đội ngũ chuyên môn.`,
  ], seed);

  const headlines = uniq([
    `Hiểu đúng ${pain} trước khi điều trị`,
    `${cap(desire)} từ nền tảng sinh học`,
    `Soi da cùng bác sĩ — hiểu da bạn cần gì`,
    `Không đua giá. Bắt đầu từ chỉ định đúng`,
    `Lộ trình trẻ hóa cá nhân hóa cho riêng bạn`,
    `Da bạn đang ở giai đoạn nào?`,
  ]).slice(0, 5);

  const primaryTexts = uniq([short, medium.split("\n")[0], `${cap(pain)}? Hãy bắt đầu bằng việc hiểu da bạn — đặt lịch soi da cùng SERYN.`]).slice(0, 3);

  const videoOpen = [
    `[Visual] Cận cảnh vùng da ${pain} dưới ánh sáng soi da, chuyển sang gương mặt rạng rỡ tự nhiên.`,
    `[Voiceover] "${cap(desire)} không bắt đầu từ một liệu trình — mà từ việc hiểu chính làn da bạn."`,
    `[Text overlay] "Da bạn đang ở giai đoạn nào? Soi da để biết." (3 giây đầu, nền tối giản, sang trọng)`,
  ];

  const messenger = obj.includes("messenger")
    ? [
        "Mở inbox: 'Chào bạn, bạn đang quan tâm cải thiện tình trạng da nào ạ?'",
        "Câu hỏi phân loại: 'Da bạn hiện đang gặp " + pain + " hay dấu hiệu nào khác ạ?'",
        "Tư vấn: 'Bên mình có thể soi da để đánh giá nền tảng trước khi gợi ý lộ trình phù hợp.'",
        "Chốt lịch: 'Bạn muốn đặt lịch soi da vào buổi nào trong tuần này ạ?'",
      ].join("\n")
    : "(Objective không phải Messenger — ưu tiên kịch bản landing/booking.)";

  const landing = obj.includes("landing") || obj.includes("conversion")
    ? [
        `Hero headline: ${cap(desire)} bắt đầu từ nền tảng sinh học của bạn`,
        `Subheadline: Bác sĩ soi da & cá nhân hóa lộ trình — tự nhiên, bền vững, có cơ sở khoa học.`,
        `Proof block: đội ngũ bác sĩ đa chuyên khoa · quy trình đánh giá nền tảng sinh học · kết quả tùy cơ địa.`,
        `CTA block: "Đặt lịch soi da" / "Nhận tư vấn cá nhân hóa".`,
        `Form angle: hỏi tình trạng da chính (${pain}) + mong muốn (${desire}) để cá nhân hóa tư vấn.`,
      ].join("\n")
    : "(Đối thủ chưa kéo mạnh landing/conversion — có thể test Messenger trước.)";

  const visualDirection = pick([
    `Tông quiet luxury: ánh sáng dịu, da thật, có khoảnh khắc soi da/bác sĩ. Tránh before/after cường điệu.`,
    `Editorial cao cấp, ấm: cận cảnh kết cấu da tự nhiên + bác sĩ trao đổi. Không nhấn giá, không banner đỏ.`,
  ], seed);

  const fmtNote = fmt === "video" ? "Đối thủ mạnh video → ưu tiên reel bác sĩ giải thích 20–40s." : fmt === "carousel" ? "Đối thủ dùng carousel → kể câu chuyện theo từng slide (vấn đề → cơ chế → lộ trình → CTA)." : "Ảnh editorial cao cấp + text overlay tinh tế.";

  return {
    ad_copy_short: claimSafe(short).claim_safe_version,
    ad_copy_medium: claimSafe(medium).claim_safe_version,
    ad_copy_long: claimSafe(long).claim_safe_version,
    headline_options: headlines.join(" | "),
    primary_text_options: primaryTexts.join(" || "),
    cta_options: pickN(CTA_POOL, 5, seed).join(" | "),
    video_opening_3s: videoOpen.join(" || "),
    messenger_script_angle: messenger,
    landing_page_angle: landing,
    visual_direction: `${visualDirection} ${fmtNote}`,
  };
}

/* ---------- helpers ---------- */
function cap(s) { const x = String(s || ""); return x.charAt(0).toUpperCase() + x.slice(1); }
function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
function pickN(pool, n, seed) {
  const start = hashSeed(seed) % pool.length;
  const out = [];
  for (let i = 0; i < pool.length && out.length < n; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}
