/* ============================================================
   SERYN Spy — Service scope: ad có phải TRẺ HÓA DA MẶT không?
   ------------------------------------------------------------
   Quyết định 100% dựa trên CONTENT TEXT (headline + primary_text +
   hook_text), không tin nhãn service_or_product (nhãn đó từng để lọt
   ad "soi da miễn phí" bán sẹo rỗ/cấy tóc vì khớp keyword phụ).

   Chống né lọc & biến thể chính tả:
     - fold(): bỏ dấu + đ→d  → "trẻ hoá"/"trẻ hóa"/"tre hoa" đều khớp.
     - deobfuscate(): "HÚT M.Ỡ" → "hút mỡ" (bỏ . * · giữa 2 chữ cái).
     - Từ đơn dễ va chạm sau khi bỏ dấu (vd "mông" vs "mong muốn")
       match bằng regex CÓ DẤU riêng (NEG_BODY_VI).

   Thứ tự quyết định (negative thắng trước):
     1. Headline/hook dính dịch vụ khác / vùng cơ thể khác  → other
     2. Body dính negative mà headline KHÔNG có tín hiệu trẻ hóa lõi
        (ad menu đa dịch vụ bán thứ khác)                     → other
     3. Tín hiệu LÕI trẻ hóa/căng da mặt (bất kỳ đâu)         → skin_rejuvenation
     4. Tín hiệu MỀM da-mặt lân cận (nám/mụn/soi da/lỗ chân lông…)
                                                              → skin_rejuvenation
     5. Còn lại                                               → other
   ============================================================ */
import { SERVICE_CATEGORY } from "./schemas.mjs";

/** Bỏ ký tự chèn giữa chữ cái để né lọc: "M.Ỡ"→"MỠ", "C.A.M"→"CAM". */
export function deobfuscate(s) {
  return String(s || "").replace(/(\p{L})[.*·‧]+(?=\p{L})/gu, "$1");
}

/** lowercase + bỏ dấu + đ→d. NFKD để chữ Unicode bold trong ads
 *  ("𝐏𝐢𝐜𝐨 𝐃𝐞𝐫𝐦", "𝟏𝟎𝟎 𝐭𝐲̉") về ASCII trước khi match.
 *  (KHÔNG dùng cho từ đơn dễ va chạm sau bỏ dấu — xem NEG_BODY_VI.) */
