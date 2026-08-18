/* ============================================================
   SERYN — Bộ sàng lọc rủi ro pháp lý cho content quảng cáo
   ------------------------------------------------------------
   Nguồn quy tắc:
   1. "Hướng dẫn tuân thủ pháp luật về quảng cáo" v2.0 (Mục 3, Mục 4, Mục 5, Phụ lục A)
   2. TIỀN LỆ THẬT của Phòng Pháp chế SERYN — rút từ 54 case trong file
      "S - Theo dõi check duyệt pháp lý content quảng cáo". Tiền lệ nặng hơn hướng dẫn
      chung vì đây là cách SERYN ĐÃ xử tình huống cụ thể.

   NGUYÊN TẮC:
   - Chỉ báo lỗi khi khớp NGUYÊN VĂN trong text -> mọi phát hiện đều trích dẫn được.
   - Có kiểm BIÊN TỪ và NGỮ CẢNH LOẠI TRỪ để không báo nhầm (xem LOAI_TRU).
   - Đây là SÀNG LỌC cho Marketing, KHÔNG thay ý kiến Phòng Pháp chế (Mục 8 hướng dẫn).
   ============================================================ */

import { lamSachChuoi, catAnToan } from "./sanitizeText.mjs";

export const fold = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

const isWordChar = (ch) => !!ch && /[a-z0-9]/.test(ch);


/* ---------- Ngữ cảnh LOẠI TRỪ (chống dương tính giả đã gặp thật) ---------- */
const LOAI_TRU = {
  // "duy nhất tháng này" / "duy nhất 9 suất" = khan hiếm ưu đãi, KHÔNG phải từ dẫn đầu
  "duy nhất": [/duy nhat\s+(hom nay|thang nay|tuan nay|trong ngay|\d)/, /duy nhat\s+\d+\s*(suat|ngay|gio|ca)/],
  "độc quyền": [/uu dai\s+(trai nghiem\s+)?doc quyen/],
  // "khách hàng đầu tư" bị cắt nhầm thành "hàng đầu"
  "hàng đầu": [/khach hang dau\s*tu/, /hang dau\s*tu\b/],
  // câu HỎI phản biện khác CAM KẾT
  "trọn đời": [/tron doi[^.!?]{0,40}\bkhong\s*\?/],
  "hối hận": [/hoi han[^.!?]{0,40}vi da khong lam som/],
  "nhanh nhất": [/nhanh nhat\s+co the/],
};

