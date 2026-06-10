/* ============================================================
   Swipe File — lưu hook/ad/pattern đáng học vào localStorage.
   ============================================================ */
import type { SwipeFileItem } from "../types";

const SWIPE_FILE_KEY = "seryn_swipe_file_v1";

export function genId(prefix = "sw"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lc(s?: string) { return String(s || "").trim().toLowerCase(); }

export function loadSwipeFile(): SwipeFileItem[] {
  try {
    const raw = localStorage.getItem(SWIPE_FILE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveSwipeFile(items: SwipeFileItem[]): void {
  try {
    localStorage.setItem(SWIPE_FILE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Không lưu được Swipe File:", e);
  }
}

/** Thêm item; nếu trùng brand_name + hook thì chỉ cập nhật savedAt (không add trùng). */
export function addSwipeItem(item: SwipeFileItem): SwipeFileItem[] {
  const items = loadSwipeFile();
  const key = `${lc(item.brand_name)}|${lc(item.hook)}`;
  const idx = items.findIndex((x) => `${lc(x.brand_name)}|${lc(x.hook)}` === key);
  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      savedAt: item.savedAt || new Date().toISOString(),
      tags: Array.from(new Set([...(items[idx].tags || []), ...(item.tags || [])])),
    };
  } else {
    items.unshift(item);
  }
  saveSwipeFile(items);
  return items;
}

export function updateSwipeItem(id: string, patch: Partial<SwipeFileItem>): SwipeFileItem[] {
  const items = loadSwipeFile().map((x) => (x.id === id ? { ...x, ...patch } : x));
  saveSwipeFile(items);
  return items;
}

export function deleteSwipeItem(id: string): SwipeFileItem[] {
  const items = loadSwipeFile().filter((x) => x.id !== id);
  saveSwipeFile(items);
  return items;
}

export function clearSwipeFile(): void {
  try { localStorage.removeItem(SWIPE_FILE_KEY); } catch { /* noop */ }
}

export { SWIPE_FILE_KEY };
