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

Tạo 1 Google Sheet với **5 tab dashboard** (tên phân biệt hoa/thường, đúng tuyệt đối):

- `Brand Weekly Snapshot`
- `Ad Level Analysis`
- `Scaled Content Analysis`
- `Weekly Strategy Change`
- `SERYN Content Recommendations`

Dòng đầu mỗi tab là **header** đúng theo schema CSV của dự án (giữ nguyên tên cột tiếng Anh).
Có thể copy thẳng 5 file CSV trong `outputs/` của project vào từng tab tương ứng.

**+ 2 tab nội dung** cho Swipe File & Creative Briefs (đọc/ghi 2 chiều — xem mục
*Swipe File & Creative Briefs sync* bên dưới). Có thể để trống; Apps Script tự tạo tab + header
khi lần đầu ghi:

- `Swipe File`
- `Creative Briefs`

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

## Step 3.5 — (Khuyến nghị) Bật bảo vệ API key

Mặc định *Who has access: Anyone* nghĩa là **bất kỳ ai có URL đều đọc được dữ liệu**.
Bật một lớp khóa nhẹ bằng **Script Property**:

1. Trong Apps Script: **Project Settings (⚙️) → Script properties → Add script property**.
2. **Name:** `API_SECRET_KEY` · **Value:** chuỗi bí mật của bạn (vd `seryn-7f3a...`).
3. Lưu. Từ giờ mọi request thiếu/sai `?key=...` sẽ nhận `{"ok":false,"error":"Unauthorized"}`.

> Bí mật nằm trong **Script Properties** (server-side), **không** hardcode trong source công khai.
> Chưa đặt `API_SECRET_KEY` thì API mở (tương thích ngược) — production nên đặt key.

## Step 4 — Add Vercel Environment Variables

Trong Vercel: **Project → Settings → Environment Variables**.

| Name | Value |
|---|---|
| `VITE_GOOGLE_SHEETS_API_URL` | URL `/exec` ở Step 3 |
| `VITE_GOOGLE_SHEETS_API_KEY` | **đúng** `API_SECRET_KEY` ở Step 3.5 (bỏ qua nếu chưa bật key) |

- **Environment:** Production (nên thêm cả Preview/Development nếu cần test)
- **Save**, sau đó **Redeploy** project.

> Vite chỉ inject các biến có tiền tố `VITE_` vào frontend tại lúc **build**, nên
> bắt buộc phải **redeploy** sau khi thêm/sửa biến này. Frontend tự nối `?key=...` vào mọi
> request khi `VITE_GOOGLE_SHEETS_API_KEY` có giá trị (xem `src/utils/sheetsApi.ts`).

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
# Chỉ cần nếu đã bật API_SECRET_KEY trong Apps Script:
VITE_GOOGLE_SHEETS_API_KEY=your-secret-key
```

Rồi chạy:

```bash
npm install
npm run dev
```

Xem thêm mẫu trong [`.env.example`](.env.example).

---

## Swipe File & Creative Briefs sync (2 tab nội dung)

Ngoài 5 bảng dashboard (read-only), dashboard còn **đọc/ghi 2 chiều** 2 tab nội dung khi đã cấu hình
`VITE_GOOGLE_SHEETS_API_URL`. Chưa cấu hình thì 2 mục này **vẫn chạy bằng localStorage** như cũ
(offline). Có cấu hình thì localStorage đóng vai trò **cache/fallback**.

- **Đọc:** `GET ?type=swipe_file` · `GET ?type=creative_briefs` → `{ ok:true, data:[...] }`.
- **Ghi:** `POST` body JSON `{ type, action, record }` với `action` = `create | update | upsert | delete`
  (delete chỉ cần `{ type, action:"delete", id }`). Khóa theo cột `id` (ổn định) → **không tạo bản ghi trùng**.
- App ghi **optimistic** vào localStorage trước (UI mượt), rồi đồng bộ Sheets nền; lỗi mạng → giữ bản local.

### Tab `Swipe File` — header (dòng 1, đúng thứ tự)

```
id, savedAt, sourceType, brand_name, hook, service_or_product, content_format,
content_angle, offer_detected, proof_point, scale_level, reason_to_save, action,
seryn_reframe, notes, tags
```

> `tags` lưu dạng JSON array (vd `["doctor","education"]`). Bắt buộc: `id`, `hook`.

### Tab `Creative Briefs` — header (dòng 1, đúng thứ tự)

```
id, createdAt, sourceType, title, brand_name, objective, market_signal,
competitor_evidence, seryn_angle, target_audience, core_message, hook_options,
content_format, script_outline, visual_direction, proof_points, cta, kpi, dos, donts, markdown
```

> Các cột mảng (`hook_options`, `script_outline`, `proof_points`, `dos`, `donts`) lưu dạng JSON array.
> Bắt buộc: `id`, `title`. (Header trên bám sát data model thực tế của app — lossless round-trip; nên
> để Apps Script tự tạo tab/header lần ghi đầu thay vì gõ tay.)

> Header phải **khớp** serializer ở `src/utils/swipeFile.ts` / `src/utils/briefs.ts` và mảng `RECORD_TABS`
> trong `docs/google-apps-script-web-api.js`. Sửa cột thì sửa cả 3 nơi.

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

- **Không** nhúng service account JSON / private key vào frontend. `VITE_GOOGLE_SHEETS_API_KEY`
  chỉ là *shared secret* mức nhẹ (chống người lạ đọc URL), **không** phải khóa riêng tư.
- **Không** commit `.env` / `.env.local` (đã có trong `.gitignore`).
- Bật `API_SECRET_KEY` (Script Property) cho production — thiếu/sai key → `{ok:false, error:"Unauthorized"}`.
- Vì "Who has access: Anyone", **đừng** để dữ liệu nhạy cảm trong Sheet này.
- Apps Script có thể **ghi** 2 tab `Swipe File` / `Creative Briefs` (doPost). Các tab 5 bảng
  dashboard vẫn **chỉ đọc** từ phía frontend.
