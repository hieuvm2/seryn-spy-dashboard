# Tự động spy ads hằng tuần bằng GitHub Actions

```
GitHub Actions (cron thứ 6)  ──►  npm run spy:weekly
   → đọc tab Competitors + Own Brand Pages → pull ads (scrapecreators|mock|custom)
   → lọc scope skin_rejuvenation → phân tích incremental (cache)
   → ghi ~15 tab Google Sheets → đẩy Supabase
   ──►  npm run report:weekly-intel → Weekly_Summary / Action_Plan / Swipe_File_Suggestions
   ──►  Dashboard Vercel (đọc Supabase, fallback Apps Script doGet)
```

- Workflow: `.github/workflows/weekly-spy.yml` (2 step: `spy:weekly` rồi `report:weekly-intel`)
- Script: `scripts/weekly-spy-sync.mjs` + `scripts/weekly-intelligence.mjs`
- Lịch: **02:07 UTC thứ Sáu** = ~**09:07 sáng thứ Sáu giờ Việt Nam** (UTC+7). Cron: `7 2 * * 5`.
- Provider lấy từ secret `ADS_SOURCE_PROVIDER` — production dùng **`scrapecreators`** (ads thật);
  `mock` chỉ để test pipeline. Chi tiết ở mục 9.

> Không build lại dashboard. Không commit secret. Không đưa private key vào frontend.
> Service account JSON chỉ nằm trong **GitHub Secrets** (server-side).

---

## 1. Tạo Google Service Account

1. <https://console.cloud.google.com/> → chọn/tạo project (có thể là project cá nhân nếu org chặn tạo key).
2. **APIs & Services → Credentials → Create credentials → Service account** → đặt tên → Create.
3. Mở service account vừa tạo → tab **Keys → Add key → Create new key → JSON** → tải file `.json` về.
   - File này chứa `client_email` và `private_key`. **Không commit, không đưa vào frontend.**

## 2. Bật Google Sheets API

- **APIs & Services → Library → Google Sheets API → Enable** (trong cùng project).

## 3. Share Google Sheet cho service account (quyền Editor)

- Mở file JSON, copy `client_email` (dạng `xxx@yyy.iam.gserviceaccount.com`).
- Mở Google Sheet (ID `11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q`) → **Share** →
  dán email đó → chọn **Editor** → Send.
- Tạo tab **`Competitors`** theo `docs/SHEETS_SCHEMA.md` §1 (hoặc để trống nếu test bằng mock).

## 4. Thêm GitHub Secrets

Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Giá trị | Bắt buộc |
|---|---|---|
| `GOOGLE_SHEET_ID` | `11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q` | ✅ |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Dán toàn bộ nội dung** file JSON service account | ✅ |
| `ADS_SOURCE_PROVIDER` | `scrapecreators` (prod) / `mock` (test) / `custom` | ✅ |
| `ADS_SOURCE_API_KEY` | Key ScrapeCreators (nhiều key phân cách `,` → tự rotation) | khi scrapecreators |
| `ADS_SOURCE_API_URL` | URL API ads thật (chỉ khi `custom`) | khi custom |
| `SUPABASE_URL` | `https://<project>.supabase.co` | cho bước đẩy Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (**secret**, bypass RLS để upsert) | cho bước đẩy Supabase |
| `EXA_API_KEY` | key Exa (chỉ 2 workflow manual dùng) | tùy chọn |

> ⚠️ `GOOGLE_SERVICE_ACCOUNT_JSON` là **toàn bộ JSON** (cả dấu `{ }`, `\n` trong private_key giữ nguyên).
> Dán nguyên văn vào ô value của Secret — GitHub lưu an toàn, không lộ trong log.

## 5. Chạy thủ công GitHub Actions

- Repo → tab **Actions** → chọn workflow **Weekly Spy Sync** → **Run workflow** → branch `main` → **Run workflow**.
- Hoặc đợi cron tự chạy 02:07 UTC thứ Sáu.

