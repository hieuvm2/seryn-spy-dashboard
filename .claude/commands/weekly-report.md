---
description: Tạo/cập nhật báo cáo phân tích spy ads tuần cho SERYN và đẩy lên dashboard
---

Tạo/cập nhật BÁO CÁO PHÂN TÍCH tuần cho SERYN rồi đẩy lên dashboard. Làm tuần tự, dừng nếu bước nào lỗi:

1. Chạy `node scripts/report-export.mjs` — đọc dữ liệu spy đối thủ MỚI NHẤT từ Supabase → `report-input.json`
   (đã tách SERYN khỏi đối thủ). Nếu báo thiếu `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` thì dừng + báo rõ.
2. Đọc `report-input.json` (market, competitors[], seryn.ads_detail, scaledContent, hookClusters, visualPatterns).
   Áp khung phân tích: đọc `.claude/skills/marketing-psychology/SKILL.md`, `.claude/skills/ads/SKILL.md`,
   `.claude/skills/offers/SKILL.md`, `.claude/skills/ad-creative/SKILL.md`, `.claude/skills/copywriting/SKILL.md`.
3. Viết `report-out.json`:
   `{"week":{"period_start":"<market.week lùi 6 ngày, YYYY-MM-DD>","period_end":"<market.week>"},"report":{ 8 field }}`
   8 field (executive_summary là 1 chuỗi 5-6 câu; còn lại là mảng string):
   executive_summary · key_competitor_moves (8-12, "Brand: động thái") · notable_content_patterns (5-8, có bằng chứng) ·
   notable_visual_patterns (3-6, kèm benchmark SERYN) · risk_warnings (4-8; mục nội bộ bắt đầu "Nội bộ SERYN: ") ·
   seryn_implications (5-8 "Chủ đề: nội dung") · recommended_actions (5-8 "[Ưu tiên cao|Trung bình|Thấp] … (classify: …)") ·
   seryn_benchmark (4-8 "Chỉ số: SERYN vs thị trường có số").
4. Chạy `node scripts/report-push.mjs report-out.json --apply` để đẩy lên dashboard.
5. Báo lại: KPI + số mục mỗi field + xác nhận đã lên dashboard.

TUÂN THỦ TUYỆT ĐỐI (xem CLAUDE.md): KHÔNG template/câu sinh sẵn — mọi dòng là phân tích CỤ THỂ, dẫn brand/số/hook
thật, mỗi mục KHÁC nhau. Tiếng Việt đời thường, dễ hiểu. Tông premium/điềm tĩnh; không FOMO/hù dọa lão hóa/đua giá/
công kích đối thủ; nói hiệu quả kèm "kết quả tùy cơ địa". KHÔNG thêm câu "không có số liệu chi phí/spend/CPA…".
SERYN là own brand, KHÔNG tính vào đối thủ.
