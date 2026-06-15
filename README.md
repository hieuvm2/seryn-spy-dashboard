# SERYN Weekly Spy Dashboard

Dashboard **React + Vite + TypeScript** hiển thị **kết quả spy ads đối thủ theo tuần** cho SERYN Clinic.
SPA tĩnh thuần (không backend): đọc dữ liệu từ **Google Sheets** (online) hoặc **CSV** (local),
fallback **localStorage** / dữ liệu mẫu.

> ⚙️ **Cấu trúc repo:** Ứng dụng nằm ở **gốc repository này** (`package.json`, `src/`, `index.html`
> ở root). Không có thư mục con `web-react/`. Mọi lệnh dưới đây chạy ở **gốc repo**.

---

## Local Development

```bash
npm install        # cài dependencies
npm run dev        # chạy dev server → http://localhost:5173
npm run build      # build production → thư mục dist/
npm run lint       # kiểm tra type (tsc --noEmit)
npm run preview    # xem thử bản build tại http://localhost:4173
```

| Script | Lệnh | Mục đích |
|---|---|---|
| `dev` | `vite` | Dev server + HMR |
| `build` | `vite build` | Build tĩnh ra `dist/` |
| `preview` | `vite preview` | Xem thử bản build |
| `lint` | `tsc --noEmit` | Type-check |
| `spy:sync` | `node scripts/run-weekly-spy-and-sync.mjs` | Ghi 5 CSV `outputs/` → Google Sheets (service account) |
| `market:run` | `node scripts/market-research-on-demand.mjs` | **Exa** Market Research (manual/on-demand) |
| `market:validate` | `node scripts/validate-market-research-output.mjs` | Validate output Claude deep-analysis |
| `market:import` | `node scripts/import-market-research-output.mjs` | Import output Claude → Opportunity Briefs |
| `market:status` | `node scripts/market-research-status.mjs` | Tóm tắt trạng thái Market Research |
| `competitors:discover` | `node scripts/competitor-discovery-on-demand.mjs` | **Exa** Competitor Discovery (manual) |
| `competitors:import` | `node scripts/import-discovered-competitors.mjs` | Import candidate đã approve → tab `Competitors` |
| `competitors:status` | `node scripts/competitor-discovery-status.mjs` | Tóm tắt trạng thái Discovery |

---

## Các view

Tổng quan · Đối thủ (click mở drawer) · Nội dung nhân rộng · Top Hooks ·
**Visual Intelligence** · Swipe File · Creative Briefs · **Thay đổi tuần (intelligence feed)** ·
Gợi ý cho SERYN · **Competitor Setup** · **Market Research** · **Competitor Discovery** · Nhập dữ liệu.

## Nâng cấp v2 (Visual / Competitor / Weekly Changes)

- **Visual Intelligence** — phân tích creative (ảnh/video) theo 5 lớp (asset · OCR/overlay · visual ·
  risk · pattern): format, before/after, bác sĩ, UGC, offer, điểm clinical/luxury/UGC, rủi ro compliance,
  pattern đang scale. MVP dùng **heuristic** (`VISUAL_ANALYSIS_PROVIDER=heuristic`); thiếu tab thì
  dashboard tự suy luận từ `Ad Level Analysis`. Cho phép manual review (localStorage).
- **Competitor Setup** — thêm/sửa/bật-tắt đối thủ ngay trong dashboard (validate, test crawl). Ghi tab
  `Competitors` qua Apps Script nếu cấu hình; chưa thì lưu **localStorage draft** + cảnh báo.
- **Thay đổi tuần** — nâng thành *intelligence feed*: change_type / severity / confidence / evidence /
  recommended_action (scaling, đổi offer/hook, dịch chuyển dịch vụ/visual, page mới/ngừng…). Wording
  an toàn (signal, không "winning"). Thiếu tab enriched thì map từ tab cũ.

Tab Google Sheets + cột mới: xem [`docs/SCHEMA_V2_VISUAL_COMPETITORS_CHANGES.md`](docs/SCHEMA_V2_VISUAL_COMPETITORS_CHANGES.md).
Sau khi cập nhật, **phải Deploy lại Apps Script** (`docs/google-apps-script-web-api.js`) → New version.

## Nâng cấp v3 — Incremental pipeline (cache + provenance)

