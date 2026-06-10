export interface MockAdItem {
  id: string;
  pageName: string;
  pageAvatar: string;
  startDate: string;
  status: "active" | "inactive";
  platforms: ("facebook" | "instagram" | "messenger" | "audience")[];
  adText: string;
  mediaType: "video" | "image";
  mediaUrl?: string;
  mediaTitle: string;
  mediaDesc: string;
  ctaText: string;
}

export const MOCK_ADS_BY_COMPETITOR: Record<string, MockAdItem[]> = {
  thucuc: [
    {
      id: "ad-tc-1",
      pageName: "Bệnh Viện Thẩm Mỹ Thu Cúc",
      pageAvatar: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 01/06/2026",
      status: "active",
      platforms: ["facebook", "instagram", "messenger"],
      adText: "🔥 ĐẠI TIỆC TRẺ HÓA - NÂNG CƠ HiFU PRO CHỈ 6.5TR! Duy nhất tuần này tại Hệ Thống Thu Cúc.\n\n👉 Lấy lại 10 năm xuân thì sau 60 phút thực hiện. Săn ngay suất giảm giá tột đỉnh để hồi sinh làn da thô sần, kéo căng rãnh cười rỗng hóp.\n❌ Không xâm lấn, không đau đớn, không cần nghỉ dưỡng. Cam kết hiệu quả đo lường bằng văn bản y khoa!",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Nâng Cơ HiFU MULTI-DEPTH - Đợt Cuối Năm 2026",
      mediaDesc: "Đồng giá ưu đãi từ 6.5 Triệu • Nhận ưu đãi qua Messenger",
      ctaText: "Gửi tin nhắn"
    },
    {
      id: "ad-tc-2",
      pageName: "Thu Cúc Thẩm Mỹ HN - SG",
      pageAvatar: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 28/05/2026",
      status: "active",
      platforms: ["facebook", "messenger"],
      adText: "👃 NÂNG MŨI THÁI PLASTY - ƯU ĐÃI CHƯA BẰNG CHIẾC IPHONE 17 PRO MAX!\n\nNhận ngay combo nâng sống mũi siêu nhẹ TC-Form + bọc đầu mũi sụn tự thân tạo hình chuẩn tỉ lệ vàng. Khắc phục hoàn toàn khuyết điểm mũi tẹt, hếch, lệch vách ngăn.\n⚡ Hỗ trợ trả góp 0% lãi suất. Click ngay tư vấn trực tiếp cùng Thạc sĩ, Bác sĩ Trưởng khoa Thẩm mỹ.",
      mediaType: "video",
      mediaUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Nâng Mũi Plasty Chuẩn Tỉ Lệ Vàng Châu Á",
      mediaDesc: "Đợt Đăng Ký Có Hạn • Chỉ 50 Suất Trong Ngày",
      ctaText: "Đăng ký ngay"
    }
  ],
  jw_hanquoc: [
    {
      id: "ad-jw-1",
      pageName: "TS.BS Nguyễn Phan Tú Dung - Bệnh viện JW",
      pageAvatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 02/06/2026",
      status: "active",
      platforms: ["facebook", "instagram", "messenger", "audience"],
      adText: "👨‍⚕️ THĂM KHÁM TRỰC TIẾP CÙNG TS.BS NGUYỄN PHAN TÚ DUNG\n\nPhác đồ Cải Lão Diệu Kỳ trẻ hóa 5 IN 1: Giải quyết rệt ròi nếp nhăn bọng mắt bằng kỹ thuật SMAS Pro, bù đắp thể tích rỗng hóp rãnh má bằng cấy mỡ tự thân Baby Face y khoa chuẩn.\n✨ Kiến tạo độ căng bóng tự nhiên dựa trên nền tảng sinh học phục hồi, hạn chế tối đa xâm lấn thô bạo.",
      mediaType: "video",
      mediaUrl: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "TS.BS Tú Dung Giải Thích Giải Phẫu Trẻ Hóa Đa Tầng",
      mediaDesc: "Bệnh viện Thẩm mỹ JW Hàn Quốc chuẩn y khoa",
      ctaText: "Tìm hiểu thêm"
    },
    {
      id: "ad-jw-2",
      pageName: "Bệnh viện Thẩm mỹ JW Hàn Quốc",
      pageAvatar: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 30/05/2026",
      status: "active",
      platforms: ["facebook", "messenger"],
      adText: "✨ MIDFACE 3-IN-1: Đánh bay bọng mỡ mắt, xóa nhăn rãnh cười rỗng hóp.\n\nKỹ thuật đặc biệt can thiệp cơ vòng mi dưới, treo cơ má lên trên giúp nâng toàn bộ vùng cơ chảy xệ, đồng thời tái phân bố mỡ mi mắt tự nhiên.\n👉 Không dùng chất làm đầy công nghiệp. Trẻ hóa bền vững lấy lại 10-15 tuổi sinh học.",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Căng Cơ Midface 3in1 Độc Quyền Y Khoa",
      mediaDesc: "Trực tiếp tiến hành tại phòng mổ áp lực dương vô trùng",
      ctaText: "Đăng ký tư vấn"
    }
  ],
  lavender_by_chang: [
    {
      id: "ad-lv-1",
      pageName: "Lavender By Chang Luxury",
      pageAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 03/06/2026",
      status: "active",
      platforms: ["facebook", "instagram", "messenger"],
      adText: "👑 ĐẠI TIỆC TRI ÂN SINH NHẬT CEO LỚN NHẤT NĂM: OFF TỚI 55% + QUÀ TẶNG 70 TRIỆU!\n\nĐồng hành cùng danh ca Đan Trường và CEO Chang chạm tới đỉnh cao làn da căng bóng ngọc ngà nhờ siêu phẩm trẻ hóa y học thượng lưu Nanocell Diamond & Thermage FLX 2026.\n💎 Cam kết phục hồi độ đàn hồi tế bào tức thì, nâng cơ thon gọn tức thì sau một liệu trình xa hoa.",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Trải Nghiệm Trẻ Hóa Thượng Lưu Cùng Ca Sĩ Đan Trường",
      mediaDesc: "Đại Tiệc Tri Ân Đặc Quyền - Số lượng Giới Hạn",
      ctaText: "Gửi tin nhắn"
    },
    {
      id: "ad-lv-2",
      pageName: "Lavender By Chang",
      pageAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 26/05/2026",
      status: "active",
      platforms: ["facebook", "instagram"],
      adText: "💎 SIÊU CÔNG NGHỆ THERMAGE FLX THẾ HỆ MỚI\n\nTập trung trẻ hóa vùng mắt nhăn sâu, rãnh má sụp xệ bằng sóng vô tuyến điện dung độc quyền từ Hoa Kỳ. Thắt chặt mạng lưới collagen đứt gãy bên dưới trung bì.\n🌟 Đẳng cấp được khẳng định bởi hơn 20.000 chính khách và hoa hậu hàng đầu Việt Nam tin tưởng.",
      mediaType: "video",
      mediaUrl: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Thermage FLX Mỹ Chuẩn Chứng Nhận FDA",
      mediaDesc: "Check code đầu tip thật trực tiếp trước khi làm",
      ctaText: "Tìm hiểu thêm"
    }
  ],
  seoul_center: [
    {
      id: "ad-sc-1",
      pageName: "Hệ Thống Thẩm Mỹ Quốc Tế Seoul Center",
      pageAvatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 01/06/2026",
      status: "active",
      platforms: ["facebook", "messenger"],
      adText: "🎁 ĐỒNG GIÁ TRẢI NGHIỆM 159K PHỤC HỒI BIỂU PHÌ - TRẺ HÓA KHÔNG KIM!\n\nLiệu trình Meso không kim đa tầng độc quyền cứu cánh làn da thâm, xỉn màu, sần ráp, rỗng lỗ chân lông. Hồi phục màng ẩm tự nhiên chỉ sau 45 phút thư giãn.\n🌟 Áp dụng cho toàn bộ tệp khách hàng văn phòng đăng ký hôm nay qua m.me!",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "ĐĂNG KÝ GIỜ VÀNG - Trải Nghiệm Meso Đồng Giá 159K",
      mediaDesc: "Chỉ áp dụng tại 45 Chi nhánh Toàn quốc",
      ctaText: "Gửi tin nhắn"
    }
  ],
  kangnam: [
    {
      id: "ad-kn-1",
      pageName: "Bệnh Viện Thẩm Mỹ Kangnam",
      pageAvatar: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 02/06/2026",
      status: "active",
      platforms: ["facebook", "instagram", "messenger"],
      adText: "👁️ KIẾN TẠO MẮT ĐẸP CHỈ 30 PHÚT - CÔNG NGHỆ CẮT MÍ PLASTY ĐỘC QUYỀN\n\nXóa tan bọng mỡ mắt, tạo nếp mí tự nhiên siêu mảnh chuẩn Hàn, không sưng bầm không cần cắt chỉ dài ngày. Sở hữu đôi mắt có hồn tươi tắn rạng rỡ ngay lập tức.\n👉 Giảm 40% chi phí khi đăng ký theo cặp bạn bè hoặc nhóm KOCs.",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Cận Cảnh Kết Quả Cắt Mí Toàn Diện Tại Phòng Livestream",
      mediaDesc: "Trực tiếp thực hiện bởi Ekip chuẩn Hàn Quốc",
      ctaText: "Gửi tin nhắn"
    }
  ],
  shynh_house: [
    {
      id: "ad-sh-1",
      pageName: "Shynh House - Thẩm Mỹ & Spa",
      pageAvatar: "https://images.unsplash.com/photo-1607990283143-e81e7a2c93ab?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 01/06/2026",
      status: "active",
      platforms: ["facebook", "instagram", "messenger"],
      adText: "🔋 TRẺ HÓA CHUẨN Y KHOA: Hi-Trulift Pro nâng cơ sâu từng milimet biểu mô.\n\nTác động xóa cơ nọng cằm lỏng lẻo, tạo khuôn mặt thon gọn hàm V-line sắc sảo. Nghiên cứu thực hiện dưới góc nhìn bác sĩ chuyên môn y khoa Shynh House.\n💬 Click để bác sĩ trưởng chi nhánh trực tiếp tư vấn phác đồ phân tích nếp nhăn.",
      mediaType: "video",
      mediaUrl: "https://images.unsplash.com/photo-1512290901897-306364a8994c?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Hi-Trulift Pro 2026: Nâng Cơ Sâu Theo Phác Đồ Y Khoa",
      mediaDesc: "Tư vấn và phân tích da cơ bản miễn phí",
      ctaText: "Nhận báo giá"
    }
  ],
  lg_clinic: [
    {
      id: "ad-lg-1",
      pageName: "LG Clinic - Hệ Thống Viện Hàn Quốc",
      pageAvatar: "https://images.unsplash.com/photo-1557555187-23d685287bc3?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 31/05/2026",
      status: "active",
      platforms: ["facebook", "messenger"],
      adText: "❄️ SIÊU PHỄU TRIỆT LÔNG CẢM GIÁC LẠNH -8°C BẢO HÀNH TRỌN ĐỜI CHỈ 600K/10 BUỔI!\n\nXóa sổ 99% nang lông cứng đầu vùng nách và bikini cực kỳ nhẹ nhàng mát rượi, không sưng đỏ rát ngứa.\n🎁 Tặng kèm gói trị thâm Laser y khoa bảo chứng chất lượng trong ngày hôm nay kịch sàn m.me!",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Combo Triệt Lông Lạnh Âm Độ Sâu Sạch Mịn Da",
      mediaDesc: "Đã có 12.000 khách hàng đăng ký trải nghiệm thành công",
      ctaText: "Gửi tin nhắn"
    }
  ],
  gangwhoo: [
    {
      id: "ad-gw-1",
      pageName: "Bệnh Viện Thẩm Mỹ Gangwhoo",
      pageAvatar: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã kích hoạt vào 30/05/2026",
      status: "active",
      platforms: ["facebook", "messenger"],
      adText: "⚡ HÚT MỠ NỌNG CẰM KHÔNG SẸO LIPO ULTRASOUND GIẢM NGAY 50% GIỜ VÀNG!\n\nĐánh bay lớp mỡ trùng rỗng sụp xệ xung quanh nọng hàm, kéo dãn cơ cổ thanh thoát thon lọn. Trải nghiệm nhanh 45 phút công nghệ siêu tần sóng siêu âm không lo xơ cứng rát ngứa.\n👉 Giới hạn chỉ áp dụng ưu đãi cho khách hàng đăng ký sớm nhất.",
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&auto=format&fit=crop&q=80",
      mediaTitle: "Công Nghệ Ultrasound Hút Mỡ Nọng Hàm Góc Nghiêng",
      mediaDesc: "Đăng ký nhận mã code giảm giá 50% trực tiếp",
      ctaText: "Gửi tin nhắn"
    }
  ]
};

