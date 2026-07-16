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
import { getOwnSnapshotBrandNames, isOwnRow } from "./ownBrand";

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

/* ---------- tìm QC của SERYN chứa 1 cụm từ (khi bấm chip cụm vi phạm) ---------- */
export interface MatchedAd {
  adId: string;
  pageId: string;    // để mở trang Ad Library của page (link ad lẻ hay bị Meta ẩn)
  text: string;      // tiêu đề/hook của ad
  snippet: string;   // đoạn văn chứa cụm khớp (có thể = text)
  adFormat: string;
  daysActive: number;
  cta: string;
  offer: string;
  pageName: string;
  url: string;
}
export interface PhraseMatchResult {
  ads: MatchedAd[];
  /** Cụm thực sự khớp (có thể ngắn hơn phrase khi phải khớp gần đúng). */
  matchedFragment: string;
  /** true khi không có QC chứa nguyên cụm, phải khớp theo cụm con dài nhất. */
  approximate: boolean;
}

const AD_FMT_VI: Record<string, string> = { image: "Ảnh", video: "Video", carousel: "Carousel" };
function fmtLabel(a: { ad_format?: unknown; media_type?: unknown; content_format?: unknown }): string {
  const f = `${String(a.ad_format ?? "")} ${String(a.media_type ?? "")} ${String(a.content_format ?? "")}`.toLowerCase();
  const k = (["video", "carousel", "image"] as const).find((x) => f.includes(x));
  return k ? AD_FMT_VI[k] : "";
}
const numOf = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
/** Chuẩn hóa để khớp linh hoạt: bỏ dấu, thường hóa, gộp khoảng trắng. */
const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Link Thư viện QC Facebook của SERYN — xem trực tiếp ad thật (nguồn gốc).
 *  Ưu tiên trang SERYN (view_all_page_id); nếu chưa cấu hình page thì tìm theo
 *  từ khóa tại VN. */
/** Trang Ad Library của 1 page cụ thể — luôn mở được (link ad lẻ ?id= hay bị Meta
 *  ẩn "Ad isn't in the ad library" với ad own mới/ít impression). */
export function pageAdLibraryUrl(pageId: string): string {
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&view_all_page_id=${encodeURIComponent(String(pageId).trim())}&media_type=all`;
}
export function serynAdLibraryUrl(data: SpyDashboardData, phrase?: string): string {
  const pageId = (data.ownBrandPages ?? []).map((p) => String(p.page_id || "").trim()).find(Boolean);
  if (pageId) return pageAdLibraryUrl(pageId);
  const q = encodeURIComponent(String(phrase || "").trim());
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&q=${q}&search_type=keyword_unordered&media_type=all`;
}

/** Trích đoạn ~120 ký tự quanh vị trí khớp `frag` (đã chuẩn hóa) trong text gốc. */
function snippetAround(fields: string[], frag: string): string {
  for (const raw of fields) {
    const i = norm(raw).indexOf(frag);
    if (i < 0) continue;
    const full = String(raw).replace(/\s+/g, " ").trim();
    // vị trí trong bản chuẩn hóa ~ vị trí trong bản gốc (độ dài xấp xỉ) -> lấy cửa sổ rộng.
    const start = Math.max(0, i - 40);
    const end = Math.min(full.length, i + frag.length + 80);
    return (start > 0 ? "…" : "") + full.slice(start, end).trim() + (end < full.length ? "…" : "");
  }
  return "";
}

/** Các QC của CHÍNH SERYN có nội dung chứa `phrase`.
 *  Tìm trên MỌI field text (hook/headline/primary_text/offer) của adLevelAnalysis +
 *  scaledContentAnalysis (own). Nếu không QC nào chứa nguyên cụm (cụm trong báo cáo
 *  thường là bản AI diễn giải), fallback: khớp theo CỤM CON dài nhất (n-gram) — vd
 *  "vũ khí giữ chồng" -> "giữ chồng". Khử trùng theo ad_id/nội dung. */
export function findOwnAdsByPhrase(data: SpyDashboardData, phrase: string): PhraseMatchResult {
  const key = norm(phrase);
  if (!key) return { ads: [], matchedFragment: "", approximate: false };

  // Gom nguồn own (ad-level + scaled) về 1 dạng chung để quét text.
  type Src = { adId: string; pageId: string; text: string; fields: string[]; adFormat: string; daysActive: number; cta: string; offer: string; pageName: string; url: string };
  const srcs: Src[] = [];
  for (const a of data.adLevelAnalysis ?? []) {
    if (!isOwnRow(a, data)) continue;
    srcs.push({
      adId: String(a.ad_id || ""), pageId: String(a.page_id || ""),
      text: String(a.hook_raw_text || a.hook_text || a.headline || a.primary_text || ""),
      fields: [a.hook_raw_text, a.hook_text, a.headline, a.primary_text, a.hook_normalized, a.offer_detected].map((x) => String(x ?? "")).filter(Boolean),
      adFormat: fmtLabel(a), daysActive: numOf(a.days_active), cta: String(a.cta || ""),
      offer: String(a.offer_detected || ""), pageName: String(a.page_name || ""), url: String(a.ad_snapshot_url || ""),
    });
  }
  for (const s of data.scaledContentAnalysis ?? []) {
    if (!isOwnRow(s, data)) continue;
    srcs.push({
      adId: String(s.representative_ad_id || s.content_cluster_id || ""), pageId: String((s as { page_id?: unknown }).page_id || ""),
      text: String(s.representative_hook || ""),
      fields: [s.representative_hook, s.offer_detected].map((x) => String(x ?? "")).filter(Boolean),
      adFormat: fmtLabel(s), daysActive: numOf(s.longest_days_active), cta: "",
      offer: String(s.offer_detected || ""), pageName: "", url: "",
    });
  }

  // Các cụm con ứng viên: cụm đầy đủ trước, rồi ngắn dần tới tối thiểu 2 từ
  // (phrase 1 từ thì để 1). Tránh khớp 1 từ chung chung gây nhiễu.
  const words = key.split(" ").filter(Boolean);                       // đã bỏ dấu (để khớp)
  const origWords = String(phrase ?? "").replace(/\s+/g, " ").trim().split(" "); // giữ nguyên (để hiển thị)
  const nMin = words.length >= 2 ? 2 : 1;
  const collect = (frag: string): MatchedAd[] => {
    const seen = new Set<string>();
    const out: MatchedAd[] = [];
    for (const s of srcs) {
      if (!s.fields.some((f) => norm(f).includes(frag))) continue;
      const dedup = s.adId || s.text.toLowerCase();
      if (!dedup || seen.has(dedup)) continue;
      seen.add(dedup);
      out.push({
        adId: s.adId, pageId: s.pageId, text: s.text, snippet: snippetAround(s.fields, frag) || s.text,
        adFormat: s.adFormat, daysActive: s.daysActive, cta: s.cta, offer: s.offer, pageName: s.pageName, url: s.url,
      });
    }
    return out.sort((a, b) => b.daysActive - a.daysActive);
  };

  for (let n = words.length; n >= nMin; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const frag = words.slice(i, i + n).join(" ");
      const ads = collect(frag);
      if (ads.length) {
        const display = origWords.slice(i, i + n).join(" ") || frag; // nhãn giữ dấu
        return { ads, matchedFragment: display, approximate: n < words.length };
      }
    }
  }
  return { ads: [], matchedFragment: "", approximate: false };
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
