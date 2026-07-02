# Google Sheets — schema các tab (trạng thái hiện tại)

Toàn bộ tab mà hệ thống ghi/đọc trên Google Sheet. **Nguồn chuẩn của header là
[`scripts/lib/schemas.mjs`](../scripts/lib/schemas.mjs)** (`HEADERS.*`) — đổi cột thì đổi ở đó;
tài liệu này giải thích ý nghĩa và quy tắc. Apps Script đọc theo `SHEET_MAP` trong
[`docs/google-apps-script-web-api.js`](google-apps-script-web-api.js).

Mọi tab đều **optional với dashboard** — thiếu/trống thì UI fallback (derived/mảng rỗng), không crash.

---

## 1) Watchlist

### `Competitors` (pipeline đọc · dashboard đọc/ghi · import ghi)
Header: `HEADERS.competitors` — 5 cột pipeline đầu (`brand_name, page_ids, page_urls, active, notes`)
+ metadata dashboard/import (`category, last_crawled_at, last_status, id, website_url, service_focus,
geo, source, discovery_id, status, created_at, updated_at`).

Quy tắc:
- Chỉ crawl dòng `active=TRUE` (chấp nhận `TRUE/true/1/yes/x/có`).
- `page_ids` nhiều id ngăn cách bằng `|`. **Thiếu `page_ids` → skip brand** (log `[!]`).
- 🚫 **Không bịa `page_id`** — chỉ dùng id do API trả về (resolve tự động khi
  `npm run competitors:import`, xem `scripts/lib/pageIdResolver.mjs`). Chưa có id thật → `active=FALSE`.
- `id` = `cmp-<slug(normalizeBrandName(brand))>` — ổn định để dashboard ↔ Sheet ↔ pipeline upsert khớp.
- Tab trống + `ADS_SOURCE_PROVIDER=mock` → pipeline dùng danh sách default để test (có warning).

### `Own Brand Pages` (seed 1 lần · pipeline đọc)
Header: `HEADERS.ownBrandPages`. Page của **CHÍNH SERYN** (brand_type=own) để crawl benchmark
SERYN vs đối thủ. Seed bằng `npm run seed:own-brand`. `is_active` + `crawl_enabled` + có `page_id`
thì mới crawl.

---

## 2) 5 tab lõi (pipeline ghi đè mỗi tuần — khớp 5 CSV `outputs/`)

| Tab | Header | Ghi chú |
|---|---|---|
| `Brand Weekly Snapshot` | `HEADERS.snapshot` | 1 dòng/brand/tuần + khối `skin_rejuvenation_*` (format/objective mix) + `brand_type` (own/competitor) |
| `Ad Level Analysis` | `HEADERS.adLevel` | 1 dòng/ad; gồm hash + `analysis_status` + khối `hook_*` (từ `lib/hookAnalysis.mjs`) |
| `Scaled Content Analysis` | `HEADERS.scaled` | cụm nội dung đang nhân rộng + `seryn_should_copy_adapt_counter_avoid` |
| `Weekly Strategy Change` | `HEADERS.change` | so sánh tuần này vs tuần trước theo brand |
| `SERYN Content Recommendations` | `HEADERS.contentRecs` | header SUPERSET dùng chung: weekly + Exa opportunity + hook content generator (`source` phân biệt) |

`analysis_status` ∈ `newly_analyzed | reused_from_cache | changed_reanalyzed | carried_forward |
crawl_failed | missing_media | low_confidence`.

---

## 3) Visual Intelligence (pipeline ghi)

| Tab | Header | Ghi chú |
|---|---|---|
| `Visual Analysis` | `HEADERS.visualAnalysis` | 1 dòng/creative; heuristic mặc định (`VISUAL_AI_PROVIDER=heuristic`); `creative_signature` gom creative giống nhau, `cluster_size` = số ad cùng cụm |
| `Brand Visual Summary` | `HEADERS.brandVisualSummary` | tỷ lệ before/after, doctor, UGC… theo brand (`*_rate` 0–1) |
| `Visual Pattern Analysis` | `HEADERS.visualPattern` | `is_signal=TRUE` khi ≥3 ad cùng (brand + visual_format + visual_angle + offer) |

**Review visual thủ công** (đọc ảnh thật, không tốn phí AI): `npm run visual:fetch -- 40` → xem ảnh
trong `work/visual_review/`, điền `analysis.json` theo `creative_signature` → `npm run visual:write`
(áp cho mọi ad cùng signature, confidence 0.85). `scripts/vision_excludes.json` = danh sách `ad_id`
bị loại khỏi scope sau khi nhìn ảnh (pipeline tự áp khi lọc).

