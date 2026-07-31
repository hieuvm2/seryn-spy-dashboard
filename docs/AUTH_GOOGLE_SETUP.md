# Đăng nhập Google + Phân quyền Dashboard

Dashboard yêu cầu **đăng nhập Google** trước khi xem. Phân quyền:

| Role | Ai | Quyền |
|------|----|-------|
| `admin` | `hieuvm2@seryn.vn` | Toàn quyền: xem tất cả, nhập dữ liệu, xóa dữ liệu, ghi vào Supabase (RLS cho phép SELECT/INSERT/UPDATE/DELETE) |
| `viewer` | Mọi email `@seryn.vn` khác | Chỉ xem: toàn bộ dashboard trừ trang "Dữ liệu"; không có nút Nhập/Xóa dữ liệu; Supabase chỉ cho SELECT |
| — | Email ngoài `@seryn.vn` | Bị chặn hoàn toàn (màn hình "Không có quyền truy cập" + RLS chặn đọc) |

Chặn 2 lớp:

1. **Giao diện** — `src/components/AuthGate.tsx` chặn trước khi render app; `src/utils/auth.ts` chứa danh sách admin (`ADMIN_EMAILS`) và domain được phép (`ALLOWED_EMAIL_DOMAIN`).
2. **Database (RLS)** — `supabase/schema.sql`: kể cả ai lấy được anon key cũng không đọc được dữ liệu nếu chưa đăng nhập bằng email `@seryn.vn`.

Pipeline/GitHub Actions **không bị ảnh hưởng** — vẫn ghi bằng `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS).

> Lưu ý: nếu KHÔNG cấu hình `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (chạy local demo, dữ liệu mẫu), app bỏ qua đăng nhập vì không có dữ liệu thật cần bảo vệ.

## Bước 1 — Tạo OAuth Client trên Google Cloud

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → chọn (hoặc tạo) project.
2. **APIs & Services → OAuth consent screen**:
   - User type: **Internal** (nếu seryn.vn dùng Google Workspace — chỉ tài khoản trong tổ chức đăng nhập được, khuyến nghị) hoặc **External**.
   - Điền tên app (vd `SERYN Spy Dashboard`), email hỗ trợ → Save.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** — thêm:
     ```
     https://<PROJECT_REF>.supabase.co/auth/v1/callback
     ```
     (`<PROJECT_REF>` là ID project Supabase, thấy trong `VITE_SUPABASE_URL`.)
4. Lưu lại **Client ID** và **Client Secret**.

## Bước 2 — Bật Google provider trên Supabase

1. Vào [Supabase Dashboard](https://supabase.com/dashboard) → project → **Authentication → Providers → Google**.
2. Bật **Enable**, dán **Client ID** + **Client Secret** từ Bước 1 → Save.
3. **Authentication → URL Configuration**:
   - **Site URL**: URL dashboard trên Vercel, vd `https://seryn-spy-dashboard.vercel.app`
   - **Redirect URLs**: thêm cả URL Vercel và `http://localhost:5173` (dev local).

## Bước 3 — Cập nhật RLS (chạy 1 lần trong SQL Editor)

Mở **Supabase → SQL Editor**, chạy lại toàn bộ file [`supabase/schema.sql`](../supabase/schema.sql) (an toàn chạy nhiều lần). Việc này:

- Gỡ policy đọc công khai cũ (`spy_data public read`).
- Thêm policy đọc cho email `@seryn.vn` đã đăng nhập.
- Thêm policy toàn quyền cho `hieuvm2@seryn.vn`.

## Bước 4 — Deploy

Không cần env mới — vẫn dùng `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` như cũ. Chỉ cần build + deploy lại lên Vercel.

## Kiểm tra sau khi cài

- [ ] Mở dashboard (chưa đăng nhập) → thấy màn hình "Đăng nhập bằng Google".
- [ ] Đăng nhập bằng `hieuvm2@seryn.vn` → vào được, header hiện badge **Quản trị**, có nút "Nhập dữ liệu" + "Xóa dữ liệu".
- [ ] Đăng nhập bằng email `@seryn.vn` khác → vào được, badge **Chỉ xem**, KHÔNG có nút nhập/xóa, sidebar không có trang "Dữ liệu".
- [ ] Đăng nhập bằng Gmail cá nhân (ngoài seryn.vn) → màn hình "Không có quyền truy cập".

## Thêm/bớt admin sau này

Sửa 2 chỗ (giữ đồng bộ):

1. `src/utils/auth.ts` → mảng `ADMIN_EMAILS`.
2. `supabase/schema.sql` → policy `spy_data admin all` (điều kiện email) → chạy lại trong SQL Editor.
