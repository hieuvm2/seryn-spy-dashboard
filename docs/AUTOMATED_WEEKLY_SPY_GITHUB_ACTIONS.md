# Tự động spy ads hằng tuần bằng GitHub Actions

```
GitHub Actions (cron thứ 2)  ──►  npm run spy:weekly
   → đọc tab Competitors → pull ads (mock|custom) → phân tích
   → ghi 5 tab Google Sheets  ──►  Apps Script doGet  ──►  Dashboard Vercel
```

- Workflow: `.github/workflows/weekly-spy.yml`
- Script: `scripts/weekly-spy-sync.mjs` (`npm run spy:weekly`)
- Lịch: **02:00 UTC thứ Hai** = ~**09:00 sáng thứ Hai giờ Việt Nam** (UTC+7). Cron: `0 2 * * 1`.
- Provider hiện tại: **`mock`** (test pipeline). Đổi sang ads thật ở mục 9.

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
- Tạo tab **`Competitors`** theo `docs/COMPETITORS_SHEET_SCHEMA.md` (hoặc để trống nếu test bằng mock).

## 4. Thêm GitHub Secrets

Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Giá trị | Bắt buộc |
|---|---|---|
| `GOOGLE_SHEET_ID` | `11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q` | ✅ |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Dán toàn bộ nội dung** file JSON service account | ✅ |
| `ADS_SOURCE_PROVIDER` | `mock` (hoặc `custom`) | ✅ |
| `ADS_SOURCE_API_URL` | URL API ads thật (chỉ khi `custom`) | khi custom |
| `ADS_SOURCE_API_KEY` | Key API ads thật (nếu API cần) | tùy chọn |

> ⚠️ `GOOGLE_SERVICE_ACCOUNT_JSON` là **toàn bộ JSON** (cả dấu `{ }`, `\n` trong private_key giữ nguyên).
> Dán nguyên văn vào ô value của Secret — GitHub lưu an toàn, không lộ trong log.

## 5. Chạy thủ công GitHub Actions

- Repo → tab **Actions** → chọn workflow **Weekly Spy Sync** → **Run workflow** → branch `main` → **Run workflow**.
- Hoặc đợi cron tự chạy 02:00 UTC thứ Hai.

## 6. Xem log

- Actions → lần chạy mới nhất → job **spy-weekly** → step **Run weekly spy sync**.
- Log hiển thị: số brand active, số ad/cụm scale mỗi brand, số dòng ghi từng tab, và cảnh báo `[!]`.

## 7. Kiểm tra Google Sheets

- Mở Google Sheet → kiểm tra 5 tab đã có dữ liệu tuần mới:
  `Brand Weekly Snapshot`, `Ad Level Analysis`, `Scaled Content Analysis`,
  `Weekly Strategy Change`, `SERYN Content Recommendations`.
- Cột `week_date` = thứ Hai của tuần chạy.

## 8. Dashboard Vercel đọc dữ liệu mới

- Mở dashboard → tab **Nhập dữ liệu** → **Refresh Online Data** (hoặc reload trang).
- Badge chuyển **ONLINE SHEET DATA**; dữ liệu mới hiển thị. (Dashboard đọc qua Apps Script `doGet`,
  cấu hình bằng `VITE_GOOGLE_SHEETS_API_URL` — xem `README_GOOGLE_SHEETS_ONLINE_DATA.md`.)

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
