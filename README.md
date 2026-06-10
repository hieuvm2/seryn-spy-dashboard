# SERYN Weekly Spy Dashboard

Dashboard React + Vite + TypeScript hiển thị **kết quả spy ads đối thủ theo tuần** cho SERYN Clinic.
Tĩnh thuần (không backend), đọc dữ liệu từ Google Sheets, fallback localStorage / dữ liệu mẫu.

## Chạy
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview
```

## 6 view
Tổng quan · Đối thủ (click mở drawer chi tiết) · Nội dung nhân rộng · Thay đổi tuần · Gợi ý cho SERYN · Nhập dữ liệu.

## Nguồn dữ liệu
- **DEMO DATA** — dữ liệu mẫu nhúng sẵn.
- **LOCAL CSV DATA** — nhập tay 1 trong 5 CSV.
- **LOCAL PROJECT FOLDER** — chọn thư mục project, đọc cả 5 CSV (Chrome/Edge).
- **ONLINE SHEET DATA** — đọc Google Sheets qua Apps Script Web App (`VITE_GOOGLE_SHEETS_API_URL`).

Mọi dữ liệu lưu trong trình duyệt (localStorage), reload không mất; có lịch sử snapshot theo tuần.

## Đồng bộ & deploy
- **Ghi dữ liệu lên Sheet:** `npm run spy:sync` (đọc `outputs/*.csv` của agent → Google Sheets bằng service account). Xem `docs/GOOGLE_SHEETS_LOCAL_SYNC.md`.
- **Đọc online:** `docs/google-apps-script-web-api.js` + `README_GOOGLE_SHEETS_ONLINE_DATA.md`.
- **Deploy Vercel:** `README_DEPLOY_VERCEL.md` (Framework Vite · Output `dist`).

## Cấu trúc
```
src/
  App.tsx                  router 6 view + localStorage + drawer
  types.ts                 schema 5 bảng (SpyDashboardData)
  sampleData.ts            dữ liệu demo
  utils/spyData.ts         CSV parse, localStorage, health-check, viLabel
  utils/onlineData.ts      đọc Apps Script (ONLINE SHEET DATA)
  components/              Sidebar · TopHeader · BrandDetailDrawer
  components/views/        6 view
scripts/run-weekly-spy-and-sync.mjs   sync outputs/ -> Google Sheets
docs/                      hướng dẫn Sheets/Apps Script/deploy
```
