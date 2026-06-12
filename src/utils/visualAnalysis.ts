/* ============================================================
   Visual Intelligence — phân tích creative ads (heuristic, frontend).

   - Nếu Google Sheets có tab "Visual Analysis" -> dùng thẳng.
   - Nếu thiếu/trống -> DERIVE từ adLevelAnalysis bằng heuristic để view
     vẫn có dữ liệu (không crash). Cùng logic với scripts/weekly-spy-sync.mjs.
   - Manual review/correction lưu localStorage (offline fallback).
   ============================================================ */
import type {
  AdLevelAnalysis,
  SpyDashboardData,
  VisualAnalysis,
  VisualFormat,
  VisualAngle,
  CreativeType,
  CreativeRisk,
  SerynVisualAction,
  BrandVisualSummary,
  VisualPattern,
} from "../types";

const REVIEW_KEY = "seryn_visual_reviews_v1";

const lc = (s?: unknown) => String(s ?? "").toLowerCase();
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Vân tay ảnh ổn định (tên file fbcdn, bỏ query) -> gom creative trùng. */
export function imageFingerprint(url?: string): string {
  if (!url) return "";
  const file = String(url).split("?")[0].split("/").pop() || "";
  const m = file.match(/^(\d+_\d+)/);
  return m ? m[1] : file;
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const has = (t: string, kws: string[]) => kws.some((k) => t.includes(k));

/* ---------- từ điển heuristic ---------- */
const KW = {
  beforeAfter: ["trước sau", "trước/sau", "before after", "before/after", "lột xác", "transformation", "sau liệu trình", "sau 1 buổi", "kết quả sau"],
  doctor: ["bác sĩ", "ts.bs", "ths.bs", "bs.", "doctor", "dr.", "chuyên gia", "phác đồ", "y khoa"],
  offer: ["giảm", "ưu đãi", "tặng", "sale", " off", "đồng giá", "combo", "trọn gói", "khuyến mãi", "giá gốc", "miễn phí"],
  ugc: ["review", "trải nghiệm", "khách hàng", "chia sẻ", "cảm nhận", "mình", "em đã", "nhật ký"],
  education: ["bạn có biết", "vì sao", "tại sao", "cơ chế", "giải thích", "hiểu đúng", "kiến thức"],
  luxury: ["cao cấp", "đẳng cấp", "luxury", "sang trọng", "thanh xuân", "quý cô", "tinh hoa", "thượng lưu"],
  clinic: ["phòng khám", "cơ sở", "bệnh viện", "trang thiết bị", "không gian"],
  product: ["sản phẩm", "kem", "serum", "tinh chất", "liệu trình tại nhà"],
  testimonialShot: ["tin nhắn", "phản hồi", "feedback", "ảnh chụp"],
  riskTerms: ["cam kết", "100%", "khỏi hẳn", "vĩnh viễn", "tận gốc", "thần kỳ", "trẻ hơn 10 tuổi", "xóa sạch", "tuyệt đối", "duy nhất"],
};

const PRICE_RE = /(\d[\d.,]*\s?(?:k|đ|tr|triệu|vnđ|%))/i;

function adText(ad: Partial<AdLevelAnalysis> & Record<string, unknown>): string {
  return [ad.primary_text, ad.headline, ad.hook_text, (ad as any).description, ad.ad_snapshot_url, (ad as any).thumbnail_url, (ad as any).media_url]
    .map(lc).filter(Boolean).join(" \n ");
}

function pickVisualFormat(t: string, fmtHint: string): VisualFormat {
  if (has(t, KW.beforeAfter) || fmtHint === "before_after") return "before_after";
  if (has(t, KW.doctor) || fmtHint === "doctor_explainer") return "doctor_expert";
  if (has(t, KW.testimonialShot)) return "testimonial_screenshot";
  if (has(t, KW.ugc) || fmtHint === "customer_testimonial" || fmtHint === "kol_review") return "ugc_selfie";
  if (has(t, KW.offer) || PRICE_RE.test(t) || fmtHint === "offer_promotion") return "offer_banner";
  if (has(t, KW.luxury)) return "luxury_beauty";
  if (has(t, KW.clinic) || fmtHint === "facility_trust") return "clinic_room";
  if (has(t, KW.product)) return "product_packshot";
  if (has(t, KW.education) || fmtHint === "educational_post") return "educational";
  return "unknown";
}

function pickVisualAngle(fmt: VisualFormat): VisualAngle {
  switch (fmt) {
    case "before_after": return "transformation";
    case "doctor_expert": return "authority";
    case "educational": return "education";
    case "offer_banner": return "promotion";
    case "luxury_beauty": return "luxury";
    case "ugc_selfie":
    case "testimonial_screenshot": return "social_proof";
    default: return "unknown";
  }
}

function riskFrom(score: number): CreativeRisk {
  return score >= 66 ? "high" : score >= 33 ? "medium" : "low";
}

/** Phân tích visual cho 1 ad từ text + media hint (heuristic). */
export function analyzeVisualFromAd(ad: AdLevelAnalysis): VisualAnalysis {
  const t = adText(ad);
  const media = lc(ad.media_type);
  const creative_type: CreativeType =
    media.includes("video") ? "video" : media.includes("carousel") || media.includes("dco") || media.includes("dpa") ? "carousel" : media.includes("image") ? "image" : "unknown";

  const thumb = (ad as any).thumbnail_url || "";
  const mediaUrl = (ad as any).media_url || "";
  const hasAsset = !!(thumb || mediaUrl);

  const visual_format = pickVisualFormat(t, lc(ad.content_format));
  const visual_angle = pickVisualAngle(visual_format);

  const doctor_presence = has(t, KW.doctor);
  const before_after_presence = visual_format === "before_after" || has(t, KW.beforeAfter);
  const offer_visual_presence = has(t, KW.offer) || PRICE_RE.test(t);
  const ugcish = has(t, KW.ugc) || has(t, KW.testimonialShot);
  const text_overlay_presence = offer_visual_presence || before_after_presence || /[a-zà-ỹ]/i.test(lc(ad.headline));
  const human_presence = doctor_presence || ugcish || before_after_presence || ["facial_rejuvenation", "lifting_firming"].includes(lc(ad.service_or_product));

  const clinical_score = clamp((doctor_presence ? 55 : 0) + (has(t, KW.education) ? 25 : 0) + (lc(ad.proof_point).includes("doctor") ? 20 : 0) + (has(t, KW.clinic) ? 10 : 0));
  const beauty_luxury_score = clamp((has(t, KW.luxury) ? 50 : 0) + (lc(ad.proof_point).includes("kol") ? 30 : 0) + (visual_format === "luxury_beauty" ? 25 : 10));
  const ugc_score = clamp((ugcish ? 55 : 0) + (lc(ad.content_format).includes("testimonial") ? 25 : 0) + (creative_type === "video" ? 10 : 0));
  const trust_signal_score = clamp(clinical_score * 0.5 + ugc_score * 0.3 + (lc(ad.proof_point).includes("media") ? 20 : 0));
  const offer_visibility_score = clamp((offer_visual_presence ? 50 : 0) + (PRICE_RE.test(t) ? 30 : 0) + (lc(t).includes("giá gốc") ? 15 : 0));
  const scroll_stop_score = clamp((before_after_presence ? 40 : 0) + (offer_visibility_score > 60 ? 25 : 0) + (creative_type === "video" ? 20 : 10) + (has(t, KW.luxury) ? 10 : 0));

  const risk_terms_from_visual = KW.riskTerms.filter((k) => t.includes(k));
  const medical_claim_risk = riskFrom(risk_terms_from_visual.length * 30 + (doctor_presence && risk_terms_from_visual.length ? 20 : 0));
  const before_after_risk: CreativeRisk = before_after_presence ? (risk_terms_from_visual.length ? "high" : "medium") : "low";
  const promotion_claim_risk = riskFrom((lc(t).includes("giá gốc") ? 50 : 0) + (offer_visibility_score > 70 ? 30 : 0));
  const claim_risk_score = clamp(risk_terms_from_visual.length * 25 + (before_after_presence ? 20 : 0) + (promotion_claim_risk === "high" ? 20 : 0));
  const visual_risk_level = riskFrom(claim_risk_score);
  const risk_reasons: string[] = [];
  if (risk_terms_from_visual.length) risk_reasons.push(`Từ ngữ tuyệt đối: ${risk_terms_from_visual.join(", ")}`);
  if (before_after_presence) risk_reasons.push("Có visual trước/sau (nhạy cảm về compliance)");
  if (promotion_claim_risk === "high") risk_reasons.push("Neo giá gốc / giảm sâu");

  let seryn_action: SerynVisualAction = "monitor";
  if (visual_format === "offer_banner" || visual_angle === "promotion") seryn_action = "counter";
  else if (visual_format === "doctor_expert" || visual_format === "educational") seryn_action = "adapt";
  else if (before_after_presence && risk_terms_from_visual.length) seryn_action = "avoid";
  else if (visual_format === "luxury_beauty") seryn_action = "counter";
  else if (visual_format === "ugc_selfie") seryn_action = "monitor";

  const confidence_score = Math.round((hasAsset ? 0.55 : 0.35) * 100) / 100; // không có media -> hạ confidence
  const confidence_reason = hasAsset ? "Heuristic trên text + media hint." : "Heuristic trên text (chưa có media asset).";

  const summaryBits = [
    visual_format.replace(/_/g, " "),
    doctor_presence ? "có bác sĩ" : "",
    before_after_presence ? "before/after" : "",
    offer_visual_presence ? "nhấn ưu đãi" : "",
  ].filter(Boolean);
  const visual_insight_summary = `Creative ${creative_type} dạng ${summaryBits.join(", ") || "chưa rõ"}.` + (hasAsset ? "" : " (limited analysis — no media asset)");

  return {
    ad_id: String(ad.ad_id || ""),
    brand: String(ad.brand_name || ""),
    page_id: ad.page_id ? String(ad.page_id) : undefined,
    last_seen_date: ad.week_date,
    creative_type,
    media_url: mediaUrl || undefined,
    thumbnail_url: thumb || undefined,
    snapshot_url: ad.ad_snapshot_url,
    image_urls: thumb ? [String(thumb)] : [],
    video_preview_url: undefined,
    has_media_asset: hasAsset,
    text_overlay_raw: "",
    text_overlay_summary: String(ad.headline || ad.hook_text || "").slice(0, 120),
    offer_from_visual: ad.offer_detected && ad.offer_detected !== "no_clear_offer" ? String(ad.offer_detected) : "",
    claim_from_visual: risk_terms_from_visual.join("|"),
    risk_terms_from_visual,
    visual_format,
    visual_angle,
    human_presence,
    doctor_presence,
    before_after_presence,
    text_overlay_presence,
    offer_visual_presence,
    clinical_score,
    beauty_luxury_score,
    ugc_score,
    trust_signal_score,
    offer_visibility_score,
    scroll_stop_score,
    confidence_score,
    confidence_reason,
    visual_risk_level,
    risk_reasons,
    claim_risk_score,
    before_after_risk,
    medical_claim_risk,
    promotion_claim_risk,
    visual_insight_summary,
    seryn_action,
    creative_signature: imageFingerprint(thumb) || `${ad.brand_name}|${visual_format}|${visual_angle}|${ad.offer_detected || "no_offer"}`,
  };
}

/* ---------- manual review (localStorage) ---------- */
type ReviewPatch = { seryn_action?: SerynVisualAction; review_note?: string; reviewed?: boolean };
export function loadVisualReviews(): Record<string, ReviewPatch> {
  try { const raw = localStorage.getItem(REVIEW_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function saveVisualReview(adId: string, patch: ReviewPatch): Record<string, ReviewPatch> {
  const all = loadVisualReviews();
  all[adId] = { ...all[adId], ...patch, reviewed: true };
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(all)); } catch { /* noop */ }
  return all;
}
function applyReviews(items: VisualAnalysis[]): VisualAnalysis[] {
  const reviews = loadVisualReviews();
  return items.map((x) => {
    const r = reviews[x.ad_id];
    return r ? { ...x, ...(r.seryn_action ? { seryn_action: r.seryn_action } : {}), review_note: r.review_note, reviewed: r.reviewed } : x;
  });
}

/** Gán cluster_size theo creative_signature nếu Sheet chưa có. */
function attachClusterSizes(items: VisualAnalysis[]): VisualAnalysis[] {
  const sizes: Record<string, number> = {};
  for (const x of items) { const k = x.creative_signature || x.ad_id; sizes[k] = (sizes[k] || 0) + 1; }
  return items.map((x) => (x.cluster_size && x.cluster_size > 0 ? x : { ...x, cluster_size: sizes[x.creative_signature || x.ad_id] }));
}

/** Nguồn visual chính: tab Sheet nếu có, ngược lại derive từ adLevel. */
export function getVisualAnalysis(data: SpyDashboardData): { items: VisualAnalysis[]; source: "sheet" | "derived" } {
  const fromSheet = data.visualAnalysis ?? [];
  if (fromSheet.length) {
    const norm = attachClusterSizes(fromSheet.map(normalizeVisualRow));
    return { items: applyReviews(norm), source: "sheet" };
  }
  const derived = attachClusterSizes((data.adLevelAnalysis ?? []).filter((a) => a.ad_id).map(analyzeVisualFromAd));
  return { items: applyReviews(derived), source: "derived" };
}

/** Gom theo creative_signature -> 1 đại diện/cụm (ưu tiên đã review > confidence > có media). */
export function buildVisualClusters(items: VisualAnalysis[]): VisualAnalysis[] {
  const groups: Record<string, VisualAnalysis[]> = {};
  for (const x of items) (groups[x.creative_signature || x.ad_id] ||= []).push(x);
  const reps = Object.values(groups).map((list) => {
    const rep = [...list].sort((a, b) =>
      (Number(b.reviewed || 0) - Number(a.reviewed || 0)) ||
      (Number(b.confidence_score) - Number(a.confidence_score)) ||
      (Number(b.has_media_asset || 0) - Number(a.has_media_asset || 0))
    )[0];
    return { ...rep, cluster_size: list.length };
  });
  return reps.sort((a, b) => Number(b.cluster_size) - Number(a.cluster_size));
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return ["true", "1", "yes", "có"].includes(String(v ?? "").trim().toLowerCase());
}
function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  const s = String(v ?? "").trim();
  if (!s) return [];
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(String); } catch { /* */ }
  return s.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
}
/** Chuẩn hóa 1 dòng VisualAnalysis đọc từ Sheet (mọi field là string). */
export function normalizeVisualRow(r: Record<string, unknown>): VisualAnalysis {
  return {
    ad_id: String(r.ad_id ?? ""),
    brand: String(r.brand ?? ""),
    page_id: r.page_id ? String(r.page_id) : undefined,
    last_seen_date: r.last_seen_date ? String(r.last_seen_date) : undefined,
    creative_type: (String(r.creative_type ?? "unknown") as CreativeType) || "unknown",
    media_url: r.media_url ? String(r.media_url) : undefined,
    thumbnail_url: r.thumbnail_url ? String(r.thumbnail_url) : undefined,
    snapshot_url: r.snapshot_url ? String(r.snapshot_url) : undefined,
    image_urls: toArr(r.image_urls),
    video_preview_url: r.video_preview_url ? String(r.video_preview_url) : undefined,
    has_media_asset: r.has_media_asset !== undefined ? toBool(r.has_media_asset) : !!(r.thumbnail_url || r.media_url),
    text_overlay_raw: r.text_overlay_raw ? String(r.text_overlay_raw) : "",
    text_overlay_summary: r.text_overlay_summary ? String(r.text_overlay_summary) : "",
    offer_from_visual: r.offer_from_visual ? String(r.offer_from_visual) : "",
    claim_from_visual: r.claim_from_visual ? String(r.claim_from_visual) : "",
    risk_terms_from_visual: toArr(r.risk_terms_from_visual),
    visual_format: (String(r.visual_format ?? "unknown") as VisualFormat) || "unknown",
    visual_angle: (String(r.visual_angle ?? "unknown") as VisualAngle) || "unknown",
    human_presence: toBool(r.human_presence),
    doctor_presence: toBool(r.doctor_presence),
    before_after_presence: toBool(r.before_after_presence),
    text_overlay_presence: toBool(r.text_overlay_presence),
    offer_visual_presence: toBool(r.offer_visual_presence),
    clinical_score: num(r.clinical_score),
    beauty_luxury_score: num(r.beauty_luxury_score),
    ugc_score: num(r.ugc_score),
    trust_signal_score: num(r.trust_signal_score),
    offer_visibility_score: num(r.offer_visibility_score),
    scroll_stop_score: num(r.scroll_stop_score),
    confidence_score: num(r.confidence_score),
    confidence_reason: r.confidence_reason ? String(r.confidence_reason) : undefined,
    visual_risk_level: (String(r.visual_risk_level ?? "low") as CreativeRisk) || "low",
    risk_reasons: toArr(r.risk_reasons),
    claim_risk_score: num(r.claim_risk_score),
    before_after_risk: (String(r.before_after_risk ?? "low") as CreativeRisk) || "low",
    medical_claim_risk: (String(r.medical_claim_risk ?? "low") as CreativeRisk) || "low",
    promotion_claim_risk: (String(r.promotion_claim_risk ?? "low") as CreativeRisk) || "low",
    visual_insight_summary: String(r.visual_insight_summary ?? ""),
    seryn_action: (String(r.seryn_action ?? "monitor") as SerynVisualAction) || "monitor",
    creative_signature: r.creative_signature ? String(r.creative_signature) : undefined,
    cluster_size: r.cluster_size !== undefined && r.cluster_size !== "" ? num(r.cluster_size) : undefined,
  };
}

