/* ============================================================
   SERYN — Đối thủ trực tiếp (đồng bộ theo quản trị viên)
   ------------------------------------------------------------
   Admin tích "đối thủ trực tiếp" ở Cấu hình đối thủ -> lưu lên Supabase
   (bảng spy_data, dataset_key 'directCompetitors') -> MỌI người xem đều
   thấy cùng lựa chọn. localStorage chỉ là cache offline / chế độ demo.
   - Đọc: mọi user @seryn.vn (RLS cho SELECT).
   - Ghi: chỉ admin (RLS chặn INSERT/UPDATE của viewer; UI cũng ẩn trang
     Cấu hình đối thủ với viewer).
   Khớp brand "lỏng" (chứa nhau) vì tên ở Competitors và Brand Weekly
   Snapshot có thể lệch nhẹ.
   ============================================================ */
import { useSyncExternalStore } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "./auth";

const KEY = "seryn_direct_competitors_v1";
const DATASET_KEY = "directCompetitors";
const EMPTY = new Set<string>();
const listeners = new Set<() => void>();
let cache: Set<string> | null = null;
let cacheRaw = "";

function read(): string {
  try { return localStorage.getItem(KEY) || "[]"; } catch { return "[]"; }
}
function getSet(): Set<string> {
  const raw = read();
  if (raw !== cacheRaw || !cache) {
    cacheRaw = raw;
    try { cache = new Set((JSON.parse(raw) as string[]).filter(Boolean)); } catch { cache = new Set(); }
  }
  return cache;
}
function commit(s: Set<string>): void {
  const raw = JSON.stringify([...s]);
  try { localStorage.setItem(KEY, raw); } catch { /* noop */ }
  cache = s; cacheRaw = raw;
  listeners.forEach((l) => l());
}

/** Tải lựa chọn của admin từ Supabase -> ghi đè cache local (mọi viewer thấy giống nhau).
    Gọi khi app khởi động (sau đăng nhập). Offline/lỗi -> giữ cache local. */
export async function syncDirectCompetitorsOnline(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { data, error } = await getSupabaseClient()
      .from("spy_data")
      .select("rows")
      .eq("dataset_key", DATASET_KEY)
      .maybeSingle();
    if (error) return;
    const rows = Array.isArray(data?.rows)
      ? (data.rows as unknown[]).filter((x): x is string => typeof x === "string" && !!x)
      : [];
    commit(new Set(rows));
  } catch { /* offline -> giữ cache local */ }
}

/** Đẩy lựa chọn hiện tại lên Supabase (chỉ admin ghi được — RLS chặn viewer). */
async function pushOnline(s: Set<string>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await getSupabaseClient()
      .from("spy_data")
      .upsert(
        { dataset_key: DATASET_KEY, rows: [...s], updated_at: new Date().toISOString() },
        { onConflict: "dataset_key" },
      );
  } catch { /* noop — cache local vẫn giữ, lần sync sau sẽ khớp lại */ }
}

/** Match lỏng: trùng tuyệt đối hoặc chứa nhau (bỏ qua hoa/thường). */
export function isDirectCompetitor(brand?: string, set?: Set<string>): boolean {
  if (!brand) return false;
  const s = set ?? getSet();
  if (s.has(brand)) return true;
  const b = brand.toLowerCase().trim();
  for (const x of s) { const y = x.toLowerCase().trim(); if (b === y || b.includes(y) || y.includes(b)) return true; }
  return false;
}

export function toggleDirectCompetitor(brand: string): void {
  if (!brand) return;
  const s = new Set(getSet());
  if (s.has(brand)) s.delete(brand); else s.add(brand);
  commit(s);
  void pushOnline(s); // đồng bộ cho mọi người xem (admin mới ghi thành công)
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

/** Hook reactive: trả về Set tên đối thủ trực tiếp; tự re-render khi đổi. */
export function useDirectCompetitors(): Set<string> {
  return useSyncExternalStore(subscribe, getSet, () => EMPTY);
}
