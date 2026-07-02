# Dữ liệu online — Google Sheets + Supabase (vòng đọc/ghi đầy đủ)

Tài liệu này gộp toàn bộ luồng dữ liệu online của dashboard: **ghi** (pipeline → Google Sheets),
**mirror** (Sheets → Supabase) và **đọc** (dashboard đọc **Supabase trước**, fallback Apps Script).

```
Pipeline (spy:weekly / spy:sync)
        │  Service Account (GHI)
        ▼
Google Sheet (~15+ tab)  ──►  npm run supabase:sync  ──►  Supabase (bảng spy_data)
        │                                                        │
        │  Apps Script doGet (JSON) — FALLBACK                   │  anon key (ĐỌC)
        ▼                                                        ▼
   Dashboard (Vercel): đọc SUPABASE trước → GOOGLE SHEETS → BẢN OFFLINE (localStorage) → DỮ LIỆU MẪU
```

Badge nguồn dữ liệu ở góc trên dashboard (đúng nhãn trong `src/utils/spyData.ts`):
`DỮ LIỆU MẪU` · `CSV THỦ CÔNG` · `GOOGLE SHEETS` · `SUPABASE` · `BẢN OFFLINE`.

---

## Step 1 — Tạo Google Sheet

Tạo 1 Google Sheet (ID hiện dùng: `11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q`).
**Không cần tạo tab thủ công** — pipeline (`npm run spy:weekly`) và các script tự tạo tab + header
khi ghi lần đầu. 5 tab lõi (khớp 5 CSV trong `outputs/`):

- `Brand Weekly Snapshot`
- `Ad Level Analysis`
- `Scaled Content Analysis`
- `Weekly Strategy Change`
- `SERYN Content Recommendations`

Ngoài ra pipeline còn ghi các tab visual / cache / provenance / report (~15+ tab).
Danh sách + header đầy đủ: xem [`docs/SHEETS_SCHEMA.md`](SHEETS_SCHEMA.md).

## Step 2 — Apps Script Web App (chiều ĐỌC fallback)

1. Trong Google Sheet: **Extensions → Apps Script**. Xóa code mẫu, dán toàn bộ
   [`docs/google-apps-script-web-api.js`](google-apps-script-web-api.js). Lưu.
2. (Khuyến nghị prod) **Project Settings (⚙️) → Script properties → Add script property**:
   - **Name:** `API_SECRET_KEY` · **Value:** chuỗi bí mật của bạn.
   - Từ đó mọi request thiếu/sai `?key=...` nhận `{"ok":false,"error":"Unauthorized"}`.
   - Chưa đặt key → API mở (tương thích ngược) — production nên đặt.
3. **Deploy → New deployment → Web app** · *Execute as* **Me** · *Who has access* **Anyone** →
   copy URL dạng `https://script.google.com/macros/s/XXXX/exec`.
4. Mở thử URL `/exec` → phải thấy JSON `{"ok":true,"data":{...}}`.

`doGet` (không có `?type`) trả **~19 dataset** theo `SHEET_MAP` (5 bảng lõi + visual + change
insights + crawl runs + Market Intelligence + Competitor Discovery + Hook Intelligence +
Weekly_Summary/Action_Plan/Swipe_File_Suggestions + Weekly/Monthly Reports + Own Brand Pages).
`doGet ?type=...` / `doPost` đọc/ghi 4 tab record trong `RECORD_TABS`:
`competitors`, `competitor_discovery`, `action_plan`, `swipe_suggestions`.

> ⚠️ Mỗi lần sửa file Apps Script phải **Deploy → Manage deployments → New version**
> thì URL `/exec` mới chạy code mới.

## Step 3 — Environment Variables trên Vercel

Vercel → **Project → Settings → Environment Variables** → thêm → **Redeploy**
(Vite chỉ inject biến `VITE_` lúc **build**):

