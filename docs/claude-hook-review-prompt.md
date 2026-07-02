# SERYN — Claude Hook Review Prompt (manual weekly)

Dùng prompt này mỗi tuần để Claude tinh chỉnh các hook pattern được hệ thống
heuristic gắn cờ `needs_claude_hook_review=true` (xem tab **Hook Intelligence**,
cột `needs_claude_hook_review`, hoặc các dòng `source=hook_intelligence` trong
**SERYN Content Recommendations**).

Hệ thống đã gắn cờ khi: hook_strength_score cao nhưng confidence thấp; risk_score
cao; pattern mới xuất hiện ở nhiều brand; hoặc cụm có nhiều ad nhưng category=unknown.

> Nguyên tắc: chỉ học **structure / angle**, KHÔNG copy nguyên văn đối thủ.
> Đây là **competitor hook signal** (tín hiệu lặp/bền), KHÔNG gọi “winning hook”.
> Viết theo hướng an toàn claim ngành clinic/thẩm mỹ.

---

## Prompt

```
Bối cảnh: SERYN Clinic — trẻ hóa da, định vị khoa học, điềm tĩnh, cao cấp;
không FOMO, không hù dọa tuổi tác, không tấn công đối thủ.

Hãy đọc các hook pattern có needs_claude_hook_review=true trong tab Hook Intelligence
(service_category = skin_rejuvenation). Với MỖI pattern, phân tích:

1. Hook này đánh vào pain/desire nào?
2. Vì sao đối thủ dùng hook này (động cơ + funnel stage họ nhắm)?
3. Hook này phù hợp awareness / consideration / conversion?
4. Có offer / proof nào đi kèm không?
5. Có rủi ro claim không? Nếu có, liệt kê cụm từ rủi ro + bản an toàn.
6. SERYN nên: copy_structure / adapt_angle / counter_positioning / avoid_due_to_risk / monitor / test_now? (giải thích ngắn)
7. Viết lại thành 3 phiên bản content chạy ads (tiếng Việt, an toàn claim):
   - short copy (1–2 câu)
   - medium copy (3–5 câu)
   - long copy (storytelling nhẹ + education + consultation/offer)
8. Tạo thêm:
   - 5 headline (rõ lợi ích, không giật tít quá đà)
   - 5 CTA (Nhắn tin tư vấn / Đặt lịch soi da / Nhận tư vấn da / Kiểm tra tình trạng da / Xem liệu trình phù hợp)
   - 3 gợi ý mở video 3 giây (visual hook / voiceover hook / text overlay hook)
   - messenger script angle (câu mở inbox → phân loại tình trạng da → chốt lịch soi da)
   - landing page angle (hero headline / subheadline / proof block / CTA block / form angle)
9. KHÔNG copy nguyên văn đối thủ — chỉ học structure/angle.
10. An toàn claim: tránh "trẻ hơn 10 tuổi", "xóa sạch nếp nhăn", "trị dứt điểm",
    "hiệu quả 100%". Dùng "hỗ trợ cải thiện dấu hiệu lão hóa", "giúp da trông căng
    mịn hơn", "kết quả tùy cơ địa và tình trạng da".

Xuất kết quả dạng bảng/JSON để dán lại vào SERYN Content Recommendations
(các cột: ad_copy_short/medium/long, headline_options, cta_options,
video_opening_3s, messenger_script_angle, landing_page_angle, claim_safe_version,
recommended_seryn_action, confidence_score).
```

---

## Quy trình

1. Mở tab **Hook Intelligence** → lọc `needs_claude_hook_review = TRUE`.
2. Chạy prompt trên với Claude.
3. Dán output đã tinh chỉnh vào tab **SERYN Content Recommendations**
   (các dòng `source = hook_intelligence`, đúng `source_hook_cluster_id`).
4. Dashboard hiển thị bản cập nhật trong **drawer hồ sơ brand** (mục hook clusters / recommendations)
   sau khi dữ liệu sync về (Supabase/Apps Script).

Heuristic tự động chạy bằng: `npm run hooks:analyze`.
