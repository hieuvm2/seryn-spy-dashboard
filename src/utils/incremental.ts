/* ============================================================
   Incremental pipeline — nhãn trạng thái phân tích + tổng hợp crawl run.
   Backward-compatible: thiếu dữ liệu -> trả mặc định, không crash.
   ============================================================ */
import type { SpyDashboardData, CrawlRun } from "../types";

export const STATUS_TONE: Record<string, string> = {
  newly_analyzed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reused_from_cache: "bg-slate-100 text-slate-600 border-slate-200",
  changed_reanalyzed: "bg-amber-50 text-amber-700 border-amber-200",
  carried_forward: "bg-indigo-50 text-indigo-700 border-indigo-200",
  crawl_failed: "bg-rose-50 text-rose-700 border-rose-200",
  missing_media: "bg-amber-50 text-amber-700 border-amber-200",
  low_confidence: "bg-slate-100 text-slate-500 border-slate-200",
};

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/** Lần crawl mới nhất (theo started_at). undefined nếu chưa có tab Crawl Runs. */
export function latestCrawlRun(data: SpyDashboardData): CrawlRun | undefined {
  const runs = data.crawlRuns ?? [];
  if (!runs.length) return undefined;
  return [...runs].sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")))[0];
}

export type IncrementalSummary = {
  hasData: boolean;
  newAds: number;
  reused: number;
  changed: number;
  carried: number;
  crawlFailures: number;
  totalPages: number;
  successPages: number;
  aiCallsSaved: number;     // reused + carried (không cần phân tích lại)
  status: string;
};

/** Tổng hợp incremental: ưu tiên Crawl Runs; fallback đếm từ adLevel analysis_status. */
export function incrementalSummary(data: SpyDashboardData): IncrementalSummary {
  const run = latestCrawlRun(data);
  if (run) {
    const reused = n(run.reused_ads_count), carried = n(run.carried_forward_count);
    return {
      hasData: true,
      newAds: n(run.new_ads_count), reused, changed: n(run.changed_ads_count), carried,
      crawlFailures: n(run.failed_pages), totalPages: n(run.total_pages), successPages: n(run.success_pages),
      aiCallsSaved: reused + carried, status: String(run.status || ""),
    };
  }
  // fallback: đếm từ Ad Level analysis_status (nếu có)
  const ads = data.adLevelAnalysis ?? [];
  const c = (s: string) => ads.filter((a) => a.analysis_status === s).length;
  const reused = c("reused_from_cache"), carried = c("carried_forward");
  const hasStatus = ads.some((a) => a.analysis_status);
  return {
    hasData: hasStatus,
    newAds: c("newly_analyzed"), reused, changed: c("changed_reanalyzed"), carried,
    crawlFailures: 0, totalPages: 0, successPages: 0, aiCallsSaved: reused + carried, status: "",
  };
}
