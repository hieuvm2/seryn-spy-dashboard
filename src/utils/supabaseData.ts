/* ============================================================
   SERYN Spy Ads — SUPABASE DATA (dashboard đọc).
   Đọc datasets từ bảng `spy_data` (Supabase) — nguồn dữ liệu chính
   của dashboard. Cấu hình qua env Vite (build-time, PUBLIC — anon key
   chỉ có quyền SELECT theo RLS):

       VITE_SUPABASE_URL      = https://<project>.supabase.co
       VITE_SUPABASE_ANON_KEY = <anon public key>

   KHÔNG để service_role key ở frontend.
   Dùng client chung từ auth.ts — request đọc mang JWT của user
   đã đăng nhập (RLS chỉ cho email @seryn.vn SELECT).
   ============================================================ */
import { getSupabaseClient, isSupabaseConfigured } from "./auth";
import type {
  SpyDashboardData, BrandWeeklySnapshot, AdLevelAnalysis, ScaledContentAnalysis,
  WeeklyStrategyChange, SerynContentRecommendation, VisualAnalysis, BrandVisualSummary,
  VisualPattern, WeeklyChangeInsight, CrawlRun, MarketIntelligenceItem,
  CompetitorDiscoveryCandidate, HookCluster, WeeklySummary, ActionPlanItem, SwipeSuggestion,
  SpyReport, OwnBrandPage,
} from "../types";

export { isSupabaseConfigured };

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Đọc toàn bộ datasets dashboard từ Supabase (bảng spy_data) -> SpyDashboardData. */
export async function fetchSupabaseSpyData(): Promise<SpyDashboardData> {
  const { data, error } = await getSupabaseClient().from("spy_data").select("dataset_key, rows");
  if (error) throw new Error(`Supabase đọc lỗi: ${error.message}`);
  const d: Record<string, unknown> = {};
  for (const row of (data || [])) d[String((row as any).dataset_key)] = (row as any).rows;
  return {
    brandWeeklySnapshot: asRows<BrandWeeklySnapshot>(d.brandWeeklySnapshot),
    adLevelAnalysis: asRows<AdLevelAnalysis>(d.adLevelAnalysis),
    scaledContentAnalysis: asRows<ScaledContentAnalysis>(d.scaledContentAnalysis),
    weeklyStrategyChange: asRows<WeeklyStrategyChange>(d.weeklyStrategyChange),
    serynContentRecommendations: asRows<SerynContentRecommendation>(d.serynContentRecommendations),
    visualAnalysis: asRows<VisualAnalysis>(d.visualAnalysis),
    brandVisualSummary: asRows<BrandVisualSummary>(d.brandVisualSummary),
    visualPatternAnalysis: asRows<VisualPattern>(d.visualPatternAnalysis),
    weeklyChangeInsights: asRows<WeeklyChangeInsight>(d.weeklyChangeInsights),
    crawlRuns: asRows<CrawlRun>(d.crawlRuns),
    marketIntelligence: asRows<MarketIntelligenceItem>(d.marketIntelligence),
    competitorDiscovery: asRows<CompetitorDiscoveryCandidate>(d.competitorDiscovery),
    hookIntelligence: asRows<HookCluster>(d.hookIntelligence),
    weeklySummary: asRows<WeeklySummary>(d.weeklySummary),
    actionPlan: asRows<ActionPlanItem>(d.actionPlan),
    swipeSuggestions: asRows<SwipeSuggestion>(d.swipeSuggestions),
    weeklyReports: asRows<SpyReport>(d.weeklyReports),
    monthlyReports: asRows<SpyReport>(d.monthlyReports),
    ownBrandPages: asRows<OwnBrandPage>(d.ownBrandPages),
  };
}
