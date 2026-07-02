# SERYN Weekly Spy Dashboard

Hệ thống **spy quảng cáo Meta/Facebook của đối thủ** cho SERYN Clinic (phạm vi khóa cứng:
**ad căng da / trẻ hóa da mặt**, `service_category=skin_rejuvenation`). Gồm 2 phần trong 1 repo:

- **Pipeline Node (`scripts/`)** — crawl Meta Ads Library (ScrapeCreators), phân tích, ghi Google Sheets,
  mirror Supabase; chạy tự động bằng GitHub Actions.
- **Dashboard (`src/`)** — SPA React + Vite + TypeScript (không backend), đọc Supabase (chính) /
  Apps Script (fallback) / CSV local, deploy Vercel.

```
GitHub Actions (weekly-spy.yml, thứ Sáu 9h VN)
  └─ npm run spy:weekly  ──► crawl 13 đối thủ + page SERYN ──► lọc skin_rejuvenation
                             ──► phân tích incremental (cache) ──► ghi ~15 tab Google Sheets
                             ──► đẩy Supabase (bảng spy_data)
  └─ npm run report:weekly-intel ──► Weekly_Summary / Action_Plan / Swipe_File_Suggestions

Dashboard (Vercel) ──► đọc SUPABASE ──► fallback GOOGLE SHEETS (Apps Script doGet)
                       ──► fallback BẢN OFFLINE (localStorage) ──► DỮ LIỆU MẪU
```

---

## Quickstart

```bash
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # build production → dist/
npm run lint       # type-check (tsc --noEmit)
```

> Ứng dụng nằm ở **gốc repository** (`package.json`, `src/`, `index.html` ở root).

## 6 view của dashboard

| View (hash) | Nội dung |
|---|---|
| `#overview` | KPI tuần, executive summary, data quality, SERYN own-brand benchmark |
| `#brands` | Bảng đối thủ + drawer hồ sơ từng brand (ads, scaled content, visual, hook, market signals, so sánh SERYN) |
| `#reports` | Báo cáo tuần/tháng lịch sử (tab `Weekly Reports` / `Monthly Reports`) + xuất PDF |
| `#competitor-discovery` | Candidate đối thủ do Exa phát hiện — approve/reject → tự vào watchlist |
| `#competitor-setup` | Quản lý watchlist tab `Competitors` (thêm/sửa/xóa, test cấu hình) |
| `#data-import` | Nguồn dữ liệu: refresh online, import CSV thủ công, sample data, health check |

## npm scripts

| Nhóm | Script | Việc |
|---|---|---|
| Dev | `dev` / `build` / `preview` / `lint` | Vite dev/build/preview + type-check |
| Weekly pipeline | `spy:weekly` | Crawl + phân tích + ghi Sheets + đẩy Supabase (chạy bởi CI) |
| | `spy:sync` | Copy 5 CSV `outputs/` của agent → 5 tab lõi (local, service account) |
| | `supabase:sync` | Đọc tab Sheets → upsert bảng `spy_data` Supabase |
| Reports | `report:weekly-intel` | Weekly intelligence (Weekly_Summary/Action_Plan/Swipe) — bước 2 của CI |
| | `report:weekly` / `report:monthly` / `report:monthly:last-day` | Báo cáo lịch sử theo kỳ → tab Weekly/Monthly Reports |
| | `test:weekly-intel` | Unit test offline cho `lib/weeklyIntel.mjs` |
| Exa (manual-only) | `market:run` / `market:validate` / `market:import` / `market:status` | Market research trẻ hóa da → tab `Market Intelligence` |
| Competitors | `competitors:discover` / `competitors:import` / `competitors:status` | Exa discovery → approve → import (tự resolve page_id) |
| | `competitors:add` | Thêm đối thủ thủ công từ file JSON (`node scripts/add-competitors.mjs [file] --write`) |
| Own brand | `seed:own-brand` | Seed tab `Own Brand Pages` (page của chính SERYN) |
| Khác | `hooks:analyze` | Hook clustering (manual) → tab `Hook Intelligence` |
| | `visual:fetch` / `visual:write` | Review visual thủ công theo cụm creative (xem docs/SHEETS_SCHEMA.md §3) |

## GitHub Actions (5 workflows)

| Workflow | Lịch | Chạy |
|---|---|---|
| `weekly-spy.yml` | Thứ Sáu ~9h07 VN | `spy:weekly` → `report:weekly-intel` |
| `weekly-report.yml` | Thứ Hai | `report:weekly` (báo cáo tuần lịch sử) |
| `monthly-report.yml` | Ngày 28–31 | `report:monthly:last-day` (chỉ chạy đúng ngày cuối tháng) |
| `market-research-manual.yml` | manual (dispatch) | `market:run` — Exa KHÔNG gắn cron |
| `competitor-discovery-manual.yml` | manual (dispatch) | `competitors:discover` (+ `competitors:import` nếu bật auto_import) |

