/* ============================================================
   Weekly Intelligence — frontend helpers (read-only + status update)
   - parseTopList: đọc JSON string list-field an toàn.
   - buildMarkdownReport: dựng markdown từ summary/action/swipe để copy.
   - updateActionStatus / updateSwipeStatus: ghi status qua Apps Script (nếu cấu hình).
   ============================================================ */
import type {
  WeeklySummary, ActionPlanItem, SwipeSuggestion, TopCountItem, DataQualityReport,
} from "../types";
import { isSheetsConfigured, apiPost } from "./sheetsApi";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Parse JSON list-field ({key,count}[]) an toàn — không crash khi rỗng/hỏng. */
export function parseTopList(raw: unknown): TopCountItem[] {
  if (Array.isArray(raw)) return raw as TopCountItem[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => x && typeof x.key === "string") : [];
  } catch { return []; }
}

export function dataQualityReport(summary?: WeeklySummary): DataQualityReport {
  const score = num(summary?.data_quality_score);
  const failedPages = num(summary?.total_crawl_failed_pages);
  const level: DataQualityReport["level"] = score >= 80 ? "good" : score >= 60 ? "warning" : "low";
  return { score, failedPages, level };
}

/** week_start mới nhất trong danh sách summary. */
export function latestWeek(summaries: WeeklySummary[]): WeeklySummary | undefined {
  return [...summaries].sort((a, b) => String(a.week_start).localeCompare(String(b.week_start))).slice(-1)[0];
}

/** Dựng markdown report để copy/dán (đồng bộ format với generateMarkdownReport server). */
export function buildMarkdownReport(
  summary: WeeklySummary | undefined,
  actions: ActionPlanItem[],
  swipe: SwipeSuggestion[],
): string {
  if (!summary) return "# SERYN Weekly Spy Report\n\n_Chưa có dữ liệu tuần._";
  const list = (raw: unknown) => parseTopList(raw).map((x) => `${x.key} (${x.count})`).join(", ") || "—";
  const byActive = parseTopList(summary.top_brands_by_active_ads);
  const byNew = parseTopList(summary.top_brands_by_new_ads);
  const moves = byActive.slice(0, 8).map((b) => {
    const n = byNew.find((x) => x.key === b.key)?.count ?? 0;
    return `| ${b.key} | ${b.count} | ${n} |`;
  }).join("\n");
  return [
    `# SERYN Weekly Spy Report`,
    ``,
    `**Week:** ${summary.week_start} → ${summary.week_end}  ·  generated ${summary.generated_at || ""}`,
    ``,
    `## Executive Summary`,
    summary.executive_summary || "—",
    ``,
    `## Data Quality`,
    `**Score:** ${summary.data_quality_score}/100 · failed pages: ${summary.total_crawl_failed_pages || 0}`,
    ``,
    `## Top Competitor Moves`,
    `| Brand | Active ads | New ads |`,
    `|---|---|---|`,
    moves || `| — | 0 | 0 |`,
    ``,
    `## Top Hooks`, list(summary.top_hooks), ``,
    `## Top Offers`, list(summary.top_offers), ``,
    `## Creative Formats`, list(summary.top_creative_formats), ``,
    `## Action Plan`,
    ...(actions.length ? actions.map((a) => `- **[${a.priority}] ${a.insight_type}** — ${a.insight}\n  - ${a.suggested_action}`) : ["- Không có action."]),
    ``,
    `## Swipe File Candidates`,
    ...(swipe.length ? swipe.map((s) => `- **${s.brand_name}** — ${s.hook || "(no hook)"} · ${s.why_save}${s.ad_url ? `\n  - ${s.ad_url}` : ""}`) : ["- Chưa có ad đáng lưu."]),
    ``,
  ].join("\n");
}

export function weeklyWriteConfigured(): boolean {
  return isSheetsConfigured();
}

/** Cập nhật status 1 action (qua Apps Script record tab action_plan). */
export async function updateActionStatus(item: ActionPlanItem, status: string): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  try {
    await apiPost({ type: "action_plan", action: "update", record: { ...item, status, updated_at: new Date().toISOString() } });
    return true;
  } catch { return false; }
}

/** Cập nhật status 1 swipe suggestion. */
export async function updateSwipeStatus(item: SwipeSuggestion, status: string): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  try {
    await apiPost({ type: "swipe_suggestions", action: "update", record: { ...item, status } });
    return true;
  } catch { return false; }
}
