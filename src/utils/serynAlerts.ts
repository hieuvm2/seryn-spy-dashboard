/* ============================================================
   SERYN Spy — Cảnh báo content của CHÍNH SERYN (tab SERYN)
   ------------------------------------------------------------
   NGUỒN CHÍNH: các rủi ro claim "Nội bộ SERYN" trong BÁO CÁO TUẦN mới nhất
   (report.risk_warnings) — ĐỒNG NHẤT với phần "Rủi ro tuyên bố (claim)" ở
   tab Báo cáo. Khi CHƯA có báo cáo nào -> fallback tự dò content ad-level.
   Chỉ dựa dữ liệu đã có — không bịa thêm.
   ============================================================ */
import type { SpyDashboardData, SpyReport } from "../types";
import {
  buildAdContentIntelligenceForBrand, detectRiskReasons, detectBannedPhrases, ANGLE_VI,
} from "./adContentIntelligence";
import { getOwnSnapshotBrandNames } from "./ownBrand";

export interface SerynContentAlert {
  severity: "High" | "Medium";
  /** Nhãn nguồn: đầu mục báo cáo ("Nội bộ SERYN…") hoặc angle của content. */
  label: string;
  /** Nội dung cảnh báo (nguyên văn từ báo cáo, hoặc trích content). */
  message: string;
  /** Cụm từ vi phạm phát hiện được. */
  flaggedPhrases: string[];
  /** (nguồn content) lý do rủi ro. */
  reasons?: string[];
  /** (nguồn content) đề xuất sửa an toàn + cảnh báo tuân thủ. */
  safeRewrite?: string;
  complianceWarning?: string;
  /** (nguồn content) link QC ví dụ + số QC. */
  adUrl?: string;
  adsCount?: number;
}

export interface SerynAlertsResult {
  /** Nguồn cảnh báo đang dùng: báo cáo tuần / tự dò content / không có dữ liệu. */
  source: "report" | "content" | "none";
  /** Có nguồn để đánh giá cảnh báo không (báo cáo hoặc content). */
  hasData: boolean;
  alerts: SerynContentAlert[];
}

/* ---------- helpers ---------- */
function parseList(v?: string): string[] {
  return String(v ?? "").split("|").map((s) => s.trim()).filter(Boolean);
}
function splitHead(s: string): { head: string; rest: string } {
  const i = s.indexOf(":");
  if (i > 0 && i <= 44) return { head: s.slice(0, i).trim(), rest: s.slice(i + 1).trim() };
  return { head: "", rest: s };
}
const QUOTES = "\"'‘’“”";
/** Trích các cụm trong ngoặc kép, tách tiếp theo "/" hoặc "|" (vd 'a / b / c'). */
function extractQuotedPhrases(s: string): string[] {
  const re = new RegExp(`[${QUOTES}]([^${QUOTES}]{2,}?)[${QUOTES}]`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    for (const part of m[1].split(/\s*[/|]\s*/)) {
      const p = part.trim();
      if (p) out.push(p);
    }
  }
  return [...new Set(out)];
}
function latestWeeklyReport(data: SpyDashboardData): SpyReport | null {
  const arr = data.weeklyReports ?? [];
  if (!arr.length) return null;
  return [...arr].sort((a, b) =>
    String(b.period_start).localeCompare(String(a.period_start)) ||
    String(b.generated_at).localeCompare(String(a.generated_at)),
  )[0];
}

/* ---------- nguồn 1: báo cáo tuần (đồng nhất tab Báo cáo) ---------- */
function alertsFromReport(report: SpyReport): SerynContentAlert[] {
  const out: SerynContentAlert[] = [];
  for (const raw of parseList(report.risk_warnings)) {
    const { head, rest } = splitHead(raw);
    // Chỉ lấy rủi ro của CHÍNH SERYN — lọc theo ĐẦU MỤC (bỏ "Thị trường",
    // "Đọc số kỳ này"… kể cả khi phần nội dung có nhắc tới SERYN).
    if (!/seryn|nội bộ|noi bo/i.test(head)) continue;
    const severity: "High" | "Medium" =
      /ưu tiên cao|cao nhất|nghiêm trọng|khẩn|nặng/i.test(raw) ? "High" : "Medium";
    out.push({
      severity,
      label: head || "Nội bộ SERYN",
      message: rest || raw,
      flaggedPhrases: extractQuotedPhrases(raw),
    });
  }
  out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "High" ? -1 : 1));
  return out;
}

/* ---------- nguồn 2 (fallback): tự dò content ad-level ---------- */
function alertsFromContent(data: SpyDashboardData): { hasContent: boolean; alerts: SerynContentAlert[] } {
  const ownNames = getOwnSnapshotBrandNames(data);
  const seen = new Set<string>();
  const alerts: SerynContentAlert[] = [];
  let total = 0;
  for (const name of ownNames) {
    for (const c of buildAdContentIntelligenceForBrand(name, data, 20)) {
      const key = `${c.brandName}|${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total++;
      const flaggedPhrases = detectBannedPhrases(`${c.contentText} ${c.offerDetected}`);
      const reasons = detectRiskReasons(c.contentText, c.offerDetected, false).map((r) => r.reason);
      const risky = c.riskLevel === "High" || c.riskLevel === "Medium" || flaggedPhrases.length > 0;
      if (!risky) continue;
      alerts.push({
        severity: c.riskLevel === "High" || flaggedPhrases.length > 0 ? "High" : "Medium",
        label: ANGLE_VI[c.contentAngle] || "Nội dung quảng cáo",
        message: c.contentText || c.contentSummary,
        flaggedPhrases,
        reasons: reasons.length ? reasons : ["Câu chữ cần review theo chuẩn claim an toàn"],
        safeRewrite: c.serynResponse.safeRewrite,
        complianceWarning: c.serynResponse.complianceWarning,
        adUrl: c.exampleAdUrls[0],
        adsCount: c.adsCount,
      });
    }
  }
  alerts.sort((a, b) =>
    a.severity === b.severity ? (b.adsCount ?? 0) - (a.adsCount ?? 0) : a.severity === "High" ? -1 : 1,
  );
  return { hasContent: total > 0, alerts };
}

/** Cảnh báo content SERYN — ưu tiên báo cáo tuần (đồng nhất tab Báo cáo). */
export function buildSerynAlerts(data: SpyDashboardData): SerynAlertsResult {
  const report = latestWeeklyReport(data);
  // Có báo cáo -> báo cáo là nguồn chuẩn (kể cả khi 0 rủi ro) để KHỚP tab Báo cáo.
  if (report) {
    return { source: "report", hasData: true, alerts: alertsFromReport(report) };
  }
  const c = alertsFromContent(data);
  return { source: c.hasContent ? "content" : "none", hasData: c.hasContent, alerts: c.alerts };
}
