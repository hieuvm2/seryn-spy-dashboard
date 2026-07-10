/* ============================================================
   Test bộ lọc phạm vi TRẺ HÓA DA MẶT (scripts/lib/serviceScope.mjs)
   Chạy:  node scripts/test-service-scope.mjs   (exit 1 nếu fail)
   Case lấy từ ad THẬT tuần 2026-07-06 (đã từng lọt/đúng) + case tổng hợp.
   ============================================================ */
import { explainServiceScope } from "./lib/serviceScope.mjs";

const SKIN = "skin_rejuvenation";
const CASES = [
  /* ---- PHẢI GIỮ: trẻ hóa / căng da mặt lõi ---- */
  { want: SKIN, name: "trẻ hóa cơ bản", headline: "Trẻ hóa da từ nền tảng sinh học", primary_text: "Đặt lịch đánh giá cùng bác sĩ" },
  { want: SKIN, name: "biến thể dấu 'trẻ hoá'", headline: "TRẺ HOÁ DA CÔNG NGHỆ CAO", primary_text: "Không đau - không nghỉ dưỡng" },
  { want: SKIN, name: "viết không dấu", headline: "Tre hoa da mat chuyen sau", primary_text: "Cong nghe hifu the he moi" },
  { want: SKIN, name: "hifu nâng cơ", headline: "HIFU nâng cơ xóa nhăn", primary_text: "Săn chắc vùng mặt sau liệu trình, kết quả tùy cơ địa" },
  { want: SKIN, name: "căng chỉ mesh lift", headline: "Bí mật căng chỉ Mesh Lift cho quý cô U50", primary_text: "Lão hóa ngược không phẫu thuật" },
  { want: SKIN, name: "collagen tái tạo", headline: "Kích thích collagen tái tạo da", primary_text: "Công nghệ chuẩn FDA" },
  { want: SKIN, name: "nếp nhăn chảy xệ", headline: "Nếp nhăn, chảy xệ vùng mặt?", primary_text: "Trao đổi với đội ngũ chuyên môn" },
  { want: SKIN, name: "căng da mặt + nhắc filler dạng phủ định", headline: "Căng da mặt không đơ cứng như filler", primary_text: "Phác đồ cá nhân hóa từng gương mặt" },
  /* ---- PHẢI GIỮ: dịch vụ da mặt lân cận (nám/mụn/soi da/sẹo rỗ) ---- */
  { want: SKIN, name: "trị nám", headline: "Trị nám tàn nhang chuẩn y khoa", primary_text: "Soi da miễn phí cùng bác sĩ da liễu" },
  { want: SKIN, name: "mụn diagnosis-reframe", headline: "Trị mụn cứ hết rồi lại bùng — rất mệt và tốn", primary_text: "Da cải thiện rồi lại xuất hiện? Phân tích da cùng bác sĩ" },
  { want: SKIN, name: "sẹo rỗ (da mặt)", headline: "Sẹo rỗ càng để lâu càng khó trị", primary_text: "Điều trị sẹo kết hợp 3 công nghệ, đăng ký thăm khám" },
  { want: SKIN, name: "se khít lỗ chân lông", headline: "Chỉ 168k/suất se khít lỗ chân lông", primary_text: "Đặt lịch ngay" },
  { want: SKIN, name: "soi da phân tích", headline: "Buổi phân tích da chuyên sâu", primary_text: "Chụp và phân tích da đa tầng, đánh giá cấu trúc gương mặt" },
  /* ---- PHẢI LOẠI: dịch vụ khác hẳn ---- */
  { want: "other", name: "cấy tóc", headline: "Cấy tóc hiện có Ưu đãi khủng => IB ngay", primary_text: "Địa chỉ cấy tóc uy tín" },
  { want: "other", name: "phun môi", headline: "Môi hồng tự nhiên — không cần tô son mỗi ngày", primary_text: "Giải pháp PHUN MÔI chuẩn y khoa an toàn" },
  { want: "other", name: "hút mỡ viết lách né lọc", headline: "Eo thon dáng gọn với HÚT M.Ỡ không phẫu thuật", primary_text: "Giảm 98% mỡ thừa chỉ sau 60 phút" },
  { want: "other", name: "trị thâm nách", headline: "Chỉ 168k/suất trị thâm nách | ĐẶT LỊCH NGAY", primary_text: "Hơn 100.000 chị em đã làm đẹp" },
  { want: "other", name: "triệt lông", headline: "Triệt lông vĩnh viễn công nghệ diode", primary_text: "Ưu đãi hè" },
  { want: "other", name: "niềng răng", headline: "Niềng răng trong suốt", primary_text: "Trả góp 0%" },
  { want: "other", name: "nâng mũi", headline: "Nâng mũi cấu trúc chuẩn Hàn", primary_text: "Dáng mũi tự nhiên" },
  { want: "other", name: "giảm béo nhắc collagen", headline: "Giảm béo công nghệ cao", primary_text: "Bổ sung collagen săn chắc vùng bụng" },
  /* ---- PHẢI LOẠI: vùng cơ thể không phải mặt ---- */
  { want: "other", name: "ủ trắng da tay 168k", headline: "Chỉ 168k Mua 1 Được 2 | ĐẶT LỊCH NGAY", primary_text: "Ủ trắng da tay mềm mịn đón hè" },
  { want: "other", name: "hifu tay", headline: "Chỉ 168k/suất làm đẹp", primary_text: "Hifu tay săn chắc, tặng suất Aqua Peel" },
  { want: "other", name: "tắm trắng toàn thân", headline: "Tắm trắng toàn thân bật tone", primary_text: "Da trắng sáng sau 1 buổi" },
  { want: "other", name: "rạn da mông đùi", headline: "Xóa rạn da, sần vỏ cam vùng mông đùi", primary_text: "Công nghệ laser mới" },
  { want: "other", name: "trẻ hóa vùng kín", headline: "Trẻ hóa vùng kín công nghệ mới", primary_text: "Kín đáo riêng tư" },
  /* ---- PHẢI LOẠI: không có tín hiệu da mặt ---- */
  { want: "other", name: "quà tặng túi xách", headline: "Sở hữu chiếc túi CHANEL danh giá", primary_text: "Đặc quyền thượng lưu cho khách hàng may mắn" },
  { want: "other", name: "text trống", headline: "", primary_text: "" },
  { want: "other", name: "chỉ 'mong muốn' (không phải mông)", headline: "Mong muốn của chị là gì?", primary_text: "Hãy chia sẻ cùng chúng tôi" },
  /* ---- Ranh giới: menu đa dịch vụ ---- */
  { want: SKIN, name: "headline trẻ hóa, body nhắc menu có nách", headline: "Trẻ hóa vùng mắt chỉ 168k", primary_text: "Menu ưu đãi: trẻ hóa mắt, trị thâm nách, se khít lỗ chân lông" },
  { want: "other", name: "headline generic, body bán da tay", headline: "Chỉ 168k/suất làm đẹp | ĐẶT LỊCH NGAY", primary_text: "Ưu đãi ủ trắng da tay, tặng suất chăm sóc" },
];

let fail = 0;
for (const c of CASES) {
  const got = explainServiceScope(c);
  const ok = got.category === c.want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(42)} want=${c.want} got=${got.category} (${got.reason}${got.evidence ? ": " + got.evidence : ""})`);
}
console.log(`\n${CASES.length - fail}/${CASES.length} PASS`);
if (fail) process.exit(1);
