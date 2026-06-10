/* ============================================================
   Creative Briefs — biến swipe item / recommendation thành brief
   content an toàn với định vị SERYN; lưu localStorage.
   ============================================================ */
import type { CreativeBrief, SwipeFileItem, SerynContentRecommendation } from "../types";
import { splitChips, isMissing } from "./spyData";
import { genId } from "./swipeFile";

const CREATIVE_BRIEFS_KEY = "seryn_creative_briefs_v1";

/* ---- hằng số định vị SERYN ---- */
const TARGET_AUDIENCE =
  "Nữ 35–55, TP.HCM/đô thị lớn, thu nhập khá–cao; hoài nghi lời hứa thẩm mỹ hời hợt; muốn tươi trẻ tự nhiên không lộ can thiệp; quan tâm an toàn & y khoa.";

const DEFAULT_CTA = "Đặt lịch phân tích gương mặt";
const PREFERRED_CTAS = [
  "Đặt lịch phân tích gương mặt",
  "Đặt lịch đánh giá nền tảng sinh học",
  "Tìm hiểu thêm",
  "Trao đổi với đội ngũ chuyên môn",
];

const SERYN_DOS = [
  "Bác sĩ giải thích cơ chế lão hóa từ nền tảng sinh học",
  "Phân tích cá nhân hóa trước khi chỉ định liệu trình",
  "Tự nhiên, không làm quá; bền vững, không fix tạm thời",
  "Proof bằng dữ liệu, bác sĩ, đa chuyên khoa",
  "Giọng khoa học nhưng gần gũi, tôn trọng khách hàng",
];

const SERYN_DONTS = [
  'Không dùng "trẻ hóa thần kỳ"',
  'Không dùng "xóa sạch nếp nhăn"',
  'Không dùng "lấy lại thanh xuân"',
  'Không dùng "trẻ hơn 10 tuổi"',
  'Không dùng "inbox ngay"',
  "Không dùng FOMO rẻ tiền / hù dọa khách hàng (fear-based aging)",
  "Không hứa hẹn kết quả tuyệt đối, không đua giảm giá",
];

const DEFAULT_VISUAL =
  "Editorial y khoa cao cấp: nữ 38–52, da khỏe tự nhiên; nền Albescent ấm (#FFECDF), accent Peach (#F47D6B), điểm Navy (#15224B); ánh sáng dịu; không text trên mặt; quiet luxury + clinical precision.";

const DEFAULT_PROOF = ["bác sĩ chuyên môn", "giải thích khoa học", "phân tích cá nhân hóa"];

function vi(s?: string) { return String(s || "").replace(/_/g, " ").trim(); }
function clean(arr: (string | undefined)[]): string[] {
  return Array.from(new Set(arr.map((x) => String(x || "").trim()).filter((x) => x && !isMissing(x))));
}

