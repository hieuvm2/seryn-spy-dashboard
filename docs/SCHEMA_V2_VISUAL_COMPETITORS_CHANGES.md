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
- `media_url`/`thumbnail_url`: URL ảnh/video thật từ ScrapeCreators (token fbcdn hết hạn sau ~vài ngày).
- `creative_signature`: gom creative giống nhau (ưu tiên `coll-<collation_id>` của Facebook → vân tay
  tên file ảnh → key heuristic). `cluster_size`: số ad cùng signature.
- **Thiếu media thật** → vẫn tạo record, `has_media_asset=FALSE`, UI báo *"limited analysis — no media asset"*, confidence thấp.

### Quy trình review visual định kỳ (đọc ảnh thật — không tốn phí AI)
Gom creative giống nhau để chỉ phân tích 1 đại diện/cụm rồi áp cho cả cụm:
```
npm run spy:weekly                 # pipeline lưu media_url + creative_signature + cluster_size
npm run visual:fetch -- 40         # gom cụm, tải 40 ảnh đại diện (cụm lớn nhất) -> work/visual_review/
#   → xem ảnh, điền work/visual_review/analysis.json (mỗi entry 1 creative_signature)
npm run visual:write               # áp phân tích cho MỌI ad cùng signature -> ghi Sheet (confidence 0.85)
```
Mỗi đợt phân tích top N cụm (theo số ad) → phủ nhiều ad nhất với ít lượt nhìn. Phần đuôi dài giữ heuristic.

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

---

# v3 — Incremental Intelligence Pipeline (cache + provenance)

Pipeline chỉ phân tích ad **mới** hoặc ad có `content_hash`/`visual_hash` **thay đổi**; ad cũ không đổi
→ **reuse** kết quả từ cache (giảm chi phí AI, tăng tốc, ổn định dữ liệu). Tất cả tab đều **optional**
(thiếu → app vẫn chạy, fallback đếm từ `analysis_status` của Ad Level).

### Hashing
- `content_hash` = sha256 rút gọn của: `ad_id, primary_text, headline, description, cta, landing_url, offer` (normalize null/whitespace/lowercase).
- `visual_hash` = sha256 của: `thumbnail_url, media_url, image_urls, video_preview_url, creative_type, snapshot_url`.

### Cột mới trên `Ad Level Analysis` + `Visual Analysis`
`content_hash, visual_hash, analysis_status, reused_from_cache, analysis_version, last_analyzed_at`.
`analysis_status` ∈ `newly_analyzed | reused_from_cache | changed_reanalyzed | carried_forward | crawl_failed | missing_media | low_confidence`.

### Tab `Ad Analysis Cache`
`ad_id, brand, page_id, content_hash, visual_hash, analysis_version, analysis_provider, analysis_status,
reused_from_cache, text_analysis_json, visual_analysis_json, last_analyzed_at`.
→ Mỗi run đọc cache cũ → so hash → quyết định new/reused/changed → ghi lại cache.

### Tab `Crawl Runs` (append, provenance)
`crawl_run_id, started_at, finished_at, week_date, provider, country, total_brands, total_pages,
success_pages, failed_pages, total_ads_fetched, new_ads_count, changed_ads_count, reused_ads_count,
analyzed_ads_count, carried_forward_count, status, error_summary`. Dashboard đọc tab này cho summary
(New/Changed/Reused/Carried/AI calls saved/crawl failures).

### Tab `Raw Ads Archive` (append)
`crawl_run_id, week_date, brand, page_id, ad_id, content_hash, visual_hash, status, source_provider,
source_country, first_seen_date, last_seen_date, raw_json` (raw_json cắt 8000 ký tự).

### Tab `Historical Weekly Snapshots` (append)
`week_date, brand, active_ads_count, new_ads_count, stopped_ads_count, changed_ads_count, reused_ads_count,
top_service, top_hook, top_offer, top_visual_format, crawl_status, snapshot_json` — cho trend nhiều tuần.

