# Deploy SERYN Spy Dashboard lên Vercel

Dashboard là **frontend tĩnh (SPA)** — React + Vite + TypeScript + Tailwind, **không có backend**.
Dữ liệu đọc từ Google Sheets (online) hoặc CSV (local) + localStorage. Bước này chỉ deploy frontend.

> Ứng dụng nằm ở **gốc repository này** (`package.json`, `src/`, `index.html` ở root).
> **Không có** thư mục con `web-react/`. Mọi lệnh dưới đây chạy ở **gốc repo**.

---

## 1. Chạy local

```bash
npm install
npm run dev          # → http://localhost:5173
```

## 2. Build production

```bash
npm run build        # vite build → tạo thư mục dist/
npm run preview      # xem thử bản build tại http://localhost:4173
```

Scripts trong `package.json`:

| Script | Lệnh |
|---|---|
| `dev` | `vite` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `lint` | `tsc --noEmit` |

## 3. Deploy bằng Vercel CLI

```bash
npm i -g vercel
vercel               # lần đầu: trả lời prompt (tạo project, link)
vercel --prod        # deploy bản production
```

Khi CLI hỏi:
- **In which directory is your code located?** → `.` (gốc repo)
- **Build Command** → `npm run build` (hoặc để Vercel tự nhận Vite)
- **Output Directory** → `dist`

## 4. Deploy qua GitHub (khuyến nghị)

1. Push repo lên GitHub (gốc repo chính là thư mục chứa `package.json`).
2. Vào **vercel.com → Add New → Project → Import** repo.
3. Ở màn cấu hình, nhập đúng các giá trị bên dưới rồi **Deploy**.
4. Mỗi lần `git push` → Vercel tự build lại.

### Cấu hình Vercel cần nhập

| Mục | Giá trị |
|---|---|
| **Root Directory** | `.` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` (= `vite build`) |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x hoặc 20.x |

> App nằm ở gốc repo nên Root Directory để `.` (mặc định). Không cần trỏ vào thư mục con.

## 5. `vercel.json`

Đã có sẵn `vercel.json` ở gốc repo:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/" }
  ]
}
```

App dùng **hash routing** (`#overview`, `#brands`…) nên về kỹ thuật không bắt buộc rewrite,
nhưng giữ file này để mọi đường dẫn deep-link đều fallback về `index.html` (an toàn cho SPA).

---

## 6. Lưu ý về dữ liệu (quan trọng cho bản online)

- **Không có backend.** Vercel chỉ phục vụ file tĩnh; không có database, không có API.
- **localStorage** lưu theo **từng trình duyệt / từng máy**:
  - `seryn_spy_dashboard_data_v2` — dữ liệu đang xem (reload không mất).
  - `seryn_spy_weekly_history_v1` — lịch sử snapshot theo tuần.
  - `seryn_spy_source_v2` — nguồn dữ liệu đang hiển thị.
  - Người dùng khác / máy khác sẽ **không thấy** dữ liệu bạn nhập. Xóa cache trình duyệt = mất dữ liệu.
- **Nhập dữ liệu trên bản online:** dùng **Import CSV thủ công** (tab *Nhập dữ liệu*) — kéo từng file trong 5 output, hoặc **Load Sample Data** để xem demo.
- **File System Access API (chọn cả thư mục):**
  - Chỉ chạy trên **Chrome/Edge**.
  - Người dùng phải **chọn thư mục local trên máy của họ**.
  - **Vercel/bản online KHÔNG thể tự đọc** folder local của máy bạn — đây là tính năng tiện cho người chạy agent ở máy cá nhân.
- **Trạng thái nguồn dữ liệu** hiển thị ở góc trên (badge):
  `DEMO DATA` · `LOCAL CSV DATA` · `LOCAL PROJECT FOLDER` · `ONLINE SHEET DATA`.

---

## 7. Nguồn dữ liệu online — Google Sheets (Apps Script)

Dashboard đọc 5 bảng **trực tiếp** từ một **Google Apps Script Web App** (trả JSON từ Google Sheets).
Frontend gọi URL cấu hình ở biến build-time **`VITE_GOOGLE_SHEETS_API_URL`** — đây **không phải secret**
(chỉ là endpoint đọc), **không** có service account / private key trong frontend. Nếu URL chưa cấu hình
hoặc API lỗi, dashboard **tự fallback** về localStorage / dữ liệu mẫu (không mất dữ liệu đang xem).

App tự fetch online khi mở (nếu đã cấu hình URL); hoặc bấm **Refresh Online Data** (tab *Nhập dữ liệu*)
→ badge chuyển `ONLINE SHEET DATA`.

### Cấu hình
1. Tạo Apps Script Web App đọc 5 tab và trả JSON — **code + hướng dẫn đầy đủ trong
   `README_GOOGLE_SHEETS_ONLINE_DATA.md`** (và `docs/google-apps-script-web-api.js`).
   Deploy **as Web app** · *Execute as* **Me** · *Who has access* **Anyone**.
2. (Khuyến nghị prod) Trong Apps Script → **Project Settings → Script properties** thêm
   `API_SECRET_KEY = <bí mật>` để bật bảo vệ key.
3. Copy URL `https://script.google.com/macros/s/XXX/exec`.
4. Vercel → *Settings → Environment Variables*:
   - `VITE_GOOGLE_SHEETS_API_URL = <URL>`
   - `VITE_GOOGLE_SHEETS_API_KEY = <đúng API_SECRET_KEY>` (nếu đã bật key)
   → **Redeploy**.

> Sheet vẫn **riêng tư**; Apps Script chạy bằng quyền owner. Vì *Who has access: Anyone*, hãy đặt
> `API_SECRET_KEY` cho production — thiếu/sai key API sẽ trả `{ok:false, error:"Unauthorized"}`.
> Frontend đọc/ghi 5 bảng dashboard + 2 tab **Swipe File**, **Creative Briefs** (xem
> `README_GOOGLE_SHEETS_ONLINE_DATA.md`).

### Ghi dữ liệu lên Sheet
Dùng script **local** `npm run spy:sync` (service account, đọc file JSON ngoài repo) — xem
`docs/GOOGLE_SHEETS_LOCAL_SYNC.md`. Đây là chiều **ghi**; phần trên là chiều **đọc** cho dashboard.

## 8. Phạm vi backend

**Không có backend.** Dashboard là **SPA tĩnh thuần** (chỉ `dist/`), đọc online trực tiếp từ Apps Script
Web App. Không database, không serverless function, không secret ở client. Mọi nhập/xóa/lịch sử chạy
hoàn toàn trong trình duyệt (localStorage).
