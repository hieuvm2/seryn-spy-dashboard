# Pipeline local: MOCK data → Google Sheets → Dashboard

Hướng dẫn chạy script local `scripts/run-weekly-spy-and-sync.mjs` để **ghi dữ liệu spy ads
(mock) lên Google Sheets**. Dashboard Vercel sẽ đọc lại qua `/api/sheets` (nút *Refresh Online Data*).

> Bước này chỉ test **pipeline ghi Sheet** bằng mock data. Chưa pull ads thật.
> Secret (service account JSON) nằm **ngoài repo**, không commit, không vào frontend.

---

## 1. Tạo Google Cloud Service Account

1. Vào <https://console.cloud.google.com/> → tạo (hoặc chọn) một **Project**.
2. **APIs & Services → Library** → tìm **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service account**.
   - Đặt tên (vd `seryn-sheets-writer`) → Create → Done.
4. Mở service account vừa tạo → tab **Keys → Add key → Create new key → JSON** → tải file `.json` về.

## 2. Lưu file credential (KHÔNG commit)

Đặt file JSON vào đường dẫn (ngoài repo, đã được `.gitignore` bỏ qua):

```
C:/seryn-spy-agent/secrets/google-service-account.json
```

> Thư mục `secrets/` và mọi `*.json` lạ đã nằm trong `.gitignore` → an toàn, không bị commit.

## 3. Share Google Sheet cho service account

1. Mở file JSON, copy giá trị **`client_email`** (dạng `...@...iam.gserviceaccount.com`).
2. Mở Google Sheet đích (ID `11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q`) →
   **Share** → dán email service account → quyền **Editor** → Send.

## 4. Tạo file `.env` từ `.env.example`

Trong thư mục `web-react/`:

```bash
copy .env.example .env       # Windows (hoặc: cp .env.example .env)
```

Mở `.env`, đảm bảo 2 dòng sau đúng:

```
GOOGLE_SHEET_ID=11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q
GOOGLE_SERVICE_ACCOUNT_FILE=C:/seryn-spy-agent/secrets/google-service-account.json
```

> `.env` đã được `.gitignore` bỏ qua — không bao giờ commit.

## 5. Cài dependencies & chạy

```bash
cd web-react
npm install            # googleapis + dotenv (đã có trong package.json)
npm run spy:sync
```

Kết quả mong đợi (log):

```
SERYN Spy — sync MOCK -> Google Sheets
Sheet ID : 11WRRCa5...
week_date: 2026-06-xx
  [OK] Brand Weekly Snapshot: ghi 5 dòng dữ liệu (+1 dòng header)
  [OK] Ad Level Analysis: ghi 7 dòng ...
  [OK] Scaled Content Analysis: ghi 5 dòng ...
  [OK] Weekly Strategy Change: ghi 5 dòng ...
  [OK] SERYN Content Recommendations: ghi 5 dòng ...
Xong: 5/5 tab, tổng 27 dòng dữ liệu.
```

## 6. Kiểm tra Google Sheet

Mở Sheet → 5 tab phải có **header đúng schema ở dòng 1** và data mock từ dòng 2.
Mỗi dòng mock có ghi chú `[MOCK]` ở `content_strategy_summary` / `notes` / `seryn_reframe`.

## 7. Kiểm tra Dashboard online

1. Trên Vercel, đảm bảo function `/api/sheets` đọc đúng Sheet:
   - Cách A: env `GSHEET_ID = 11WRRCa5...` (Sheet share *Anyone with link: Viewer* — hoặc dùng Cách B Apps Script nếu muốn giữ riêng tư).
   - Xem `README_DEPLOY_VERCEL.md` mục 7.
2. Mở dashboard → tab **Nhập dữ liệu** → bấm **Refresh Online Data** → badge chuyển **ONLINE SHEET DATA**, 5 bảng hiển thị dữ liệu vừa ghi.

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân & cách sửa |
|---|---|
| `Không tìm thấy service account JSON tại …` | Sai đường dẫn `GOOGLE_SERVICE_ACCOUNT_FILE` hoặc chưa tải file JSON về. |
| `The caller does not have permission` | Chưa **Share Sheet (Editor)** cho `client_email` của service account. |
| `Google Sheets API has not been used/enabled` | Chưa **Enable Google Sheets API** trong project Google Cloud. |
| `Unable to parse range` | Tên tab sai — Sheet phải có đúng 5 tab (script tự tạo nếu thiếu). |
| Dashboard không thấy dữ liệu | Kiểm tra env `GSHEET_ID`/`APPS_SCRIPT_URL` trên Vercel + quyền chia sẻ Sheet. |

## Bước sau (chưa làm ở đây)

Khi pipeline mock chạy ổn, sẽ nâng cấp: **nguồn ads thật → phân tích → thay mock bằng dữ liệu thật**
trong cùng script (giữ nguyên phần ghi Google Sheets).
