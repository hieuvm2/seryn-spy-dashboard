-- ============================================================
-- SERYN Spy Dashboard — Supabase schema
-- Chạy 1 lần trong Supabase SQL Editor (project của bạn).
-- ------------------------------------------------------------
-- Mô hình: mỗi DATASET dashboard = 1 hàng, rows = jsonb (mảng object).
-- Pipeline/Claude đẩy bằng service_role key (bypass RLS). Dashboard đọc
-- bằng anon key (chỉ SELECT). KHÔNG để service_role key ở frontend.
-- ============================================================

create table if not exists public.spy_data (
  dataset_key text primary key,           -- vd 'brandWeeklySnapshot', 'adLevelAnalysis'…
  rows        jsonb  not null default '[]'::jsonb,
  week_date   text,
  updated_at  timestamptz not null default now()
);

comment on table public.spy_data is 'SERYN spy dashboard datasets (kết quả phân tích). Mỗi hàng = 1 dataset, rows = mảng jsonb.';

-- ============================================================
-- RLS + PHÂN QUYỀN (Supabase Auth — đăng nhập Google):
--   * ĐỌC : chỉ user đã đăng nhập với email @seryn.vn (viewer).
--   * GHI : admin (hieuvm2@seryn.vn) toàn quyền qua dashboard;
--           pipeline/Claude vẫn ghi bằng service_role key (bypass RLS).
--   * anon (chưa đăng nhập): KHÔNG đọc, KHÔNG ghi.
-- Chạy lại khối này trong SQL Editor khi cập nhật (drop policy if exists
-- nên chạy nhiều lần an toàn).
-- ============================================================
alter table public.spy_data enable row level security;

-- Gỡ policy đọc công khai cũ (nếu có từ schema phiên bản trước).
drop policy if exists "spy_data public read" on public.spy_data;

-- VIEWER: mọi email @seryn.vn đã đăng nhập được ĐỌC.
drop policy if exists "spy_data seryn read" on public.spy_data;
create policy "spy_data seryn read"
  on public.spy_data for select
  to authenticated
  using ( lower(coalesce(auth.jwt()->>'email', '')) like '%@seryn.vn' );

-- ADMIN: hieuvm2@seryn.vn toàn quyền (SELECT/INSERT/UPDATE/DELETE).
drop policy if exists "spy_data admin all" on public.spy_data;
create policy "spy_data admin all"
  on public.spy_data for all
  to authenticated
  using ( lower(coalesce(auth.jwt()->>'email', '')) = 'hieuvm2@seryn.vn' )
  with check ( lower(coalesce(auth.jwt()->>'email', '')) = 'hieuvm2@seryn.vn' );
