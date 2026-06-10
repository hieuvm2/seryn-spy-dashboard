# SERYN Spy Dashboard — Online Data via Google Sheets

Hướng dẫn bật chế độ **ONLINE SHEET DATA**: dashboard Vercel đọc dữ liệu trực tiếp
từ Google Sheets qua một Google Apps Script Web App. Mọi người mở cùng một link
Vercel đều fetch cùng một URL → **xem chung một bộ dữ liệu**.

```
Google Sheets (5 tab) → Google Apps Script Web App (JSON) → Dashboard Vercel fetch → Mọi người xem chung
```

Các chế độ cũ vẫn hoạt động: **Upload CSV**, **Load Sample Data**, **localStorage fallback**,
và **OFFLINE CACHE** (khi online lỗi sẽ tự dùng dữ liệu đã lưu).

---

## Step 1 — Create Google Sheet

Tạo 1 Google Sheet với đúng **5 tab** (tên phân biệt hoa/thường, đúng tuyệt đối):

- `Brand Weekly Snapshot`
- `Ad Level Analysis`
- `Scaled Content Analysis`
- `Weekly Strategy Change`
- `SERYN Content Recommendations`

Dòng đầu mỗi tab là **header** đúng theo schema CSV của dự án (giữ nguyên tên cột tiếng Anh).
Có thể copy thẳng 5 file CSV trong `outputs/` của project vào từng tab tương ứng.

## Step 2 — Add Apps Script

Trong Google Sheet: **Extensions → Apps Script**.
Xóa code mẫu, dán toàn bộ nội dung file [`docs/google-apps-script-web-api.js`](docs/google-apps-script-web-api.js).
Lưu (Ctrl/Cmd + S).

## Step 3 — Deploy Web App

Trong Apps Script: **Deploy → New deployment**.

- **Type:** Web app
- **Execute as:** Me
- **Who has access:** Anyone
- Bấm **Deploy**, cấp quyền nếu được hỏi.
- Copy **Web app URL** dạng `https://script.google.com/macros/s/XXXX/exec`.

Mở thử URL `/exec` trên trình duyệt → phải thấy JSON `{"ok":true,"data":{...}}`.

## Step 4 — Add Vercel Environment Variable

Trong Vercel: **Project → Settings → Environment Variables**.

- **Name:** `VITE_GOOGLE_SHEETS_API_URL`
- **Value:** URL `/exec` ở Step 3
- **Environment:** Production (nên thêm cả Preview/Development nếu cần test)
- **Save**, sau đó **Redeploy** project.

> Vite chỉ inject các biến có tiền tố `VITE_` vào frontend tại lúc **build**, nên
> bắt buộc phải **redeploy** sau khi thêm/sửa biến này.

## Step 5 — Test

1. Mở link Vercel. Khi khởi động, dashboard tự fetch Google Sheets.
2. Header hiển thị badge **ONLINE SHEET DATA** (và `Syncing Google Sheets...` lúc đang tải).
3. Vào **Nhập dữ liệu** → khu vực *Nguồn dữ liệu online — Google Sheets*:
   - **API URL:** `Configured`
   - Bấm **Refresh Online Data** → báo `Đã cập nhật dữ liệu từ Google Sheets`.
4. Mở link trên máy/người khác → thấy **cùng dữ liệu**.
5. Sửa dữ liệu trong Google Sheet → bấm **Refresh Online Data** → dashboard cập nhật.

Nếu chưa cấu hình env, bấm Refresh sẽ báo `Missing VITE_GOOGLE_SHEETS_API_URL`,
và app vẫn chạy bằng dữ liệu mẫu / localStorage.

---

## Local development

Tạo file `.env.local` (đã được `.gitignore` bỏ qua):

```env
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Rồi chạy:

```bash
npm install
npm run dev
```

Xem thêm mẫu trong [`.env.example`](.env.example).

---

## How it works (kỹ thuật)

- `src/utils/onlineData.ts` → `fetchOnlineSpyData(apiUrl)`: fetch URL, kiểm tra
  `json.ok === true`, normalize 5 dataset về đúng type `SpyDashboardData`, thiếu
  field nào trả mảng rỗng, lỗi thì throw rõ ràng.
- `src/App.tsx`: khi khởi động, nếu có env thì fetch online → set data, badge
  `ONLINE SHEET DATA`, cache vào localStorage. Lỗi → fallback localStorage
  (`OFFLINE CACHE`) → sample data, không crash.
- `src/components/views/DataImportView.tsx`: hiển thị trạng thái cấu hình, nguồn
  hiện tại, lần đồng bộ gần nhất, nút **Refresh Online Data**; giữ nguyên Upload
  CSV / Sample / Clear / Data Health Check / lịch sử tuần.

## Important Security Notes

- **Không** nhúng service account JSON / private key vào frontend.
- **Không** commit `.env` / `.env.local` (đã có trong `.gitignore`).
- Apps Script Web App URL **chỉ dùng để đọc** dữ liệu dashboard.
- Vì "Who has access: Anyone", **đừng** để dữ liệu nhạy cảm trong Sheet này.
- Nếu cần bảo vệ thêm, có thể đặt token kiểm tra trong Apps Script (`e.parameter.key`)
  và thêm vào URL, hoặc chuyển sang proxy serverless (`api/sheets.ts` đã có sẵn
  trong repo như một phương án thay thế dùng `APPS_SCRIPT_URL` / `GSHEET_ID`).
