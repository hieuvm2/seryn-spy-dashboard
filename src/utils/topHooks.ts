/* ============================================================
   Top Hooks — gom hook đáng chú ý từ ad-level + scaled content,
   suy luận hành động SERYN và viết lại theo giọng SERYN.
   ============================================================ */
import type { SpyDashboardData, TopHookItem } from "../types";
import { normalizeNumber, isMissing } from "./spyData";

/* ---- từ khóa phân loại hook ---- */
const FORBIDDEN = [
  "trẻ hóa thần kỳ", "xóa sạch", "lấy lại thanh xuân", "trẻ hơn 10 tuổi",
  "trẻ ra 10 tuổi", "trẻ 10 tuổi", "trẻ 0 tuổi", "inbox ngay", "đừng bỏ lỡ",
  "100%", "tuyệt đối", "khỏi hẳn", "hết hẳn", "vĩnh viễn",
];
const OFFER_WORDS = ["giảm", "trợ giá", "đồng giá", "chỉ từ", "giá sốc", "miễn phí", "ưu đãi", "off", "sale", "khuyến mãi", "tặng"];
const FEAR_WORDS = ["xấu", "xệ", "chảy xệ", "già nua", "tàn phá", "lão hóa đang", "sợ", "nhăn nheo"];
const DOCTOR_WORDS = ["bác sĩ", "phân tích", "cơ chế", "giải thích", "cấu trúc", "nền tảng", "chuyên gia", "y khoa", "khoa học"];
const TRANSFORM_WORDS = ["lột xác", "ngoạn mục", "sau 1 buổi", "sau một buổi", "thay đổi diện mạo", "khác biệt rõ rệt"];

function lc(s?: string) { return String(s || "").toLowerCase(); }
function has(text: string, words: string[]) { return words.some((w) => text.includes(w)); }
/** hook có vẻ "giá/offer" (có số + K, hoặc % , hoặc từ khóa offer). */
function looksOffer(text: string, hookType: string) {
  if (hookType.includes("offer")) return true;
  if (/\d+\s*k\b/i.test(text) || /\d+%/.test(text) || /\d+\s*(triệu|tr)\b/i.test(text)) return true;
  return has(text, OFFER_WORDS);
}

/** Suy luận hành động SERYN cho 1 hook. */
export function inferSerynAction(hook: TopHookItem): string {
  const text = lc(hook.hook_text);
  const ht = lc(hook.hook_type);
  if (!text || text.length < 4) return "monitor";
  if (has(text, FORBIDDEN)) return "avoid";
  if (ht.includes("fear") || has(text, FEAR_WORDS)) return "counter";
  if (ht.includes("transformation") || has(text, TRANSFORM_WORDS)) return "counter";
  if (looksOffer(text, ht)) return "counter";
  if (ht.includes("doctor") || ht.includes("education") || ht.includes("insight") || has(text, DOCTOR_WORDS)) return "adapt";
  // trung tính, hợp SERYN (nhắc tới tự nhiên / cá nhân hóa / da) -> copy hạn chế
  if (has(text, ["tự nhiên", "cá nhân hóa", "phù hợp", "lộ trình", "đánh giá"])) return "copy";
  return "monitor";
}

/** Viết lại hook theo giọng SERYN (an toàn brand). */
export function generateSerynRewrite(hook: TopHookItem): string {
  const text = lc(hook.hook_text);
  const ht = lc(hook.hook_type);
  const svc = String(hook.service_or_product || "").trim();
  const svcVi = svc ? svc.replace(/_/g, " ") : "vấn đề da";

  // Offer / giá sốc -> reframe sang hiểu nguyên nhân, không đua giá
  if (looksOffer(text, ht)) {
    return `Đừng bắt đầu điều trị ${svcVi} bằng giá — hãy bắt đầu bằng việc hiểu đúng nguyên nhân và chỉ định phù hợp với bạn.`;
  }
  // Fear-based -> counter tôn trọng
  if (ht.includes("fear") || has(text, FEAR_WORDS)) {
    return `Một làn da đẹp hơn không cần bắt đầu bằng việc chê chính mình — bắt đầu bằng hiểu cơ thể đang thay đổi như thế nào.`;
  }
  // Transformation quá mạnh / phóng đại -> counter bền vững
  if (ht.includes("transformation") || has(text, TRANSFORM_WORDS) || has(text, FORBIDDEN)) {
    return `Trẻ hóa bền vững bắt đầu từ việc hiểu cơ thể đang thay đổi như thế nào, không phải từ một thay đổi tức thời.`;
  }
  // Doctor / education -> adapt theo bác sĩ giải thích nền tảng sinh học
  if (ht.includes("doctor") || ht.includes("education") || ht.includes("insight") || has(text, DOCTOR_WORDS)) {
    return `Bác sĩ giải thích vì sao ${svcVi} cần được đánh giá từ nền tảng sinh học trước khi chọn liệu trình — cá nhân hóa, không làm quá.`;
  }
  // Mặc định
  return `Có những thay đổi của làn da không bắt đầu từ bề mặt — SERYN bắt đầu từ phân tích cá nhân hóa và nền tảng sinh học.`;
}