export function getMockAdsForBrand(brandName: string, brandId?: string): MockAdItem[] {
  // Let's normalize name
  const normalizedName = brandName.toLowerCase();
  
  if (brandId && MOCK_ADS_BY_COMPETITOR[brandId]) {
    return MOCK_ADS_BY_COMPETITOR[brandId];
  }
  
  // Tag matchers
  if (normalizedName.includes("thu cúc") || normalizedName.includes("thucuc")) {
    return MOCK_ADS_BY_COMPETITOR.thucuc;
  }
  if (normalizedName.includes("jw") || normalizedName.includes("tú dung")) {
    return MOCK_ADS_BY_COMPETITOR.jw_hanquoc;
  }
  if (normalizedName.includes("lavender") || normalizedName.includes("by chang")) {
    return MOCK_ADS_BY_COMPETITOR.lavender_by_chang;
  }
  if (normalizedName.includes("seoul center") || normalizedName.includes("seoulcenter")) {
    return MOCK_ADS_BY_COMPETITOR.seoul_center;
  }
  if (normalizedName.includes("kangnam")) {
    return MOCK_ADS_BY_COMPETITOR.kangnam;
  }
  if (normalizedName.includes("shynh")) {
    return MOCK_ADS_BY_COMPETITOR.shynh_house;
  }
  if (normalizedName.includes("lg") || normalizedName.includes("lg clinic")) {
    return MOCK_ADS_BY_COMPETITOR.lg_clinic;
  }
  if (normalizedName.includes("gangwhoo")) {
    return MOCK_ADS_BY_COMPETITOR.gangwhoo;
  }

  // Fallback dynamic generator matching name
  return [
    {
      id: `ad-fallback-${brandId || "unkn"}-1`,
      pageName: brandName,
      pageAvatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?w=80&auto=format&fit=crop&q=60",
      startDate: "Đã phát hiện chiến dịch mới tuân này",
      status: "active",
      platforms: ["facebook", "messenger"],
      adText: `🔥 CHIẾN DỊCH TRẺ HÓA TIÊU BIỂU GẦN ĐÂY BỞI ${brandName.toUpperCase()}.\n\nTập trung giới thiệu liệu trình nâng cơ sâu và thắt chặt bọc sợi Collagen lão hóa. Áp dụng ưu đãi đợt tư vấn đầu mùa hè, hỗ trợ phân tích da 3D trực quan.\n👉 Nhấp vào 'Gửi tin nhắn' để nhận thông số bảng giá chính xác nhất từ hệ thống trợ lý.`,
      mediaType: "image",
      mediaUrl: "https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=600&auto=format&fit=crop&q=80",
      mediaTitle: `Xu hướng Trẻ Hóa Công Nghệ Mới Nhất • ${brandName}`,
      mediaDesc: "Đăng ký sớm nhận gói chẩn đoán da cá nhân hóa",
      ctaText: "Gửi tin nhắn"
    }
  ];
}
