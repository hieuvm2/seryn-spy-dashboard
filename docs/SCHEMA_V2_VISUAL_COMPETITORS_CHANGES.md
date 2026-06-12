# Schema v2 — Visual Intelligence · Competitor Setup · Weekly Change Insights

Nâng cấp này thêm **5 tab Google Sheets** (đều tùy chọn — thiếu/trống thì dashboard
vẫn chạy bằng fallback/derived, không crash). Pipeline `npm run spy:weekly` tự sinh
4 tab đầu; tab `Competitors` được dashboard ghi qua Apps Script.

> ⚠️ Sau khi dán Apps Script mới (`docs/google-apps-script-web-api.js`) phải **Deploy → New version**
> để doGet trả các tab v2 và doPost ghi được tab `Competitors`.

---

## 1) Tab `Visual Analysis` (pipeline ghi)

Header (dòng 1):
```
ad_id, brand, page_id, creative_type, media_url, thumbnail_url, snapshot_url, image_urls,
video_preview_url, has_media_asset, text_overlay_raw, text_overlay_summary, offer_from_visual,
claim_from_visual, risk_terms_from_visual, visual_format, visual_angle, human_presence,
doctor_presence, before_after_presence, text_overlay_presence, offer_visual_presence,
clinical_score, beauty_luxury_score, ugc_score, trust_signal_score, offer_visibility_score,
scroll_stop_score, confidence_score, confidence_reason, visual_risk_level, risk_reasons,
claim_risk_score, before_after_risk, medical_claim_risk, promotion_claim_risk,
visual_insight_summary, seryn_action, last_seen_date
```
- `creative_type`: image | video | carousel | unknown
- `visual_format`: before_after | doctor_expert | ugc_selfie | clinic_room | product_packshot | testimonial_screenshot | offer_banner | luxury_beauty | educational | unknown
- `*_presence`, `has_media_asset`: TRUE/FALSE · `*_score`: 0–100 · `confidence_score`: 0–1
- `*_risk` / `visual_risk_level`: low | medium | high · `seryn_action`: copy|adapt|counter|avoid|monitor
- Mảng (`image_urls`, `risk_terms_from_visual`, `risk_reasons`) lưu JSON string.
- **Thiếu media thật** (provider chưa trả thumbnail) → vẫn tạo record, `has_media_asset=FALSE`,
  UI hiển thị *"limited analysis — no media asset"* và hạ confidence.

## 2) Tab `Brand Visual Summary` (pipeline ghi)
```
brand, week_date, total_creatives, before_after_rate, doctor_rate, ugc_rate, offer_banner_rate,
high_risk_rate, avg_clinical_score, avg_luxury_score, top_visual_formats, dominant_visual_angle, notes
```
(`*_rate` 0–1).

## 3) Tab `Visual Pattern Analysis` (pipeline ghi)
```
id, week_date, brand, visual_format, visual_angle, hook_type, offer_type, ad_count, is_signal,
representative_ad_id, summary, recommended_seryn_response
```
`is_signal=TRUE` khi ≥3 ad cùng (brand + visual_format + visual_angle + offer).

## 4) Tab `Weekly Change Insights` (pipeline ghi)
```
id, brand, week_start, previous_week_start, change_type, severity, confidence_score,
summary, evidence, affected_ads, previous_value, current_value, recommended_action
```
- `change_type`: new_ad, stopped_ad, relaunched_ad, new_variant, new_campaign_theme, offer_changed,
  hook_changed, service_focus_shifted, visual_format_shifted, brand_scaled_up, brand_scaled_down,
  new_page_detected, page_inactive, same_concept_new_variants
- `severity`: low|medium|high · `confidence_score`: 0–1 · `recommended_action`: copy|adapt|counter|monitor|ignore
- `affected_ads`: "id|id". Tab cũ `Weekly Strategy Change` **vẫn giữ nguyên** (không phá dữ liệu cũ);
  nếu tab này trống, dashboard tự map từ tab cũ (confidence ~0.5).

## 5) Tab `Competitors` (dashboard đọc/ghi + pipeline đọc)

Header **giữ 5 cột pipeline đầu** (tương thích ngược) + metadata dashboard:
```
brand_name, page_ids, page_urls, active, notes, category, last_crawled_at, last_status, id
```
- Pipeline `weekly-spy-sync.mjs` chỉ đọc `brand_name, page_ids, page_urls, active, notes` → không ảnh hưởng.
- Dashboard (Competitor Setup) đọc qua `GET ?type=competitors`, ghi qua `POST {type:"competitors", action:"upsert"|"delete", record}`.
- `id` = `cmp-<slug(brand)>` (ổn định để upsert khớp). `page_ids` nhiều id ngăn cách bằng `|`.
- Nếu Apps Script chưa hỗ trợ ghi → dashboard lưu **localStorage draft** + cảnh báo
  *"Local draft only — sync endpoint not configured"*.

---

## Biến môi trường mới
| Biến | Mặc định | Dùng cho |
|---|---|---|
| `VISUAL_ANALYSIS_PROVIDER` | `heuristic` | pipeline — `heuristic` (MVP) hoặc `ai` (sau này) |
| `VISUAL_ANALYSIS_API_KEY` | (trống) | dành cho AI vision/OCR sau này (server-side, không vào frontend) |

Frontend **không** cần env mới — Visual Intelligence tự derive từ `Ad Level Analysis` nếu thiếu tab `Visual Analysis`.