`spy:weekly` giờ là **incremental**: chỉ phân tích ad **mới** hoặc ad có `content_hash`/`visual_hash`
**thay đổi**; ad cũ không đổi → **reuse** từ tab `Ad Analysis Cache` (giảm chi phí AI, tăng tốc, ổn định).
- Cột mới trên Ad Level/Visual: `content_hash, visual_hash, analysis_status, reused_from_cache, analysis_version, last_analyzed_at`.
- Tab mới: `Ad Analysis Cache`, `Crawl Runs`, `Page Crawl Logs`, `Raw Ads Archive`, `Historical Weekly Snapshots`, `Pattern Cache` (đều optional).
- **Check-before-analysis:** tính hash TRƯỚC → cache hit (hash + prompt/provider version khớp) thì KHÔNG gọi AI, tái dùng kết quả.
- **Cache merge:** giữ cache của ad đã dừng (`keptOld`), dedup `ad_id|content_hash|visual_hash`, giữ `first_seen_date`/`last_seen_date`.
- **Page Crawl Logs:** log mỗi page (status, ads_fetched, error) cho mọi provider; `Raw Ads Archive` ghi cho mọi provider (custom/mock không rỗng).
- **Chống kết luận sai:** chỉ kết luận `scaled_down`/`page_inactive` khi crawl page/brand đó THÀNH CÔNG; crawl lỗi → cảnh báo + `carried_forward`.
- **Creative assets:** map thêm `image_urls`, `video_preview_url`, `carousel_image_urls` từ ScrapeCreators/custom.
- Dashboard: badge New/Cached/Changed/Carried/No media trên creative; banner data-quality + "AI calls saved" trong Thay đổi tuần.
- Env mới (GitHub Actions qua Repository `vars`, key qua `secrets`): `ADS_SOURCE_COUNTRY`, `ADS_SOURCE_MAX_ADS`, `VISUAL_AI_PROVIDER`, `VISUAL_AI_API_KEY`, `MAX_AI_ANALYSIS_PER_RUN`, `AI_BATCH_SIZE`, `AI_RETRY_LIMIT`, `TEXT_ANALYSIS_PROMPT_VERSION`, `VISUAL_ANALYSIS_PROMPT_VERSION`.

---

## Exa Market Research & Competitor Discovery (MANUAL / ON-DEMAND)

Module **Exa.ai** chạy **thủ công** để nghiên cứu thị trường và phát hiện đối thủ mới.
Hai dashboard view mới: **Market Research** và **Competitor Discovery** (chỉ đọc Google Sheets).

### Exa DÙNG để làm gì
- Research thị trường, tìm **trend**, tìm report / news / blog / review / landing page.
- Phân tích tín hiệu tăng/giảm theo service category; **digital share of voice** của đối thủ.
- Ước lượng **directional market size** (TAM/SAM/SOM low/mid/high + assumptions + missing_data).
- Tạo **SERYN Opportunity Briefs** + **Market Research Queue** cho Claude phân tích sâu.
- Tìm **brand/clinic/spa đối thủ mới** → website + fanpage candidate → page_id (nếu có numeric).
- Tạo danh sách candidate để **review/approve → import vào tab `Competitors`**.

### Exa KHÔNG dùng để làm gì
- **Không** thay ScrapeCreators (vẫn là nguồn ads thật). **Không** lấy Meta Ads trực tiếp.
- **Không** phân tích ảnh creative. **Không** thay Claude Visual Review.
- **Không** chạy tự động hằng tuần. **Không** gắn vào weekly spy cron. **Không** gọi từ frontend.

