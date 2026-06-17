/* ============================================================
   SERYN — Hook Intelligence (frontend derived model)
   ------------------------------------------------------------
   Dựng "Enhanced Hook Card" từ HookCluster (+ SerynContentRecommendation
   nếu có). Mọi logic scoring / psychology / rewrite / mini-brief để ở đây,
   view chỉ render. KHÔNG cần Google Sheets có field mới.

   Thuật ngữ: competitor hook signal / repeated signal / persistence signal /
   likely scaled pattern / content opportunity. KHÔNG dùng "winning hook".
   hookScore là PROXY (từ tín hiệu public), KHÔNG phải performance thật.
   ============================================================ */
import type { HookCluster, SerynContentRecommendation } from "../types";
import { viLabel } from "./spyData";

/* ---------- derived types ---------- */
export type HookStatusLabel =
  | "Evergreen Pattern"
  | "Strong Repeated Signal"
  | "Rising Pattern"
  | "Monitor"
  | "Low Confidence"
  | "High Risk";

export type HookPsychology = {
  painPoint: string;
  desire: string;
  beliefTrigger: string;
  objectionRemoved: string;
  emotionalTrigger: string;
  awarenessStage: string;
  funnelIntent: string;
  whyItMayWork: string;
  riskNote: string;
};

export type SerynRewriteGroups = {
  directResponse: string[];
  premiumClinicTone: string[];
  safeComplianceTone: string[];
  videoOpening3s: string[];
  metaAdsCaption: string[];
};

export type MiniCreativeBrief = {
  objective: string;
  angle: string;
  targetAudience: string;
  coreMessage: string;
  openingScene: string;
  visualDirection: string;
  proofElement: string;
  offerSuggestion: string;
  cta: string;
  contentFormat: string;
  scriptOutline: { scene1: string; scene2: string; scene3: string; scene4: string };
  complianceWarning: string;
  testPriority: "High" | "Medium" | "Low";
  recommendedAction: string;
};

export type EnhancedHookCard = {
  cluster: HookCluster;
  rec?: SerynContentRecommendation;
  hookScore: number;
  statusLabel: HookStatusLabel;
  confidenceLevel: "High" | "Medium" | "Low";
  riskLevel: "Low" | "Medium" | "High";
  relatedBrands: string[];
  exampleHooks: string[];
  psychology: HookPsychology;
  rewrites: SerynRewriteGroups;
  miniBrief: MiniCreativeBrief;
};

