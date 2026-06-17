/* ============================================================
   SERYN — Đối thủ trực tiếp (preference local, reactive)
   ------------------------------------------------------------
   Tích "đối thủ trực tiếp" ở Cấu hình đối thủ -> ưu tiên hiển thị brand đó
   ở các tab khác (Đối thủ, Tổng quan, hồ sơ). Lưu localStorage, không đụng
   Google Sheets. Khớp brand "lỏng" (chứa nhau) vì tên ở Competitors và
   Brand Weekly Snapshot có thể lệch nhẹ.
   ============================================================ */
import { useSyncExternalStore } from "react";

const KEY = "seryn_direct_competitors_v1";
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