/* ---------- Nhóm 1: quy tắc từ HƯỚNG DẪN v2.0 ---------- */
export const RULES = [
  { id: "cam-ket-tuyet-doi", nhom: "Cam kết tuyệt đối", canCu: "Mục 3 + Phụ lục A", muc: "Cao",
    cum: ["100% khỏi", "khỏi 100%", "cam kết khỏi", "dứt điểm", "trị dứt điểm", "không tái phát",
          "khỏi vĩnh viễn", "vĩnh viễn", "trọn đời", "cam kết hiệu quả", "cam kết kết quả", "đảm bảo khỏi"],
    sua: "Đổi sang 'hỗ trợ cải thiện', kèm 'kết quả tùy tình trạng và cơ địa mỗi người'." },

  { id: "tu-dan-dau", nhom: "Từ dẫn đầu", canCu: "Phụ lục A + Thông tư 12/2026/TT-BVHTTDL", muc: "Cao",
    cum: ["số 1", "số một", "tốt nhất", "hàng đầu", "duy nhất", "độc quyền", "đứng đầu", "nhất thị trường", "top 1"],
    sua: "Bỏ, hoặc chỉ giữ khi có tài liệu hợp pháp chứng minh VÀ ghi rõ tài liệu đó trong content." },

  { id: "phu-dinh-rui-ro", nhom: "Phủ định rủi ro y khoa", canCu: "Mục 3", muc: "Cao",
    cum: ["không đau", "không sưng", "không biến chứng", "an toàn 100%", "an toàn tuyệt đối",
          "không xâm lấn", "không cần nghỉ dưỡng", "không nghỉ dưỡng", "không để lại sẹo",
          "không kiêng khem", "không vết thương hở", "không bầm"],
    sua: "Mô tả đúng thực tế: 'châm chích nhẹ', 'có cảm giác nhưng trong mức chịu được', 'khó nhìn thấy sẹo'." },

  { id: "toc-do-thoi-gian", nhom: "Mô tả thời gian / tốc độ", canCu: "Mục 3", muc: "Trung bình",
    cum: ["hiệu quả tức thì", "thấy kết quả ngay", "chỉ sau 1 lần", "chỉ sau một lần", "thần tốc",
          "nhanh nhất", "tức thì", "ngay lập tức", "chỉ 1 buổi", "chỉ sau 1 liệu trình"],
    sua: "Nêu đúng thời gian thực tế của dịch vụ; bỏ từ chỉ tốc độ tuyệt đối." },

  { id: "de-doa-cam-xuc", nhom: "Đe dọa / phóng đại cảm xúc", canCu: "Mục 3", muc: "Trung bình",
    cum: ["nguy hiểm nếu không", "biến chứng nếu chậm", "hối hận", "đừng để quá muộn",
          "tố cáo tuổi tác", "già trước tuổi", "không điều trị ngay"],
    sua: "Bỏ áp lực cảm xúc; chuyển sang giải thích cơ chế và mời đánh giá cùng bác sĩ." },

  { id: "claim-xa-hoi", nhom: "Claim xã hội không chứng cứ", canCu: "Phụ lục A", muc: "Cao",
    cum: ["khách hàng tin dùng", "100% khách hàng hài lòng", "hàng nghìn ca thành công",
          "chuyên gia khuyên dùng", "triệu khách hàng", "nghìn khách hàng", "tỷ lệ hài lòng"],
    sua: "Chỉ dùng khi có khảo sát/hồ sơ chứng minh hợp pháp, và nêu rõ nguồn." },

  { id: "ngon-ngu-dieu-tri", nhom: "Ngôn ngữ điều trị sai nhóm", canCu: "Mục 4.2 / 4.3", muc: "Trung bình",
    cum: ["đặc trị", "chữa khỏi", "điều trị khỏi", "thay thuốc", "chữa dứt"],
    sua: "Với dịch vụ không phải khám chữa bệnh: đổi sang 'chăm sóc', 'hỗ trợ cải thiện'." },

  { id: "so-sanh-doi-thu", nhom: "So sánh đối thủ", canCu: "Phụ lục A", muc: "Cao",
    cum: ["tốt hơn hẳn", "hiệu quả hơn hẳn", "hơn hẳn các", "vượt trội hơn hẳn"],
    sua: "Nêu ưu điểm của mình, không nêu tên và không ám chỉ đối thủ." },

  { id: "cam-ket-so-tuoi", nhom: "Cam kết hiệu quả định lượng", canCu: "Mục 4.1", muc: "Cao",
    cum: ["trẻ ra 10 tuổi", "trẻ hơn 10 tuổi", "trẻ ra 20 tuổi", "trẻ hơn 20 tuổi",
          "trẻ 20 tuổi", "kéo dài 15 năm", "duy trì vĩnh viễn"],
    sua: "Bỏ mọi con số tuổi/năm cụ thể; nói 'làn da và gương mặt tươi trẻ hơn, tùy cơ địa mỗi người'." },
];