## 6. Xem log

- Actions → lần chạy mới nhất → job **spy-weekly** → step **Run weekly spy sync**.
- Log hiển thị: số brand active, số ad/cụm scale mỗi brand, số dòng ghi từng tab, và cảnh báo `[!]`.

## 7. Kiểm tra Google Sheets

- Mở Google Sheet → kiểm tra 5 tab lõi đã có dữ liệu tuần mới:
  `Brand Weekly Snapshot`, `Ad Level Analysis`, `Scaled Content Analysis`,
  `Weekly Strategy Change`, `SERYN Content Recommendations`.
- Pipeline còn ghi các tab visual/cache/provenance (`Visual Analysis`, `Ad Analysis Cache`,
  `Crawl Runs`, `Raw Ads Archive`…) và bước 2 ghi `Weekly_Summary` / `Action_Plan` /
  `Swipe_File_Suggestions` — danh sách đầy đủ: `docs/SHEETS_SCHEMA.md`.
- Cột `week_date` = thứ Hai của tuần chạy.

## 8. Dashboard Vercel đọc dữ liệu mới

- Cuối pipeline tự đẩy Supabase (khi có `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) —
  dashboard đọc Supabase là thấy dữ liệu mới ngay (badge **SUPABASE**).
- Hoặc mở dashboard → view **Dữ liệu** → **Refresh Online Data** (badge **GOOGLE SHEETS** nếu
  đang dùng fallback Apps Script). Cấu hình nguồn đọc: `docs/ONLINE_DATA.md`.

## 9. Đổi provider từ mock sang ads thật

### Cách A — ScrapeCreators (Facebook Ad Library) — khuyến nghị
Pull ads thật trực tiếp theo `page_id` của tab `Competitors`.
1. Lấy API key tại <https://scrapecreators.com/dashboard>.
2. Đặt Secrets trên GitHub:
   - `ADS_SOURCE_PROVIDER` = `scrapecreators`
   - `ADS_SOURCE_API_KEY` = key (có thể nhiều key phân cách `,` để tự rotation khi hết credit)
   - (tùy chọn) `ADS_SOURCE_COUNTRY` = `VN`, `ADS_SOURCE_MAX_ADS` = `80`
3. Chạy lại workflow. Script gọi `GET /v1/facebook/adLibrary/company/ads?pageId=...` (header `x-api-key`),
   map ad → classify (service/format/hook) → scale detect → cluster → ghi 5 bảng.
   - Brand `0 ad` (page tắt ad hoặc chạy qua page khác) → ghi warning, **không bịa**, xử lý brand còn lại.
   - Mỗi page_id tốn ~1 credit; tab `Competitors` 13 brand ≈ 19 page call/lần chạy.

### Cách B — API ads tùy biến (provider=custom)
1. Dựng/được cấp một API trả ads theo `brand_name` + `page_id` (JSON).
   - Script chấp nhận mảng ads ở `json`, `json.ads`, hoặc `json.data`; mỗi ad map các field:
     `ad_id/id`, `headline/title`, `primary_text/body/ad_creative_body`, `start_date/ad_delivery_start_time`,
     `media_type`, `platforms`, `cta`, `ad_snapshot_url`...
2. Đặt Secrets: `ADS_SOURCE_PROVIDER=custom`, `ADS_SOURCE_API_URL=<url>`, (tùy chọn) `ADS_SOURCE_API_KEY=<key>`.
3. Chạy lại workflow. Script tự classify, detect scale, cluster, và sinh 5 bảng.

---

## Chạy thử ở máy local

```bash
npm install
# .env: GOOGLE_SHEET_ID + (GOOGLE_SERVICE_ACCOUNT_FILE hoặc GOOGLE_SERVICE_ACCOUNT_JSON)
ADS_SOURCE_PROVIDER=mock npm run spy:weekly
```

Thiếu credentials (cả JSON lẫn FILE) → script báo lỗi rõ và dừng. Không commit `.env` / file JSON.
