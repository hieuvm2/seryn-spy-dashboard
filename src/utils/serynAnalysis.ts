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

export function analyzeSwipe(s: SwipeSuggestion): SwipeInsight {
  const brand = String(s.brand_name || "đối thủ");
  const hook = String(s.hook || "").trim();
  const offer = isMeaningful(s.offer) ? String(s.offer) : "";
  const angle = lc(s.angle);
  const fmt = lbl(s.format);
  const seed = `${brand}|${hook}`;

  const offerWords = /giảm|ưu đãi|khuyến mãi|miễn phí|trợ giá|đồng giá|sale|off|\d/.test(lc(offer) + " " + lc(hook));
  const doctor = /bác sĩ|chuyên gia|y khoa|phác đồ/.test(lc(hook));
  const transform = /trước sau|lột xác|thay đổi|sau \d/.test(lc(hook));

  const whySave = offerWords
    ? `${brand} dùng mồi ưu đãi${offer ? ` ("${offer}")` : ""} để kéo tương tác nhanh — đáng lưu để hiểu cách họ đóng gói offer, KHÔNG để bắt chước giảm giá.`
    : doctor
      ? `${brand} khai thác uy tín bác sĩ trong ${fmt || "creative"} — đáng lưu vì gần với trục "nền tảng sinh học" của SERYN.`
      : transform
        ? `${brand} nhấn kết quả thay đổi — đáng lưu để học cách kể, nhưng cần bỏ phóng đại khi SERYN dùng lại.`
        : `Hook "${hook.slice(0, 50)}" của ${brand} bắt đúng mối quan tâm trẻ hóa da — đáng lưu làm tham chiếu góc tiếp cận.`;

  const howToAdapt = offerWords
    ? `SERYN viết lại: bỏ giảm giá, đổi sang "soi da/đánh giá nền tảng sinh học" làm điểm vào; nhấn chỉ định đúng thay vì giá rẻ.`
    : doctor
      ? `Giữ vai trò bác sĩ nhưng nâng lên giải thích cơ chế lão hóa & cá nhân hóa lộ trình; CTA: đặt lịch soi da.`
      : transform
        ? `Đổi "thay đổi tức thì" thành kết quả tự nhiên, bền vững (kết quả tùy cơ địa); thêm bước đánh giá trước điều trị.`
        : pick([
            `Dựng lại theo tông điềm tĩnh, cao cấp; mở bằng việc hiểu đúng tình trạng da rồi mới tới giải pháp.`,
            `Giữ góc tiếp cận, đổi giọng sang khoa học & cá nhân hóa; CTA nhẹ "đặt lịch soi da".`,
          ], seed);
  return { whySave, howToAdapt };
}
