/* ============================================================
   SERYN Spy Ads — ONLINE SHEET DATA
   Đọc dữ liệu online trực tiếp từ Google Apps Script Web App URL
   (trả JSON từ Google Sheets). Cấu hình qua biến môi trường Vite:

       VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/XXX/exec

   KHÔNG nhúng service account JSON / private key vào frontend.
   Apps Script URL chỉ dùng để ĐỌC dữ liệu dashboard.

   Mọi người mở cùng một link Vercel đều fetch cùng URL này -> xem
   chung một bộ dữ liệu.
   ============================================================ */
import type {
  SpyDashboardData,
  BrandWeeklySnapshot,
  AdLevelAnalysis,
  ScaledContentAnalysis,
  WeeklyStrategyChange,
  SerynContentRecommendation,
} from "../types";

/** URL Apps Script Web App lấy từ env Vite (build-time). Rỗng nếu chưa cấu hình. */
export function getOnlineApiUrl(): string {
  const raw = import.meta.env.VITE_GOOGLE_SHEETS_API_URL;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Đã cấu hình env VITE_GOOGLE_SHEETS_API_URL hay chưa. */
export function isOnlineConfigured(): boolean {
  return getOnlineApiUrl().length > 0;
}

/** Bảo đảm trả về mảng object an toàn (không crash khi field thiếu / sai kiểu). */
function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Fetch 5 bảng dữ liệu spy từ Google Apps Script Web App URL.
 *
 * - Gọi `fetch(apiUrl)` (no-store, luôn lấy bản mới).
 * - Parse JSON, kiểm tra `json.ok === true` và có `json.data`.
 * - Thiếu dataset nào -> trả mảng rỗng cho dataset đó (không crash).
 * - Lỗi mạng / HTTP / JSON / response sai -> throw Error rõ ràng để
 *   caller fallback về localStorage / sample data.
 */
export async function fetchOnlineSpyData(apiUrl: string): Promise<SpyDashboardData> {
  if (!apiUrl) {
    throw new Error("Thiếu VITE_GOOGLE_SHEETS_API_URL (chưa cấu hình Google Sheets API URL).");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, { method: "GET", cache: "no-store" });
  } catch (e: any) {
    throw new Error(`Không kết nối được Google Sheets API: ${e?.message || e}`);
  }

  if (!response.ok) {
    throw new Error(`Google Sheets API error: HTTP ${response.status}`);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new Error("Google Sheets API không trả về JSON hợp lệ.");
  }

  if (!json || json.ok !== true || !json.data) {
    const reason = json && json.error ? `: ${json.error}` : "";
    throw new Error(`Phản hồi Google Sheets API không hợp lệ${reason}.`);
  }

  const d = json.data;
  return {
    brandWeeklySnapshot: asRows<BrandWeeklySnapshot>(d.brandWeeklySnapshot),
    adLevelAnalysis: asRows<AdLevelAnalysis>(d.adLevelAnalysis),
    scaledContentAnalysis: asRows<ScaledContentAnalysis>(d.scaledContentAnalysis),
    weeklyStrategyChange: asRows<WeeklyStrategyChange>(d.weeklyStrategyChange),
    serynContentRecommendations: asRows<SerynContentRecommendation>(d.serynContentRecommendations),
  };
}