/* ---------- small helpers ---------- */
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp = (n: number, a = 0, b = 100): number => Math.max(a, Math.min(b, Math.round(n)));
const lc = (s?: string): string => String(s || "").toLowerCase();
const cap = (s?: string): string => { const x = String(s || ""); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
/** confidence_score đôi khi 0–1, đôi khi 0–100 — chuẩn hóa về 0–1. */
const conf01 = (c: HookCluster): number => { const n = num(c.confidence_score); return n > 1 ? n / 100 : n; };
const hasDays = (c: HookCluster): boolean => !!c.avg_active_days && String(c.avg_active_days).toLowerCase() !== "unknown";

export function parsePipeList(value?: string): string[] {
  if (!value) return [];
  return String(value)
    .split(/\s*\|\|\s*|\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function hashSeed(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

/* ---------- compliance (an toàn claim ngành thẩm mỹ) ---------- */
const BANNED: Array<[RegExp, string]> = [
  [/trẻ (hơn|ra)\s*\d+\s*tuổi|trẻ\s*\d+\s*tuổi/gi, "hỗ trợ cải thiện dấu hiệu lão hóa"],
  [/xóa (sạch|hết)|hết (hẳn|sạch)|sạch (nám|nhăn)/gi, "giúp làm mờ và cải thiện rõ hơn"],
  [/(trị )?dứt điểm|tận gốc|khỏi hẳn|chữa khỏi/gi, "hỗ trợ cải thiện theo liệu trình"],
  [/vĩnh viễn|mãi mãi/gi, "duy trì lâu dài hơn cùng chăm sóc đúng cách"],
  [/100%|hiệu quả tuyệt đối|cam kết (kết quả|khỏi|hết)/gi, "kết quả tùy cơ địa và tình trạng da"],
  [/không rủi ro|không có rủi ro/gi, "cần tư vấn để hiểu phù hợp với bạn"],
  [/lột xác thần kỳ|thần kỳ|kỳ diệu/gi, "cải thiện rõ nét, tự nhiên"],
];
export function sanitizeClaim(text: string): string {
  let t = String(text || "");
  for (const [re, repl] of BANNED) t = t.replace(re, repl);
  return t.trim();
}

/* ============================================================
   BLOCK 1 — scoring
   ============================================================ */
export function calculateHookScore(cluster: HookCluster): number {
  const ads = num(cluster.ads_count);
  const brands = parsePipeList(cluster.brands_using).length;
  const exampleAds = parsePipeList(cluster.example_ads).length;

  const frequencyScore = clamp(ads * 14);
  const brandDiversityScore = brands >= 4 ? 100 : brands === 3 ? 85 : brands === 2 ? 65 : brands === 1 ? 35 : 10;

  let durationScore = 20;
  if (hasDays(cluster)) {
    const d = num(cluster.avg_active_days);
    durationScore = d >= 60 ? 100 : d >= 30 ? 75 : d >= 14 ? 50 : d >= 7 ? 30 : 15;
  }

  const creativeRepetitionScore = clamp(ads * 10 + exampleAds * 8 + (cluster.top_ad_format && cluster.top_ad_format !== "unknown" ? 10 : 0));
  const confidenceScore = clamp(conf01(cluster) * 100);

  const recencyMap: Record<string, number> = {
    evergreen_persistence_signal: 90,
    strong_persistence_signal: 80,
    repeated_signal: 65,
    early_signal: 50,
    none: 30,
  };
  const recencyScore = recencyMap[String(cluster.scale_signal)] ?? 40;

  const score =
    frequencyScore * 0.25 +
    recencyScore * 0.2 +
    durationScore * 0.2 +
    brandDiversityScore * 0.15 +
    creativeRepetitionScore * 0.1 +
    confidenceScore * 0.1;
  return clamp(score);
}

export function getHookStatusLabel(cluster: HookCluster, _hookScore: number): HookStatusLabel {
  if (num(cluster.risk_score) >= 60) return "High Risk";
  if (conf01(cluster) < 0.45) return "Low Confidence";
  switch (String(cluster.scale_signal)) {
    case "evergreen_persistence_signal": return "Evergreen Pattern";
    case "strong_persistence_signal": return "Strong Repeated Signal";
    case "repeated_signal":
    case "early_signal": return "Rising Pattern";
    default: return "Monitor";
  }
}

export function getConfidenceLevel(cluster: HookCluster): "High" | "Medium" | "Low" {
  const c = conf01(cluster);
  return c >= 0.65 ? "High" : c >= 0.45 ? "Medium" : "Low";
}
export function getRiskLevel(cluster: HookCluster): "Low" | "Medium" | "High" {
  const r = num(cluster.risk_score);
  return r >= 60 ? "High" : r >= 30 ? "Medium" : "Low";
}

/* ============================================================
   BLOCK 2 — psychology
   ============================================================ */
export function buildHookPsychology(cluster: HookCluster): HookPsychology {
  const proof = lc(cluster.proof_type) + " " + lc(cluster.top_proof_type);
  const cat = String(cluster.hook_category);
  const exHooks = lc(parsePipeList(cluster.example_hooks).join(" "));
  const offer = cluster.offer_linked === "TRUE" || cluster.top_offer_linked === "TRUE";

  let beliefTrigger = "Tư vấn cá nhân hóa";
  if (/doctor|expert|medical|bác sĩ|chuyên gia|y khoa/.test(proof)) beliefTrigger = "Uy tín chuyên môn (bác sĩ/chuyên gia)";
  else if (/tech|machine|scientific|công nghệ|máy|khoa học/.test(proof)) beliefTrigger = "Công nghệ / khoa học";
  else if (/customer|testimonial|kol|social|khách hàng/.test(proof)) beliefTrigger = "Bằng chứng xã hội";
  else if (offer) beliefTrigger = "Giá / ưu đãi";

  let objectionRemoved = "Giúp khách hàng hiểu rõ tình trạng da trước khi quyết định";
  if (/không xâm lấn|không đau|không nghỉ dưỡng|không downtime/.test(exHooks)) objectionRemoved = "Lo ngại an toàn / thời gian nghỉ dưỡng";
  else if (/bác sĩ|soi da|phác đồ|chẩn đoán/.test(exHooks + proof)) objectionRemoved = "Lo ngại về độ tin cậy / cần chẩn đoán đúng";
  else if (offer) objectionRemoved = "Lo ngại về chi phí";

  const emotionMap: Record<string, string> = {
    offer_promotion: "Khẩn trương (urgency)", urgency: "Khẩn trương (urgency)",
    fear_loss_aversion: "Lo sợ (fear)", mistake_warning: "Lo sợ (fear)",
    authority: "Tin tưởng (trust)", education: "Tin tưởng (trust)",
    transformation: "Khát vọng (aspiration)", desire_outcome: "Khát vọng (aspiration)",
    social_proof: "Thuộc về số đông (social proof)", testimonial: "Thuộc về số đông (social proof)",
    curiosity: "Tò mò (curiosity)", myth_busting: "Tò mò (curiosity)", comparison: "Tò mò (curiosity)",
  };
  const emotionalTrigger = emotionMap[cat] || "Hy vọng (hope)";

  const awarenessMap: Record<string, string> = {
    education: "Problem-aware", pain_point: "Problem-aware", diagnosis_problem: "Problem-aware",
    authority: "Solution-aware", comparison: "Solution-aware", technology_based: "Solution-aware",
    offer_promotion: "Product-aware", consultation_invite: "Product-aware",
    testimonial: "Consideration", social_proof: "Consideration",
  };
  const awarenessStage = awarenessMap[cat] || "Problem-aware";

  const funnelIntent = cluster.top_inferred_objective && cluster.top_inferred_objective !== "unknown"
    ? viLabel(cluster.top_inferred_objective)
    : viLabel(cat);

  const brands = parsePipeList(cluster.brands_using).length;
  const days = hasDays(cluster) ? `avg active ${cluster.avg_active_days} ngày` : "chưa rõ số ngày chạy";
  const labelBits = [viLabel(cluster.hook_category), viLabel(cluster.hook_formula)]
    .filter((x) => x && x.toLowerCase() !== "chưa rõ");
  const usingTxt = labelBits.length ? `dùng ${labelBits.join("/")} ` : "";
  const whyItMayWork =
    `Pattern này đáng chú ý vì có ${num(cluster.ads_count)} ad từ ${brands} brand, ${days}, ` +
    `${usingTxt}để khơi "${emotionalTrigger}" ` +
    `ở giai đoạn ${awarenessStage}. Đây là competitor hook signal, không phải hook thắng chắc.`;

  const r = num(cluster.risk_score);
  const riskNote = r >= 60
    ? "Rủi ro câu chữ CAO — chỉ dùng bản Safe Compliance, tránh mọi claim mạnh."
    : r >= 30
      ? "Có rủi ro câu chữ — cần review trước khi chạy, ưu tiên bản an toàn."
      : "Rủi ro thấp — vẫn tránh claim tuyệt đối, ghi 'kết quả tùy cơ địa'.";

  return {
    painPoint: cluster.pain_point && cluster.pain_point !== "unknown" ? String(cluster.pain_point) : "Dấu hiệu lão hóa da",
    desire: cluster.desired_outcome && cluster.desired_outcome !== "unknown" ? String(cluster.desired_outcome) : "Da trẻ trung, căng bóng",
    beliefTrigger, objectionRemoved, emotionalTrigger, awarenessStage, funnelIntent, whyItMayWork, riskNote,
  };
}

/* ============================================================
   BLOCK 3 — SERYN rewrite groups
   ============================================================ */
function painOf(c: HookCluster): string { return c.pain_point && c.pain_point !== "unknown" ? String(c.pain_point) : "dấu hiệu lão hóa da"; }
function desireOf(c: HookCluster): string { return c.desired_outcome && c.desired_outcome !== "unknown" ? String(c.desired_outcome) : "làn da trẻ trung, căng bóng"; }
/** Lấy n option từ rec field (nếu có) rồi bù bằng template, đã sanitize, unique. */
function fill(primary: string[], template: string[], n = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...primary, ...template]) {
    const v = sanitizeClaim(s);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

/** Câu dẫn riêng theo nhóm hook (để rewrite KHÁC nhau giữa các loại hook). */
function catLeadIn(cat: string, pain: string): string {
  return ({
    offer_promotion: `Đối thủ đua ưu đãi cho ${pain}; SERYN chọn hướng khác`,
    urgency: `Thay vì tạo áp lực thời gian quanh ${pain}`,
    fear_loss_aversion: `Thay vì hù dọa về ${pain}`,
    mistake_warning: `Thay vì "cảnh báo sai lầm" về ${pain}`,
    authority: `Bác sĩ SERYN tiếp cận ${pain} bằng chẩn đoán`,
    education: `Hiểu đúng ${pain} trước đã`,
    myth_busting: `Có nhiều lầm tưởng quanh ${pain}`,
    transformation: `Với ${pain}, kết quả đẹp nhất là tự nhiên`,
    social_proof: `Nhiều người cùng quan tâm ${pain}`,
    testimonial: `Sau mỗi câu chuyện về ${pain} là một nền da khác nhau`,
    consultation_invite: `Trước khi điều trị ${pain}`,
    diagnosis_problem: `Da bạn đang ở giai đoạn nào của ${pain}?`,
    curiosity: `Điều ít người để ý về ${pain}`,
    comparison: `So phương pháp cho ${pain} chỉ có nghĩa khi hiểu nền da của bạn`,
    pain_point: `${cap(pain)} là điều nhiều người gặp khi da đổi theo thời gian`,
    desire_outcome: `Hướng tới ${pain ? "cải thiện " + pain : "làn da đẹp hơn"}`,
  } as Record<string, string>)[cat] || `Về ${pain}`;
}

export function buildSerynRewriteGroups(cluster: HookCluster, rec?: SerynContentRecommendation): SerynRewriteGroups {
  const pain = painOf(cluster);
  const desire = desireOf(cluster);
  const cat = String(cluster.hook_category || "");
  const lead = catLeadIn(cat, pain);
  const recHeadlines = rec ? parsePipeList(rec.headline_options) : [];
  const recPrimary = rec ? parsePipeList(rec.primary_text_options) : [];
  const recVideo = rec ? parsePipeList(rec.video_opening_3s) : [];

  const directResponse = fill(
    [...recHeadlines, rec?.ad_copy_short || ""].filter(Boolean),
    [
      `${lead} — soi da & đánh giá nền tảng sinh học trước, rồi mới chọn lộ trình hướng tới ${desire}.`,
      `Đừng đoán: soi da để biết ${pain} của bạn đang ở mức nào, rồi mới chọn lộ trình phù hợp.`,
      `${cap(desire)} bắt đầu từ đánh giá nền tảng da — đặt lịch soi da cùng SERYN.`,
    ],
  );

  const premiumClinicTone = fill(
    [rec?.ad_copy_medium || ""].filter(Boolean),
    [
      `${lead}: tại SERYN, mỗi lộ trình cải thiện ${pain} bắt đầu từ việc đọc hiểu nền tảng sinh học của làn da bạn.`,
      `${cap(desire)} một cách tự nhiên, có cơ sở khoa học — cá nhân hóa theo chính tình trạng da của bạn.`,
      `Không vội vàng, không đại trà: bác sĩ SERYN đánh giá da trước khi đề xuất giải pháp phù hợp.`,
    ],
  );

  const safeComplianceTone = fill(
    [rec?.claim_safe_version || ""].filter(Boolean),
    [
      `Hỗ trợ cải thiện dấu hiệu ${pain}; kết quả tùy cơ địa và tình trạng da.`,
      `Giúp da trông săn chắc và căng mịn hơn — cần được tư vấn trước khi lựa chọn liệu trình.`,
      `Đánh giá nền tảng da trước khi đưa ra chỉ định, cá nhân hóa theo tình trạng da.`,
    ],
  );

  const videoOpening3s = fill(
    recVideo,
    [
      `[0–3s] Cận cảnh vùng da ${pain} dưới ánh sáng soi da → chuyển sang gương mặt rạng rỡ tự nhiên.`,
      `[Voiceover] "${cap(desire)} không bắt đầu từ một liệu trình — mà từ việc hiểu chính làn da bạn."`,
      `[Text overlay] "Da bạn đang ở giai đoạn nào?" trên nền tối giản, sang trọng.`,
    ],
  );

  const metaAdsCaption = fill(
    [...recPrimary, rec?.ad_copy_short || ""].filter(Boolean),
    [
      `${cap(pain)} là điều nhiều người gặp khi da thay đổi theo thời gian. Ở SERYN, bác sĩ soi da và cá nhân hóa lộ trình hướng tới ${desire}. Nhắn tin để được tư vấn (kết quả tùy cơ địa).`,
      `Hiểu đúng trước khi điều trị: ${desire} hiệu quả hơn khi được cá nhân hóa theo nền tảng da của bạn. Đặt lịch soi da cùng SERYN.`,
      `Không đua giá — SERYN bắt đầu từ chẩn đoán đúng. Đặt lịch đánh giá nền tảng sinh học cho làn da của bạn.`,
    ],
  );

  return { directResponse, premiumClinicTone, safeComplianceTone, videoOpening3s, metaAdsCaption };
}

/* ============================================================
   BLOCK 4 — mini creative brief
   ============================================================ */
const OBJECTIVE_MAP: Record<string, string> = {
  messenger: "Inbox / Tư vấn",
  landing_page_conversion: "Landing / Booking",
  lead_form: "Lead Form",
  phone_call: "Phone Call",
  website_traffic: "Traffic / Awareness",
  unknown: "Testing",
};
const ACTION_BRIEF_MAP: Record<string, string> = {
  copy_structure: "Adapt Structure",
  adapt_angle: "Adapt Angle",
  counter_positioning: "Counter Positioning",
  avoid_due_to_risk: "Avoid / Safe Rewrite Only",
  monitor: "Monitor",
  test_now: "Test Now",
};

export function buildMiniCreativeBrief(
  cluster: HookCluster,
  rec: SerynContentRecommendation | undefined,
  hookScore: number,
): MiniCreativeBrief {
  const pain = painOf(cluster);
  const desire = desireOf(cluster);
  const obj = String(cluster.top_inferred_objective || "unknown");
  const fmt = String(cluster.top_ad_format || "unknown");
  const offer = cluster.offer_linked === "TRUE" || cluster.top_offer_linked === "TRUE";
  const risk = num(cluster.risk_score);
  const conf = conf01(cluster);

  const cta = (rec ? parsePipeList(rec.cta_options)[0] : "") || "Đặt lịch soi da";

  const openingScene = fmt === "video"
    ? `[0–3s video] Cận cảnh vùng da ${pain} → chuyển sang gương mặt rạng rỡ; bác sĩ xuất hiện soi da.`
    : fmt === "carousel"
      ? `Slide 1: nêu ${pain} · Slide 2: cơ chế/giải thích · Slide 3: hướng cải thiện · Slide 4: CTA soi da.`
      : `Visual hero cận mặt / khoảnh khắc soi da; tông sạch, sang, ánh sáng dịu.`;

  const visualDirection = sanitizeClaim(
    (rec?.visual_direction || "").trim() ||
    "Quiet luxury, clinic clean, bác sĩ soi da; ánh sáng dịu, da thật; tránh before/after cường điệu.",
  );

  const offerSuggestion = offer
    ? "Không đua giá — chuyển offer thành 'soi da / đánh giá nền tảng da cá nhân hóa'."
    : "Đặt lịch soi da / tư vấn cá nhân hóa (không FOMO).";

  const complianceWarning = risk >= 60
    ? "Không dùng claim mạnh; CHỈ dùng bản Safe Compliance."
    : risk >= 30
      ? "Cần review câu chữ trước khi chạy; tránh claim tuyệt đối."
      : "Vẫn tránh claim tuyệt đối; ghi 'kết quả tùy cơ địa'.";

  const testPriority: MiniCreativeBrief["testPriority"] =
    hookScore >= 70 && risk < 60 && conf >= 0.55 ? "High" : hookScore >= 50 ? "Medium" : "Low";

  return {
    objective: OBJECTIVE_MAP[obj] || "Testing",
    angle: `${viLabel(cluster.hook_angle)} · ${pain} → ${desire}`,
    targetAudience: pain && pain !== "dấu hiệu lão hóa da"
      ? `Nữ 30–45 đang quan tâm "${pain}", muốn cải thiện theo hướng tự nhiên, cao cấp`
      : "Nữ 30–45, quan tâm trẻ hóa da, bắt đầu thấy dấu hiệu lão hóa/chảy xệ/kém săn chắc",
    coreMessage: sanitizeClaim(
      (rec?.insight || rec?.main_message || "").trim() ||
      `Hiểu đúng tình trạng da trước khi chọn liệu trình: SERYN soi da & cá nhân hóa lộ trình hướng tới ${desire}.`,
    ),
    openingScene,
    visualDirection,
    proofElement: viLabel(cluster.top_proof_type) || viLabel(cluster.proof_type) || "Tư vấn chuyên môn",
    offerSuggestion,
    cta,
    contentFormat: viLabel(fmt) || "Ảnh / Video",
    scriptOutline: {
      scene1: `Khơi đúng ${pain} mà nhóm khách hàng đang gặp (không hù dọa).`,
      scene2: `Giải thích ngắn vì sao cần hiểu nền tảng da trước khi can thiệp.`,
      scene3: `SERYN soi da & cá nhân hóa lộ trình hướng tới ${desire}.`,
      scene4: `CTA: ${cta} (kết quả tùy cơ địa và tình trạng da).`,
    },
    complianceWarning,
    testPriority,
    recommendedAction: ACTION_BRIEF_MAP[String(cluster.recommended_seryn_action)] || "Monitor",
  };
}

/* ============================================================
   builders + copy formatters
   ============================================================ */
export function buildEnhancedHookCards(
  clusters: HookCluster[],
  recs: SerynContentRecommendation[],
): EnhancedHookCard[] {
  const recByCluster = new Map<string, SerynContentRecommendation>();
  for (const r of recs || []) {
    if (String(r.source) === "hook_intelligence" && r.source_hook_cluster_id) {
      recByCluster.set(String(r.source_hook_cluster_id), r);
    }
  }
  return (clusters || [])
    .map((cluster) => {
      const rec = recByCluster.get(String(cluster.hook_cluster_id));
      const hookScore = calculateHookScore(cluster);
      return {
        cluster,
        rec,
        hookScore,
        statusLabel: getHookStatusLabel(cluster, hookScore),
        confidenceLevel: getConfidenceLevel(cluster),
        riskLevel: getRiskLevel(cluster),
        relatedBrands: parsePipeList(cluster.brands_using),
        exampleHooks: parsePipeList(cluster.example_hooks),
        psychology: buildHookPsychology(cluster),
        rewrites: buildSerynRewriteGroups(cluster, rec),
        miniBrief: buildMiniCreativeBrief(cluster, rec, hookScore),
      };
    })
    .sort((a, b) => b.hookScore - a.hookScore);
}

export function formatRewriteGroupForCopy(group: string[]): string {
  return (group || []).map((s, i) => `${i + 1}. ${s}`).join("\n");
}

export function formatBriefForCopy(brief: MiniCreativeBrief): string {
  return [
    "=== SERYN MINI CREATIVE BRIEF ===",
    `Objective: ${brief.objective}`,
    `Angle: ${brief.angle}`,
    `Target audience: ${brief.targetAudience}`,
    `Core message: ${brief.coreMessage}`,
    `Opening scene: ${brief.openingScene}`,
    `Visual direction: ${brief.visualDirection}`,
    `Proof element: ${brief.proofElement}`,
    `Offer suggestion: ${brief.offerSuggestion}`,
    `CTA: ${brief.cta}`,
    `Content format: ${brief.contentFormat}`,
    "Script outline:",
    `  1. ${brief.scriptOutline.scene1}`,
    `  2. ${brief.scriptOutline.scene2}`,
    `  3. ${brief.scriptOutline.scene3}`,
    `  4. ${brief.scriptOutline.scene4}`,
    `Compliance: ${brief.complianceWarning}`,
    `Test priority: ${brief.testPriority}`,
    `Recommended action: ${brief.recommendedAction}`,
  ].join("\n");
}

export function formatScriptOutlineForCopy(brief: MiniCreativeBrief): string {
  const s = brief.scriptOutline;
  return [`1. ${s.scene1}`, `2. ${s.scene2}`, `3. ${s.scene3}`, `4. ${s.scene4}`].join("\n");
}