/* ---------- Nhóm 2: TIỀN LỆ Pháp chế SERYN (đã có phán quyết thật) ---------- */
export const PRECEDENTS = [
  { id: "pl-sera-core-xam-lan", muc: "Cao",
    nhom: "Sera Core là dịch vụ XÂM LẤN — không được nói 'không xâm lấn'",
    canCu: "Pháp chế case 1: Sera Core gồm tiêm Botulinum, cấy vi cầu CaHA (MDC), RF Microneedling; là DV khám chữa bệnh da liễu + Phẫu thuật thẩm mỹ",
    cum: ["không xâm lấn", "ko xâm lấn"],
    sua: "Bỏ 'không xâm lấn'. Mô tả đúng bản chất thủ thuật đã được Chuyên môn thẩm định." },

  { id: "pl-co-seo", muc: "Cao",
    nhom: "Nói 'không sẹo' nhưng thực tế CÓ sẹo",
    canCu: "Pháp chế case 7 và case 9",
    cum: ["không sẹo", "không để lại sẹo", "không vết thương hở"],
    sua: "Đổi thành 'khó nhìn thấy sẹo' hoặc nội dung tương đương." },

  { id: "pl-kieng-khem", muc: "Cao",
    nhom: "Nói 'không kiêng khem' nhưng thực tế có sưng nhẹ và phải hạn chế đồ cứng",
    canCu: "Pháp chế case 1 — Chuyên môn xác nhận có sưng nhẹ + hạn chế ăn đồ cứng",
    cum: ["không kiêng khem", "không cần kiêng", "hoàn toàn không kiêng"],
    sua: "Nêu đúng mức độ thực tế: có thể sưng nhẹ, hạn chế đồ cứng trong vài ngày đầu." },

  { id: "pl-phu-dinh-dau", muc: "Cao",
    nhom: "Phủ định hoàn toàn cảm giác đau",
    canCu: "Pháp chế case 1 — câu 'không thấy khó chịu hay đau chút nào' bị bắt sửa",
    cum: ["không đau chút nào", "không hề đau", "không thấy đau", "không đau"],
    sua: "'Châm chích nhẹ' / 'có cảm giác nhưng trong mức chịu được'." },

  { id: "pl-toan-dien-ket-qua", muc: "Cao",
    nhom: "Claim KẾT QUẢ 'toàn diện' (từ tuyệt đối)",
    canCu: "Pháp chế case 1 — bỏ cụm 'chuyển hóa toàn diện' vì thể hiện thay đổi hoàn toàn, không đạt thì bị claim quảng cáo sai sự thật",
    // CHỈ bắt claim KẾT QUẢ. "tiếp cận cơ thể toàn diện" là mô tả PHƯƠNG PHÁP -> không tính.
    cum: ["trẻ hóa toàn diện", "chuyển hóa toàn diện", "cải thiện toàn diện", "thay đổi toàn diện"],
    sua: "'Tùy theo sự thích ứng của cơ địa mỗi người, ... có thể mang đến làn da và gương mặt tươi trẻ rạng ngời.'" },

  { id: "pl-triet-de", muc: "Trung bình",
    nhom: "Từ tuyệt đối 'triệt để'",
    canCu: "Pháp chế case 5",
    cum: ["triệt để", "xử lý triệt để"],
    sua: "Bỏ 'triệt để'; dùng 'hỗ trợ cải thiện'." },

  { id: "pl-thoi-gian-sai", muc: "Trung bình",
    nhom: "Mô tả thời gian không đúng thực tế làm dịch vụ",
    canCu: "Pháp chế case 1 — 'nhắm mắt chút xíu là xong', 'trải nghiệm thần tốc' bị bắt sửa vì khách có thể claim quảng cáo sai sự thật",
    cum: ["nhắm mắt", "chút xíu là xong", "thần tốc", "loáng cái là xong"],
    sua: "Sửa cho khớp thời gian thực tế của dịch vụ." },

  { id: "pl-may-chua-danh-muc", muc: "Cao",
    nhom: "Truyền thông máy/thiết bị CHƯA có trong danh mục kỹ thuật được phê duyệt",
    canCu: "Pháp chế case 1 — máy Wonder Face và buồng Oxyregen chưa có trong danh mục ⇒ bỏ, không truyền thông",
    cum: ["wonder face", "oxyregen", "oxyrizen"],
    sua: "Không nhắc tới cho đến khi thiết bị được đăng ký tại phòng khám và có trong danh mục phê duyệt." },

  { id: "pl-claim-ty-le", muc: "Cao",
    nhom: "Claim tỷ lệ hài lòng / tỷ lệ thành công không có hồ sơ",
    canCu: "Pháp chế case 8 — '10 người trải nghiệm thì 10 người đều trẻ' bị hỏi có hồ sơ đánh giá không",
    cum: ["10 người", "tỷ lệ hài lòng", "gần như tuyệt đối"],
    sua: "Bỏ, trừ khi có tài liệu/hồ sơ đánh giá trải nghiệm khách hàng chứng minh." },
];

/* ---------- Yếu tố BẮT BUỘC PHẢI CÓ ---------- */
const DISCLAIMER = ["tùy cơ địa", "tuỳ cơ địa", "tùy thuộc cơ địa", "tuỳ thuộc cơ địa",
  "kết quả có thể khác nhau", "tùy tình trạng", "tuỳ tình trạng", "tùy từng người", "tuỳ từng người"];
const GIAY_PHEP = ["giấy phép hoạt động", "gphđ", "giấy phép số", "gp số", "số gp"];
/* Dấu hiệu content thuộc nhóm khám bệnh, chữa bệnh (Mục 4.1) -> ràng buộc chặt hơn. */
const DAU_HIEU_KBCB = ["tiêm", "chích", "phẫu thuật", "thủ thuật", "laser", "điều trị", "phác đồ",
  "bác sĩ", "cấy", "nội soi", "botulinum", "filler", "sera core", "căng da"];
/* Dấu hiệu có khuyến mại -> phải khớp CTKM Vận hành đang áp dụng (tiền lệ case 1, 3, 8). */
const DAU_HIEU_KHUYEN_MAI = ["tặng", "miễn phí", "0đ", "ưu đãi", "giảm giá", "quà", "voucher", "suất"];

