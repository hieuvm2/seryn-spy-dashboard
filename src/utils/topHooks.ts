/* ============================================================
   Top Hooks — gom hook đáng chú ý từ ad-level + scaled content,
   suy luận hành động SERYN và viết lại theo giọng SERYN.
   ============================================================ */
import type { SpyDashboardData, TopHookItem } from "../types";
import { normalizeNumber, isMissing, viLabel } from "./spyData";

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

/** Tên dịch vụ tiếng Việt, gọn để ghép câu (không slash, không "chưa rõ"). */
function serviceNoun(svc?: string): string {
  const vi = viLabel(svc);
  if (!vi || vi === "chưa rõ") return "chăm sóc da";
  return vi.toLowerCase().replace(/\s*\/\s*/g, " ");
}
/** Hash ổn định để chọn biến thể câu theo từng hook (cùng hook -> cùng câu). */
function pick(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/**
 * Viết lại hook theo giọng SERYN — tiếng Việt thuần, sẵn sàng làm content,
 * nhiều biến thể để không bị trùng lặp giữa các hook (an toàn brand).
 */
export function generateSerynRewrite(hook: TopHookItem): string {
  const text = lc(hook.hook_text);
  const ht = lc(hook.hook_type);
  const svc = serviceNoun(hook.service_or_product);
  const seed = `${hook.brand_name || ""}|${hook.hook_text || ""}`;

  // Offer / giá sốc -> không đua giá, bắt đầu từ hiểu nguyên nhân
  if (looksOffer(text, ht)) {
    return pick([
      `Đừng để một con số khuyến mãi quyết định lựa chọn ${svc} của bạn — hãy bắt đầu từ việc hiểu đúng nguyên nhân và chỉ định phù hợp.`,
      `Giá rẻ không trả lời được câu hỏi quan trọng nhất: làn da bạn thực sự cần gì? Hãy bắt đầu bằng một buổi đánh giá ${svc}.`,
      `Ưu đãi rồi sẽ hết, nhưng làn da thì ở lại lâu dài — SERYN bắt đầu từ phân tích cá nhân hóa thay vì cuộc đua giá.`,
      `Thay vì chọn ${svc} theo khuyến mãi, hãy chọn theo điều thực sự phù hợp với cơ địa của bạn.`,
    ], seed);
  }
  // Fear-based -> counter tôn trọng
  if (ht.includes("fear") || has(text, FEAR_WORDS)) {
    return pick([
      `Một làn da đẹp hơn không cần bắt đầu bằng việc chê chính mình — mà bằng hiểu cơ thể đang thay đổi thế nào.`,
      `Lão hóa là điều tự nhiên, không phải điều đáng sợ — SERYN giúp bạn hiểu và đồng hành cùng nó một cách khoa học.`,
      `Bạn không cần lo lắng về gương mặt mình — chỉ cần hiểu đúng làn da đang ở giai đoạn nào để chăm sóc phù hợp.`,
    ], seed);
  }
  // Transformation phóng đại -> counter bền vững
  if (ht.includes("transformation") || has(text, TRANSFORM_WORDS) || has(text, FORBIDDEN)) {
    return pick([
      `Trẻ hóa bền vững bắt đầu từ việc hiểu cơ thể đang thay đổi thế nào, không phải từ một kết quả tức thời.`,
      `Thay đổi đẹp nhất là thay đổi tự nhiên và giữ được lâu — SERYN ưu tiên kết quả bền vững hơn hiệu ứng nhanh.`,
      `Không phải đổi khác chỉ sau một buổi, mà là một lộ trình ${svc} phù hợp để đẹp dài lâu.`,
    ], seed);
  }
  // Doctor / education -> adapt, bác sĩ giải thích nền tảng sinh học
  if (ht.includes("doctor") || ht.includes("education") || ht.includes("insight") || has(text, DOCTOR_WORDS)) {
    return pick([
      `Bác sĩ SERYN giải thích vì sao ${svc} nên được đánh giá từ nền tảng sinh học trước khi chọn liệu trình.`,
      `Cùng một phương pháp, kết quả mỗi người mỗi khác — vì ${svc} phụ thuộc vào cơ địa riêng của bạn.`,
      `Hiểu đúng trước khi điều trị: ${svc} hiệu quả nhất khi được cá nhân hóa theo chính làn da bạn.`,
    ], seed);
  }
  // Mặc định
  return pick([
    `Có những thay đổi của làn da không bắt đầu từ bề mặt — SERYN bắt đầu từ phân tích cá nhân hóa và nền tảng sinh học.`,
    `Làn da khỏe đẹp bắt đầu từ việc hiểu chính mình — SERYN đồng hành bằng đánh giá khoa học, điềm tĩnh.`,
    `Mỗi làn da là một câu chuyện riêng — SERYN lắng nghe bằng phân tích cá nhân hóa trước khi đề xuất lộ trình.`,
  ], seed);
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
