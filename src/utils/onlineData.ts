/* ============================================================
   SERYN Spy Ads — ONLINE SHEET DATA
   Đọc dữ liệu online trực tiếp từ Google Apps Script Web App URL
   (trả JSON từ Google Sheets). Cấu hình qua biến môi trường Vite:

       VITE_GOOGLE_SHEETS_API_URL = https://script.google.com/macros/s/XXX/exec
       VITE_GOOGLE_SHEETS_API_KEY = <khớp Script Property API_SECRET_KEY> (tùy chọn)

   KHÔNG nhúng service account JSON / private key vào frontend.
   Apps Script URL chỉ dùng để ĐỌC dữ liệu dashboard.

   URL + API key được dựng tập trung trong `sheetsApi.ts` (buildUrl) để mọi
   request đều nối key nhất quán.
   ============================================================ */
import type {
  SpyDashboardData,
  BrandWeeklySnapshot,
  AdLevelAnalysis,
  ScaledContentAnalysis,
  WeeklyStrategyChange,
  SerynContentRecommendation,
  VisualAnalysis,
  BrandVisualSummary,
  VisualPattern,
  WeeklyChangeInsight,
  CrawlRun,
  MarketIntelligenceItem,
  CompetitorDiscoveryCandidate,
  WeeklySummary,
  ActionPlanItem,
  SwipeSuggestion,
} from "../types";
import { apiGet, getApiUrl, isSheetsConfigured } from "./sheetsApi";

/** URL Apps Script Web App lấy từ env Vite (build-time). Rỗng nếu chưa cấu hình. */
export function getOnlineApiUrl(): string {
  return getApiUrl();
}

/** Đã cấu hình env VITE_GOOGLE_SHEETS_API_URL hay chưa. */
export function isOnlineConfigured(): boolean {
  return isSheetsConfigured();
}

/** Bảo đảm trả về mảng object an toàn (không crash khi field thiếu / sai kiểu). */
function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Fetch 5 bảng dữ liệu spy từ Google Apps Script Web App.
 *
 * - Gọi `apiGet()` (no-store, tự nối ?key=... nếu có VITE_GOOGLE_SHEETS_API_KEY).
 * - Đã xác thực `json.ok === true` trong apiGet; ở đây chỉ map `json.data`.
 * - Thiếu dataset nào -> trả mảng rỗng cho dataset đó (không crash).
 * - Lỗi mạng / HTTP / JSON / Unauthorized -> throw Error rõ ràng để caller
 *   fallback về localStorage / sample data.
 *
 * Tham số `apiUrl` giữ lại cho tương thích chữ ký cũ; nếu rỗng -> báo lỗi rõ.
 */
export async function fetchOnlineSpyData(apiUrl?: string): Promise<SpyDashboardData> {
  if (apiUrl !== undefined && apiUrl.trim() === "") {
    throw new Error("Thiếu VITE_GOOGLE_SHEETS_API_URL (chưa cấu hình Google Sheets API URL).");
  }
  // apiGet() sẽ tự dựng URL (kèm key) và ném lỗi rõ ràng nếu URL chưa cấu hình.
  const json = await apiGet();
  const data = json.data;
  if (!data || typeof data !== "object") {
    throw new Error("Phản hồi Google Sheets API không có trường data hợp lệ.");
  }
  const d = data as Record<string, unknown>;
  return {
    brandWeeklySnapshot: asRows<BrandWeeklySnapshot>(d.brandWeeklySnapshot),
    adLevelAnalysis: asRows<AdLevelAnalysis>(d.adLevelAnalysis),
    scaledContentAnalysis: asRows<ScaledContentAnalysis>(d.scaledContentAnalysis),
    weeklyStrategyChange: asRows<WeeklyStrategyChange>(d.weeklyStrategyChange),
    serynContentRecommendations: asRows<SerynContentRecommendation>(d.serynContentRecommendations),
    // ---- nâng cấp v2 (tab có thể chưa tồn tại -> mảng rỗng, không crash) ----
    visualAnalysis: asRows<VisualAnalysis>(d.visualAnalysis),
    brandVisualSummary: asRows<BrandVisualSummary>(d.brandVisualSummary),
    visualPatternAnalysis: asRows<VisualPattern>(d.visualPatternAnalysis),
    weeklyChangeInsights: asRows<WeeklyChangeInsight>(d.weeklyChangeInsights),
    crawlRuns: asRows<CrawlRun>(d.crawlRuns),
    // ---- Exa Market Research & Competitor Discovery (gộp 2 tab; thiếu -> []) ----
    marketIntelligence: asRows<MarketIntelligenceItem>(d.marketIntelligence),
    competitorDiscovery: asRows<CompetitorDiscoveryCandidate>(d.competitorDiscovery),
    // ---- Weekly Intelligence (team report) ----
    weeklySummary: asRows<WeeklySummary>(d.weeklySummary),
    actionPlan: asRows<ActionPlanItem>(d.actionPlan),
    swipeSuggestions: asRows<SwipeSuggestion>(d.swipeSuggestions),
  };
}