### Setup GitHub Secrets
- Tạo secret **`EXA_API_KEY`** (Settings → Secrets and variables → Actions → New repository secret).
- Dùng lại `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (đã có cho weekly spy).
- **KHÔNG** commit key vào repo. **KHÔNG** dùng `VITE_EXA_API_KEY`. Chỉ script server-side đọc
  `process.env.EXA_API_KEY`. Thiếu key → script **skip exit 0** (không làm fail hệ thống).

### Chạy Market Research (thủ công)
1. GitHub → tab **Actions** → workflow **Market Research Manual** → **Run workflow**.
2. Nhập `market` / `geo` / `service_category` (`all` hoặc 1 category) / `max_queries` / `max_results` / `deep_search`.
3. Mở dashboard → view **Market Research** (Overview · Trend Radar · Market Size · Digital SoV · Source Explorer · Opportunity Briefs · Assumptions).
4. (tùy chọn) Claude đọc tab `Market Research Queue` → xuất `data/market-research/market_research_output.json`
   → `npm run market:validate` → `npm run market:import` (upsert Opportunity Briefs).

### Chạy Competitor Discovery (thủ công)
1. GitHub → **Actions** → **Competitor Discovery Manual** → **Run workflow** (nhập market/geo/service_category, `auto_import` mặc định `false`).
2. Mở dashboard → view **Competitor Discovery** → review **Candidate Table**.
3. Bổ sung **page_id** nếu thiếu (click cột page_id), **Approve** / **Reject** / **Mark duplicate**.
4. Chạy `npm run competitors:import` (hoặc bật `auto_import=true`) → import candidate hợp lệ vào tab `Competitors`.
5. **Lần weekly spy tiếp theo**, ScrapeCreators tự crawl ads từ competitor mới (vẫn chỉ đọc tab `Competitors`).

### Review/Import & ScrapeCreators
- Chỉ candidate **`status=approved`** hoặc **`ready_for_spy=true`** (brand + **numeric page_id** + confidence ≥ 0.65, không duplicate) mới được import.
- Upsert theo `page_id`; nếu chưa có page_id → upsert theo `normalized_brand_name + website_domain` với `active=false`. **Không** xóa competitor cũ, **không** tạo duplicate.
- Competitor import từ Exa: `source=exa_discovery`, `discovery_id`, `notes` chứa evidence ngắn.

### Tránh duplicate / sai page
- Dedupe theo `page_id`, facebook_url chuẩn hóa, website_domain, `normalized_brand_name + geo`.
- **Vanity URL** (`facebook.com/brand`) **KHÔNG** phải page_id → để `needs_page_id`, chưa cho crawl.
- **Không bịa page_id.** Nên để `auto_import=false` lúc đầu và review thủ công.

### Kiểm soát chi phí Exa
- `max_queries` mặc định **10**, `max_results` mặc định **10**, clamp tối đa **20**.
- `deep_search` mặc định **false** (bật → ghi warning vào `Market Research Runs.cost_guard_status`).
- Exa **chỉ** chạy manual `workflow_dispatch` — không có `schedule`, không gắn weekly cron.

### Đọc Market Size Estimates đúng cách
- Là **directional estimate**, không phải số liệu audited. Luôn xem **low/mid/high** + `confidence_score`
  + `assumptions` + `missing_data`. Confidence thấp khi thiếu `detected_market_numbers` / `detected_prices`.

### Tab Google Sheets mới
Market Research: `Market Research Runs`, `Market Sources`, `Trend Signals`, `Competitor Market Activity`,
`Market Size Estimates`, `SERYN Opportunity Briefs`, `Market Research Queue`.
Competitor Discovery: `Competitor Discovery Runs`, `Competitor Discovery`, `Competitor Website Intelligence`,
`Competitor Fanpage Candidates`, `Competitor Import Log`. Tab `Competitors` mở rộng cột
(`website_url`, `service_focus`, `geo`, `source`, `discovery_id`, `status`, `created_at`, `updated_at` — backward compatible).
Tab thiếu → script tự tạo / Apps Script trả `[]` (không crash). Sau khi cập nhật **Deploy lại Apps Script** → New version.

---

## Hai nguồn dữ liệu — Local CSV vs Google Sheets online

| | **LOCAL CSV / FOLDER** | **GOOGLE SHEETS ONLINE** |
|---|---|---|
| Cách nạp | Tab *Nhập dữ liệu* → upload 5 CSV hoặc chọn cả thư mục `outputs/` (Chrome/Edge) | Tự fetch khi mở app, hoặc nút **Refresh Online Data** |
| Lưu ở đâu | **localStorage** của *từng trình duyệt/máy* | Một **Google Sheet** chung (mọi người mở cùng link Vercel xem **chung 1 bộ dữ liệu**) |
| Khi nào dùng | Bạn chạy agent ở máy cá nhân, muốn xem nhanh; không cần chia sẻ | Team dùng chung, deploy Vercel; dữ liệu tập trung |
| Cấu hình | Không cần | `VITE_GOOGLE_SHEETS_API_URL` (+ `VITE_GOOGLE_SHEETS_API_KEY` nếu bật bảo vệ) |

- **Local CSV import** = nhập tay từng file CSV vào trình duyệt → chỉ máy đó thấy.
- **Google Sheets online sync** = dashboard đọc Google Sheets qua Apps Script Web App → mọi người
  xem chung. Khi online lỗi, app tự fallback về localStorage (**OFFLINE CACHE**) rồi dữ liệu mẫu — không crash.
- **Swipe File** & **Creative Briefs** cũng đồng bộ Google Sheets khi cấu hình API (xem
  `README_GOOGLE_SHEETS_ONLINE_DATA.md`); nếu chưa cấu hình thì vẫn lưu localStorage như cũ.

---

## Environment Variables

Tạo `.env` (hoặc `.env.local`) ở gốc repo — **không commit** (đã có trong `.gitignore`).
Xem mẫu đầy đủ ở [`.env.example`](.env.example).

| Biến | Bắt buộc | Dùng cho | Ghi chú |
|---|---|---|---|
| `VITE_GOOGLE_SHEETS_API_URL` | Khi muốn online | Frontend ĐỌC/GHI online | URL `.../exec` của Apps Script Web App. **Không phải secret.** |
| `VITE_GOOGLE_SHEETS_API_KEY` | Khuyến nghị (prod) | Frontend nối `?key=...` | Phải khớp Script Property `API_SECRET_KEY`. |
| `GOOGLE_SHEET_ID` | Khi chạy `spy:sync` | Script `spy:sync` | ID Google Sheet đích. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Khi chạy `spy:sync` | Script `spy:sync` | Đường dẫn JSON service account (ngoài repo). |
| `OUTPUTS_DIR` | Tùy chọn | Script `spy:sync` | Thư mục 5 CSV của agent. Mặc định `<repo>/outputs`. |

> ⚠️ Chỉ biến tiền tố `VITE_` được inject vào frontend (build-time). Trên Vercel, sửa env xong
> phải **Redeploy**. **Không** đưa service account / private key vào frontend.

---

## Google Sheets Setup (tóm tắt)

1. Tạo 1 Google Sheet với **5 tab dashboard** + **2 tab nội dung** (tên chính xác):
   `Brand Weekly Snapshot`, `Ad Level Analysis`, `Scaled Content Analysis`,
   `Weekly Strategy Change`, `SERYN Content Recommendations`, `Swipe File`, `Creative Briefs`.
2. **Extensions → Apps Script** → dán [`docs/google-apps-script-web-api.js`](docs/google-apps-script-web-api.js).
3. (Khuyến nghị) **Project Settings → Script properties** → thêm `API_SECRET_KEY = <bí mật>`.
4. **Deploy → New deployment → Web app** (Execute as *Me*, Who has access *Anyone*) → copy URL `.../exec`.
5. Đặt `VITE_GOOGLE_SHEETS_API_URL` (+ `VITE_GOOGLE_SHEETS_API_KEY`) trên Vercel → **Redeploy**.

Chi tiết: [`README_GOOGLE_SHEETS_ONLINE_DATA.md`](README_GOOGLE_SHEETS_ONLINE_DATA.md) (đọc online + bảo vệ key + 2 tab mới)
và [`docs/GOOGLE_SHEETS_LOCAL_SYNC.md`](docs/GOOGLE_SHEETS_LOCAL_SYNC.md) (ghi bằng `spy:sync`).

---

## Deploy lên Vercel

Cấu hình Import Project trên Vercel:

| Mục | Giá trị |
|---|---|
| **Root Directory** | `.` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

Thêm Environment Variables (mục trên) → **Deploy**. Mỗi `git push` Vercel tự build lại.
Hướng dẫn đầy đủ: [`README_DEPLOY_VERCEL.md`](README_DEPLOY_VERCEL.md).

---

## Cấu trúc

```
package.json             scripts: dev/build/preview/lint/spy:sync
index.html               entry Vite
vite.config.ts           cấu hình Vite (alias @ -> gốc repo)
vercel.json              SPA rewrite
src/
  App.tsx                router 9 view + localStorage + online fetch + drawer
  types.ts               schema 5 bảng + Swipe File + Creative Briefs
  sampleData.ts          dữ liệu demo
  utils/spyData.ts       CSV parse, localStorage, health-check, viLabel
  utils/sheetsApi.ts     API client Google Sheets (build URL + key, GET/POST)
  utils/onlineData.ts    đọc 5 bảng online (ONLINE SHEET DATA)
  utils/swipeFile.ts     Swipe File: localStorage + sync Google Sheets
  utils/briefs.ts        Creative Briefs: localStorage + sync Google Sheets
  components/            Sidebar · TopHeader · BrandDetailDrawer
  components/views/      9 view
scripts/run-weekly-spy-and-sync.mjs   ghi outputs/*.csv -> Google Sheets (service account)
docs/                    Apps Script Web App + hướng dẫn sync
```
