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

-- RLS: dashboard (anon) chỉ ĐỌC; ghi chỉ qua service_role key (bypass RLS).
alter table public.spy_data enable row level security;

drop policy if exists "spy_data public read" on public.spy_data;
create policy "spy_data public read"
  on public.spy_data for select
  to anon, authenticated
  using (true);

-- (Không tạo policy INSERT/UPDATE/DELETE cho anon — chỉ service_role được ghi.)