**Secrets cần có:** `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `ADS_SOURCE_PROVIDER`
(`scrapecreators` cho production), `ADS_SOURCE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`EXA_API_KEY` (cho 2 workflow manual). Chi tiết: [`docs/AUTOMATED_WEEKLY_SPY_GITHUB_ACTIONS.md`](docs/AUTOMATED_WEEKLY_SPY_GITHUB_ACTIONS.md).

## Environment variables

Template đầy đủ kèm giải thích: [`.env.example`](.env.example). Tóm tắt:

| Biến | Đặt ở | Vai trò |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Vercel | Dashboard đọc Supabase (nguồn **chính**) |
| `VITE_GOOGLE_SHEETS_API_URL` (+`_KEY`) | Vercel | Dashboard đọc Apps Script (fallback) |
| `GOOGLE_SHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON`/`_FILE` | CI secret / `.env` local | Pipeline ghi Sheets |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | CI secret / `.env` local | Pipeline đẩy Supabase (**secret**) |
| `ADS_SOURCE_PROVIDER` / `ADS_SOURCE_API_KEY` | CI secret | Provider crawl (`scrapecreators` prod, `mock` test) |
| `ADS_SCOPE` | (mặc định `skin_rejuvenation`) | `all` để tắt lọc phạm vi (không khuyến nghị) |
| `EXA_API_KEY` + `EXA_*` | CI secret (manual) | Exa market research / discovery |
| `RESOLVE_PAGE_ID` / `MAX_PAGE_ID_RESOLVES_PER_RUN` | CI/local | Tự resolve Facebook page_id khi import đối thủ |

## Cấu trúc repo

```
src/                      dashboard React (main.tsx → App.tsx → 6 view)
  components/             Sidebar, TopHeader, BrandDetailDrawer, WeeklyReportModal, SerynBenchmark, views/
  utils/                  spyData (CSV/localStorage), labelsVi (dịch nhãn), remoteData (Supabase+Sheets),
                          reportData, brandIntelligence, adContentIntelligence, serynBenchmark, ownBrand,
                          competitors, competitorDiscovery, brandName, directCompetitors, incremental
  types.ts                schema TypeScript của mọi dataset
  sampleData.ts           dữ liệu demo (fallback khi chưa có nguồn nào)
scripts/                  pipeline Node (.mjs) — xem bảng npm scripts ở trên
  weekly-spy-sync.mjs     pipeline crawl chính (provider → lọc scope → phân tích → ghi tab)
  lib/                    schemas (header tab — nguồn chuẩn), sheets (I/O), hookAnalysis, exaClient,
                          pageIdResolver, reportGen/reportStore/reportDateUtils, supabase, netConfig…
  vision_excludes.json    config lọc ad_id bị loại sau vision review (KHÔNG phải secret)
docs/                     ONLINE_DATA.md · DEPLOY.md · SHEETS_SCHEMA.md · AUTOMATED_WEEKLY_SPY…
  google-apps-script-web-api.js   nguồn Apps Script đang deploy (sửa xong phải Deploy → New version)
supabase/schema.sql       tạo bảng spy_data (chạy 1 lần trong SQL Editor)
data/market-research/     output.schema.json — contract output Claude deep-analysis (market:validate)
public/                   seryn-mark.png (favicon/logo), seryn-logo.png (brand asset)
.github/workflows/        5 workflows (bảng trên)
```

## Đọc thêm

- [`docs/ONLINE_DATA.md`](docs/ONLINE_DATA.md) — vòng dữ liệu online đầy đủ: Sheet → Apps Script → Supabase → dashboard
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — deploy Vercel
- [`docs/SHEETS_SCHEMA.md`](docs/SHEETS_SCHEMA.md) — schema mọi tab Google Sheets
- [`docs/AUTOMATED_WEEKLY_SPY_GITHUB_ACTIONS.md`](docs/AUTOMATED_WEEKLY_SPY_GITHUB_ACTIONS.md) — thiết lập CI weekly spy
- [`docs/claude-hook-review-prompt.md`](docs/claude-hook-review-prompt.md) — prompt Claude review hook clusters

## Nguyên tắc dữ liệu

- **Không bịa** offers / ad counts / page_id / spend / ROAS. Thiếu dữ liệu → `unknown`.
- Chỉ nói *"likely scaled based on duration and repetition"* — không khẳng định ad chắc chắn hiệu quả.
- Khuyến nghị cho SERYN luôn premium, y khoa, điềm tĩnh — không FOMO rẻ tiền, không fear-based.
