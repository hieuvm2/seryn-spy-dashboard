/* ============================================================
   SERYN Spy — Supabase push (server-side).
   ------------------------------------------------------------
   Đẩy datasets (kết quả phân tích) lên Supabase để dashboard đọc.
   Dùng SERVICE_ROLE key (bypass RLS) — CHỈ chạy server, KHÔNG để ở frontend.

   .env:
     SUPABASE_URL=https://<project>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=<service_role key>   (KHÔNG commit)
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const URL = (process.env.SUPABASE_URL || "").trim();
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

/** Đã cấu hình Supabase (server) chưa. */
export function supabaseConfigured() {
  return !!URL && !!KEY;
}

let _client = null;
function client() {
  if (!supabaseConfigured()) throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env).");
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}

/**
 * Upsert nhiều dataset lên bảng spy_data.
 * @param {Record<string, any[]>} datasets  map dataset_key -> mảng rows
 * @param {string} [weekDate]
 * @returns {Promise<{ok:number, fail:number, errors:string[]}>}
 */
export async function pushDatasets(datasets, weekDate = "") {
  const sb = client();
  const now = new Date().toISOString();
  const records = Object.entries(datasets || {}).map(([dataset_key, rows]) => ({
    dataset_key,
    rows: Array.isArray(rows) ? rows : [],
    week_date: weekDate,
    updated_at: now,
  }));
  let ok = 0, fail = 0; const errors = [];
  // upsert theo lô để tránh payload quá lớn 1 request
  for (let i = 0; i < records.length; i += 5) {
    const batch = records.slice(i, i + 5);
    const { error } = await sb.from("spy_data").upsert(batch, { onConflict: "dataset_key" });
    if (error) { fail += batch.length; errors.push(error.message); }
    else ok += batch.length;
  }
  return { ok, fail, errors };
}