/* ---- localStorage CRUD ---- */
export function loadCreativeBriefs(): CreativeBrief[] {
  try {
    const raw = localStorage.getItem(CREATIVE_BRIEFS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export function saveCreativeBriefs(items: CreativeBrief[]): void {
  try { localStorage.setItem(CREATIVE_BRIEFS_KEY, JSON.stringify(items)); }
  catch (e) { console.warn("Không lưu được Creative Briefs:", e); }
}
export function addCreativeBrief(brief: CreativeBrief): CreativeBrief[] {
  const items = loadCreativeBriefs();
  items.unshift(brief);
  saveCreativeBriefs(items);
  return items;
}
export function deleteCreativeBrief(id: string): CreativeBrief[] {
  const items = loadCreativeBriefs().filter((x) => x.id !== id);
  saveCreativeBriefs(items);
  return items;
}
export function clearCreativeBriefs(): void {
  try { localStorage.removeItem(CREATIVE_BRIEFS_KEY); } catch { /* noop */ }
}

/* ---- markdown ---- */
export function briefToMarkdown(b: CreativeBrief): string {
  const bullet = (arr: string[]) => (arr.length ? arr.map((x) => `- ${x}`).join("\n") : "- (chưa có)");
  return [
    "# SERYN Creative Brief",
    "",
    `**${b.title}**${b.brand_name ? `  ·  nguồn: ${b.brand_name}` : ""}  ·  ${b.createdAt}`,
    "",
    "## Objective", b.objective || "(chưa có)", "",
    "## Market Signal", b.market_signal || "(chưa có)", "",
    "## Competitor Evidence", b.competitor_evidence || "(chưa có)", "",
    "## SERYN Angle", b.seryn_angle || "(chưa có)", "",
    "## Target Audience", b.target_audience || "(chưa có)", "",
    "## Core Message", b.core_message || "(chưa có)", "",
    "## Hook Options", bullet(b.hook_options), "",
    "## Content Format", b.content_format || "(chưa có)", "",
    "## Script Outline", bullet(b.script_outline), "",
    "## Visual Direction", b.visual_direction || "(chưa có)", "",
    "## Proof Points", bullet(b.proof_points), "",
    "## CTA", b.cta || "(chưa có)", "",
    "## KPI", b.kpi || "(chưa có)", "",
    "## Do", bullet(b.dos), "",
    "## Don't", bullet(b.donts), "",
  ].join("\n");
}

function objectiveFor(action: string): string {
  switch (String(action || "").toLowerCase()) {
    case "copy": return "Học & nhân bản pattern hiệu quả theo cách an toàn với định vị SERYN.";
    case "adapt": return "Điều chỉnh pattern đối thủ sang định vị nền tảng sinh học của SERYN.";
    case "counter": return "Phản đòn pattern đối thủ bằng định vị nền tảng sinh học & phân tích cá nhân hóa.";
    case "avoid": return "Tránh pattern này; làm nội dung ngược lại theo nguyên tắc SERYN.";
    default: return "Theo dõi pattern & thử nghiệm nhỏ theo định vị SERYN.";
  }
}

/* ---- generators ---- */
export function generateBriefFromSwipeItem(item: SwipeFileItem): CreativeBrief {
  const svc = vi(item.service_or_product) || "vấn đề da";
  const angle = item.seryn_reframe && !isMissing(item.seryn_reframe)
    ? item.seryn_reframe
    : `SERYN tiếp cận ${svc} từ nền tảng sinh học & phân tích cá nhân hóa, không đua giá/không phóng đại.`;
  const hookOptions = clean([
    item.seryn_reframe,
    `Có những thay đổi của ${svc} không bắt đầu từ bề mặt.`,
    `${svc.charAt(0).toUpperCase() + svc.slice(1)} bền vững bắt đầu từ việc hiểu cơ thể bạn đang thay đổi như thế nào.`,
  ]);
  const evidenceBits = [
    `${item.brand_name}: "${item.hook}"`,
    vi(item.content_format),
    svc,
    item.scale_level ? `scale C${item.scale_level}` : "",
    vi(item.offer_detected),
  ].filter(Boolean);

  const brief: CreativeBrief = {
    id: genId("br"),
    createdAt: new Date().toISOString(),
    sourceType: "swipe_file",
    title: `${item.brand_name} — ${String(item.hook).slice(0, 60)}`,
    brand_name: item.brand_name,
    objective: objectiveFor(item.action),
    market_signal: (item.reason_to_save && !isMissing(item.reason_to_save))
      ? String(item.reason_to_save)
      : `Đối thủ ${item.brand_name} đang dùng hook: "${item.hook}".`,
    competitor_evidence: evidenceBits.join(" · "),
    seryn_angle: angle,
    target_audience: TARGET_AUDIENCE,
    core_message: angle,
    hook_options: hookOptions,
    content_format: vi(item.content_format) || "doctor_explainer (video bác sĩ 60–90s)",
    script_outline: [
      "Mở: nêu một sự thật ngầm về lão hóa/da (không hù dọa).",
      `Thân: bác sĩ giải thích cơ chế & vì sao cần đánh giá ${svc} từ nền tảng sinh học.`,
      "Bằng chứng: phân tích cá nhân hóa + ca thật, đo lường được.",
      "Kết: mời đánh giá/lộ trình phù hợp với cơ thể.",
    ],
    visual_direction: DEFAULT_VISUAL,
    proof_points: clean([...splitChips(item.proof_point).map(vi), ...DEFAULT_PROOF]),
    cta: DEFAULT_CTA,
    kpi: "thumb-stop rate; message-to-booking; lead quality",
    dos: SERYN_DOS,
    donts: SERYN_DONTS,
    markdown: "",
  };
  brief.markdown = briefToMarkdown(brief);
  return brief;
}

export function generateBriefFromRecommendation(rec: SerynContentRecommendation): CreativeBrief {
  const niche = vi(rec.seryn_content_niche);
  const hookOptions = clean([rec.suggested_hook, rec.main_message]);
  const brief: CreativeBrief = {
    id: genId("br"),
    createdAt: new Date().toISOString(),
    sourceType: "recommendation",
    title: `${vi(rec.recommendation_type) || "Gợi ý"} — ${niche || "SERYN"}`,
    brand_name: "SERYN",
    objective: `Triển khai gợi ý "${vi(rec.recommendation_type)}" cho SERYN.`,
    market_signal: String(rec.market_signal || ""),
    competitor_evidence: String(rec.competitor_evidence || ""),
    seryn_angle: niche || String(rec.main_message || ""),
    target_audience: TARGET_AUDIENCE,
    core_message: String(rec.main_message || ""),
    hook_options: hookOptions.length ? hookOptions : ["(chưa có hook)"],
    content_format: vi(rec.suggested_content_format) || "doctor_explainer",
    script_outline: [
      "Mở: hook theo gợi ý.",
      `Thân: ${rec.main_message || "thông điệp chính của SERYN"}.`,
      "Bằng chứng: " + (splitChips(rec.proof_to_use).map(vi).join(", ") || "bác sĩ + dữ liệu cá nhân hóa") + ".",
      "Kết: CTA premium.",
    ],
    visual_direction: DEFAULT_VISUAL,
    proof_points: clean([...splitChips(rec.proof_to_use).map(vi), ...DEFAULT_PROOF]),
    cta: (rec.cta && !isMissing(rec.cta)) ? String(rec.cta) : DEFAULT_CTA,
    kpi: (rec.kpi && !isMissing(rec.kpi)) ? String(rec.kpi) : "message-to-booking; CTR",
    dos: SERYN_DOS,
    donts: SERYN_DONTS,
    markdown: "",
  };
  brief.markdown = briefToMarkdown(brief);
  return brief;
}

export { CREATIVE_BRIEFS_KEY, PREFERRED_CTAS };