/** Gom & xếp hạng Top Hooks từ adLevelAnalysis (ưu tiên) + scaledContentAnalysis. */
export function buildTopHooks(data: SpyDashboardData): TopHookItem[] {
  const items: TopHookItem[] = [];

  // 1) ad-level
  (data.adLevelAnalysis || []).forEach((a, i) => {
    let hook = String(a.hook_text || "").trim();
    if (!hook) hook = String(a.headline || "").trim();
    if (!hook) hook = String(a.primary_text || "").split("\n")[0].trim();
    if (!hook || isMissing(hook)) return;
    items.push({
      id: `ad-${a.ad_id || i}`,
      source: "ad_level",
      brand_name: a.brand_name,
      ad_id: a.ad_id,
      ad_snapshot_url: a.ad_snapshot_url,
      hook_text: hook,
      hook_type: a.hook_type,
      service_or_product: a.service_or_product,
      content_format: a.content_format,
      content_angle: a.content_angle,
      offer_detected: a.offer_detected,
      proof_point: a.proof_point,
      days_active: a.days_active,
      scale_level: a.scale_level,
      scale_reason: a.scale_reason,
    });
  });

  // 2) scaled content (representative_hook)
  (data.scaledContentAnalysis || []).forEach((s, i) => {
    const hook = String(s.representative_hook || "").trim();
    if (!hook || isMissing(hook)) return;
    items.push({
      id: `sc-${s.content_cluster_id || i}`,
      source: "scaled_content",
      brand_name: s.brand_name,
      ad_id: s.representative_ad_id,
      hook_text: hook,
      service_or_product: s.service_or_product,
      content_format: s.content_format,
      content_angle: s.content_angle,
      offer_detected: s.offer_detected,
      proof_point: s.proof_point,
      longest_days_active: s.longest_days_active,
      scale_level: s.scale_level,
      scale_reason: s.why_it_is_scaling,
    });
  });

  // 3) dedupe theo brand + hook (giữ bản scale cao hơn)
  const byKey = new Map<string, TopHookItem>();
  for (const it of items) {
    const key = `${lc(it.brand_name)}|${lc(it.hook_text)}`;
    const prev = byKey.get(key);
    if (!prev || normalizeNumber(it.scale_level) > normalizeNumber(prev.scale_level)) {
      byKey.set(key, it);
    }
  }
  const deduped = Array.from(byKey.values());

  // 4) suy luận action + rewrite
  for (const it of deduped) {
    it.seryn_action = inferSerynAction(it);
    it.seryn_rewrite = generateSerynRewrite(it);
  }

  // 5) sort: scale_level desc -> days_active/longest desc -> brand
  deduped.sort((a, b) => {
    const sl = normalizeNumber(b.scale_level) - normalizeNumber(a.scale_level);
    if (sl) return sl;
    const da =
      Math.max(normalizeNumber(b.days_active), normalizeNumber(b.longest_days_active)) -
      Math.max(normalizeNumber(a.days_active), normalizeNumber(a.longest_days_active));
    if (da) return da;
    return String(a.brand_name).localeCompare(String(b.brand_name));
  });

  return deduped;
}

/** Hook có "an toàn SERYN" không (không vi phạm brand rules). */
export function isSerynSafeHook(hook: TopHookItem): boolean {
  const text = lc(hook.hook_text);
  return !has(text, FORBIDDEN) && !has(text, FEAR_WORDS) && !looksOffer(text, lc(hook.hook_type));
}

export { FORBIDDEN as SERYN_FORBIDDEN_PHRASES };
