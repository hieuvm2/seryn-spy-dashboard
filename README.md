# Hệ Thống Tự Động Phân Tích Báo Cáo & Tạo Dashboard SaaS (Seryn Intell)

Chào mừng bạn đến với **Seryn Intell Auto SaaS Dashboard Analyzer** — ứng dụng phân tích dữ liệu và tự động tạo dashboard trực quan hóa cao cấp giành riêng cho các nhóm hoạch định chiến lược, marketing và Business Intelligence (BI).

Ứng dụng của bạn đã được cấu trúc lại hoàn chỉnh, đạt chuẩn Responsive, hỗ trợ chế độ tối (Default Dark Mode) sang trọng và khả năng nhận diện dữ liệu động thông minh từ 5 định dạng file khác nhau.

---

## 🚀 Các Tính Năng Cốt Lõi

1. **Bộ Đọc Trích Xuất Phao Cứu Sinh (Dynamic Live File Parser)**:
   - Hỗ trợ tải trực tiếp các tệp: **Markdown (`.md`)**, **CSV (`.csv`)**, **Excel (`.xlsx` / `.xls`)**, **JSON (`.json`)**, và **Plain Text (`.txt`)**.
   - Tích hợp công cụ phân tích cấu trúc bảng, dòng, bullet list để tách bạch hai khái niệm:
     - **Observed**: Dữ liệu kiểm nghiệm thực tế từ Ad Library (Không tự bịa số).
     - **Inferred**: Nhận định định vị chiến thuật sâu sắc dựa trên tương quan số liệu (Đánh nhãn rõ ràng).
   - Đảm bảo cơ chế tự phục hồi, chống đổ vỡ (Anti-crash) khi tệp tin tải lên bị thiếu trường dữ liệu hoặc rỗng.

2. **Executive Summary & KPIs**:
   - Tự động thống kê số thương hiệu đang theo dõi, tỉ lệ Active, top đối thủ nặng ký, và tổng khối lượng tương tác số học mà không hard-code.

3. **Bảng Xếp Hạng Động (Leaderboard & Progress Performance)**:
   - Minh họa thứ bậc các đối thủ kèm mô tả chi tiết bằng các thanh Progress bar màu Cyan-to-Indigo hiện đại.
   - Bấm chọn bất kỳ dòng thương hiệu nào sẽ kích hoạt Drawer xem chi tiết.

4. **Biểu Đồ Trực Quan (Recharts Center)**:
   - Biểu đồ Donut phân chia tỷ trọng phân khúc thị trường.
   - Biểu đồ Bar phân bổ định dạng nội dung sáng tạo (Offer, Doctor Explainer, Testimonial).

5. **Entity Detail Slider Drawer (Trượt Xem Chi Tiết)**:
   - Bảng trượt cực mịn từ cạnh phải màn hình hiển thị toàn bộ chỉ số, điểm mạnh, rủi ro y khoa, và đề xuất hành động tương ứng cho thương hiệu được nhấp chọn.

6. **Insights & Recommendations Hub**:
   - Bộ lọc và nhãn đánh giá độ ưu tiên (High / Medium / Low) giúp khoanh vùng hoạt động khẩn cấp.

7. **Trình Khám Phá Dữ Liệu Thô (Raw Data Explorer)**:
   - Tìm kiếm từ khóa thời gian thực, lọc nhanh theo trạng thái/phân khúc, sắp xếp (sorting) chiều cột số học hoặc chữ cái, cùng nút **Xuất CSV** xuất xưởng dữ liệu ngay tại chỗ.

8. **Giao Diện Premium Dark Theme**:
   - Được phối sắc theo gam màu chuyên nghiệp của các SaaS hàng đầu: Space Navy (`#020617`), Slate (`#0f172a`), Cyan (`#06b6d4`), và Emerald (`#10b981`), mang lại cảm giác cực kì hiện đại, dễ đọc, trực quan.

---

## 🛠️ Cài Đặt & Khởi Chạy

Bạn có thể chạy dự án ở môi trường cục bộ thông qua các bước đơn giản sau:

### 1. Cài đặt các thư viện bổ trợ:
```bash
npm install
```

### 2. Khởi động máy chủ phát triển (Development Server):
```bash
npm run dev
```
Dự án sẽ khởi tạo và lắng nghe tại đường dẫn mặc định `http://localhost:3000`.

### 3. Biên dịch bản phân phối Production tối ưu hóa:
```bash
npm run build
```
Bộ biên dịch `vite build` và `typescript` dạng biên dịch sạch `--noEmit` sẽ tự động bảo vệ dự án khỏi các lỗi cú pháp.

---

## 📁 Cấu Trúc Thư Mục Dự Án

* 📄 `/src/types.ts`: Khai báo các mô hình dữ liệu cứng, đảm bảo an toàn kiểu kiểm soát (Type-safe).
* 📄 `/src/sampleData.ts`: Lưu trữ bộ dữ liệu mẫu mặc định khởi tạo dựa trên Báo Cáo "SERYN Weekly Competitor Ads Intelligence Report" đã được bạn cung cấp.
* 📁 `/src/utils/parser.ts`: Chứa 5 lõi bóc tách tài liệu CSV, Markdown, Text, Excel, JSON và hàm heuristic tự động chuẩn hóa data.
* 📁 `/src/components/`:
  * `Sidebar.tsx`: Điều hướng liên kết trượt êm ái.
  * `TopHeader.tsx`: Thanh header đầu trang hiển thị thông tin metadata báo cáo và nút thao tác nhanh.
  * `KpiCard.tsx`: Thẻ chỉ số kèm nhãn xu hướng.
  * `ChartCard.tsx`: Nền tảng vẽ sơ đồ Responsive với Recharts.
  * `InsightCenter.tsx`: Lọc phân loại các quan sát nhận định.
  * `RecommendationCenter.tsx`: Khung chiến thuật hành động của SERYN.
  * `ComparisonPanel.tsx`: So sác giữa baseline và WoW (Tuần tiếp theo).
  * `RawDataExplorer.tsx`: Bộ lưới bảng danh sách toàn khối dữ liệu.
  * `UploadPanel.tsx`: Khung kéo thả tải file báo cáo và giả lập nhanh file mẫu.

---

Ứng dụng đã hoàn thành chuẩn xác, biên dịch thành công và sẵn sàng để nghiệm thu! Bạn có thể bắt đầu tải lên báo cáo thử nghiệm của các tuần tiếp theo để theo dõi biến động thị trường.
