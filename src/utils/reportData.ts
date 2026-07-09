/* ============================================================
   Weekly PDF report — dựng model dữ liệu từ SpyDashboardData.
   Tách riêng khỏi component để dễ test + tái dùng logic đã có.
   Mọi field "an toàn": thiếu dữ liệu -> mảng rỗng/0, không crash.
   ============================================================ */
import type { SpyDashboardData, DataSourceType } from "../types";
import {
  normalizeNumber, countChips, firstChip, viLabel, SOURCE_LABELS,
} from "./spyData";
import { latestWeek, dataQualityReport, parseTopList } from "./weeklyIntel";

export type ReportRecAction = "adapt" | "counter" | "avoid" | "copy" | "monitor";

export type TopItem = { key: string; count: number };

export type ReportBrandRow = {
  name: string;
  active: number;
  newAds: number;
  stopped: number;
  scaled: number;
  videoRate: number;   // 0–1
  msgRate: number;     // 0–1
  topFormat: string;
  topHook: string;
  offers: string;
};

export type ReportModel = {
  weekDate: string;
  generatedAt: string;
  sourceLabel: string;
  kpis: {
    totalBrands: number;
    activeBrands: number;
    totalAds: number;
    newAds: number;
    stoppedAds: number;
    scaledClusters: number;
    dataQuality: number;
    failedPages: number;
  };
  execSummary: string;
  brands: ReportBrandRow[];        // CHỈ brand đang chạy ad (active > 0)
  inactiveBrands: number;          // số brand watchlist không chạy ad tuần này (ẩn khỏi bảng)
  patterns: { hooks: TopItem[]; offers: TopItem[]; formats: TopItem[]; services: TopItem[]; angles: TopItem[] };
  recommendations: Array<{ action: ReportRecAction; items: Array<{ brand: string; format: string; hook: string; reframe: string }> }>;
  scaledClusters: Array<{ brand: string; ads: number; format: string; hook: string; scaleLevel: number; action: string }>;
  changes: Array<{ brand: string; type: string; severity: string; summary: string; action: string }>;
  actions: Array<{ priority: string; insightType: string; insight: string; suggested: string; brand: string }>;
  swipes: Array<{ brand: string; hook: string; offer: string; format: string; whySave: string; howAdapt: string; url: string }>;
};

const ACTION_ORDER: ReportRecAction[] = ["adapt", "counter", "avoid", "copy", "monitor"];

/** Chuẩn hóa giá trị seryn action (copy/adapt/counter/avoid/monitor) về 1 từ. */
function normAction(raw?: string): ReportRecAction | null {
  const s = String(raw ?? "").toLowerCase();
  for (const a of ACTION_ORDER) if (s.includes(a)) return a;
  return null;
}

/** Ưu tiên top-list từ weeklySummary (server-computed); fallback đếm từ snapshot. */
function topFrom(rawList: unknown, rows: Array<Record<string, any>>, field: string, limit = 10): TopItem[] {
  const fromSummary = parseTopList(rawList);
  if (fromSummary.length) return fromSummary.slice(0, limit);
  return countChips(rows, field).slice(0, limit).map((c) => ({ key: c.label, count: c.n }));
}

/**
 * Tóm tắt điều hành — SINH TỪ SNAPSHOT (nguồn chuẩn của dashboard) để mọi con số
 * khớp KPI/bảng. KHÔNG dùng weeklySummary.executive_summary vì nó đếm theo cách
 * khác (status=active) -> lệch số và sai cả định tính (vd sai brand dẫn đầu).
 */
export function composeExecSummary(data: SpyDashboardData): string {
  const snap = data.brandWeeklySnapshot ?? [];
  const scaled = data.scaledContentAnalysis ?? [];
  const dq = dataQualityReport(latestWeek(data.weeklySummary ?? []));
  const weekDate = snap[0]?.week_date || "—";
  const totalBrands = snap.length;
  const activeBrands = snap.filter((b) => normalizeNumber(b.total_active_ads) > 0).length;
  const totalAds = snap.reduce((a, b) => a + normalizeNumber(b.total_active_ads), 0);
  const newAds = snap.reduce((a, b) => a + normalizeNumber(b.new_ads_count), 0);
  const stoppedAds = snap.reduce((a, b) => a + normalizeNumber(b.stopped_ads_count), 0);

  const leader = [...snap].sort((a, b) => normalizeNumber(b.total_active_ads) - normalizeNumber(a.total_active_ads))[0];
  const riser = [...snap].sort((a, b) => normalizeNumber(b.new_ads_count) - normalizeNumber(a.new_ads_count))[0];
  const topHook = countChips(snap, "main_hooks")[0];
  const topOffer = countChips(snap, "offers_detected")[0];

  const parts: string[] = [
    `Tuần ${weekDate}: theo dõi ${totalBrands} đối thủ, ${activeBrands} đang chạy ` +
      `${totalAds.toLocaleString("vi-VN")} quảng cáo trẻ hóa da (+${newAds} mới, −${stoppedAds} dừng).`,
  ];
  if (leader && normalizeNumber(leader.total_active_ads) > 0)
    parts.push(`Dẫn đầu volume: ${leader.brand_name} (${normalizeNumber(leader.total_active_ads)} ad).`);
  if (riser && normalizeNumber(riser.new_ads_count) > 0)
    parts.push(`Tăng tốc mạnh nhất: ${riser.brand_name} (+${normalizeNumber(riser.new_ads_count)} ad mới).`);
  if (topHook) parts.push(`Hook phổ biến: ${viLabel(topHook.label)}.`);
  if (topOffer) parts.push(`Offer nổi bật: ${topOffer.label}.`);
  parts.push(`${scaled.length} cụm nội dung đang nhân rộng.`);
  parts.push(`Chất lượng dữ liệu: ${dq.score}/100.`);
  return parts.join(" ");
}

