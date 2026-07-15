/* ============================================================
   SERYN Spy — Cảnh báo content của CHÍNH SERYN (tab SERYN)
   ------------------------------------------------------------
   Lấy từ phần PHÂN TÍCH content (adContentIntelligence): mỗi content của
   SERYN có riskLevel + lý do rủi ro + cụm từ claim vi phạm. Tab SERYN dùng
   kết quả này để liệt kê RÕ content nào bị cảnh báo và vì sao.
   Chỉ dựa dữ liệu ads công khai đã crawl — không bịa thêm.
   ============================================================ */
import type { SpyDashboardData } from "../types";
import {
  buildAdContentIntelligenceForBrand, detectRiskReasons, detectBannedPhrases,
  type AdContentIntelligence,
} from "./adContentIntelligence";
import { getOwnSnapshotBrandNames } from "./ownBrand";

export interface SerynContentAlert {
  /** Content bị cảnh báo (từ phân tích content của SERYN). */
  content: AdContentIntelligence;
  severity: "High" | "Medium";
  /** Vì sao bị cảnh báo (từ phân tích rủi ro). */
  reasons: string[];
  /** Cụm từ claim vi phạm phát hiện trong chính content (nếu có). */
  flaggedPhrases: string[];
  /** Đề xuất sửa an toàn (từ phân tích — safe rewrite). */
  safeRewrite: string;
  complianceWarning: string;
}

export interface SerynAlertsResult {
  hasData: boolean;
  /** Tổng content SERYN đã phân tích (để hiển thị "X/Y content bị cảnh báo"). */
  totalContents: number;
  alerts: SerynContentAlert[];
}

/** Dựng cảnh báo cho toàn bộ content của SERYN (mọi brand_name thuộc own brand). */
export function buildSerynAlerts(data: SpyDashboardData): SerynAlertsResult {
  const ownNames = getOwnSnapshotBrandNames(data);
  const contents: AdContentIntelligence[] = [];
  const seen = new Set<string>();
  for (const name of ownNames) {
    for (const c of buildAdContentIntelligenceForBrand(name, data, 20)) {
      const key = `${c.brandName}|${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      contents.push(c);
    }
  }

  const alerts: SerynContentAlert[] = [];
  for (const c of contents) {
    const flaggedPhrases = detectBannedPhrases(`${c.contentText} ${c.offerDetected}`);
    const reasons = detectRiskReasons(c.contentText, c.offerDetected, false).map((r) => r.reason);
    const risky = c.riskLevel === "High" || c.riskLevel === "Medium" || flaggedPhrases.length > 0;
    if (!risky) continue;
    alerts.push({
      content: c,
      severity: c.riskLevel === "High" || flaggedPhrases.length > 0 ? "High" : "Medium",
      reasons: reasons.length ? reasons : ["Câu chữ có yếu tố cần review theo chuẩn claim an toàn"],
      flaggedPhrases,
      safeRewrite: c.serynResponse.safeRewrite,
      complianceWarning: c.serynResponse.complianceWarning,
    });
  }

  alerts.sort((a, b) => (a.severity === b.severity ? b.content.adsCount - a.content.adsCount : a.severity === "High" ? -1 : 1));
  return { hasData: contents.length > 0, totalContents: contents.length, alerts };
}
