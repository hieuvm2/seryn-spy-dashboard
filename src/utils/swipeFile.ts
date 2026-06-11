/* ============================================================
   Swipe File — lưu hook/ad/pattern đáng học.

   - localStorage = cache/offline fallback (luôn hoạt động).
   - Nếu cấu hình Google Sheets API (VITE_GOOGLE_SHEETS_API_URL) thì ĐỒNG BỘ
     2 chiều với tab "Swipe File" qua Apps Script (đọc khi load, ghi khi
     thêm/sửa/xóa). Lỗi mạng -> vẫn giữ localStorage, không chặn UI.
   ============================================================ */
import type { SwipeFileItem } from "../types";
import { isSheetsConfigured, apiGet, apiPost } from "./sheetsApi";

const SWIPE_FILE_KEY = "seryn_swipe_file_v1";

/** Tên tab Google Sheets + thứ tự cột (header) cho Swipe File. */
export const SWIPE_SHEET_TAB = "Swipe File";
export const SWIPE_HEADERS = [
  "id",
  "savedAt",
  "sourceType",
  "brand_name",
  "hook",
  "service_or_product",
  "content_format",
  "content_angle",
  "offer_detected",
  "proof_point",
  "scale_level",
  "reason_to_save",
  "action",
  "seryn_reframe",
  "notes",
  "tags",
] as const;

export function genId(prefix = "sw"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lc(s?: string) { return String(s || "").trim().toLowerCase(); }
function str(v: unknown): string { return v === undefined || v === null ? "" : String(v); }

/* ---- serialize <-> bản ghi Sheets (Record<string,string>) ---- */
export function swipeToRecord(x: SwipeFileItem): Record<string, string> {
  return {
    id: str(x.id),
    savedAt: str(x.savedAt),
    sourceType: str(x.sourceType),
    brand_name: str(x.brand_name),
    hook: str(x.hook),
    service_or_product: str(x.service_or_product),
    content_format: str(x.content_format),
    content_angle: str(x.content_angle),
    offer_detected: str(x.offer_detected),
    proof_point: str(x.proof_point),
    scale_level: str(x.scale_level),
    reason_to_save: str(x.reason_to_save),
    action: str(x.action),
    seryn_reframe: str(x.seryn_reframe),
    notes: str(x.notes),
    tags: JSON.stringify(Array.isArray(x.tags) ? x.tags : []),
  };
}

function parseTags(raw: string): string[] {
  const s = String(raw || "").trim();
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr.map((t) => String(t)).filter(Boolean);
  } catch { /* không phải JSON -> tách theo dấu phẩy/gạch dọc */ }
  return s.split(/[|,]/).map((t) => t.trim()).filter(Boolean);
}

export function recordToSwipe(r: Record<string, unknown>): SwipeFileItem {
  const get = (k: string) => str(r[k]);
  return {
    id: get("id") || genId(),
    savedAt: get("savedAt") || new Date().toISOString(),
    sourceType: (get("sourceType") || "hook") as SwipeFileItem["sourceType"],
    brand_name: get("brand_name"),
    hook: get("hook"),
    service_or_product: get("service_or_product"),
    content_format: get("content_format"),
    content_angle: get("content_angle"),
    offer_detected: get("offer_detected"),
    proof_point: get("proof_point"),
    scale_level: get("scale_level"),
    reason_to_save: get("reason_to_save"),
    action: get("action") || "monitor",
    seryn_reframe: get("seryn_reframe"),
    notes: get("notes"),
    tags: parseTags(get("tags")),
  };
}

/** Validate tối thiểu trước khi ghi lên Sheets. */
function isValidSwipe(x: SwipeFileItem): boolean {
  return !!str(x.id).trim() && !!str(x.hook).trim();
}

/* ---- localStorage (cache/offline) ---- */
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

/* ---- đồng bộ Google Sheets (fire-and-forget, không chặn UI) ---- */
function remoteUpsertSwipe(item: SwipeFileItem): void {
  if (!isSheetsConfigured() || !isValidSwipe(item)) return;
  apiPost({ type: "swipe_file", action: "upsert", record: swipeToRecord(item) })
    .catch((e) => console.warn("Sync Swipe File (upsert) thất bại — giữ bản local:", e));
}
function remoteDeleteSwipe(id: string): void {
  if (!isSheetsConfigured() || !str(id).trim()) return;
  apiPost({ type: "swipe_file", action: "delete", id })
    .catch((e) => console.warn("Sync Swipe File (delete) thất bại — giữ bản local:", e));
}

/**
 * Đọc Swipe File ưu tiên Google Sheets (nếu cấu hình), fallback localStorage.
 * Thành công online -> cache vào localStorage để lần sau / offline vẫn có.
 */
export async function loadSwipeFileAsync(): Promise<{ items: SwipeFileItem[]; source: "online" | "local" }> {
  if (isSheetsConfigured()) {
    try {
      const json = await apiGet({ type: "swipe_file" });
      // Apps Script PHẢI trả data dạng mảng cho type này. Nếu là object (Apps Script
      // cũ chưa hỗ trợ type, trả 5 bảng dashboard) -> KHÔNG ghi đè cache local.
      if (!Array.isArray(json.data)) {
        throw new Error("Apps Script chưa hỗ trợ type=swipe_file (cập nhật bản mới).");
      }
      const online = (json.data as Record<string, unknown>[]).map(recordToSwipe);
      // Merge offline-first: giữ item local chưa kịp lên online (POST upsert đang bay)
      // để tránh ghi đè mất item vừa tạo khi view load ngay sau khi thêm.
      const onlineIds = new Set(online.map((x) => x.id));
      const localOnly = loadSwipeFile().filter((x) => !onlineIds.has(x.id));
      const items = [...online, ...localOnly];
      saveSwipeFile(items);
      return { items, source: "online" };
    } catch (e) {
      console.warn("Đọc Swipe File online thất bại — dùng localStorage:", e);
    }
  }
  return { items: loadSwipeFile(), source: "local" };
}

/** Thêm item; trùng brand_name + hook thì gộp (cập nhật savedAt + tags). */
export function addSwipeItem(item: SwipeFileItem): SwipeFileItem[] {
  const items = loadSwipeFile();
  const key = `${lc(item.brand_name)}|${lc(item.hook)}`;
  const idx = items.findIndex((x) => `${lc(x.brand_name)}|${lc(x.hook)}` === key);
  let saved: SwipeFileItem;
  if (idx >= 0) {
    saved = {
      ...items[idx],
      savedAt: item.savedAt || new Date().toISOString(),
      tags: Array.from(new Set([...(items[idx].tags || []), ...(item.tags || [])])),
    };
    items[idx] = saved;
  } else {
    saved = item;
    items.unshift(item);
  }
  saveSwipeFile(items);
  remoteUpsertSwipe(saved);
  return items;
}

export function updateSwipeItem(id: string, patch: Partial<SwipeFileItem>): SwipeFileItem[] {
  let updated: SwipeFileItem | null = null;
  const items = loadSwipeFile().map((x) => {
    if (x.id === id) { updated = { ...x, ...patch }; return updated; }
    return x;
  });
  saveSwipeFile(items);
  if (updated) remoteUpsertSwipe(updated);
  return items;
}

export function deleteSwipeItem(id: string): SwipeFileItem[] {
  const items = loadSwipeFile().filter((x) => x.id !== id);
  saveSwipeFile(items);
  remoteDeleteSwipe(id);
  return items;
}

export function clearSwipeFile(): void {
  try { localStorage.removeItem(SWIPE_FILE_KEY); } catch { /* noop */ }
}

export { SWIPE_FILE_KEY };
