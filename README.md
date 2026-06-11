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

---

## 9 view

Tổng quan · Đối thủ (click mở drawer) · Nội dung nhân rộng · Top Hooks · **Swipe File** ·
**Creative Briefs** · Thay đổi tuần · Gợi ý cho SERYN · Nhập dữ liệu.

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
