/* ============================================================
   SERYN — Brand Intelligence (gom mọi dữ liệu đối thủ theo brand)
   ------------------------------------------------------------
   Helper để BrandDetailDrawer hiển thị hồ sơ đầy đủ 1 đối thủ:
   snapshot, ads, scaled content, weekly change, visual, hook clusters,
   recommendations, discovery info, market signals. Không crash khi thiếu data.
   ============================================================ */
import type {
  SpyDashboardData, BrandWeeklySnapshot, AdLevelAnalysis, ScaledContentAnalysis,
  WeeklyStrategyChange, BrandVisualSummary, VisualPattern, HookCluster,
  SerynContentRecommendation, CompetitorDiscoveryCandidate, MarketIntelligenceItem,
} from "../types";

const lc = (s?: string): string => String(s || "").toLowerCase().trim();
const num = (v: unknown): number => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
/** So khớp brand "lỏng": chứa nhau sau khi bỏ dấu/ký tự thừa. */
function brandMatch(a?: string, b?: string): boolean {
  const x = lc(a), y = lc(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function getBrandSnapshot(brand: string, d: SpyDashboardData): BrandWeeklySnapshot | undefined {
  return (d.brandWeeklySnapshot ?? []).find((s) => s.brand_name === brand);
}
export function getBrandAds(brand: string, d: SpyDashboardData): AdLevelAnalysis[] {
  return (d.adLevelAnalysis ?? []).filter((a) => a.brand_name === brand);
}
export function getBrandScaledContent(brand: string, d: SpyDashboardData): ScaledContentAnalysis[] {
  return (d.scaledContentAnalysis ?? []).filter((s) => s.brand_name === brand);
}
function getBrandWeeklyChange(brand: string, d: SpyDashboardData): WeeklyStrategyChange | undefined {
  return (d.weeklyStrategyChange ?? []).find((c) => c.brand_name === brand);
}
export function getBrandVisualSummary(brand: string, d: SpyDashboardData): BrandVisualSummary | undefined {
  return (d.brandVisualSummary ?? []).find((v) => brandMatch(v.brand, brand));
}
function getBrandVisualPatterns(brand: string, d: SpyDashboardData): VisualPattern[] {
  return (d.visualPatternAnalysis ?? []).filter((p) => brandMatch(p.brand, brand));
}
/** Hook clusters mà brand này có mặt trong brands_using. */
function getBrandHookClusters(brand: string, d: SpyDashboardData): HookCluster[] {
  return (d.hookIntelligence ?? []).filter((c) =>
    String(c.brands_using || "").split("|").some((b) => brandMatch(b, brand)),
  );
}
/** Discovery info (website/fanpage/phone/address) nếu brand từng được Exa phát hiện. */
function getBrandDiscoveryInfo(brand: string, d: SpyDashboardData): CompetitorDiscoveryCandidate | undefined {
  return (d.competitorDiscovery ?? []).find((c) => brandMatch(c.brand_name, brand) || brandMatch(c.normalized_brand_name, brand));
}
/** Recommendations gắn với brand: source_brands / competitor_evidence / hook cluster của brand. */
function getBrandRecommendations(brand: string, d: SpyDashboardData): SerynContentRecommendation[] {
  const clusterIds = new Set(getBrandHookClusters(brand, d).map((c) => String(c.hook_cluster_id)));
  return (d.serynContentRecommendations ?? []).filter((r) => {
    if (brandMatch(r.source_brands, brand) || String(r.source_brands || "").split("|").some((b) => brandMatch(b, brand))) return true;
    if (lc(r.competitor_evidence).includes(lc(brand))) return true;
    if (r.source_hook_cluster_id && clusterIds.has(String(r.source_hook_cluster_id))) return true;
    return false;
  });
}
/** Tín hiệu thị trường liên quan brand: match brand trong title/summary/source, hoặc trùng domain. */
function getBrandMarketSignals(brand: string, d: SpyDashboardData): MarketIntelligenceItem[] {
  const disc = getBrandDiscoveryInfo(brand, d);
  const domain = lc(disc?.website_domain);
  return (d.marketIntelligence ?? []).filter((m) => {
    if (m.intelligence_type === "source") {
      const blob = `${m.source_title} ${m.summary} ${m.source_url}`;
      if (lc(blob).includes(lc(brand))) return true;
      if (domain && lc(m.source_domain) === domain) return true;
      return false;
    }
    // trend/opportunity: chỉ lấy nếu nhắc tên brand
    return lc(`${m.topic} ${m.summary} ${m.evidence}`).includes(lc(brand));
  }).slice(0, 8);
}

export type BrandIntelligenceProfile = {
  brand: string;
  snapshot?: BrandWeeklySnapshot;
  ads: AdLevelAnalysis[];
  scaled: ScaledContentAnalysis[];
  change?: WeeklyStrategyChange;
  visual?: BrandVisualSummary;
  visualPatterns: VisualPattern[];
  hookClusters: HookCluster[];
  recommendations: SerynContentRecommendation[];
  discovery?: CompetitorDiscoveryCandidate;
  marketSignals: MarketIntelligenceItem[];
};

export function getBrandProfile(brand: string, d: SpyDashboardData): BrandIntelligenceProfile {
  return {
    brand,
    snapshot: getBrandSnapshot(brand, d),
    ads: getBrandAds(brand, d),
    scaled: getBrandScaledContent(brand, d),
    change: getBrandWeeklyChange(brand, d),
    visual: getBrandVisualSummary(brand, d),
    visualPatterns: getBrandVisualPatterns(brand, d),
    hookClusters: getBrandHookClusters(brand, d),
    recommendations: getBrandRecommendations(brand, d),
    discovery: getBrandDiscoveryInfo(brand, d),
    marketSignals: getBrandMarketSignals(brand, d),
  };
}