| Name | Value | Vai trò |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` | Nguồn đọc **chính** (Supabase) |
| `VITE_SUPABASE_ANON_KEY` | anon public key | Đọc Supabase (chỉ SELECT theo RLS) |
| `VITE_GOOGLE_SHEETS_API_URL` | URL `/exec` ở Step 2 | Nguồn đọc **fallback** (Apps Script) |
| `VITE_GOOGLE_SHEETS_API_KEY` | đúng `API_SECRET_KEY` | Chỉ khi Apps Script đã bật key |

Có `VITE_SUPABASE_*` → dashboard đọc Supabase, badge **SUPABASE**. Không có → dùng Apps Script,
badge **GOOGLE SHEETS**. Online lỗi → tự fallback localStorage (**BẢN OFFLINE**) → **DỮ LIỆU MẪU**,
không crash. Nút **Refresh Online Data** nằm ở view **Dữ liệu**.

## Step 4 — Chiều GHI local: service account + `npm run spy:sync`

`npm run spy:sync` (`scripts/sync-outputs-to-sheet.mjs`) **copy 5 CSV** trong `outputs/` của agent
lên 5 tab lõi. **Không crawl** — crawl + phân tích là việc của `npm run spy:weekly`
(xem [`docs/AUTOMATED_WEEKLY_SPY_GITHUB_ACTIONS.md`](AUTOMATED_WEEKLY_SPY_GITHUB_ACTIONS.md)).

### Thiết lập 1 lần (service account)
1. <https://console.cloud.google.com/> → chọn/tạo project (project **cá nhân** nếu org chặn tạo key).
2. **APIs & Services → Library → Google Sheets API → Enable**.
3. **Credentials → Create credentials → Service account** → tạo → tab **Keys → Add key → JSON** → tải file.
4. Lưu file **ngoài repo** (đã gitignore), ví dụ: `C:\seryn-spy-agent\secrets\google-service-account.json`.
5. Mở file JSON lấy `client_email` → mở Google Sheet → **Share → email đó → Editor**.

### `.env` ở gốc repo (không commit)
```env
GOOGLE_SHEET_ID=11WRRCa5AfIoWDK9qo3UqT3QvdrD0xCRY-zRd-8Ezj0Q
GOOGLE_SERVICE_ACCOUNT_FILE=C:/seryn-spy-agent/secrets/google-service-account.json
# (tùy chọn) thư mục 5 CSV của agent — mặc định <repo>/outputs:
OUTPUTS_DIR=C:/seryn-spy-agent/outputs
```

### Chạy
```bash
npm run spy:sync     # ở gốc repo
```
Log dạng `[OK] Brand Weekly Snapshot: ghi 13 dòng … Xong: 5/5 tab`. Thiếu CSV nào → script bỏ qua
tab đó (báo `[!]`). Lỗi `caller does not have permission` = chưa Share Sheet (Editor) cho
`client_email` của service account.

| Dataset | File nguồn |
|---|---|
| Brand Weekly Snapshot | `outputs/weekly_snapshots/brand_weekly_snapshot.csv` |
| Ad Level Analysis | `outputs/normalized_ads/ad_level_analysis.csv` |
| Scaled Content Analysis | `outputs/normalized_ads/scaled_content_analysis.csv` |
| Weekly Strategy Change | `outputs/weekly_snapshots/weekly_strategy_change.csv` |
| SERYN Content Recommendations | `outputs/creative_briefs/seryn_content_recommendations.csv` |

## Step 5 — Mirror Supabase (nguồn đọc chính của dashboard)

1. **Một lần:** mở Supabase → SQL Editor → chạy [`supabase/schema.sql`](../supabase/schema.sql)
   (tạo bảng `spy_data`, mỗi dataset 1 hàng jsonb + RLS chỉ cho SELECT bằng anon key).
2. `.env` (pipeline GHI — secret, không commit; trên GitHub Actions đặt làm **secrets**):
   ```env
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   ```
3. Đồng bộ thủ công:
   ```bash
   npm run supabase:sync    # đọc các tab Sheet -> upsert bảng spy_data
   ```
   Pipeline `spy:weekly` và 2 workflow report **tự đẩy Supabase** ở cuối run
   (khi có `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
4. Dashboard ĐỌC bằng `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Step 3).

> Sheet = nơi làm việc/dữ liệu thô; Supabase = nguồn dashboard đọc. Sửa tay trên Sheet xong
> nhớ chạy `npm run supabase:sync` để bản online cập nhật.

---

## Bảo mật

- **Không** nhúng service account JSON / private key / `SUPABASE_SERVICE_ROLE_KEY` vào frontend.
  Chỉ biến `VITE_` được inject vào build; anon key Supabase là public (giới hạn bởi RLS).
- `VITE_GOOGLE_SHEETS_API_KEY` chỉ là *shared secret* mức nhẹ (chống người lạ đọc URL Apps Script),
  không phải khóa riêng tư.
- **Không** commit `.env` / `.env.local` / file JSON (đã có trong `.gitignore`).
- Apps Script *Who has access: Anyone* → **đừng** để dữ liệu nhạy cảm trong Sheet này.