export function fold(s) {
  return deobfuscate(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}

/** lowercase GIỮ DẤU (NFKC gộp bold-unicode nhưng không mất dấu tiếng Việt). */
function foldVi(s) {
  return deobfuscate(s).toLowerCase().normalize("NFKC");
}

/* ---- NEGATIVE: dịch vụ KHÁC hẳn (match trên text đã fold) ---- */
const NEG_OTHER = new RegExp([
  // giảm béo / body contouring
  "hut mo", "giam beo", "giam mo", "giam can", "vong eo", "eo thon", "mo bung", "danh tan mo",
  // ngực / mũi / mắt / hàm / phẫu thuật tạo hình
  "nang nguc", "treo nguc", "nang mui", "sua mui", "cat mi", "nhan mi", "bam mi", "treo cung may",
  "nang cung may", "don cam", "got ham", "ha go ma", "v[- ]?line", "phau thuat ham",
  // triệt lông / nách
  "triet long", "wax long", "hoi nach", "tham nach", "kho tham nach", "vien nang long",
  // răng
  "nieng rang", "boc rang", "trong rang", "rang su", "dan su", "veneer", "nha khoa", "tay trang rang",
  // tóc / mi / mày / môi (phun xăm)
  "cay toc", "rung toc", "phun xam", "phun moi", "xam moi", "phun may", "xam long may",
  "dieu khac chan may", "dieu khac long may", "noi mi",
  // vùng cơ thể không phải mặt
  "vung kin", "tang sinh mon", "tam trang", "u trang", "trang da toan than", "trang than",
  "da tay", "hifu tay", "cang da tay", "tre hoa tay", "tre hoa vung tay", "tre hoa ban tay",
].map((k) => `\\b(?:${k})\\b`).join("|"), "i");

/* ---- NEGATIVE: vùng cơ thể — từ đơn giữ DẤU để tránh va chạm
   ("mông" ≠ "mong muốn", "bụng" ≠ "bủng"…). Match trên lowercase gốc. ---- */
const NEG_BODY_VI = /mông|đùi|bắp tay|bắp chân|cellulite|sần vỏ cam|rạn da|thâm mông|toàn thân|mỡ bụng|vòng 1|vòng 2|vòng 3|\bbụng\b/i;

/* ---- CORE: tín hiệu trẻ hóa / căng da mặt (đủ để giữ) ---- */
const CORE = new RegExp([
  "tre hoa", "chong lao hoa", "lao hoa", "cang da", "cang chi", "cang bong", "nang co",
  "xoa nhan", "nep nhan", "chay xe", "ranh cuoi", "chun nhan",
  "hifu", "thermage", "ulthera\\w*", "song rf", "\\brf\\b", "skin ?booster",
  "tai tao da", "phuc hoi da", "collagen", "exosome", "meso(?:therapy)?", "tre trung",
].map((k) => `\\b(?:${k})\\b`).join("|"), "i");

/* ---- SOFT: dịch vụ da-mặt lân cận (nám/sắc tố/mụn/soi da…) —
   vẫn thuộc phạm vi spy da mặt, giữ nếu không dính negative. ---- */
const SOFT = new RegExp([
  "soi da", "phan tich da", "danh gia da", "cham soc da", "da lieu", "dieu tri da",
  "tri nam", "nam da", "tan nhang", "sam da", "sam nam", "dom nau", "sac to",
  "tri mun", "mun an", "mun dau den", "seo ro", "seo lom",
  "lo chan long", "se khit", "tham mat", "quang tham", "bong mat",
  "da mat", "lan da", "guong mat", "khuon mat", "duong am da", "cap am da",
  "da dep", "da khoe", "duong da", "skincare",
  // thiết bị da liễu/trẻ hóa hay gặp trong ad công nghệ
  "pico", "fotona", "sofwave", "redtouch",
].map((k) => `\\b(?:${k})\\b`).join("|"), "i");

/**
 * Phân loại chi tiết (có lý do) — dùng cho test/debug.
 * @param {{headline?:string, primary_text?:string, hook_text?:string}} ad
 * @returns {{category:string, reason:string, evidence:string}}
 */
export function explainServiceScope(ad) {
  const headRaw = [ad.headline, ad.hook_text].join(" \n ");
  const fullRaw = [ad.headline, ad.primary_text, ad.hook_text].join(" \n ");
  const headF = fold(headRaw), fullF = fold(fullRaw);
  const headVi = foldVi(headRaw), fullVi = foldVi(fullRaw);

  const negHead = NEG_OTHER.exec(headF) || NEG_BODY_VI.exec(headVi);
  if (negHead) return { category: "other", reason: "headline_other_service", evidence: negHead[0] };

  // Body nhắc dịch vụ khác (ad menu đa dịch vụ): chỉ loại khi HEADLINE cũng
  // không có tín hiệu da mặt nào (core hoặc soft) — headline quyết định ad bán gì.
  const negBody = NEG_OTHER.exec(fullF) || NEG_BODY_VI.exec(fullVi);
  const headSignal = CORE.exec(headF) || SOFT.exec(headF);
  if (negBody && !headSignal) return { category: "other", reason: "body_other_service_no_facial_headline", evidence: negBody[0] };

  const core = CORE.exec(fullF);
  if (core) return { category: SERVICE_CATEGORY, reason: "core_rejuvenation_signal", evidence: core[0] };

  const soft = SOFT.exec(fullF);
  if (soft) return { category: SERVICE_CATEGORY, reason: "adjacent_facial_skin_signal", evidence: soft[0] };

  return { category: "other", reason: "no_facial_skin_signal", evidence: "" };
}

/** API chính — tương thích chữ ký cũ: nhận ad, trả "skin_rejuvenation" | "other". */
export function inferServiceCategory(ad) {
  return explainServiceScope(ad).category;
}
