# Deploy SERYN Spy Dashboard lên Vercel

Dashboard là **frontend tĩnh (SPA)** — React + Vite + TypeScript + Tailwind, **không có backend**.
Toàn bộ dữ liệu nằm trong trình duyệt (localStorage) + nhập CSV thủ công. Bước này chỉ deploy frontend.

> Thư mục dự án React nằm ở `web-react/`. Mọi lệnh dưới đây chạy **trong `web-react/`**.

---

## 1. Chạy local

```bash
cd web-react
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
cd web-react
vercel               # lần đầu: trả lời prompt (tạo project, link)
vercel --prod        # deploy bản production
```

Khi CLI hỏi:
- **In which directory is your code located?** → `.` (đang đứng trong `web-react`)
- **Build Command** → `npm run build` (hoặc để Vercel tự nhận Vite)
- **Output Directory** → `dist`

## 4. Deploy qua GitHub (khuyến nghị)

1. Push repo lên GitHub (cả thư mục dự án; React app nằm trong `web-react/`).
2. Vào **vercel.com → Add New → Project → Import** repo.
3. Ở màn cấu hình, nhập đúng các giá trị bên dưới rồi **Deploy**.
4. Mỗi lần `git push` → Vercel tự build lại.

### Cấu hình Vercel cần nhập

| Mục | Giá trị |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `web-react`  ⚠️ (vì app nằm trong thư mục con) |
| **Build Command** | `npm run build` (= `vite build`) |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x hoặc 20.x |

> Nếu bạn tạo repo riêng **chỉ chứa nội dung `web-react/`** thì Root Directory để trống (`.`).

## 5. `vercel.json`

Đã có sẵn `web-react/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
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

## 7. Nguồn dữ liệu online — Google Sheets

Dashboard có thể đọc 5 bảng trực tiếp từ Google Sheets qua serverless function
`web-react/api/sheets.ts` (Vercel tự nhận `api/*` thành Serverless Function).
**Không có service account JSON / API key nào nằm trong frontend** — mọi cấu hình đặt ở
Vercel → *Settings → Environment Variables* (server-side). Nếu API lỗi, dashboard **tự fallback**
về localStorage / dữ liệu mẫu (không mất dữ liệu đang xem).

Bấm **Refresh Online Data** (tab *Nhập dữ liệu*) để nạp → badge chuyển `ONLINE SHEET DATA`.

> ⚠️ `/api/sheets` chỉ chạy trên Vercel (hoặc `vercel dev`). Khi chạy `npm run dev` (vite thuần),
> nút Refresh sẽ báo lỗi và giữ nguyên dữ liệu local — đúng theo cơ chế fallback.

### Cách A — Google Sheet công khai (đơn giản, không cần key)

1. Mở Google Sheet chứa 5 tab (đúng tên worksheet như `scripts/sheets_sync.py` tạo ra):
   `Brand Weekly Snapshot`, `Ad Level Analysis`, `Scaled Content Analysis`,
   `Weekly Strategy Change`, `SERYN Content Recommendations`.
2. **Share → Anyone with the link → Viewer**.
3. Lấy Spreadsheet ID từ URL (`.../spreadsheets/d/<ID>/edit`).
4. Vercel → Environment Variables:
   - `GSHEET_ID` = `<ID>`
   - *(tùy chọn nếu đổi tên tab)* `GTAB_SNAPSHOT`, `GTAB_ADS`, `GTAB_SCALED`, `GTAB_CHANGES`, `GTAB_RECS`
5. Redeploy → bấm **Refresh Online Data**.

> Cách A khiến Sheet **công khai cho ai có link**. Hợp với dữ liệu không nhạy cảm. Muốn giữ Sheet riêng tư → dùng Cách B.

### Cách B — Google Apps Script Web App (giữ Sheet riêng tư)

1. Trong Google Sheet: **Extensions → Apps Script**, dán đoạn sau vào `Code.gs`:

```javascript
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabs = {
    brand_weekly_snapshot: "Brand Weekly Snapshot",
    ad_level_analysis: "Ad Level Analysis",
    scaled_content_analysis: "Scaled Content Analysis",
    weekly_strategy_change: "Weekly Strategy Change",
    seryn_content_recommendations: "SERYN Content Recommendations"
  };
  const out = {};
  for (const key in tabs) {
    const sh = ss.getSheetByName(tabs[key]);
    if (!sh) { out[key] = []; continue; }
    const values = sh.getDataRange().getValues();
    const header = (values.shift() || []).map(String);
    out[key] = values.map(function (row) {
      const o = {};
      header.forEach(function (h, i) { o[h] = row[i] == null ? "" : String(row[i]); });
      return o;
    });
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
```

2. **Deploy → New deployment → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
3. Copy URL web app (`https://script.google.com/macros/s/XXX/exec`).
4. Vercel → Environment Variables: `APPS_SCRIPT_URL` = `<URL>` (khi có biến này, function ưu tiên dùng Cách B).
5. Redeploy → bấm **Refresh Online Data**.

> Cách B: Sheet vẫn **riêng tư**; Apps Script chạy bằng quyền của bạn (owner) và chỉ trả JSON 5 bảng.

### Test serverless function ở local
```bash
npm i -g vercel
cd web-react
vercel dev          # chạy cả Vite + /api/sheets ở local (cần đã `vercel link`)
```

## 8. Phạm vi backend

Backend duy nhất là **1 serverless function read-only** (`api/sheets.ts`) làm proxy đọc Google Sheets.
Không có database, không ghi dữ liệu, không lưu secret ở client. Mọi thao tác nhập/xóa/lịch sử vẫn
chạy hoàn toàn trong trình duyệt (localStorage).
