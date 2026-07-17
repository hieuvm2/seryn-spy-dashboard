/* ============================================================
   SERYN Spy — Service scope: ad có phải TRẺ HÓA DA MẶT không?
   ------------------------------------------------------------
   Quyết định 100% dựa trên CONTENT TEXT (headline + primary_text +
   hook_text), không tin nhãn service_or_product.

   PHẠM VI TRẺ HÓA (cập nhật theo danh sách chốt) — CHỈ gồm:
     căng chỉ collagen · căng chỉ da mặt · căng da mặt · chống lão hoá ·
     trẻ hoá · trẻ hoá da · công nghệ trẻ hoá da · da chảy xệ · lão hoá da ·
     nâng cơ · nâng cơ mặt · nhăn trán · xoá nhăn · xoá nếp nhăn ·
     xoá nhăn mắt · xoá rãnh cười (+ công nghệ nâng cơ/trẻ hóa: HIFU,
     Thermage, Ultherapy, Sofwave, RF).
   KHÔNG còn tự nhận nám / sắc tố / mụn / sẹo / lỗ chân lông / soi da như trẻ
   hóa (đây là chỗ bộ lọc CŨ để lọt). Các dịch vụ này -> "other".

   Chống né lọc & biến thể chính tả:
     - fold(): bỏ dấu + đ→d  → "trẻ hoá"/"trẻ hóa"/"tre hoa" đều khớp.
     - deobfuscate(): "HÚT M.Ỡ" → "hút mỡ" (bỏ . * · giữa 2 chữ cái).
     - Từ đơn dễ va chạm sau khi bỏ dấu match bằng regex CÓ DẤU (NEG_*_VI).

   Thứ tự quyết định (negative thắng trước):
     1. Headline dính dịch vụ KHÁC HẲN / vùng cơ thể khác        → other
     2. Headline dẫn NÁM/MỤN/SẮC TỐ/SẸO… mà KHÔNG có tín hiệu trẻ hóa → other
     3. Body dính dịch vụ khác hẳn mà headline không có tín hiệu trẻ hóa → other
     4. Tín hiệu LÕI trẻ hóa/căng da/nâng cơ/xóa nhăn (bất kỳ đâu) → skin_rejuvenation
     5. Còn lại                                                   → other
   ============================================================ */
import { SERVICE_CATEGORY } from "./schemas.mjs";

/** Bỏ ký tự chèn giữa chữ cái để né lọc: "M.Ỡ"→"MỠ", "C.A.M"→"CAM". */
export function deobfuscate(s) {
  return String(s || "").replace(/(\p{L})[.*·‧]+(?=\p{L})/gu, "$1");
}

/** lowercase + bỏ dấu + đ→d. NFKD để chữ Unicode bold trong ads về ASCII. */
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
  // cấy mỡ / ngực / mũi / mắt / hàm / phẫu thuật tạo hình (KHÁC trẻ hóa không xâm lấn)
  "cay mo", "nang nguc", "treo nguc", "nang mui", "sua mui", "cat mi", "nhan mi", "bam mi",
  "sup mi", "chinh hinh mi", "treo cung may", "nang cung may", "don cam", "got ham", "ha go ma",
  "v[- ]?line", "phau thuat ham", "phau thuat tham my",
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

/* ---- NEGATIVE: vùng cơ thể — từ đơn giữ DẤU để tránh va chạm. ---- */
const NEG_BODY_VI = /mông|đùi|bắp tay|bắp chân|cellulite|sần vỏ cam|rạn da|thâm mông|toàn thân|mỡ bụng|vòng 1|vòng 2|vòng 3|\bbụng\b/i;

/* ---- NEGATIVE: dịch vụ da mặt KHÁC trẻ hóa (nám/sắc tố/mụn/sẹo/lỗ chân lông).
   Giữ DẤU để tránh va chạm ("nám" vs "năm", "mụn" vs "muôn"). Đây là nhóm bộ lọc
   CŨ hay để lọt vào trẻ hóa. ---- */
const NEG_FACIAL_VI = /nám|tàn nhang|sắc tố|đốm nâu|sạm da|sạm nám|nốt ruồi|\bmụn\b|mụn ẩn|mụn đầu đen|sẹo rỗ|sẹo lõm|lỗ chân lông/i;

/* ---- CORE: tín hiệu trẻ hóa / căng da / nâng cơ / xóa nhăn (đủ để giữ) ----
   Bám sát danh sách chốt + công nghệ nâng cơ/trẻ hóa. ---- */
const CORE = new RegExp([
  "tre hoa", "tre trung", "chong lao hoa", "lao hoa",
  "cang da", "cang chi", "cang bong", "nang co",
  "xoa nhan", "nep nhan", "vet nhan", "nhan tran", "nhan mat", "chong nhan", "lam mo nhan", "giam nhan",
  "chay xe", "chun nhan", "ranh cuoi",
  "hifu", "thermage", "ulthera\\w*", "sofwave", "song rf", "\\brf\\b",
  "collagen", "kich thich collagen", "cang chi collagen",
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
  const coreHead = CORE.test(headF); // headline có tín hiệu trẻ hóa lõi?

  // 1. Headline bán dịch vụ khác hẳn / vùng cơ thể khác → other.
  const negHead = NEG_OTHER.exec(headF) || NEG_BODY_VI.exec(headVi);
  if (negHead) return { category: "other", reason: "headline_other_service", evidence: negHead[0] };

  // 2. Headline dẫn nám/mụn/sắc tố/sẹo… mà KHÔNG có tín hiệu trẻ hóa → ad nám/mụn.
  const negFacialHead = NEG_FACIAL_VI.exec(headVi);
  if (negFacialHead && !coreHead) return { category: "other", reason: "headline_other_facial_service", evidence: negFacialHead[0] };

  // 3. Body nhắc dịch vụ khác hẳn (ad menu đa dịch vụ) & headline không có tín hiệu trẻ hóa → other.
  const negBody = NEG_OTHER.exec(fullF) || NEG_BODY_VI.exec(fullVi);
  if (negBody && !coreHead) return { category: "other", reason: "body_other_service_no_facial_headline", evidence: negBody[0] };

  // 4. Tín hiệu LÕI trẻ hóa ở bất kỳ đâu → giữ.
  const core = CORE.exec(fullF);
  if (core) return { category: SERVICE_CATEGORY, reason: "core_rejuvenation_signal", evidence: core[0] };

  return { category: "other", reason: "no_rejuvenation_signal", evidence: "" };
}

/** API chính — tương thích chữ ký cũ: nhận ad, trả "skin_rejuvenation" | "other". */
export function inferServiceCategory(ad) {
  return explainServiceScope(ad).category;
}
