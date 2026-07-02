# Deploy SERYN Spy Dashboard lên Vercel

Dashboard là **frontend tĩnh (SPA)** — React + Vite + TypeScript + Tailwind, **không có backend**.
Dữ liệu đọc từ Supabase (chính) / Google Sheets (fallback) / CSV local + localStorage.
Bước này chỉ deploy frontend; cấu hình nguồn dữ liệu xem [`docs/ONLINE_DATA.md`](ONLINE_DATA.md).

> Ứng dụng nằm ở **gốc repository này** (`package.json`, `src/`, `index.html` ở root).
> Mọi lệnh dưới đây chạy ở **gốc repo**.

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
npm run lint         # type-check (tsc --noEmit)
```

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
| **Node.js Version** | 20.x hoặc 22.x |

### Environment Variables (Settings → Environment Variables → Redeploy)

| Biến | Vai trò |
|---|---|
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | nguồn đọc **chính** (Supabase) |
| `VITE_GOOGLE_SHEETS_API_URL` | nguồn đọc **fallback** (Apps Script) |
| `VITE_GOOGLE_SHEETS_API_KEY` | chỉ khi Apps Script bật `API_SECRET_KEY` |

Chi tiết từng biến + cách lấy giá trị: [`docs/ONLINE_DATA.md`](ONLINE_DATA.md).

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

- **Không có backend.** Vercel chỉ phục vụ file tĩnh; không database, không serverless function,
  không secret ở client.
- **localStorage** lưu theo **từng trình duyệt / từng máy**:
  - `seryn_spy_dashboard_data_v2` — dữ liệu đang xem (reload không mất).
  - `seryn_spy_weekly_history_v1` — lịch sử snapshot theo tuần.
  - `seryn_spy_source_v2` — nguồn dữ liệu đang hiển thị.
  - Người dùng khác / máy khác sẽ **không thấy** dữ liệu bạn nhập thủ công. Muốn mọi người xem chung
    → dùng nguồn online (Supabase/Sheets).
- **Nhập dữ liệu thủ công trên bản online:** view **Dữ liệu** → Import CSV từng file, hoặc
  **Load Sample Data** để xem demo.
- **Badge nguồn dữ liệu** ở góc trên: `DỮ LIỆU MẪU` · `CSV THỦ CÔNG` · `GOOGLE SHEETS` ·
  `SUPABASE` · `BẢN OFFLINE`.