export function buildReportModel(data: SpyDashboardData, dataSource: DataSourceType): ReportModel {
  const snap = data.brandWeeklySnapshot ?? [];
  const scaled = data.scaledContentAnalysis ?? [];
  const summary = latestWeek(data.weeklySummary ?? []);
  const dq = dataQualityReport(summary);

  const weekDate = snap[0]?.week_date || summary?.week_start || "—";
  const totalBrands = snap.length;
  const activeBrands = snap.filter((b) => normalizeNumber(b.total_active_ads) > 0).length;
  const totalAds = snap.reduce((a, b) => a + normalizeNumber(b.total_active_ads), 0);
  const newAds = snap.reduce((a, b) => a + normalizeNumber(b.new_ads_count), 0);
  const stoppedAds = snap.reduce((a, b) => a + normalizeNumber(b.stopped_ads_count), 0);

  const execSummary = composeExecSummary(data);

  const brands: ReportBrandRow[] = [...snap]
    .filter((b) => normalizeNumber(b.total_active_ads) > 0)   // bỏ brand không chạy ad khỏi báo cáo PDF
    .sort((a, b) => normalizeNumber(b.total_active_ads) - normalizeNumber(a.total_active_ads))
    .map((b) => ({
      name: b.brand_name,
      active: normalizeNumber(b.total_active_ads),
      newAds: normalizeNumber(b.new_ads_count),
      stopped: normalizeNumber(b.stopped_ads_count),
      scaled: normalizeNumber(b.scaled_content_count),
      videoRate: normalizeNumber(b.skin_rejuvenation_video_rate),
      msgRate: normalizeNumber(b.skin_rejuvenation_messenger_rate),
      topFormat: firstChip(b.main_content_formats) || b.skin_rejuvenation_top_format || "",
      topHook: firstChip(b.main_hooks),
      offers: String(b.offers_detected || ""),
    }));

  const patterns = {
    hooks: topFrom(summary?.top_hooks, snap, "main_hooks"),
    offers: topFrom(summary?.top_offers, snap, "offers_detected"),
    formats: topFrom(summary?.top_creative_formats, snap, "main_content_formats"),
    services: topFrom(summary?.top_service_types, snap, "services_running"),
    angles: topFrom(undefined, snap, "main_angles"),
  };

  // Khuyến nghị SERYN gom theo copy/adapt/counter/avoid/monitor từ cụm scale.
  const recMap = new Map<ReportRecAction, Array<{ brand: string; format: string; hook: string; reframe: string }>>();
  for (const s of scaled) {
    const act = normAction(s.seryn_should_copy_adapt_counter_avoid);
    if (!act) continue;
    const arr = recMap.get(act) ?? [];
    if (arr.length >= 8) { recMap.set(act, arr); continue; }
    arr.push({
      brand: s.brand_name,
      format: firstChip(s.content_format),
      hook: String(s.representative_hook || "").trim(),
      reframe: String(s.seryn_reframe || s.competitor_strategy_interpretation || "").trim(),
    });
    recMap.set(act, arr);
  }
  const recommendations = ACTION_ORDER
    .filter((a) => recMap.has(a))
    .map((a) => ({ action: a, items: recMap.get(a)! }));

  const scaledClusters = [...scaled]
    .sort((a, b) => normalizeNumber(b.number_of_similar_ads) - normalizeNumber(a.number_of_similar_ads))
    .slice(0, 15)
    .map((s) => ({
      brand: s.brand_name,
      ads: normalizeNumber(s.number_of_similar_ads),
      format: firstChip(s.content_format),
      hook: String(s.representative_hook || "").trim(),
      scaleLevel: normalizeNumber(s.scale_level),
      action: String(s.seryn_should_copy_adapt_counter_avoid || "").trim(),
    }));

  const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const changes = [...(data.weeklyChangeInsights ?? [])]
    .sort((a, b) => (sevRank[String(a.severity)] ?? 3) - (sevRank[String(b.severity)] ?? 3))
    .slice(0, 24)
    .map((c) => ({
      brand: c.brand,
      type: String(c.change_type || ""),
      severity: String(c.severity || ""),
      summary: String(c.summary || ""),
      action: String(c.recommended_action || ""),
    }));

  const wk = summary?.week_start;
  const actions = (data.actionPlan ?? [])
    .filter((a) => !wk || a.week_start === wk)
    .map((a) => ({
      priority: String(a.priority || ""),
      insightType: String(a.insight_type || ""),
      insight: String(a.insight || ""),
      suggested: String(a.suggested_action || ""),
      brand: String(a.related_brand || ""),
    }));

  const swipes = (data.swipeSuggestions ?? [])
    .slice(0, 14)
    .map((s) => ({
      brand: String(s.brand_name || ""),
      hook: String(s.hook || ""),
      offer: String(s.offer || ""),
      format: String(s.format || ""),
      whySave: String(s.why_save || ""),
      howAdapt: String(s.how_to_adapt || ""),
      url: String(s.ad_url || ""),
    }));

  let generatedAt = "";
  try { generatedAt = new Date().toLocaleString("vi-VN"); } catch { generatedAt = ""; }

  return {
    weekDate,
    generatedAt,
    sourceLabel: SOURCE_LABELS[dataSource] || String(dataSource),
    kpis: {
      totalBrands, activeBrands, totalAds, newAds, stoppedAds,
      scaledClusters: scaled.length,
      dataQuality: dq.score,
      failedPages: dq.failedPages,
    },
    execSummary,
    brands,
    inactiveBrands: snap.length - brands.length,
    patterns,
    recommendations,
    scaledClusters,
    changes,
    actions,
    swipes,
  };
}