---

## 4) Incremental cache + provenance (pipeline ghi)

| Tab | Header | Kiểu ghi | Ghi chú |
|---|---|---|---|
| `Ad Analysis Cache` | `HEADERS.adAnalysisCache` | ghi đè (merge) | so `content_hash`/`visual_hash` → chỉ phân tích ad mới/đổi; giữ cache ad đã dừng; `first_seen_date`/`last_seen_date` |
| `Pattern Cache` | `HEADERS.patternCache` | ghi đè (merge) | pattern (service+hook+offer+visual) theo brand; `scale_signal=TRUE` khi ≥3 ad active cùng pattern |
| `Raw Ads Archive` | `HEADERS.rawAdsArchive` | **append** | payload gốc (cắt 8000 ký tự) — provenance |
| `Historical Weekly Snapshots` | `HEADERS.historicalSnapshots` | **append** | trend nhiều tuần theo brand |
| `Crawl Runs` | `HEADERS.crawlRuns` | **append** | header SUPERSET dùng chung: weekly spy + Exa market/discovery + hook intelligence (`run_type`) |
| `Page Crawl Logs` | `HEADERS.pageCrawlLogs` | **append** | log crawl từng page_id |

Chống kết luận sai: chỉ kết luận `brand_scaled_down`/`page_inactive` khi crawl brand/page đó
**thành công**; crawl lỗi → ad giữ `carried_forward`, không kết luận dừng/giảm.

### `Weekly Change Insights` (pipeline + hooks:analyze append)
Header: `HEADERS.changeInsight`. `change_type` ∈ new_ad, stopped_ad, relaunched_ad, new_variant,
new_campaign_theme, offer_changed, hook_changed, service_focus_shifted, visual_format_shifted,
brand_scaled_up, brand_scaled_down, new_page_detected, page_inactive, same_concept_new_variants.
`severity` low|medium|high · `recommended_action` copy|adapt|counter|monitor|ignore.

---

## 5) Exa (manual-only) + Hook Intelligence

| Tab | Header | Ghi bởi |
|---|---|---|
| `Market Intelligence` | `HEADERS.marketIntelligence` | `npm run market:run` (gộp source/trend/market size/opportunity/queue — `intelligence_type`) |
| `Competitor Discovery` | `HEADERS.discovery` | `npm run competitors:discover` (gộp run/website/fanpage/import status); approve trên dashboard → `competitors:import` |
| `Hook Intelligence` | `HEADERS.hookIntelligence` | `npm run hooks:analyze` (manual — cụm hook pattern; dashboard hiển thị trong Brand drawer) |

---

## 6) Weekly Intelligence + Historical Reports

| Tab | Header | Ghi bởi |
|---|---|---|
| `Weekly_Summary` | `HEADERS.weeklySummary` | `npm run report:weekly-intel` (bước 2 của weekly-spy.yml) |
| `Action_Plan` | `HEADERS.actionPlan` | như trên (dashboard cập nhật `status` qua Apps Script) |
| `Swipe_File_Suggestions` | `HEADERS.swipeSuggestions` | như trên |
| `Weekly Reports` | `HEADERS.spyReports` | `npm run report:weekly` (upsert theo `report_id`, KHÔNG ghi đè kỳ cũ) |
| `Monthly Reports` | `HEADERS.spyReports` | `npm run report:monthly` / `report:monthly:last-day` |

`Weekly/Monthly Reports` dùng chung schema `SpyReport`; field list ngăn cách `|`;
cột `seryn_benchmark` = block so sánh SERYN vs đối thủ. **KHÔNG bịa spend/CPA/ROAS.**

---

## Lưu ý chung

- Header do script tự tạo/migrate (`reconcileHeader` trong `scripts/lib/sheets.mjs`) — đổi cột
  trong `schemas.mjs` thì tab append tự migrate theo tên cột.
- Sau khi sửa `docs/google-apps-script-web-api.js` phải **Deploy → New version** thì doGet/doPost
  mới trả tab mới (xem [`docs/ONLINE_DATA.md`](ONLINE_DATA.md)).
- Hashing: `content_hash` = sha256 rút gọn của text ad; `visual_hash` = sha256 của media URL
  (đã bỏ query token fbcdn xoay vòng). Đổi `TEXT_ANALYSIS_PROMPT_VERSION` /
  `VISUAL_ANALYSIS_PROMPT_VERSION` → buộc phân tích lại.
