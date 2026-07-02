/* ============================================================
   SERYN Spy — REMOTE DATA (một nơi duy nhất cho dữ liệu online)
   ------------------------------------------------------------
   Dashboard đọc dữ liệu online theo thứ tự ưu tiên:
     1) SUPABASE  — bảng `spy_data` (anon key, chỉ SELECT theo RLS)
     2) GOOGLE SHEETS — Google Apps Script Web App (doGet trả JSON)

   Env Vite (build-time, PUBLIC):
     VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY   → Supabase
     VITE_GOOGLE_SHEETS_API_URL                   → Apps Script Web App
     VITE_GOOGLE_SHEETS_API_KEY (tùy chọn)        → khớp Script Property API_SECRET_KEY

   KHÔNG nhúng service account / service_role key vào frontend.
   apiGet/apiPost cũng dùng cho ghi record (Competitors, Action Plan…)
   qua Apps Script doPost — xem docs/ONLINE_DATA.md.
   ============================================================ */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  SpyDashboardData, BrandWeeklySnapshot, AdLevelAnalysis, ScaledContentAnalysis,
  WeeklyStrategyChange, SerynContentRecommendation, VisualAnalysis, BrandVisualSummary,
  VisualPattern, WeeklyChangeInsight, CrawlRun, MarketIntelligenceItem,
  CompetitorDiscoveryCandidate, HookCluster, WeeklySummary, ActionPlanItem, SwipeSuggestion,
  SpyReport, OwnBrandPage,
} from "../types";

/* ---------------- Map datasets (dùng chung Sheets + Supabase) ---------------- */

/** Bảo đảm trả về mảng object an toàn (không crash khi field thiếu / sai kiểu). */
function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Map object {dataset_key: rows} -> SpyDashboardData. Thiếu dataset nào -> mảng rỗng. */
function mapDatasets(d: Record<string, unknown>): SpyDashboardData {
  return {
    brandWeeklySnapshot: asRows<BrandWeeklySnapshot>(d.brandWeeklySnapshot),
    adLevelAnalysis: asRows<AdLevelAnalysis>(d.adLevelAnalysis),
    scaledContentAnalysis: asRows<ScaledContentAnalysis>(d.scaledContentAnalysis),
    weeklyStrategyChange: asRows<WeeklyStrategyChange>(d.weeklyStrategyChange),
    serynContentRecommendations: asRows<SerynContentRecommendation>(d.serynContentRecommendations),
    // ---- visual / incremental (tab có thể chưa tồn tại -> [], không crash) ----
    visualAnalysis: asRows<VisualAnalysis>(d.visualAnalysis),
    brandVisualSummary: asRows<BrandVisualSummary>(d.brandVisualSummary),
    visualPatternAnalysis: asRows<VisualPattern>(d.visualPatternAnalysis),
    weeklyChangeInsights: asRows<WeeklyChangeInsight>(d.weeklyChangeInsights),
    crawlRuns: asRows<CrawlRun>(d.crawlRuns),
    // ---- Exa Market Research & Competitor Discovery (gộp 2 tab) ----
    marketIntelligence: asRows<MarketIntelligenceItem>(d.marketIntelligence),
    competitorDiscovery: asRows<CompetitorDiscoveryCandidate>(d.competitorDiscovery),
    hookIntelligence: asRows<HookCluster>(d.hookIntelligence),
    // ---- Weekly Intelligence (team report) ----
    weeklySummary: asRows<WeeklySummary>(d.weeklySummary),
    actionPlan: asRows<ActionPlanItem>(d.actionPlan),
    swipeSuggestions: asRows<SwipeSuggestion>(d.swipeSuggestions),
    // ---- Historical reports ----
    weeklyReports: asRows<SpyReport>(d.weeklyReports),
    monthlyReports: asRows<SpyReport>(d.monthlyReports),
    // ---- Own Brand Pages (page SERYN) ----
    ownBrandPages: asRows<OwnBrandPage>(d.ownBrandPages),
  };
}

/* ---------------- Google Sheets (Apps Script Web App) ---------------- */

/** URL Apps Script Web App (đã trim). Rỗng nếu chưa cấu hình. */
export function getApiUrl(): string {
  const raw = import.meta.env.VITE_GOOGLE_SHEETS_API_URL;
  return typeof raw === "string" ? raw.trim() : "";
}

/** API key (đã trim). Rỗng nếu chưa cấu hình (vẫn chạy được — xem docs). */
function getApiKey(): string {
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
function buildUrl(params: Record<string, string> = {}): string {
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

/** URL Apps Script Web App lấy từ env Vite (giữ tên cũ cho App.tsx). */
export function getOnlineApiUrl(): string {
  return getApiUrl();
}

/** Đã cấu hình env VITE_GOOGLE_SHEETS_API_URL hay chưa. */
export function isOnlineConfigured(): boolean {
  return isSheetsConfigured();
}

/**
 * Fetch toàn bộ datasets dashboard từ Google Apps Script Web App.
 * Lỗi mạng / HTTP / JSON / Unauthorized -> throw Error rõ ràng để caller
 * fallback về localStorage / sample data.
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
  return mapDatasets(data as Record<string, unknown>);
}

/* ---------------- Supabase (nguồn đọc ưu tiên) ---------------- */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

/** Đã cấu hình Supabase cho dashboard chưa. */
export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON;
}

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  return _client;
}

/** Đọc toàn bộ datasets dashboard từ Supabase (bảng spy_data) -> SpyDashboardData. */
export async function fetchSupabaseSpyData(): Promise<SpyDashboardData> {
  const { data, error } = await client().from("spy_data").select("dataset_key, rows");
  if (error) throw new Error(`Supabase đọc lỗi: ${error.message}`);
  const d: Record<string, unknown> = {};
  for (const row of (data || [])) d[String((row as any).dataset_key)] = (row as any).rows;
  return mapDatasets(d);
}
