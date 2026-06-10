# Tự động đồng bộ dữ liệu spy → Google Sheets → Dashboard

```
Agent spy ghi 5 CSV (outputs/)  ──►  npm run spy:sync  ──(Service Account)──►  Google Sheet  ──►  Apps Script doGet  ──►  Dashboard
```

- Script local **đọc 5 CSV thật** trong `outputs/` rồi **ghi thẳng** vào 5 tab Google Sheets bằng **Service Account**.
- Dashboard **đọc** Sheet qua **Apps Script Web App** (`doGet`, biến `VITE_GOOGLE_SHEETS_API_URL`).

> Nếu org chặn tạo service account key: tạo key ở **một project Google Cloud cá nhân** (ngoài org),
> rồi Share Sheet cho service account đó — vẫn ghi được. (Đã áp dụng.)

---

## A. Thiết lập 1 lần

### 1) Service Account + key
1. <https://console.cloud.google.com/> → chọn/tạo project (cá nhân nếu org chặn key).
2. **APIs & Services → Library → Google Sheets API → Enable**.
3. **Credentials → Create credentials → Service account** → tạo → tab **Keys → Add key → JSON** → tải file.
4. Lưu file vào (ngoài repo, đã gitignore):
   ```
   C:\seryn-spy-agent\secrets\google-service-account.json
   ```
5. Mở file JSON lấy **`client_email`** → mở Google Sheet → **Share → email đó → Editor**.

### 2) `.env` (trong `web-react/`, không commit)
```
GOOGLE_SHEET_ID=11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q
GOOGLE_SERVICE_ACCOUNT_FILE=C:/seryn-spy-agent/secrets/google-service-account.json
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/XXXX/exec   # cho dashboard đọc
```

### 3) Dashboard đọc online (đã có)
Apps Script `doGet` (file `docs/google-apps-script-web-api.js`) deploy as Web App (Anyone) →
đặt `VITE_GOOGLE_SHEETS_API_URL` trên Vercel → Redeploy. Xem `README_GOOGLE_SHEETS_ONLINE_DATA.md`.

## B. Đồng bộ thủ công
```bash
cd web-react
npm run spy:sync
```
Log: `[OK] Brand Weekly Snapshot: ghi 13 dòng ... Xong: 5/5 tab, tổng 537 dòng.`
→ Mở dashboard bấm **Refresh Online Data** (hoặc reload).

> Thiếu CSV nào trong `outputs/` → script bỏ qua tab đó (báo `[!]`). Lỗi `caller does not have permission`
> = chưa Share Sheet (Editor) cho `client_email` của service account.

## C. Tự động hoá — "khi spy ads thì tự đồng bộ"

Agent pull ads (ghi `outputs/`) chạy trên máy bạn, nên lên lịch bằng **Windows Task Scheduler**:

1. Tạo `C:\seryn-spy-agent\sync.bat`:
   ```bat
   @echo off
   cd /d C:\seryn-spy-agent\web-react
   call npm run spy:sync >> C:\seryn-spy-agent\outputs\sync.log 2>&1
   ```
2. **Task Scheduler → Create Task** → Trigger **Weekly (Thứ Hai)** → Action chạy `sync.bat`.
3. Trước đó cập nhật `outputs/` (chạy agent spy). Có thể gộp: agent → `npm run spy:sync` trong cùng batch.

> Quy trình "khi spy ads → tự đồng bộ": **chạy agent (ghi outputs/) ➜ `npm run spy:sync`**.
> Dashboard online tự lấy bản mới mỗi lần mở / bấm Refresh.

## Nguồn ads THẬT (đã nối)
Script đọc trực tiếp output thật của agent:

| Dataset | File |
|---|---|
| Brand Weekly Snapshot | `outputs/weekly_snapshots/brand_weekly_snapshot.csv` |
| Ad Level Analysis | `outputs/normalized_ads/ad_level_analysis.csv` |
| Scaled Content Analysis | `outputs/normalized_ads/scaled_content_analysis.csv` |
| Weekly Strategy Change | `outputs/weekly_snapshots/weekly_strategy_change.csv` |
| SERYN Content Recommendations | `outputs/creative_briefs/seryn_content_recommendations.csv` |

Mỗi lần agent spy xong, chỉ cần `npm run spy:sync` là đẩy dữ liệu thật lên Sheet → dashboard cập nhật.

> Ghi chú: `docs/google-apps-script-seed-mock.js` (seedMockData / doPost / trigger) là **phương án dự phòng**
> (ghi qua Apps Script khi không có service account). Hiện KHÔNG dùng vì đã có service account.