/** Tìm cụm từ trong text, có kiểm biên từ + ngữ cảnh loại trừ. Trả vị trí hoặc -1. */
function timCum(f, cum) {
  const needle = fold(cum);
  let from = 0;
  while (true) {
    const i = f.indexOf(needle, from);
    if (i < 0) return -1;
    from = i + 1;
    if (isWordChar(f[i - 1]) || isWordChar(f[i + needle.length])) continue;
    const around = f.slice(Math.max(0, i - 30), i + needle.length + 40);
    if ((LOAI_TRU[cum] || []).some((re) => re.test(around))) continue;
    return i;
  }
}

/**
 * Sàng lọc 1 đoạn content.
 * @returns {{ loi: Array, thieu: Array, laKBCB: boolean, coKhuyenMai: boolean, tongRuiRo: string }}
 */
export function screenText(text) {
  const raw = String(text || "");
  const f = fold(raw);
  const loi = [];

  const quet = (list, loai) => {
    for (const r of list) {
      for (const c of r.cum) {
        const i = timCum(f, c);
        if (i < 0) continue;
        loi.push({
          loai, id: r.id, nhom: r.nhom, canCu: r.canCu, muc: r.muc, cum_khop: c,
          // lamSachChuoi: slice có thể xén ĐÔI emoji (cặp surrogate) -> chuỗi UTF-16
          // hỏng -> Supabase/jsonb từ chối. Bỏ nửa emoji lạc trước khi lưu.
          trich_dan: lamSachChuoi(raw.slice(Math.max(0, i - 50), i + c.length + 50)).replace(/\s+/g, " ").trim(),
          cach_sua: r.sua,
        });
        break;
      }
    }
  };
  // Tiền lệ quét TRƯỚC (nặng hơn), rồi tới quy tắc hướng dẫn.
  quet(PRECEDENTS, "tiền lệ Pháp chế");
  quet(RULES, "hướng dẫn v2.0");

  // Bỏ trùng: cùng một cụm từ đã bị tiền lệ bắt thì không báo lại ở hướng dẫn.
  const daCo = new Set();
  const loiGon = loi.filter((x) => {
    const k = fold(x.cum_khop);
    if (daCo.has(k)) return false;
    daCo.add(k); return true;
  });

  const laKBCB = DAU_HIEU_KBCB.some((d) => f.includes(fold(d)));
  const coKhuyenMai = DAU_HIEU_KHUYEN_MAI.some((d) => f.includes(fold(d)));

  const thieu = [];
  if (!DISCLAIMER.some((d) => f.includes(fold(d)))) {
    thieu.push({
      muc: laKBCB ? "Cao" : "Trung bình",
      thieu_gi: 'Câu lưu ý "kết quả tùy thuộc cơ địa mỗi người"',
      canCu: "Mục 4.1 hướng dẫn + Pháp chế case 1 yêu cầu bổ sung disclaimer",
      cach_sua: 'Thêm: "Kết quả có thể khác nhau tùy tình trạng, cơ địa và quá trình chăm sóc sau thực hiện."',
    });
  }
  if (laKBCB && !GIAY_PHEP.some((d) => f.includes(fold(d)))) {
    thieu.push({
      muc: "Cao",
      thieu_gi: "Số giấy phép hoạt động của cơ sở",
      canCu: "Mục 4.1 + Điều 9 Nghị định 342/2025/NĐ-CP",
      cach_sua: "Bổ sung tên cơ sở, địa chỉ, số giấy phép hoạt động, thời gian hoạt động, phạm vi chuyên môn.",
    });
  }
  if (coKhuyenMai) {
    thieu.push({
      muc: "Trung bình",
      thieu_gi: "Cần đối chiếu chương trình khuyến mại",
      canCu: "Tiền lệ Pháp chế case 1, 3, 8",
      cach_sua: "Ưu đãi/quà tặng phải ĐÚNG chương trình khuyến mại Vận hành đang áp dụng công khai tại phòng khám ở thời điểm quảng cáo. Thể lệ thi có thưởng phải thông báo Sở Công Thương.",
    });
  }

  // Thang rủi ro do LỖI CÂU CHỮ quyết định. Các mục "thiếu yếu tố bắt buộc" (disclaimer,
  // giấy phép, đối chiếu khuyến mại) là vấn đề HỆ THỐNG — gần như card nào cũng dính, nếu
  // để nó đẩy mọi card lên "Cao" thì bảng kết quả mất hết tác dụng phân loại.
  const tongRuiRo = loiGon.some((x) => x.muc === "Cao") ? "Cao"
    : (loiGon.length || thieu.some((x) => x.muc === "Cao")) ? "Trung bình"
    : thieu.length ? "Thấp" : "Thấp";

  return { loi: loiGon, thieu, laKBCB, coKhuyenMai, tongRuiRo, coLoiCauChu: loiGon.length > 0 };
}

export const SO_QUY_TAC = { huong_dan: RULES.length, tien_le: PRECEDENTS.length };