/* ---------- aggregate: brand summary + patterns ---------- */
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : 0);
const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0);
function topN(values: string[], n = 3): string {
  const c: Record<string, number> = {};
  for (const v of values) if (v && v !== "unknown") c[v] = (c[v] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k).join("|");
}

export function buildBrandVisualSummaries(items: VisualAnalysis[]): BrandVisualSummary[] {
  const byBrand: Record<string, VisualAnalysis[]> = {};
  for (const it of items) (byBrand[it.brand] ||= []).push(it);
  return Object.entries(byBrand).map(([brand, list]) => {
    const total = list.length;
    return {
      brand,
      week_date: list[0]?.last_seen_date,
      total_creatives: total,
      before_after_rate: rate(list.filter((x) => x.before_after_presence).length, total),
      doctor_rate: rate(list.filter((x) => x.doctor_presence).length, total),
      ugc_rate: rate(list.filter((x) => x.visual_format === "ugc_selfie" || x.ugc_score >= 50).length, total),
      offer_banner_rate: rate(list.filter((x) => x.visual_format === "offer_banner" || x.offer_visual_presence).length, total),
      high_risk_rate: rate(list.filter((x) => x.visual_risk_level === "high").length, total),
      avg_clinical_score: avg(list.map((x) => x.clinical_score)),
      avg_luxury_score: avg(list.map((x) => x.beauty_luxury_score)),
      top_visual_formats: topN(list.map((x) => String(x.visual_format))),
      dominant_visual_angle: topN(list.map((x) => String(x.visual_angle)), 1),
    };
  }).sort((a, b) => Number(b.total_creatives) - Number(a.total_creatives));
}

export function buildVisualPatterns(items: VisualAnalysis[]): VisualPattern[] {
  const groups: Record<string, VisualAnalysis[]> = {};
  for (const it of items) {
    const key = [it.brand, it.visual_format, it.visual_angle, it.offer_from_visual || "no_offer"].join("|");
    (groups[key] ||= []).push(it);
  }
  const out: VisualPattern[] = [];
  let idx = 0;
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 2 && list[0]?.visual_format === "unknown") continue;
    const rep = list[0];
    const action = rep.seryn_action;
    out.push({
      id: `vp-${++idx}`,
      week_date: rep.last_seen_date,
      brand: rep.brand,
      visual_format: rep.visual_format,
      visual_angle: rep.visual_angle,
      offer_type: rep.offer_from_visual || "",
      ad_count: list.length,
      is_signal: list.length >= 3,
      representative_ad_id: rep.ad_id,
      summary: `${list.length} creative cùng ${String(rep.visual_format).replace(/_/g, " ")} / ${rep.visual_angle}${rep.offer_from_visual ? ` · ${rep.offer_from_visual}` : ""}.`,
      recommended_seryn_response: action,
    });
    void key;
  }
  return out.sort((a, b) => Number(b.ad_count) - Number(a.ad_count));
}
