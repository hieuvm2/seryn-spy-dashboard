/* ============================================================
   SERYN — Trích tên DỊCH VỤ và tên CÔNG NGHỆ nêu trong quảng cáo
   ------------------------------------------------------------
   NGUYÊN TẮC: CHỈ liệt kê tên XUẤT HIỆN NGUYÊN VĂN trong câu chữ quảng cáo.
   KHÔNG suy đoán từ nhãn phân loại (service_or_product, content_angle…),
   KHÔNG đoán theo ngữ cảnh. Không khớp được chữ nào -> trả mảng rỗng để giao
   diện hiện "không nêu tên", TUYỆT ĐỐI không điền tên thay.

   Từ điển dựng từ dữ liệu THẬT (quét 481 quảng cáo tuần 2026-08-10), không
   phải danh sách tự nghĩ ra. Tên không xuất hiện trong dữ liệu vẫn giữ lại
   nếu là công nghệ phổ biến của ngành, để tuần sau đối thủ dùng là bắt được.
   ============================================================ */

/** Bỏ dấu tiếng Việt + hạ chữ thường, để "Trẻ Hoá"/"TRẺ HÓA"/"trẻ hóa" khớp như nhau. */
function fold(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/** Ký tự thuộc "trong một từ" — dùng để chặn khớp lọt giữa từ khác
 *  (vd "tre hoa" không được khớp vào "tre hoai"). */
const isWordChar = (ch: string | undefined) => !!ch && /[a-z0-9]/.test(ch);

/** TÊN DỊCH VỤ (tiếng Việt) — thao tác/thủ thuật khách hàng mua. */
const SERVICE_NAMES: string[] = [
  "căng da mặt", "căng da cổ", "căng da nội soi", "căng da",
  "trẻ hóa da", "trẻ hóa",
  "nâng cơ", "xóa nhăn", "xóa rãnh", "căng chỉ",
  "cắt mí", "nhấn mí", "treo cung mày",
  "nâng mũi", "nâng ngực", "thu gọn cánh mũi",
  "cấy mỡ", "hút mỡ", "giảm béo",
  "độn thái dương", "làm đầy má hóp", "má hóp",
  "tiêm filler", "tiêm botox", "tiêm meso",
  "trị nám", "trị mụn", "trị thâm", "tàn nhang",
  "tạo hình thành bụng", "tạo hình",
  "thon gọn viền hàm", "gọt hàm", "hạ gò má",
  "phẫu thuật thẩm mỹ", "nội soi",
];

/** TÊN CÔNG NGHỆ / THIẾT BỊ / SẢN PHẨM (danh từ riêng, thường tiếng Anh). */
const TECH_NAMES: string[] = [
  // máy / liệu trình có tên thương mại
  "Ultherapy Prime Maxpro", "Ultherapy Prime", "Ultherapy",
  "Thermage FLX", "Thermage",
  "SkinGold Therapy", "SkinGold",
  "Matrix 8D", "AICollaboost", "BluemoonPro", "Sera Core", "Meso Extra",
  "Sofwave", "Morpheus8", "Endolift", "Fotona", "Tixel", "Oligio", "Volnewmer",
  "Shurink", "Doublo", "Hydrafacial", "Scarlet", "Secret RF", "Genius RF",
  "HIFU", "SMAS PRO", "SMAS", "Deep Plane",
  // hoạt chất / sản phẩm tiêm có tên thương mại
  "Rejuran", "Juvederm", "Restylane", "Radiesse", "Sculptra", "Profhilo",
  "Exosome", "Mesotherapy", "Botulinum", "Botox", "Filler",
  "PRF", "PRP", "Skin Booster",
  // công nghệ laser / ánh sáng
  "Pico", "Fractional CO2", "CO2", "Laser",
];

/** Chuẩn hoá hiển thị: trả về đúng dạng viết trong từ điển (không phải dạng
 *  ALL-CAPS hay lem nhem của quảng cáo), để chip nhìn gọn và gộp trùng được. */
function extractExact(text: string, dict: string[]): string[] {
  const hay = fold(text);
  if (!hay) return [];
  // Dài trước ngắn sau: "Thermage FLX" phải thắng "Thermage",
  // "căng da nội soi" phải thắng "căng da".
  const ordered = [...dict].sort((a, b) => b.length - a.length);
  const taken: Array<[number, number]> = []; // các đoạn đã bị tên dài chiếm
  const out: string[] = [];

  for (const name of ordered) {
    const needle = fold(name);
    if (!needle) continue;
    let from = 0;
    while (true) {
      const i = hay.indexOf(needle, from);
      if (i < 0) break;
      const j = i + needle.length;
      from = i + 1;
      // chặn khớp lọt giữa từ khác
      if (isWordChar(hay[i - 1]) || isWordChar(hay[j])) continue;
      // bỏ nếu nằm trong đoạn đã thuộc về một tên dài hơn
      if (taken.some(([a, b]) => i >= a && j <= b)) continue;
      taken.push([i, j]);
      if (!out.includes(name)) out.push(name);
      break; // mỗi tên chỉ liệt kê 1 lần
    }
  }
  // Gộp trùng ý: quảng cáo nhắc "Thermage FLX" ở chỗ này và "Thermage" ở chỗ
  // khác thì chỉ giữ tên CỤ THỂ NHẤT — vẫn là tên có thật trong bài, chỉ bỏ bản
  // rút gọn của cùng một thứ để danh sách không rối.
  return out.filter((name) => {
    const f = fold(name);
    return !out.some((other) => other !== name && fold(other).includes(f));
  });
}

export type NamedInAd = {
  /** Tên dịch vụ nêu nguyên văn trong quảng cáo. */
  services: string[];
  /** Tên công nghệ / thiết bị / sản phẩm nêu nguyên văn trong quảng cáo. */
  technologies: string[];
};

/** Trích tên dịch vụ + công nghệ từ text quảng cáo. Rỗng = quảng cáo KHÔNG nêu tên. */
export function extractNamedInAd(text: string): NamedInAd {
  return {
    services: extractExact(text, SERVICE_NAMES),
    technologies: extractExact(text, TECH_NAMES),
  };
}

export const NAMED_DICT_SIZE = { services: SERVICE_NAMES.length, technologies: TECH_NAMES.length };
