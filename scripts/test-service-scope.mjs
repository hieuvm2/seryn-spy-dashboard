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
  /* ---- PHẢI LOẠI: dịch vụ da mặt KHÁC trẻ hóa (nám/mụn/sẹo/lỗ chân lông/soi da) —
     danh sách chốt KHÔNG gồm các dịch vụ này, bộ lọc CŨ để lọt ---- */
  { want: "other", name: "trị nám", headline: "Trị nám tàn nhang chuẩn y khoa", primary_text: "Soi da miễn phí cùng bác sĩ da liễu" },
  { want: "other", name: "mụn diagnosis-reframe", headline: "Trị mụn cứ hết rồi lại bùng — rất mệt và tốn", primary_text: "Da cải thiện rồi lại xuất hiện? Phân tích da cùng bác sĩ" },
  { want: "other", name: "sẹo rỗ (da mặt)", headline: "Sẹo rỗ càng để lâu càng khó trị", primary_text: "Điều trị sẹo kết hợp 3 công nghệ, đăng ký thăm khám" },
  { want: "other", name: "se khít lỗ chân lông", headline: "Chỉ 168k/suất se khít lỗ chân lông", primary_text: "Đặt lịch ngay" },
  { want: "other", name: "soi da phân tích (không có tín hiệu trẻ hóa)", headline: "Buổi phân tích da chuyên sâu", primary_text: "Chụp và phân tích da đa tầng, đánh giá cấu trúc gương mặt" },
  /* ---- CHẶT: ad "trộn" nám + trẻ hóa -> vẫn LOẠI (thà bỏ nhầm còn hơn bỏ sót) ---- */
  { want: "other", name: "nám + trẻ hóa (trộn, có nám -> loại)", headline: "Hết nám, căng bóng trẻ hóa da", primary_text: "Soi da miễn phí" },
  { want: SKIN, name: "trẻ hóa thuần (không nhắc nám) -> giữ", headline: "Nâng cơ HIFU trẻ hóa, xóa nhăn chảy xệ", primary_text: "Kích thích collagen, kết quả tùy cơ địa" },
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
  /* ---- Ranh giới: menu đa dịch vụ — CHẶT: body có lỗ chân lông -> loại dù headline trẻ hóa ---- */
  { want: "other", name: "headline trẻ hóa nhưng body menu có lỗ chân lông (chặt -> loại)", headline: "Trẻ hóa vùng mắt chỉ 168k", primary_text: "Menu ưu đãi: trẻ hóa mắt, trị thâm nách, se khít lỗ chân lông" },
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

/* ── Ngoại lệ nới phạm vi theo brand (yêu cầu 04/08/2026: chỉ Sejung) ────── */
const RELAXED_CASES = [
  { name: "Sejung: Meso lỗ chân lông (nới -> giữ)", brand: "Sejung",
    ad: { headline: "MESO TRẺ HÓA TẠI SEJUNG", primary_text: "Làn da xỉn màu, thiếu sức sống, lỗ chân lông to hay nền da không đều màu" }, want: "skin_rejuvenation" },
  { name: "Sejung: trị nám (nới -> giữ)", brand: "Sejung",
    ad: { headline: "Điều trị nám tại SeJung", primary_text: "Nám chân sâu, tàn nhang" }, want: "skin_rejuvenation" },
  { name: "Sejung: nâng ngực (vẫn LOẠI)", brand: "Sejung",
    ad: { headline: "Nâng ngực nội soi tại SeJung", primary_text: "Túi nâng cao cấp" }, want: "other" },
  { name: "Sejung: giảm mỡ bụng (vẫn LOẠI)", brand: "Sejung",
    ad: { headline: "Giảm mỡ bụng", primary_text: "Hút mỡ bụng, vòng 2 thon gọn" }, want: "other" },
  { name: "Brand KHÁC: Meso lỗ chân lông (vẫn LOẠI)", brand: "Hải Lê",
    ad: { headline: "MESO TRẺ HÓA", primary_text: "Làn da xỉn màu, lỗ chân lông to" }, want: "other" },
  { name: "SERYN: trị nám (brand nhà -> GIỮ, xem nhóm own bên dưới)", brand: "SERYN",
    ad: { headline: "Điều trị nám", primary_text: "Nám chân sâu" }, want: "skin_rejuvenation" },
];
let rp = 0, rf = 0;
for (const c of RELAXED_CASES) {
  const got = explainServiceScope({ ...c.ad, brand_name: c.brand });
  const ok = got.category === c.want;
  ok ? rp++ : rf++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(46)} want=${c.want} got=${got.category} (${got.reason})`);
}
console.log(`\n${rp}/${rp + rf} PASS (ngoại lệ nới brand)`);
if (rf) process.exitCode = 1;

/* ── Brand nhà lấy toàn bộ quảng cáo (yêu cầu 04/08/2026: SERYN) ────────── */
const OWN_CASES = [
  { name: "SERYN: trị nám (giữ - brand nhà)", ad: { brand_name: "SERYN", headline: "Điều trị nám", primary_text: "Nám chân sâu" }, want: "skin_rejuvenation" },
  { name: "SERYN: mỡ mí mắt (giữ - brand nhà)", ad: { brand_name: "SERYN", headline: "Tư vấn 0đ mỡ mí mắt", primary_text: "" }, want: "skin_rejuvenation" },
  { name: "brand_type=own bất kỳ (giữ)", ad: { brand_name: "Phòng khám Seryn Việt Nam", brand_type: "own", headline: "Nâng ngực", primary_text: "" }, want: "skin_rejuvenation" },
  { name: "Đối thủ tên gần giống, KHÔNG own (loại)", ad: { brand_name: "Serena Clinic", headline: "Điều trị nám", primary_text: "Nám chân sâu" }, want: "other" },
];
let op = 0, of_ = 0;
for (const c of OWN_CASES) {
  const got = explainServiceScope(c.ad);
  const ok = got.category === c.want;
  ok ? op++ : of_++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(46)} want=${c.want} got=${got.category} (${got.reason})`);
}
console.log(`\n${op}/${op + of_} PASS (brand nhà toàn bộ)`);
if (of_) process.exitCode = 1;