### Tab `Pattern Cache`
`pattern_id, pattern_hash, brand, service_type, hook_type, offer_type, visual_format, visual_angle,
first_seen_date, last_seen_date, ads_count, active_days_avg, example_ads, scale_signal` (`scale_signal=TRUE`
khi ≥3 ad active cùng pattern).

### Chống kết luận sai (data quality)
- Chỉ kết luận `brand_scaled_down` / `page_inactive` khi **crawl brand đó THÀNH CÔNG**.
- Crawl lỗi → ad giữ `carried_forward`, bỏ qua kết luận dừng/giảm (ghi cảnh báo), dashboard hiện banner crawl warning.

### Chuẩn bị AI Vision incremental (chưa bật)
`VISUAL_AI_PROVIDER=heuristic|ai`, `MAX_AI_ANALYSIS_PER_RUN`, `AI_BATCH_SIZE`, `AI_RETRY_LIMIT`,
`TEXT_ANALYSIS_PROMPT_VERSION`, `VISUAL_ANALYSIS_PROMPT_VERSION`. Khi bật `ai`: chỉ gọi AI cho ad
`newly_analyzed`/`changed_reanalyzed` (KHÔNG gọi cho `reused_from_cache`). Đổi prompt version → buộc phân tích lại.

---

## v3.1 — Production hardening (incremental pipeline)

### Check-before-analysis
Mỗi ad: tính `content_hash` + `visual_hash` TRƯỚC → tra `Ad Analysis Cache`. Nếu cache hit **và**
`analysis_version`+`analysis_provider` (`<provider>/<VISUAL_AI_PROVIDER>`) khớp → **không phân tích lại**,
tái dùng `text_analysis_json`/`visual_analysis_json`, đặt `analysis_status=reused_from_cache`. Miss → `newly_analyzed`;
hash đổi (hoặc đổi prompt/provider version) → `changed_reanalyzed`.

### Cache merge (giữ ad đã dừng)
Cache mới = `[curCacheRows, ...keptOld]` với `keptOld` = các dòng cache cũ có `ad_id` KHÔNG còn trong tuần này
(không bị mất khi ad dừng). Dedup theo khoá `ad_id|content_hash|visual_hash`. Giữ `first_seen_date` (từ cache/archive/start_date)
và cập nhật `last_seen_date=week_date`. Cache header thêm `first_seen_date, last_seen_date`.

### Tab `Page Crawl Logs` (append, MỚI)
`crawl_run_id, week_date, brand, page_id, status, ads_fetched, error_message, started_at, finished_at`.
Ghi cho MỌI provider (scrapecreators ghi log thật mỗi page; mock/custom dùng `fakePageLogs`).

### page_inactive theo từng page_id
Chỉ kết luận `page_inactive` cho page mà crawl **THÀNH CÔNG** nhưng tuần này 0 ad. Page crawl lỗi → chỉ cảnh báo
(partial crawl), KHÔNG kết luận. `generateWeeklyChangeInsights(..., crawlOk, pageOk)`.

### Raw Ads Archive cho mọi provider
Dùng `r._raw` nếu có (scrapecreators payload gốc), nếu không dùng bản normalized → KHÔNG bao giờ rỗng với custom/mock.

### Creative asset fields (ScrapeCreators/custom)
mapScAd map thêm `image_urls` (snapshot.images), `video_preview_url`, `carousel_image_urls` (snapshot.cards).
`Visual Analysis` thêm cột `carousel_image_urls`.

### GitHub Actions env
`weekly-spy.yml` thêm `ADS_SOURCE_COUNTRY, ADS_SOURCE_MAX_ADS, VISUAL_AI_PROVIDER, VISUAL_AI_API_KEY,
MAX_AI_ANALYSIS_PER_RUN, AI_BATCH_SIZE, AI_RETRY_LIMIT, TEXT_ANALYSIS_PROMPT_VERSION, VISUAL_ANALYSIS_PROMPT_VERSION`
(qua Repository `vars`, key qua `secrets`).
