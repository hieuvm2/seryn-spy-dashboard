import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Define data storage paths
const DATA_DIR = path.join(process.cwd(), "dist");
const SHARED_DATA_PATH = path.join(process.cwd(), "shared_report.json");
const SHARED_COMPETITORS_PATH = path.join(process.cwd(), "shared_competitors.json");

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Dictionary of realistic fallback Facebook Ads thô
const fallbackMockAdsDict: Record<string, any[]> = {
  "thu cúc": [
    {
      pageName: "Bệnh Viện Thẩm Mỹ Thu Cúc",
      adText: "🔥 ĐẠI TIỆC TRẺ HÓA - NÂNG CƠ HiFU PRO CHỈ 6.5TR! Duy nhất tuần này tại Hệ Thống Thu Cúc.\n\n👉 Lấy lại 10 năm xuân thì sau 60 phút thực hiện. Săn ngay suất giảm giá tột đỉnh để hồi sinh làn da thô sần, kéo căng rãnh cười rỗng hóp.\n❌ Không xâm lấn, không đau đớn, không cần nghỉ dưỡng. Cam kết hiệu quả đo lường bằng văn bản y khoa!",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Thu Cúc Thẩm Mỹ HN - SG",
      adText: "👃 NÂNG MŨI THÁI PLASTY - ƯU ĐÃI CHƯA BẰNG CHIẾC IPHONE 17 PRO MAX!\n\nNhận ngay combo nâng sống mũi siêu nhẹ TC-Form + bọc đầu mũi sụn tự thân tạo hình chuẩn tỉ lệ vàng. Khắc phục hoàn toàn khuyết điểm mũi tẹt, hếch, lệch vách ngăn.\n⚡ Hỗ trợ trả góp 0% lãi suất. Click ngay tư vấn trực tiếp cùng Thạc sĩ, Bác sĩ Trưởng khoa Thẩm mỹ.",
      adStartDate: "2026-05-28",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Thu Cúc Clinic & Spa",
      adText: "✨ CẤY MESO NĂNG LƯỢNG SINH HỌC CĂNG BÓNG DA\n\nChỉ 2.2tr/buổi sở hữu ngay làn da mọng mướt như sương mai. Siêu dưỡng chất tinh khiết ngậm nước Thụy Sĩ giúp kéo phẳng nếp nhăn li ti, xóa mờ thâm sạm bẩm sinh.\n🎁 ƯU ĐÃI thêm 25% khi đi nhóm 2 người trở lên.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Tổng Đài Thẩm Mỹ Thu Cúc",
      adText: "💎 TRỊ NÁM LASER PICO ULTRA - SẠCH GỐC NÁM 95%\n\nPhác đồ đa lớp tác động sâu bẻ gãy cấu trúc hắc tố melanin cứng đầu mà không gây tổn thương hay bỏng rát bề mặt da. Trả lại nền da trắng mịn tự nhiên sau liệu trình ngắn.\n👨‍⚕️ Hội chẩn trực tiếp bởi hội đồng thạc sĩ y khoa.",
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Bệnh Viện Thẩm Mỹ Thu Cúc Sài Gòn",
      adText: "👙 GIẢM BÉO LIPO ULTRASOUND - TẠO FORM S-LINE THON GỌN\n\nPhá hủy hoàn toàn các mô mỡ tầng sâu bằng sóng siêu âm hội tụ thế hệ mới. Đào thải mỡ tự nhiên, săn chắc vùng da chùng nhão mà hoàn toàn không đau đớn.\n👉 Suất ưu đãi giới hạn 10 slot rẻ nhất hôm nay!",
      adStartDate: "2026-05-31",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "jw": [
    {
      pageName: "TS.BS Nguyễn Phan Tú Dung - Bệnh viện JW",
      adText: "👨‍⚕️ THĂM KHÁM TRỰC TIẾP CÙNG TS.BS NGUYỄN PHAN TÚ DUNG\n\nPhác đồ Cải Lão Diệu Kỳ trẻ hóa 5 IN 1: Giải quyết rệt ròi nếp nhăn bọng mắt bằng kỹ thuật SMAS Pro, bù đắp thể tích rỗng hóp rãnh má bằng cấy mỡ tự thân Baby Face y khoa chuẩn.\n✨ Kiến tạo độ căng bóng tự nhiên dựa trên nền tảng sinh học phục hồi, hạn chế tối đa xâm lấn thô bạo.",
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Bệnh viện Thẩm mỹ JW Hàn Quốc",
      adText: "✨ MIDFACE 3-IN-1: Đánh bay bọng mỡ mắt, xóa nhăn rãnh cười rỗng hóp.\n\nKỹ thuật đặc biệt can thiệp cơ vòng mi dưới, treo cơ má lên trên giúp nâng toàn bộ vùng cơ chảy xệ, đồng thời tái phân bố mỡ mi mắt tự nhiên.\n👉 Không dùng chất làm đầy công nghiệp. Trẻ hóa bền vững lấy lại 10-15 tuổi sinh học.",
      adStartDate: "2026-05-30",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Bệnh viện JW Sài Gòn - Thẩm mỹ y khoa",
      adText: "👃 NÂNG MŨI S-LINE ĐỘC QUYỀN HÀN QUỐC\n\nTạo dựng cấu trúc mũi thanh tú bằng sụn nhân tạo cao cấp nhập khẩu kết hợp bọc đầu mũi bằng sụn tự thân chống bóng đỏ, lộ sóng. Thẩm mỹ chuẩn phong cách Á Đông mềm mại.\n🔥 Duy nhất tháng này: Tài trợ 30% chi phí thực hiện.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "TS.BS Nguyễn Phan Tú Dung - Bệnh viện JW",
      adText: "🌟 CƠ HỘI ĐIỀU TRỊ KHUYẾT ĐIỂM HÀM MẶT HÔ MÓM NẶNG\n\nPhẫu thuật chỉnh hàm hô móm toàn diện kết hợp niềng răng phục hồi chức năng nhai tối đa. Mang lại diện mạo hoàn hảo hoàn toàn tự nhiên chân thực cho bạn tự tin tỏa sáng.\n🤝 Đăng ký để tham gia chương trình bảo trợ nhân đạo đặc biệt từ Bệnh viện JW.",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Khoa Thẩm Mỹ Da - Bệnh viện JW",
      adText: "🧴 CẤY MESO CELL TALK CĂNG BÓNG MỜ NÁM TỨC THÌ\n\nGiải quyến nền da thâm sạm, da yếu mỏng đỏ do hóa chất lột tẩy kém chất lượng. Cấp ẩm chuyên sâu ngậm nước gấp 1000 lần thông thường.\n👉 Inbox ngay nhận báo giá ưu đãi và lịch hẹn ưu tiên cùng chuyên gia.",
      adStartDate: "2026-05-29",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "lavender": [
    {
      pageName: "Lavender By Chang Luxury",
      adText: "👑 ĐẠI TIỆC TRI ÂN SINH NHẬT CEO LỚN NHẤT NĂM: OFF TỚI 55% + QUÀ TẶNG 70 TRIỆU!\n\nĐồng hành cùng danh ca Đan Trường và CEO Chang chạm tới đỉnh cao làn da căng bóng ngọc ngà nhờ siêu phẩm trẻ hóa y học thượng lưu Nanocell Diamond & Thermage FLX 2026.\n💎 Cam kết phục hồi độ đàn hồi tế bào tức thì, nâng cơ thon gọn tức thì sau một liệu trình xa hoa.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Lavender By Chang",
      adText: "💎 SIÊU CÔNG NGHỆ THERMAGE FLX THẾ HỆ MỚI\n\nTập trung trẻ hóa vùng mắt nhăn sâu, rãnh má sụp xệ bằng sóng vô tuyến điện dung độc quyền từ Hoa Kỳ. Thắt chặt mạng lưới collagen đứt gãy bên dưới trung bì.\n🌟 Đẳng cấp được khẳng định bởi hơn 20.000 chính khách và hoa hậu hàng đầu Việt Nam tin tưởng.",
      adStartDate: "2026-05-26",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Lavender By Chang Clinic",
      adText: "✨ TRẮNG DA MAX WHITE TOÀN THÂN - BẬT TÔNG SIÊU TỐC\n\nPhác đồ truyền trắng thảo dược thiên nhiên kết hợp máy ánh sáng hồng ngoại giúp đào thải độc tố xỉn màu từ sâu bên trong tế bào biểu bì, trả lại làn da trắng mịn ngọc ngà.\n🚫 Không châm chích, không lột tẩy, an toàn tuyệt đối.",
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Lavender By Chang Thẩm Mỹ Viện",
      adText: "🔥 CĂNG CHỈ COLLAGEN KIM CƯƠNG ĐA TẦNG - KÉO CĂNG RÃNH CƯỜI\n\nKỹ thuật căng chỉ sinh học siêu mảnh giúp nâng đỡ vùng cơ chảy xệ vùng má, xóa nhăn khóe mắt và nọng cằm trùng nhão tức thì.\n👩‍🔬 Thực hiện bởi các bác sĩ thẩm mỹ tu nghiệp nước ngoài lâu năm.",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Lavender By Chang Luxury Sài Gòn",
      adText: "🌟 LIỆU TRÌNH MESO GLOW CĂNG BÓNG SÁNG DA\n\nTăng sinh collagen tự nhiên giúp thu nhỏ lỗ chân lông thô ráp, lấp đầy các vết lõm sẹo mụn nhẹ. Làn da bừng sáng rực rỡ chỉ sau lần điều trị đầu tiên.\n💬 Đăng ký nhận ngay quà tặng cao cấp trị giá 5.5tr đồng.",
      adStartDate: "2026-05-28",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "seoul center": [
    {
      pageName: "Hệ Thống Thẩm Mỹ Quốc Tế Seoul Center",
      adText: "🎁 ĐỒNG GIÁ TRẢI NGHIỆM 159K PHỤC HỒI BIỂU PHÌ - TRẺ HÓA KHÔNG KIM!\n\nLiệu trình Meso không kim đa tầng độc quyền cứu cánh làn da thâm, xỉn màu, sần ráp, rỗng lỗ chân lông. Hồi phục màng ẩm tự nhiên chỉ sau 45 phút thư giãn.\n🌟 Áp dụng cho toàn bộ tệp khách hàng văn phòng đăng ký hôm nay qua m.me!",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Seoul Center Clinic HN - HCM",
      adText: "⚡ PHÁC ĐỒ TRỊ MỤN KHÔNG THÂM ACNE ALGAE\n\nCông nghệ độc quyền sử dụng siêu vi tảo silic Thụy Điển giúp loại bỏ cồi mụn ẩn sâu, tiêu diệt vi khuẩn gây viêm sưng, se khít lỗ chân lông và làm mờ các vết thâm mụn chỉ sau 1 liệu trình.\n👉 Giá dùng thử siêu hời chỉ 299K cho sinh viên.",
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Seoul Center - Chi Nhánh Thẩm Mỹ",
      adText: "❄️ TRIỆT LÔNG BĂNG TUYẾT DIODE LASER - TRIỆT SẠCH KHÔNG ĐAU\n\nTác động triệt tiêu tận gốc nang lông xù xì, khử thâm nách sáng mịn chỉ sau 15 phút nhẹ nhàng. Đầu làm lạnh cảm biến băng mát đem lại trải nghiệm hoàn hảo.\n🎁 Đăng ký ngay săn deal trọn đời chỉ với 499k.",
      adStartDate: "2026-05-31",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Hệ Thống Thẩm Mỹ Quốc Tế Seoul Center",
      adText: "👄 PHUN XĂM MÔI COLLAGEN LÊN MÀU ĐỎ CAM TỰ NHIÊN\n\nGiải pháp hoàn hảo xóa thâm môi bẩm sinh, khắc phục viền môi mờ nhạt khô ráp nứt nẻ. SỬ dụng mực hữu cơ thảo dược chuẩn FDA Hoa Kỳ cực kỳ an toàn lành tính.\n🎁 Tặng ngay hũ dưỡng kích màu sau phun xăm chất lượng.",
      adStartDate: "2026-05-28",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "seoulspa": [
    {
      pageName: "Thẩm Mỹ Viện SeoulSpa",
      adText: "🎁 ĐỒNG GIÁ TRẢI NGHIỆM 159K PHỤC HỒI BIỂU PHÌ - TRẺ HÓA KHÔNG KIM!\n\nLiệu trình Meso không kim đa tầng độc quyền cứu cánh làn da thâm, xỉn màu, sần ráp, rỗng lỗ chân lông. Hồi phục màng ẩm tự nhiên chỉ sau 45 phút thư giãn.\n🌟 Áp dụng cho toàn bộ tệp khách hàng văn phòng đăng ký hôm nay qua m.me!",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "SeoulSpa.Vn - Hệ Thống Làm Đẹp",
      adText: "🌿 TẮM TRẮNG PHI THUYỀN HOÀNG GIA - BẬT 2-3 TÔNG DA RÕ RỆT\n\nDịch vụ luxury giúp đẩy lùi hắc sắc tố xơ cứng, thanh lọc bã nhờn cơ thể đồng thời bổ sung vitamin C & E đậm đặc nuôi dưỡng da sáng hồng từ gốc.\n🔥 Giảm giá kích sàn 65% cho khách hàng mới đăng ký trải nghiệm.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Thẩm Mỹ Viện SeoulSpa Toàn Quốc",
      adText: "💧 ULTRA HYDRATION - CẤP NƯỚC ĐA TẦNG CĂNG KÍT MỊN MÀNG\n\nĐộ ẩm sâu phục hồi da khô nứt nẻ, da sần sùi không đều màu do thức đêm làm việc nhiều. Sử dụng huyết thanh phục hồi bơ hạt mỡ Thụy Sĩ tốt gấp 5 lần dưỡng da thông thường.\n👉 Inbox ngay để nhận thông tin giảm giá độc quyền.",
      adStartDate: "2026-05-29",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "kangnam": [
    {
      pageName: "Bệnh Viện Thẩm Mỹ Kangnam",
      adText: "👁️ KIẾN TẠO MẮT ĐẸP CHỈ 30 PHÚT - CÔNG NGHỆ CẮT MÍ PLASTY ĐỘC QUYỀN\n\nXóa tan bọng mỡ mắt, tạo nếp mí tự nhiên siêu mảnh chuẩn Hàn, không sưng bầm không cần cắt chỉ dài ngày. Sở hữu đôi mắt có hồn tươi tắn rạng rỡ ngay lập tức.\n👉 Giảm 40% chi phí khi đăng ký theo cặp bạn bè hoặc nhóm KOCs.",
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Kangnam Beauty HN - HCM",
      adText: "👃 NÂNG MŨI CẤU TRÚC 4D - CHUẨN TỶ LỆ VÀNG CHÂN THỰC\n\nTạo hình dáng mũi L-Line cao thẳng nam tính hoặc S-Line mềm mại nữ tính cực kỳ chuẩn sụn tự thân bọc đầu mũi trọn gói. Không đau, sưng nề tối thiểu.\n🔥 Hỗ trợ trả góp 0% lãi suất cùng đặc quyền ưu tiên gặp bác sĩ trưởng khoa.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Bệnh Viện Thẩm Mỹ Kangnam Sài Gòn",
      adText: "⚡ HÚT MỠ TOÀN THÂN LIPO ULTRASOUND - GIẢM NGAY 15-20CM VÒNG EO\n\nCông nghệ hóa lỏng mỡ thừa thông minh ưu việt bậc nhất Hoa Kỳ. Cam kết loại bỏ mỡ thừa đáng ghét hiệu quả nhanh chóng, không gồ ghề lồi lõm da hay xơ cứng nọng sờ.\n👩‍⚕️ Miễn phí xét nghiệm kiểm tra sức khỏe tổng quát y khoa.",
      adStartDate: "2025-05-28",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Bệnh Viện Thẩm Mỹ Kangnam Hà Nội",
      adText: "👑 TRỊ NÁM LASER PICO SURE - CAM KẾT BẰNG VĂN BẢN\n\nBắn sạch nám đinh, nám chân sâu, nám mảng lâu năm nhờ dòng sóng Laser thế hệ mới tần số siêu ngắn. Sinh thiết phác đồ cá nhân hóa phù hợp cho mọi cơ địa da nhạy cảm.\n👉 Inbox đặt lịch ngay để được bác sĩ đầu ngành khám soi da miễn phí.",
      adStartDate: "2026-05-30",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Kangnam Clinic & Spa",
      adText: "🔋 TRẺ HÓA KÉO CĂNG DA MẶT BẰNG HIFU PRO THẾ HỆ 3\n\nTự động tái sinh mạng lưới đàn hồi hư nứt tổn hại dưới trung bì da, giảm tối đa cằm xệ nếp nhăn đuôi mắt. Trải nghiệm mát mẻ êm ái hoàn toàn không tê buốt.\n🎁 Đồng giá ưu đãi cực mạnh trải nghiệm lần đầu chỉ 2.5TR đồng.",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "shynh": [
    {
      pageName: "Shynh House - Thẩm Mỹ & Spa",
      adText: "🔋 TRẺ HÓA CHUẨN Y KHOA: Hi-Trulift Pro nâng cơ sâu từng milimet biểu mô.\n\nTác động xóa cơ nọng cằm lỏng lẻo, tạo khuôn mặt thon gọn hàm V-line sắc sảo. Nghiên cứu thực hiện dưới góc nhìn bác sĩ chuyên môn y khoa Shynh House.\n💬 Click để bác sĩ trưởng chi nhánh trực tiếp tư vấn phác đồ phân tích nếp nhăn.",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Shynh Premium Sài Gòn",
      adText: "💎 TRẺ HÓA THERMAGE FLX 900 SHOTS CHỈ 29.9TR - CAM KẾT ĐẦU TIP CHÍNH HÃNG\n\nKiểm tra mã vạch quét mã QR đầu tip trực tiếp trước khi tiến hành trị liệu. Ưu điểm thắt chặt collagen chùng xệ, nâng đuôi mắt sụp và khóe rãnh miệng lập tức.\n🎁 Tặng ngay 1 buổi cấy tinh chất HA ngậm nước Thụy Sĩ sang xịn mịn trị giá 8 triệu.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Shynh House - Clinic Toàn Quốc",
      adText: "🧪 CẤY MESO EXTRA CĂNG BÓNG MỊN MÀNG - ĐẨY LÙI THÂM SẠM\n\nNạp trực tiếp lượng dinh dưỡng dồi dào cô đặc phục hồi tận gốc các vùng tế bào yếu, tăng sức đề kháng bảo vệ da chống chọi tác hại môi trường khói bụi.\n👉 Nhận quà tặng thẻ trải nghiệm trắng da Laser khi tương tác bài viết này.",
      adStartDate: "2026-05-30",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Viện Thẩm Mỹ Quốc Tế Shynh Premium",
      adText: "✨ CẮT MÍ PLASTY HÀN QUỐC - ĐO VẼ TỶ LỆ TRỰC TIẾP CÙNG BÁC SĨ CHUYÊN KHOA\n\nLoại bỏ triệt để da chùng, mỡ thừa mi mắt nhăn nheo, mở rộng góc mắt trong cho đôi mắt tròn xoe cuốn hút long lanh như ngọc thực.\n🔥 ĐẶC BIỆT: Giảm ngay 35% cho khách hàng đặt chỗ trước.",
      adStartDate: "2026-05-28",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "lg": [
    {
      pageName: "LG Clinic - Hệ Thống Viện Hàn Quốc",
      adText: "❄️ SIÊU PHỄU TRIỆT LÔNG CẢM GIÁC LẠNH -8°C BẢO HÀNH TRỌN ĐỜI CHỈ 600K/10 BUỔI!\n\nXóa sổ 99% nang lông cứng đầu vùng nách và bikini cực kỳ nhẹ nhàng mát rượi, không sưng đỏ rát ngứa.\n🎁 Tặng kèm gói trị thâm Laser y khoa bảo chứng chất lượng trong ngày hôm nay kịch sàn m.me!",
      adStartDate: "2026-05-31",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "LG Beauty Clinic",
      adText: "🌿 CẤY MESO CELL TOXIN CĂNG BÓNG CHUẨN KLIÊN KHU\n\nPhục hồi làn da tổn thương thô ráp do corticoid, dưỡng ẩm chuyên sâu căng mọng rõ rệt ngay sau lần thực hiện đầu tiên.\n💥 Suất ưu đãi đặc biệt giảm 50% chỉ còn 1.5Tr/buổi áp dụng duy nhất hôm nay.",
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "LG Clinic - Chi Nhánh Thẩm Mỹ",
      adText: "⚡ NÂNG CƠ TRẺ HÓA HIFU LINE THERAPHY\n\nBước sóng siêu âm hội tụ phá hủy hắc tố xỉn màu sạm nám gò má, thắt chặt cơ hàm thon gọn thanh tú chuẩn mặt chuẩn V-line.\n👉 Đăng ký ngay để nhận quà tặng combo chăm sóc phục hồi chuyên sâu tại clinic.",
      adStartDate: "2026-05-29",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ],
  "gangwhoo": [
    {
      pageName: "Bệnh Viện Thẩm Mỹ Gangwhoo",
      adText: "⚡ HÚT MỠ NỌNG CẰM KHÔNG SẸO LIPO ULTRASOUND GIẢM NGAY 50% GIỜ VÀNG!\n\nĐánh bay lớp mỡ trùng rỗng sụp xệ xung quanh nọng hàm, kéo dãn cơ cổ thanh thoát thon lọn. Trải nghiệm nhanh 45 phút công nghệ siêu tần sóng siêu âm không lo xơ cứng rát ngứa.\n👉 Giới hạn chỉ áp dụng ưu đãi cho khách hàng đăng ký sớm nhất.",
      adStartDate: "2026-05-30",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Bệnh Viện Thẩm Mỹ Gangwhoo Sài Gòn",
      adText: "👃 NÂNG MŨI SIÊU CẤU TRÚC NANO CHUẨN HÀN QUỐC\n\nTái cấu trúc dáng mũi từ sống mũi, đầu mũi đến cánh mũi bằng kỹ thuật bọc sụn tự thân Nano siêu liên kết bền đẹp trọn đời.\n🔥 Giảm sốc 40% trọn gói cùng chính sách bảo hành uy tín lâu năm của Gangwhoo.",
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Gangwhoo Plastic Surgery Hospital",
      adText: "👁️ CẮT MÍ Plasty GIỮ NẾP TRỌN ĐỜI - MẮT ĐẸP TỰ NHIÊN HỒA QUYỆN\n\nPhác đồ thực hiện xâm lấn tối thiểu không ảnh hưởng thị lực, lành nhanh sau 3 ngày cắt chỉ. Trực tiếp Thạc sĩ, Bác sĩ chuyên môn cao cấp tư vấn phác đồ.\n🎁 Tặng kèm gói siêu âm tầm soát nọng toàn thân m.me!",
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    },
    {
      pageName: "Thẩm Mỹ Viện Gangwhoo Team",
      adText: "🧴 CẤY MESO PERFECT GLOW TRẺ HÓA DA 10 TUỔI SINH HỌC\n\nTăng sinh hyaluronic acid đa lớp tái cấu trúc biểu bì căng khỏe, khôi phục nếp rãnh hóp li ti khóe miệng nhanh chóng.\n👉 Nhận ngay thẻ voucher ưu đãi đặc biệt trị giá 2.500.000đ khi đăng ký.",
      adStartDate: "2026-05-28",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library"
    }
  ]
};

// Helper to lookup fallback mock ads matching keyword - ensuring a rich multi-ad list is always returned
function getFallbackMockAds(kw: string): any[] {
  const norm = kw.toLowerCase();
  for (const [key, ads] of Object.entries(fallbackMockAdsDict)) {
    if (norm.includes(key) || key.includes(norm)) {
      return ads.map(ad => ({ ...ad, originalKeyword: kw }));
    }
  }
  
  // Return a rich, randomized, high-quality diverse set of 5-6 cosmetic ads for any other brand
  return [
    {
      pageName: `${kw} Luxury Clinic`,
      adText: `❤️ THƯƠNG HIỆU THẨM MỸ ${kw} BÙNG NỔ ƯU ĐÃI: KHÔI PHỤC THANH XUÂN VÙNG MẮT\n\nDuy nhất trong tuần này, ${kw} triển khai phác đồ trẻ hóa, xóa bọng mỡ mắt và nâng cơ vùng cung mày độc quyền bằng Thermage FLX thế hệ 2026 mới nhất.\n❌ Không xâm lấn cơ, không đau đớn sưng bầm. Cam kết hiệu quả trông thấy 80% ngay sau 45 phút điều trị!`,
      adStartDate: "2026-06-01",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library",
      originalKeyword: kw
    },
    {
      pageName: `${kw} Thẩm Mỹ Viện`,
      adText: `💉 SIÊU CẤY MESO HYDRATE CĂNG BÓNG DA ĐA TẦNG TẠI ${kw}\n\nĐưa trực tiếp 18 loại axit amin quý hiếm và HA ngậm nước thuần khiết vào sâu lớp trung bì da giúp phá vỡ các màng hắc tố melanin gây sạm nám gò má.\n👉 Trải nghiệm với chi phí phễu thu đổi làn da rạng rỡ chỉ 1.200K cực rẻ!`,
      adStartDate: "2025-05-29",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library",
      originalKeyword: kw
    },
    {
      pageName: `Viện Thẩm Mỹ Quốc Tế ${kw}`,
      adText: `👃 KIẾN TẠO DÁNG MŨI THÁI NANO CHUẨN TỶ LỆ VÀNG\n\nNâng sống mũi siêu nhẹ kết hợp sụn Megaderm bọc đầu mũi trọn gói tại ${kw}. Khắc phục toàn vẹn khuyết điểm đầu mũi ngắn hếch lệch vách ngăn phẫu thuật cũ hư.\n🔥 Hỗ trợ trả góp học sinh sinh viên trả trước 0đ nhận ngay dáng mũi thanh tú đón tài lộc!`,
      adStartDate: "2026-06-03",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library",
      originalKeyword: kw
    },
    {
      pageName: `${kw} Beauty HN & SG`,
      adText: `❄️ TRIỆT LÔNG BĂNG TUYẾT DIODE LASER - GIẢI NHIỆT MÙA HÈ CÙNG ${kw}!\n\nLiệu trình triệt sạch lông cơ thể (tay, chân, nách, bikini) siêu êm dịu cảm ứng mát lạnh âm độ C không rát ngứa.\n🎁 Tặng ngay buổi laser CO2 trị mụn thâm vùng nách hoàn mỹ. Trọn gói triệt lông chỉ còn 599.000đ dành cho 20 suất sớm nhất!`,
      adStartDate: "2026-06-02",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library",
      originalKeyword: kw
    },
    {
      pageName: `Hệ Thống Thẩm Mỹ ${kw}`,
      adText: `🔥 LIỆU TRÌNH TRỊ NÁM LASER PICO ULTRA ĐỘT PHÁ TẠI ${kw}\n\nĐánh bật tận gốc các đốm nám chân đinh, tàn nhang bẩm sinh cứng đầu một cách hiệu quả, an toàn, không kích ứng mỏng đỏ da.\n👨‍⚕️ Khám tư vấn trực tiếp cùng Hội đồng Thạc sĩ Bác sĩ đầu ngành sắc đẹp.`,
      adStartDate: "2026-05-30",
      isActive: true,
      adSnapshotUrl: "https://www.facebook.com/ads/library",
      originalKeyword: kw
    }
  ];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API endpoint to serve shared dashboard data if it exists
  app.get("/api/dashboard-data", (req, res) => {
    try {
      if (fs.existsSync(SHARED_DATA_PATH)) {
        const raw = fs.readFileSync(SHARED_DATA_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        return res.json({ success: true, data: parsed });
      }
      res.json({ success: true, data: null });
    } catch (err: any) {
      console.error("Lỗi khi tải báo cáo lưu trữ:", err);
      res.status(500).json({ error: "Không thể tải báo cáo từ máy chủ." });
    }
  });

  // API endpoint to save dashboard data (Push to shared layout)
  app.post("/api/save-dashboard-data", (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: "Thiếu dữ liệu lưu trữ." });
      }
      fs.writeFileSync(SHARED_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
      res.json({ success: true, message: "Đã lưu trữ dữ liệu báo cáo lên máy chủ thành công." });
    } catch (err: any) {
      console.error("Lỗi khi ghi báo cáo lên máy chủ:", err);
      res.status(500).json({ error: "Không thể ghi lưu báo cáo lên máy chủ." });
    }
  });

  // API endpoint to serve shared competitors list if exists
  app.get("/api/competitors", (req, res) => {
    try {
      if (fs.existsSync(SHARED_COMPETITORS_PATH)) {
        const raw = fs.readFileSync(SHARED_COMPETITORS_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        return res.json({ success: true, data: parsed });
      }
      res.json({ success: true, data: null });
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách đối thủ lưu trữ:", err);
      res.status(500).json({ error: "Không thể tải danh sách đối thủ từ máy chủ." });
    }
  });

  // API endpoint to save competitors list (Push to shared layout)
  app.post("/api/save-competitors", (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: "Thiếu dữ liệu đối thủ." });
      }
      fs.writeFileSync(SHARED_COMPETITORS_PATH, JSON.stringify(data, null, 2), "utf-8");
      res.json({ success: true, message: "Đã lưu danh sách đối thủ lên máy chủ thành công." });
    } catch (err: any) {
      console.error("Lỗi khi ghi danh sách đối thủ lên máy chủ:", err);
      res.status(500).json({ error: "Không thể ghi lưu danh sách đối thủ." });
    }
  });

  // API endpoint to reset/delete custom shared data back to baseline
  app.post("/api/reset-shared-data", (req, res) => {
    try {
      if (fs.existsSync(SHARED_DATA_PATH)) {
        fs.unlinkSync(SHARED_DATA_PATH);
      }
      if (fs.existsSync(SHARED_COMPETITORS_PATH)) {
        fs.unlinkSync(SHARED_COMPETITORS_PATH);
      }
      res.json({ success: true, message: "Đã reset dữ liệu chia sẻ của hệ thống về mặc định." });
    } catch (err: any) {
      console.error("Lỗi khi reset dữ liệu chia sẻ:", err);
      res.status(500).json({ error: "Không thể reset dữ liệu chia sẻ về mặc định." });
    }
  });

  // API endpoint for checking ScrapeCreators API status
  app.get("/api/spy-status", (req, res) => {
    const hasScrapeKey = !!process.env.SCRAPE_CREATORS_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    res.json({
      hasScrapeKey,
      hasGeminiKey,
      scrapeKeyPlaceholder: hasScrapeKey ? "•••••••••" : null,
      geminiKeyPlaceholder: hasGeminiKey ? "•••••••••" : null,
      message: "ScrapeCreators và Gemini API Status check thành công."
    });
  });

  // API endpoint to spy and automatically analyze competitor Facebook ads
  app.post("/api/spy-ads", async (req, res) => {
    try {
      let { keyword, competitors, country = "VN", limit = 15, isSandbox = false } = req.body;

      const scrapeApiKey = (req.body.scrapeApiKey || process.env.SCRAPE_CREATORS_API_KEY || "").toString().trim();
      
      // Real scan is active if we actually have an API key and sandbox is not explicitly forced
      const isRealScan = !!scrapeApiKey && !isSandbox;
      
      let rawAdsData: any[] = [];
      let usedSandbox = false;
      let keywordsList: string[] = [];

      // Helper function to extract FB identifier
      const extractFacebookPageIdentifier = (urlOrText: string): string | null => {
        if (!urlOrText) return null;
        const text = urlOrText.trim();
        if (text === "" || text === "không có dữ liệu" || text.toLowerCase().includes("không có")) {
          return null;
        }
        if (text.includes("facebook.com") || text.includes("fb.com")) {
          try {
            const profileIdMatch = text.match(/profile\.php\?id=(\d+)/i);
            if (profileIdMatch && profileIdMatch[1]) return profileIdMatch[1];
            
            const pagesIdMatch = text.match(/\/(\d+)\/?$/);
            if (pagesIdMatch && pagesIdMatch[1]) return pagesIdMatch[1];

            let cleanUrl = text.split("?")[0];
            if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
            const parts = cleanUrl.split("/");
            const lastPart = parts[parts.length - 1];
            if (lastPart && lastPart.length > 0 && lastPart !== "facebook.com" && lastPart !== "fb.com") {
              return lastPart;
            }
          } catch (err) {
            console.error("Lỗi parse URL FB page:", err);
          }
        }
        return text;
      };

      // Scenario A: User passed detailed competitors array (quét sâu từng Fanpage & Vệ tinh)
      if (Array.isArray(competitors) && competitors.length > 0) {
        keywordsList = competitors.map(c => c.name.trim()).filter(Boolean);
        
        console.log(`Bắt đầu chiến dịch QUÉT SÂU cho ${competitors.length} đối thủ. Có cấu hình Fanpage chính & vệ tinh. Chế độ quét thật: ${isRealScan}`);
        
        for (const comp of competitors) {
          const compName = comp.name;
          // Gather sources for this specific competitor (Main page, satellite Pages)
          const rawSources = [
            extractFacebookPageIdentifier(comp.mainPage),
            extractFacebookPageIdentifier(comp.satellitePage1),
            extractFacebookPageIdentifier(comp.satellitePage2),
            extractFacebookPageIdentifier(comp.satellitePage3)
          ];
          
          // Filter unique, valid sources
          const sources = Array.from(new Set(rawSources.filter((s): s is string => typeof s === "string" && s.length > 0 && !s.toLowerCase().includes("không có"))));
          
          // If no specific fanpages are available in spreadsheet, search by competitor's literal brand name
          if (sources.length === 0) {
            sources.push(compName);
          }
          
          console.log(`Đối thủ ${compName}: quét qua các nguồn/fanpage thực tế: [${sources.join(", ")}]`);
          
          let compAdsFound = false;
          
          // Query all sources for this competitor
          for (const src of sources) {
            if (isRealScan) {
              console.log(`-> Đang gọi Real ScrapeCreators cho "${src}" (${compName})...`);
              const srcLimit = limit || 20;
              const url = `https://api.scrapecreators.com/v1/facebook/ads-library?query=${encodeURIComponent(src)}&country=${country}&limit=${srcLimit}`;
              
              const response = await fetch(url, {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${scrapeApiKey}`,
                  "Content-Type": "application/json"
                }
              });

              if (response.ok) {
                const data = await response.json();
                const results = data?.results || data?.data || data || [];
                if (Array.isArray(results) && results.length > 0) {
                  console.log(`   -> OK! Lấy được ${results.length} ads cho "${src}"`);
                  rawAdsData.push(...results.map((ad: any) => ({ ...ad, originalKeyword: compName })));
                  compAdsFound = true;
                } else {
                  console.log(`   -> OK nhưng không thấy ads hoạt động.`);
                }
              } else {
                // If ScrapeCreators returns an error (401, 429, etc.), we propagate it directly!
                let errText = "";
                try {
                  const errJson = await response.json();
                  errText = errJson?.error || errJson?.message || JSON.stringify(errJson);
                } catch (_) {}

                const status = response.status;
                if (status === 401) {
                  throw new Error(`ScrapeCreators API Key không hợp lệ hoặc không có quyền (Mã lỗi: 401 Unauthorized) khi đang quét nguồn "${src}".`);
                } else if (status === 429) {
                  throw new Error(`ScrapeCreators API Key của bạn đã HẾT TOKENS / GIỚI HẠN LƯỢT QUÉT (Mã lỗi: 429 Rate Limit Exceeded).`);
                } else {
                  throw new Error(`Cổng API ScrapeCreators báo lỗi ${status}: ${errText || "Không rõ nguyên nhân chi tiết"}.`);
                }
              }
            }
          }
          
          // Fallback only if we are playing with Sandbox Demo, never for real Scrape scan
          if (!isRealScan) {
            const currentCompAdsCount = rawAdsData.filter(ad => ad.originalKeyword === compName).length;
            if (currentCompAdsCount === 0) {
              console.log(`-> Không chạy thực tế, nạp mock fallback cho đối thủ ${compName}`);
              rawAdsData.push(...getFallbackMockAds(compName));
              usedSandbox = true;
            }
          }
        }
      } 
      // Scenario B: User just typed general search keyword
      else {
        if (!keyword) {
          return res.status(400).json({ error: "Vui lòng nhập từ khóa hoặc danh sách đối thủ cần spy." });
        }

        if (Array.isArray(keyword)) {
          keywordsList = keyword;
        } else if (typeof keyword === "string") {
          if (keyword.includes(",")) {
            keywordsList = keyword.split(",").map(k => k.trim()).filter(Boolean);
          } else {
            keywordsList = [keyword.trim()];
          }
        }

        console.log(`Bắt đầu quét theo từ khóa chung: ${keywordsList.join(", ")}. Chế độ quét thật: ${isRealScan}`);
        
        for (const kw of keywordsList) {
          if (isRealScan) {
            try {
              console.log(`Đang gọi Real-time ScrapeCreators API cho từ khóa: ${kw}`);
              const url = `https://api.scrapecreators.com/v1/facebook/ads-library?query=${encodeURIComponent(kw)}&country=${country}&limit=20`;
              
              const response = await fetch(url, {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${scrapeApiKey}`,
                  "Content-Type": "application/json"
                }
              });

              if (response.ok) {
                const data = await response.json();
                const results = data?.results || data?.data || data || [];
                if (Array.isArray(results) && results.length > 0) {
                  rawAdsData.push(...results.map((ad: any) => ({ ...ad, originalKeyword: kw })));
                } else {
                  console.log(`Không tìm thấy Live Ads nào cho từ khóa "${kw}" từ ScrapeCreators.`);
                }
              } else {
                let errText = "";
                try {
                  const errJson = await response.json();
                  errText = errJson?.error || errJson?.message || JSON.stringify(errJson);
                } catch (_) {}

                const status = response.status;
                if (status === 401) {
                  throw new Error(`ScrapeCreators API Key không hợp lệ hoặc đã hết hạn (HTTP 401 Unauthorized).`);
                } else if (status === 429) {
                  throw new Error(`ScrapeCreators API của bạn đã cạn kiệt số dư Tokens/Quota (HTTP 429 Rate Limit).`);
                } else {
                  throw new Error(`Cổng API ScrapeCreators báo lỗi ${status} khi quét từ khóa: ${errText || "Unknown"}`);
                }
              }
            } catch (err: any) {
              console.error("Lỗi api cho từ khóa", kw, err);
              throw err; // bubble up instead of silent fallbacks!
            }
          } else {
            // Only load simulated ads if this is a sandbox demo
            rawAdsData.push(...getFallbackMockAds(kw));
            usedSandbox = true;
          }
        }
      }

      // De-duplicate ads collected recursively based on exact text matches to ensure different campaigns are retained!
      const seenAdTexts = new Set<string>();
      const uniqueAdsData: any[] = [];
      for (const ad of rawAdsData) {
        const textKey = ad.adText ? ad.adText.trim().replace(/\s+/g, ' ') : ad.adSnapshotUrl || Math.random().toString();
        if (!seenAdTexts.has(textKey)) {
          seenAdTexts.add(textKey);
          uniqueAdsData.push(ad);
        }
      }
      rawAdsData = uniqueAdsData;

      // 2. Log final raw size
      console.log(`Quét hoàn tất: thu được ${rawAdsData.length} mẫu quảng cáo facebook thô.`);

      // 3. Setup Gemini Analysis using @google/genai
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        // Return structured data directly if Gemini key is missing
        return res.status(200).json({
          success: true,
          sandbox: usedSandbox,
          warning: "Chưa cấu hình GEMINI_API_KEY trong Settings > Secrets, trả về phân tích rỗng hoặc live theo dữ liệu quét.",
          data: createDefaultAnalyzedData(keywordsList, rawAdsData)
        });
      }

      console.log(`Đang khởi chạy Gemini để phân tích cấu trúc cho ${rawAdsData.length} Meta Ads thu thập từ: ${keywordsList.join(", ")}`);
      
      const prompt = `Hãy đóng vai trò là Chuyên Gia Phân Tích Chiến Lược Marketing Y Khoa & Thẩm Mỹ cho TMV SERYN.
Bạn vừa cào được một danh sách các mẫu quảng cáo Facebook (Meta Ads Library) thô từ các đối thủ cạnh tranh dưới đây:
Hội đồng đối thủ: ${keywordsList.join(", ")}

Chi tiết ads thô:
${JSON.stringify(rawAdsData, null, 2)}

Hãy phân tích toàn bộ các thông điệp này và chuyển đổi thành một báo cáo tình báo marketing toàn diện so sánh các đối thủ với nhau và tổng hợp lên một bộ chỉ số thống nhất cho Dashboard của TMV SERYN dưới định dạng JSON.

Hãy tạo ra một JSON phản hồi có chính xác các key sau (tất cả nội dung sinh ra bằng TIẾNG VIỆT):
{
  "reportMeta": {
    "title": "Báo cáo Tình báo Hợp nhất Meta Ads Library: " + "${keywordsList.join(" vs ")}",
    "reportDate": "2026-06-03",
    "market": "Vietnam",
    "source": "Meta Ads via ScrapeCreators",
    "reportType": "Quét Live Hợp nhất",
    "summary": "Tóm tắt chiến lược marketing so sánh, trọng tâm dịch vụ và các thủ thuật dụ khách bằng khuyến mãi của từng đối thủ qua các mẫu quảng cáo vừa cào được."
  },
  "kpis": [
    // Tạo 4-6 KPIs số liệu phân tích tổng hợp từ đợt quét (ví dụ: Tổng đối thủ quét, Tổng ads active, Ads Trẻ hóa da, Chuyên gia/Bác sĩ làm KOL, Trọng tâm giảm giá...)
    { "label": string, "value": string|number, "change": string, "status": "positive"|"neutral"|"negative"|"warning", "description": string }
  ],
  "entities": [
    // Tạo 1-4 thực thể phân tích chi tiết cho TỪNG đối thủ trong danh sách quét
    {
      "id": string, // vd: "doi_thu_a"
      "name": string, // Tên thương hiệu đối thủ
      "category": string, // Phân khúc (e.g. "Spa phổ thông", "Clinic trung cấp", "Bệnh viện thẩm mỹ")
      "status": "Active (Mạnh)" | "Active" | "Silent",
      "metrics": {
        "Tổng Ads quét được": number,
        "Dịch vụ lõi": string,
        "Mức giá phễu": string,
        "Evergreen Format": string,
        "Mức độ đe dọa": string
      },
      "tags": string[], // danh sách nhãn dạng mảng, vd: ["Promo-Heavy", "KOL-Doctor"]
      "summary": string, // Phân tích chiến lược tổng quát của đối thủ này
      "observedInsights": string[], // Các insight thực tế ghi nhận từ nội dung ad text ở trên
      "inferredInsights": string[], // Các suy luận chiến lược sâu hơn về sản phẩm, dòng tiền, mục tiêu khách hàng của họ
      "recommendations": string[] // Các đề xuất cụ thể để SERYN thắng đối thủ này
    }
  ],
  "charts": [
    // Tạo 2 biểu đồ phân tích (1 donut về "Phân bổ nhóm dịch vụ", 1 bar về "Tỷ lệ định dạng nội dung hoặc phân phối lượng ads giữa các đối thủ")
    {
      "id": string,
      "title": string,
      "type": "donut"|"bar",
      "data": [ { "name": string, "value": number, "color": string } ],
      "xKey": "name" | "value",
      "yKey": "value" | "name",
      "description": string
    }
  ],
  "rankings": [
    {
      "title": "Bảng xếp hạng hiệu suất thông điệp giữa các đối thủ",
      "items": [
        { "name": string, "value": string|number, "rank": number, "description": string }
      ]
    }
  ],
  "insights": [
    // Tạo 3-4 insights chung cho thị trường và sự cạnh tranh của đối thủ này, phân biệt rõ các type: "observed", "inferred", "warning", "opportunity", "recommendation"
    {
      "title": string,
      "type": "observed" | "inferred" | "warning" | "opportunity" | "recommendation",
      "content": string,
      "priority": "high" | "medium" | "low",
      "evidence": string // Căn cứ thực tế trích từ câu chữ của ad text
    }
  ],
  "recommendations": [
    // Tạo ít nhất 2 khuyến nghị chiến lược cực cao tay cho SERYN để chống lại hoặc tận dụng khoảng trống của các đối thủ này
    {
      "title": string,
      "reason": string,
      "action": string,
      "priority": "high" | "medium" | "low",
      "expectedImpact": string,
      "kpiToTrack": string
    }
  ],
  "rawTables": [
    // Tạo danh sách flat objects cho phần Raw Data Explorer, tối thiểu cho từng đối thủ để người dùng dễ dàng lọc bên góc phải
    {
      "Thương hiệu": string,
      "Phân khúc": string,
      "Ads Active": string,
      "Dịch vụ nổi bật": string,
      "Định giá mồi": string,
      "Mức độ đe dọa": string
    }
  ]
}

LƯU Ý QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC & CẤM DỰ ĐOÁN OR THÊM THẮT:
- LOẠI BỎ TOÀN BỘ CÁC CHẾ ĐỘ MÔ PHỎNG / DỰ ĐOÁN. Mọi chỉ số của đối thủ phải phản ánh chính xác 100% theo dữ liệu đã spy (rawAdsData).
- Không tự bịa ra các số lượng ads hoặc các mức giá ảo nếu trong rawAdsData không có bất kỳ mẫu quảng cáo nào cho một đối thủ thương hiệu. Nếu một đối thủ không có mẫu quảng cáo nào trong rawAdsData, hãy đặt số lượng ads bằng 0, status thành "Silent" và để các trường như "Dịch vụ lõi", "Mức phí phễu" thành chuỗi rỗng "". Tuyệt đối không được tự ý điền bừa số liệu ảo.
- Bạn chỉ trả về CHÍNH XÁC một đối tượng JSON hợp lệ ở trên. Không bao bọc trong định dạng markdown, không ghi thêm chữ nào khác ngoài JSON.
- Đảm bảo tính nhất quán giữa KPIs, Charts, Rankings và Entities để biểu đồ hiển thị mượt mà.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const jsonText = response.text || "";
      let parsedResult;
      
      try {
        parsedResult = JSON.parse(jsonText.trim());
      } catch (parseErr) {
        console.error("Lỗi parse JSON từ Gemini, chuyển sang fallback generator:", parseErr, jsonText);
        parsedResult = createDefaultAnalyzedData(keywordsList, rawAdsData);
      }

      res.status(200).json({
        success: true,
        sandbox: usedSandbox,
        data: parsedResult
      });

    } catch (error: any) {
      console.error("Critical error in /api/spy-ads:", error);
      res.status(500).json({ error: error?.message || "Đã xảy ra lỗi nghiêm trọng khi xử lý phân tích." });
    }
  });

  // Handle Vite Asset Server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running beautifully on port ${PORT}`);
  });
}

// Fallback logic to generate realistic analysed structures if Gemini key or parse fails
function createDefaultAnalyzedData(keywords: string | string[], rawAds: any[]) {
  const list = Array.isArray(keywords) ? keywords : typeof keywords === "string" ? keywords.split(",").map(k => k.trim()) : ["Đối thủ"];
  
  const entities = list.map((kw, index) => {
    // Filter actual live spied ads by keyword
    const matchingAds = rawAds.filter(ad => 
      ad.originalKeyword === kw || 
      (ad.pageName && ad.pageName.toLowerCase().includes(kw.toLowerCase()))
    );
    const adsCount = matchingAds.length;

    if (adsCount > 0) {
      // Concatenate ad texts to extract information
      const textConcat = matchingAds.map(ad => ad.adText || "").join(" ").toLowerCase();
      
      let coreService = "Trải nghiệm Spa / Chăm sóc da";
      if (textConcat.includes("meso")) coreService = "Cấy Meso căng bóng";
      else if (textConcat.includes("hifu")) coreService = "Nâng cơ HIFU Pro";
      else if (textConcat.includes("mũi") || textConcat.includes("plasty")) coreService = "Nâng mũi cấu trúc";
      else if (textConcat.includes("mắt") || textConcat.includes("mí")) coreService = "Cắt mí Plasty";
      else if (textConcat.includes("laser") || textConcat.includes("nám")) coreService = "Trị nám Laser Pico";
      else if (textConcat.includes("triệt")) coreService = "Triệt lông băng tuyết";
      else if (textConcat.includes("hút mỡ")) coreService = "Hút mỡ Lipo Ultrasound";
      else if (textConcat.includes("thermage")) coreService = "Thermage FLX";
      else if (textConcat.includes("trẻ hóa")) coreService = "Trẻ hóa chuyên sâu";
      
      let priceFunnel = "Xem ad text";
      // Look for pricing inside the text
      const priceMatchList = textConcat.match(/(chỉ|từ|giá|còn)\s*([\d\.,]+[\s]*(k|tr|triệu|đ))/i);
      if (priceMatchList) {
        priceFunnel = priceMatchList[0];
      } else {
        const regexPrice = /[\d\.,]+[\s]*(k|triệu|đ)/i;
        const subMatch = textConcat.match(regexPrice);
        if (subMatch) {
          priceFunnel = `Từ ${subMatch[0]}`;
        }
      }

      let evergreenFormat = "Bài viết kèm hình ảnh";
      if (textConcat.includes("bác sĩ") || textConcat.includes("ts.bs") || textConcat.includes("thạc sĩ") || textConcat.includes("dung")) {
        evergreenFormat = "Bác sĩ KOL chứng nhận";
      } else if (textConcat.includes("video") || textConcat.includes("clip")) {
        evergreenFormat = "Video quy trình khách hàng";
      } else if (textConcat.includes("voucher") || textConcat.includes("off") || textConcat.includes("quà tặng") || textConcat.includes("ưu đãi")) {
        evergreenFormat = "Banner khuyến mãi ưu đãi";
      }

      const isHospital = textConcat.includes("bệnh viện") || kw.toLowerCase().includes("bệnh viện");

      return {
        id: `comp_${index + 1}`,
        name: kw,
        category: isHospital ? "Bệnh viện thẩm mỹ" : "Phòng khám / Clinic",
        status: "Active" as const,
        metrics: {
          "Tổng Ads quét được": adsCount,
          "Dịch vụ lõi": coreService,
          "Mức giá phễu": priceFunnel,
          "Evergreen Format": evergreenFormat,
          "Mức độ đe dọa": adsCount > 1 ? "Cao" : "Trung bình"
        },
        tags: textConcat.includes("giảm") || textConcat.includes("off") || textConcat.includes("khuyến mãi") ? ["Promo-Heavy"] : ["Chuyên môn"],
        summary: `Hệ thống ghi nhận ${adsCount} quảng cáo đang chạy thực tế của thương hiệu ${kw}. Nội dung quảng bá chính là điều trị ${coreService}.`,
        observedInsights: matchingAds.slice(0, 3).map(ad => ad.adText ? ad.adText.slice(0, 150) + "..." : "Tin đăng quảng cáo hoạt động"),
        inferredInsights: [
          `Đang sử dụng dịch vụ ${coreService} làm phễu thu hút tệp khách hàng.`,
          `Quảng cáo tập trung khai thác định dạng truyền thông ${evergreenFormat}.`
        ],
        recommendations: [
          `Phát triển phác đồ trẻ hóa sinh học tại SERYN Clinic để lấp khoảng trống dịch vụ phễu giá rẻ của ${kw}.`
        ]
      };
    } else {
      // Return completely blank/empty fields according to user constraint: "mọi chỉ số phải đúng, ko có thì để trống"
      return {
        id: `comp_${index + 1}`,
        name: kw,
        category: "",
        status: "Silent" as const,
        metrics: {
          "Tổng Ads quét được": 0,
          "Dịch vụ lõi": "",
          "Mức giá phễu": "",
          "Evergreen Format": "",
          "Mức độ đe dọa": ""
        },
        tags: [],
        summary: "",
        observedInsights: [],
        inferredInsights: [],
        recommendations: []
      };
    }
  });

  const activeCount = entities.filter(e => e.metrics["Tổng Ads quét được"] > 0).length;

  return {
    reportMeta: {
      title: `Báo cáo Tình báo Hợp nhất: ${list.join(" vs ")}`,
      reportDate: new Date().toISOString().split('T')[0],
      market: "Vietnam",
      source: "ScrapeCreators Meta Spy",
      reportType: "Quét Live Thực tế",
      summary: `Hệ thống phân tích đợt quét live đối thủ gồm ${list.join(", ")}. Ghi nhận ${activeCount} / ${list.length} đối thủ đang chạy quảng cáo hoạt động với tổng số ${rawAds.length} bài đăng.`
    },
    kpis: [
      {
        label: "Tổng đối thủ đã quét",
        value: list.length,
        change: "Đồng bộ",
        status: "positive",
        description: "Số lượng đối thủ được đưa vào giám sát"
      },
      {
        label: "Tổng Ads Spied",
        value: rawAds.length,
        change: "+ Live",
        status: rawAds.length > 0 ? "positive" : "neutral",
        description: "Số lượng tin quảng cáo thu thập được từ Meta Library"
      },
      {
        label: "Dịch vụ Quảng cáo cốt lõi",
        value: rawAds.length > 0 ? "Có hoạt động" : "",
        change: "",
        status: "neutral",
        description: "Chỉ số trống nếu không có dữ liệu thực tế"
      },
      {
        label: "Mức giá mồi trung bình",
        value: "",
        change: "",
        status: "neutral",
        description: "Để trống do không có dữ liệu thực"
      }
    ],
    entities,
    charts: [
      {
        id: "spied_services",
        title: "Phân bổ số lượng Ads quét được",
        type: "donut",
        data: entities.map(e => ({
          name: e.name,
          value: e.metrics["Tổng Ads quét được"],
          color: "#06b6d4"
        })).filter(d => d.value > 0),
        xKey: "value",
        yKey: "name",
        description: "Cơ cấu lượng ads thực của đối thủ hoạt động"
      }
    ],
    rankings: [
      {
        title: "Bảng xếp hạng hiệu suất số lượng quảng cáo",
        items: entities.map((e, idx) => ({
          name: e.name,
          value: e.metrics["Tổng Ads quét được"],
          rank: idx + 1,
          description: e.metrics["Tổng Ads quét được"] > 0 ? "Active" : "Silent"
        })).sort((a, b) => b.value - a.value)
      }
    ],
    insights: rawAds.length > 0 ? [
      {
        title: "Ghi nhận biến động đối thủ",
        type: "observed",
        content: `Phát hiện tổng cộng ${rawAds.length} quảng cáo đang chạy thực tế từ những đối thủ trong lượt quét này.`,
        priority: "medium",
        evidence: "Số liệu được cập nhật trực tuyến qua tệp dò quét."
      }
    ] : [],
    recommendations: [],
    rawTables: entities.map(e => ({
      "Thương hiệu": e.name,
      "Phân khúc": e.category,
      "Ads Active": e.metrics["Tổng Ads quét được"] > 0 ? "Active" : "Silent",
      "Dịch vụ nổi bật": e.metrics["Dịch vụ lõi"],
      "Định giá mồi": e.metrics["Mức giá phễu"],
      "Mức độ đe dọa": e.metrics["Mức độ đe dọa"]
    }))
  };
}

startServer();
