/* ============================================================
   SERYN Spy — Google Sheets API client (centralized)
   ------------------------------------------------------------
   Một nơi DUY NHẤT để gọi Google Apps Script Web App:
     - đọc dữ liệu dashboard (doGet, không type)
     - đọc/ghi Swipe File & Creative Briefs (type=swipe_file|creative_briefs)

   Cấu hình qua biến môi trường Vite (build-time):
     VITE_GOOGLE_SHEETS_API_URL = https://script.google.com/macros/s/XXX/exec
     VITE_GOOGLE_SHEETS_API_KEY = <khớp Script Property API_SECRET_KEY> (tùy chọn)

   - URL build tập trung ở buildUrl() → key luôn được nối nhất quán (?key=...).
   - KHÔNG nhúng service account / private key vào frontend. API key ở đây chỉ là
     "shared secret" mức nhẹ để hạn chế người lạ đọc dữ liệu qua URL công khai.
   ============================================================ */

/** URL Apps Script Web App (đã trim). Rỗng nếu chưa cấu hình. */
export function getApiUrl(): string {
  const raw = import.meta.env.VITE_GOOGLE_SHEETS_API_URL;
  return typeof raw === "string" ? raw.trim() : "";
}

/** API key (đã trim). Rỗng nếu chưa cấu hình (vẫn chạy được — xem docs). */
export function getApiKey(): string {
  const raw = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Đã cấu hình URL Apps Script hay chưa. */
export function isSheetsConfigured(): boolean {
  return getApiUrl().length > 0;
}

/**
 * Dựng URL gọi Apps Script với query params + tự nối key an toàn.
 * Dùng URL/URLSearchParams nên không lo trùng/escape sai dấu `?`/`&`.
 */
export function buildUrl(params: Record<string, string> = {}): string {
  const base = getApiUrl();
  if (!base) throw new Error("Thiếu VITE_GOOGLE_SHEETS_API_URL (chưa cấu hình Google Sheets API URL).");
  const url = new URL(base);
  const key = getApiKey();
  if (key) url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Kiểm tra response JSON dạng `{ ok: true, ... }` của Apps Script. */
function ensureOk(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") {
    throw new Error("Google Sheets API không trả về JSON hợp lệ.");
  }
  const obj = json as Record<string, unknown>;
  if (obj.ok !== true) {
    const reason = typeof obj.error === "string" ? `: ${obj.error}` : "";
    throw new Error(`Google Sheets API từ chối hoặc lỗi${reason}.`);
  }
  return obj;
}

/** GET Apps Script với params, trả về toàn bộ JSON đã xác thực `ok:true`. */
export async function apiGet(params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const url = buildUrl(params);
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", cache: "no-store" });
  } catch (e) {
    throw new Error(`Không kết nối được Google Sheets API: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!response.ok) throw new Error(`Google Sheets API error: HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("Google Sheets API không trả về JSON hợp lệ.");
  }
  return ensureOk(json);
}

/**
 * POST Apps Script (ghi). Dùng `text/plain` để tránh CORS preflight với
 * Apps Script Web App; body là JSON string. Key được nối vào URL qua buildUrl().
 */
export async function apiPost(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = buildUrl();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Không ghi được lên Google Sheets API: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!response.ok) throw new Error(`Google Sheets API error: HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("Google Sheets API không trả về JSON hợp lệ.");
  }
  return ensureOk(json);
}
