/* ============================================================
   SERYN — phân tích per-item (frontend derive)
   ------------------------------------------------------------
   Thay các câu template chung bằng phân tích RIÊNG theo dữ liệu thật
   của từng dòng (số biến thể, ngày chạy, offer, format, hook, brand…).
   Dùng cho: Nội dung nhân rộng, Swipe File (Báo cáo tuần), Gợi ý SERYN.
   Tông SERYN: khoa học, điềm tĩnh, cao cấp, không FOMO, không claim tuyệt đối.
   ============================================================ */
import type { ScaledContentAnalysis, SwipeSuggestion } from "../types";
import { viLabel, isMeaningful } from "./spyData";

const num = (v: unknown): number => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const lc = (s?: string): string => String(s || "").toLowerCase();
const lbl = (v?: string): string => (isMeaningful(v) ? viLabel(String(v)) : "");
function hashSeed(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const pick = <T>(list: T[], seed: string): T => list[hashSeed(seed) % list.length];

/* ---------- Nội dung nhân rộng (Scaled Content) ---------- */
export type ScaledInsight = { why: string; reframe: string };

function persistenceWord(longest: number): string {
  if (longest >= 60) return "evergreen (rất bền)";
  if (longest >= 30) return "bền vững";
  if (longest >= 14) return "đang lên";
  return "mới nổi";
}

/** Phân tích riêng cho 1 cụm nội dung nhân rộng. */
export function analyzeScaledRow(r: ScaledContentAnalysis): ScaledInsight {
  const brand = String(r.brand_name || "Đối thủ");
  const n = num(r.number_of_similar_ads) || 1;
  const longest = num(r.longest_days_active);
  const avg = num(r.average_days_active);
  const svc = lbl(r.service_or_product);
  const fmt = lbl(r.content_format);
  const angle = lc(r.content_angle);
  const offer = isMeaningful(r.offer_detected) ? String(r.offer_detected) : "";
  const action = lc(r.seryn_should_copy_adapt_counter_avoid) || "monitor";
  const persist = persistenceWord(longest);

  // ---- why (phân tích dữ liệu thật, không template chung) ----
  const bits: string[] = [];
  bits.push(`${n} biến thể cùng concept`);
  if (fmt) bits.push(`đều dùng ${fmt}`);
  if (longest) bits.push(`chạy bền tới ${longest} ngày${avg ? ` (TB ${avg})` : ""}`);
  if (offer) bits.push(`gắn ưu đãi "${offer}"`);
  const why = `${brand} duy trì ${bits.join(", ")} quanh ${svc || "dịch vụ này"} — tín hiệu ${persist}. ` +
    (n >= 3
      ? "Lặp nhiều biến thể cho thấy đối thủ đang đặt cược vào concept này."
      : "Một concept giữ lâu cho thấy nó vẫn còn hiệu quả với họ.") +
    " (Đây là tín hiệu nhân rộng từ dữ liệu public, chưa xác nhận hiệu suất thật.)";

  // ---- reframe theo hành động + dữ liệu cụ thể ----
  const seed = `${brand}|${r.representative_hook}|${svc}`;
  let reframe: string;
  if (action === "counter") {
    reframe = offer
      ? `SERYN không đua "${offer}". Với ${svc || "nhóm dịch vụ này"}, hãy chuyển trục từ giá sang chẩn đoán đúng: soi da & đánh giá nền tảng sinh học trước khi chỉ định.`
      : pick([
          `${brand} đẩy mạnh ${angle || "concept này"}; SERYN phản định vị bằng chiều sâu y khoa và cá nhân hóa thay vì chạy theo hiệu ứng.`,
          `Thay vì lặp lại concept của ${brand}, SERYN khác biệt bằng đánh giá nền tảng da trước khi đề xuất lộ trình.`,
        ], seed);
  } else if (action === "avoid") {
    reframe = `Concept này (${angle || "tông mạnh"}) dễ vướng claim quá đà — SERYN tránh, chỉ truyền thông điềm tĩnh: "hỗ trợ cải thiện, kết quả tùy cơ địa".`;
  } else if (action === "adapt") {
    reframe = `Học cấu trúc ${fmt || "nội dung"} mà ${brand} đang nhân rộng cho ${svc || "dịch vụ này"}, nhưng nâng lên tầng nền tảng sinh học + đa chuyên khoa của SERYN (giữ chiều sâu, bỏ phóng đại).`;
  } else if (action === "copy") {
    reframe = `Cấu trúc ${fmt || "này"} đang chạy bền ${longest || "?"} ngày — SERYN có thể học cách dựng tương tự cho ${svc || "dịch vụ này"}, viết lại theo tông cao cấp, cá nhân hóa.`;
  } else {
    reframe = `Theo dõi concept ${svc || ""} của ${brand} (${persist}); nếu tiếp tục bền, cân nhắc test bản SERYN tập trung soi da & cá nhân hóa.`;
  }
  return { why, reframe };
}

/* ---------- Swipe File suggestions (Báo cáo tuần) ---------- */
export type SwipeInsight = { whySave: string; howToAdapt: string };

/** Nhận diện chủ đề/pain từ hook+offer; đánh dấu off-topic (ngoài trẻ hóa da). */
const SKIN_PAIN: Array<[string, RegExp]> = [
  ["nám/thâm sạm", /nám|tàn nhang|sạm|thâm|đốm nâu/],
  ["da chảy xệ", /chảy xệ|chùng|nhão|lão hóa|nếp nhăn|sụp mí/],
  ["mụn/sẹo", /mụn|sẹo|rỗ/],
  ["lỗ chân lông", /lỗ chân lông/],
  ["da xỉn màu", /xỉn|kém sắc|tối màu/],
  ["trẻ hóa/căng bóng da", /trẻ hóa|căng bóng|tái tạo|hifu|thermage|ultherapy|laser trẻ|exosome|collagen|skin booster|nâng cơ/],
];
const OFF_TOPIC: Array<[string, RegExp]> = [
  ["triệt lông", /triệt lông|wax/],
  ["nâng ngực/vòng 1", /ngực|vòng 1|nâng vòng/],
  ["răng/nha khoa", /\brăng\b|niềng|veneer|nha khoa/],
  ["giảm béo", /giảm béo|giảm mỡ|hút mỡ|coolsculpt/],
  ["phẫu thuật", /nâng mũi|cắt mí|độn cằm|phẫu thuật|gọt|v-?line/],
  ["phun xăm", /phun mày|phun môi|xăm|điêu khắc/],
];
function detectTopic(text: string): { pain: string; onTopic: boolean; offLabel: string } {
  for (const [label, re] of OFF_TOPIC) if (re.test(text)) {
    // off-topic trừ khi cũng có tín hiệu da rõ
    if (!/trẻ hóa|căng bóng|nám|lão hóa|nếp nhăn|da mặt/.test(text)) return { pain: "", onTopic: false, offLabel: label };
  }
  for (const [pain, re] of SKIN_PAIN) if (re.test(text)) return { pain, onTopic: true, offLabel: "" };
  return { pain: "dấu hiệu lão hóa da", onTopic: true, offLabel: "" };
}

export function analyzeSwipe(s: SwipeSuggestion): SwipeInsight {
  const brand = String(s.brand_name || "đối thủ");
  const hook = String(s.hook || "").trim();
  const snippet = hook ? `"${hook.slice(0, 46)}${hook.length > 46 ? "…" : ""}"` : "creative";
  const offer = isMeaningful(s.offer) ? String(s.offer) : "";
  const fmt = lbl(s.format);
  const seed = `${brand}|${hook}|${offer}`;
  const blob = lc(`${hook} ${offer} ${s.angle}`);
  const { pain, onTopic, offLabel } = detectTopic(blob);
  const isOffer = !!offer || /giảm|ưu đãi|khuyến mãi|miễn phí|trợ giá|đồng giá|sale|\boff\b|combo|tặng|\d\s*k\b|\d\s*%/.test(blob);
  const isDoctor = /bác sĩ|chuyên gia|y khoa|phác đồ|ts\.?\s*bs/.test(lc(hook));
  const isTransform = /trước sau|lột xác|thay đổi|sau \d|trẻ.* tuổi/.test(lc(hook));

  // ---- WHY SAVE (dùng dữ liệu thật + lý do riêng) ----
  let whySave: string;
  if (!onTopic) {
    whySave = `${brand} đẩy mảng ${offLabel} (${snippet}) — NGOÀI trục trẻ hóa da của SERYN. Chỉ lưu để tham chiếu cách đóng gói/CTA, không áp dụng trực tiếp.`;
  } else if (isOffer) {
    whySave = `${brand} neo ${offer ? `ưu đãi "${offer}"` : "ưu đãi"} cho ${pain} (${snippet}) để kéo tương tác nhanh — lưu để hiểu cách họ đóng gói offer, KHÔNG sao chép kiểu giảm giá.`;
  } else if (isDoctor) {
    whySave = `${brand} khai thác uy tín bác sĩ cho ${pain} trong ${fmt || "creative"} (${snippet}) — gần với trục "nền tảng sinh học" của SERYN, đáng học cấu trúc.`;
  } else if (isTransform) {
    whySave = `${brand} nhấn kết quả ${pain} (${snippet}) — lưu để học cách kể chuyện, nhưng phải bỏ phóng đại khi SERYN dùng lại.`;
  } else {
    whySave = `Hook ${snippet} của ${brand} bắt đúng nỗi lo ${pain} — lưu làm tham chiếu góc tiếp cận.`;
  }

  // ---- HOW TO ADAPT (riêng theo topic/pain, xoay biến thể) ----
  let howToAdapt: string;
  if (!onTopic) {
    howToAdapt = `Không dùng trực tiếp; nếu cần chỉ học cách trình bày rồi chuyển hẳn về trục trẻ hóa da (soi da, nền tảng sinh học).`;
  } else if (isOffer) {
    howToAdapt = pick([
      `Bỏ con số ${offer ? `"${offer}"` : "khuyến mãi"}; đổi điểm vào thành soi da & đánh giá nền tảng sinh học cho ${pain}, nhấn chỉ định đúng thay vì giá rẻ.`,
      `Giữ sức hút của ưu đãi nhưng chuyển thành "gói đánh giá ${pain} cá nhân hóa" — giá trị thay vì giá rẻ.`,
      `Đổi mồi giá sang mồi giá trị: 1 buổi soi da hiểu ${pain}, rồi mới tư vấn lộ trình.`,
    ], seed);
  } else if (isDoctor) {
    howToAdapt = `Giữ vai bác sĩ, nâng lên giải thích cơ chế ${pain} & cá nhân hóa lộ trình; CTA: đặt lịch soi da.`;
  } else if (isTransform) {
    howToAdapt = `Đổi "thay đổi tức thì" thành kết quả tự nhiên, bền vững với ${pain} (kết quả tùy cơ địa); thêm bước đánh giá trước điều trị.`;
  } else {
    howToAdapt = pick([
      `Giữ góc tiếp cận ${pain}, đổi giọng sang khoa học & cá nhân hóa; CTA nhẹ "đặt lịch soi da".`,
      `Mở bằng việc hiểu đúng ${pain} rồi mới tới giải pháp; tông điềm tĩnh, cao cấp.`,
    ], seed);
  }
  return { whySave, howToAdapt };
}
