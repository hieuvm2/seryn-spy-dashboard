/* ============================================================
   Weekly Changes nâng cao — intelligence feed.

   - Nếu Sheet có tab "Weekly Change Insights" -> dùng (enriched).
   - Nếu thiếu -> map từ "Weekly Strategy Change" cũ sang insight tối thiểu
     để view vẫn chạy (backward compatible, không crash).
   ============================================================ */
import type { SpyDashboardData, WeeklyChangeInsight, WeeklyChangeType, ChangeSeverity } from "../types";

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const num = (v: unknown) => { const n = Number(String(v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };

/** Nhãn tiếng Việt cho từng loại thay đổi (wording an toàn, không "winning"). */
export const CHANGE_TYPE_LABELS: Record<string, string> = {
  new_ad: "Ad mới",
  stopped_ad: "Ad dừng",
  relaunched_ad: "Ad chạy lại",
  new_variant: "Biến thể creative mới",
  new_campaign_theme: "Chủ đề campaign mới",
  offer_changed: "Đổi ưu đãi",
  hook_changed: "Đổi hook",
  service_focus_shifted: "Dịch chuyển dịch vụ",
  visual_format_shifted: "Dịch chuyển visual",
  brand_scaled_up: "Scaling signal (tăng)",
  brand_scaled_down: "Scaling signal (giảm)",
  new_page_detected: "Phát hiện page mới",
  page_inactive: "Page ngừng chạy",
  same_concept_new_variants: "Cùng concept, nhiều biến thể",
};

export const SEVERITY_TONE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

/** Wording an toàn theo loại — tránh kết luận tuyệt đối. */
export function signalLabel(t: string): string {
  if (t === "brand_scaled_up" || t === "brand_scaled_down") return "Scaling signal";
  if (t === "same_concept_new_variants" || t === "new_variant") return "Persistence signal";
  if (t === "new_ad") return "Likely new test";
  if (t === "new_campaign_theme") return "Likely campaign shift";
  return "Needs review";
}

export function normalizeChangeInsightRow(r: Record<string, unknown>): WeeklyChangeInsight {
  return {
    id: str(r.id) || `wc-${Math.random().toString(36).slice(2, 8)}`,
    brand: str(r.brand ?? r.brand_name),
    week_start: str(r.week_start ?? r.week_date),
    previous_week_start: r.previous_week_start ? str(r.previous_week_start) : undefined,
    change_type: str(r.change_type) || "new_ad",
    severity: (str(r.severity) || "low") as ChangeSeverity,
    confidence_score: num(r.confidence_score),
    summary: str(r.summary ?? r.change_summary),
    evidence: str(r.evidence),
    affected_ads: r.affected_ads ? str(r.affected_ads) : undefined,
    previous_value: r.previous_value ? str(r.previous_value) : undefined,
    current_value: r.current_value ? str(r.current_value) : undefined,
    recommended_action: str(r.recommended_action) || "monitor",
  };
}

/** Map 1 dòng Weekly Strategy Change (cũ) -> insight tối thiểu. */
function legacyToInsight(r: Record<string, unknown>): WeeklyChangeInsight {
  const change = num(r.active_ads_change);
  const newC = num(r.new_ads_count);
  const stopped = num(r.stopped_ads_count);
  const t = str(r.strategic_change_type).toLowerCase();
  let change_type: WeeklyChangeType = "new_variant";
  let severity: ChangeSeverity = "low";
  if (t.includes("scaled_up") || change >= 3) { change_type = "brand_scaled_up"; severity = "medium"; }
  else if (t.includes("scaled_down") || change <= -3) { change_type = "brand_scaled_down"; severity = "medium"; }
  else if (t.includes("came_online") || t.includes("new_page")) { change_type = "new_page_detected"; severity = "medium"; }
  else if (t.includes("dark") || t.includes("inactive")) { change_type = "page_inactive"; severity = "low"; }
  else if (t.includes("format_shift") || str(r.new_content_angles)) { change_type = "service_focus_shifted"; severity = "medium"; }
  else if (newC >= 3) { change_type = "same_concept_new_variants"; severity = "low"; }

  const implication = str(r.seryn_implication).toLowerCase();
  const recommended_action =
    implication.includes("counter") ? "counter" :
    implication.includes("adapt") ? "adapt" :
    implication.includes("copy") ? "copy" :
    implication.includes("avoid") || implication.includes("bỏ qua") ? "ignore" : "monitor";

  return {
    id: `wc-legacy-${str(r.brand_name)}-${str(r.week_date)}`.replace(/\s+/g, "-"),
    brand: str(r.brand_name),
    week_start: str(r.week_date),
    change_type,
    severity,
    confidence_score: 0.5, // dữ liệu cũ -> confidence trung bình
    summary: str(r.change_summary) || `Active ads thay đổi ${change >= 0 ? "+" : ""}${change}.`,
    evidence: `Active ads change ${change >= 0 ? "+" : ""}${change}; ${newC} ad mới, ${stopped} ad dừng.`,
    recommended_action,
  };
}

/** Nguồn weekly-change cho UI: enriched nếu có, fallback legacy. */
export function getWeeklyChangeInsights(data: SpyDashboardData): { items: WeeklyChangeInsight[]; source: "enriched" | "legacy" } {
  const enriched = data.weeklyChangeInsights ?? [];
  if (enriched.length) return { items: enriched.map(normalizeChangeInsightRow), source: "enriched" };
  const legacy = (data.weeklyStrategyChange ?? []).map((r) => legacyToInsight(r as unknown as Record<string, unknown>));
  return { items: legacy, source: "legacy" };
}
