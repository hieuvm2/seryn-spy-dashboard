/* ============================================================
   SERYN Spy — SERYN vs Đối thủ benchmark
   ------------------------------------------------------------
   So sánh tín hiệu ads CÔNG KHAI của SERYN với đối thủ (volume, angle,
   service, offer, format, funnel, visual, risk) + đề xuất test.
   KHÔNG dùng CPA/ROAS/spend. KHÔNG kết luận "thua/kém" — dùng wording trung
   tính: "thấp hơn trung bình", "chưa thấy dùng", "đối thủ lặp lại nhiều hơn".
   ============================================================ */
import type { SpyDashboardData, BrandWeeklySnapshot, AdLevelAnalysis } from "../types";
import { normalizeNumber, countChips, viLabel } from "./spyData";
import { isOwnRow, getOwnSnapshotBrandNames } from "./ownBrand";

const num = normalizeNumber;
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export interface SerynBenchmarkSnapshot {
  ownBrandName: string;
  hasData: boolean;
  activeAds: number;
  newAds: number;
  stoppedAds: number;
  pages: number;
  topServices: string[];
  topContentAngles: string[];
  topFormats: string[];
  topOffers: string[];
  formatMix: Record<string, number>;   // % image/video/carousel
  funnelMix: Record<string, number>;   // % messenger/lead_form/landing_page_conversion/phone_call
  visualRates: Record<string, number>; // % doctor/ugc/before_after/offer_banner/risk
}

export interface CompetitorBenchmarkSnapshot {
  brandCount: number;
  avgActiveAds: number;
  topActiveAds: number;
  topCompetitor: string;
  topServices: string[];
  topContentAngles: string[];
  topFormats: string[];
  topOffers: string[];
  formatMix: Record<string, number>;
  funnelMix: Record<string, number>;
  visualRates: Record<string, number>;
}

export interface SerynRecommendedTest {
  priority: "High" | "Medium" | "Low";
  testType: "Content Angle" | "Offer" | "Format" | "Funnel" | "Visual" | "CTA";
  recommendation: string;
  reason: string;
  evidence: string;
  riskNote?: string;
}

export interface SerynVsCompetitorComparison {
  ownBrandName: string;
  serynHasData: boolean;

  serynActiveAds: number;
  competitorAvgActiveAds: number;
  topCompetitorActiveAds: number;
  topCompetitorName: string;

  serynTopServices: string[];
  competitorTopServices: string[];
  missingServiceOpportunities: string[];

  serynTopContentAngles: string[];
  competitorTopContentAngles: string[];
  missingContentAngles: string[];

  serynTopOffers: string[];
  competitorTopOffers: string[];
  offerGapNote: string;

  serynFormatMix: Record<string, number>;
  competitorFormatMix: Record<string, number>;
  formatGapNote: string;

  serynFunnelMix: Record<string, number>;
  competitorFunnelMix: Record<string, number>;
  funnelGapNote: string;

  visualGapNote: string;
  riskGapNote: string;

  recommendedTests: SerynRecommendedTest[];
}

/* ---------- helpers ---------- */
function splitGroups(data: SpyDashboardData) {
  const snap = data.brandWeeklySnapshot ?? [];
  const own: BrandWeeklySnapshot[] = [];
  const comp: BrandWeeklySnapshot[] = [];
  for (const r of snap) (isOwnRow(r, data) ? own : comp).push(r);
  const ads = data.adLevelAnalysis ?? [];
  const ownAds: AdLevelAnalysis[] = [];
  const compAds: AdLevelAnalysis[] = [];
  for (const a of ads) (isOwnRow(a, data) ? ownAds : compAds).push(a);
  return { own, comp, ownAds, compAds };
}

const labelsOf = (rows: any[], field: string, n = 6) => countChips(rows, field).slice(0, n).map((c) => c.label);

/** Format mix % từ adLevel.ad_format; fallback trung bình rate trong snapshot. */
function formatMix(ads: AdLevelAnalysis[], snap: BrandWeeklySnapshot[]): Record<string, number> {
  const keys = ["image", "video", "carousel"] as const;
  const counts: Record<string, number> = { image: 0, video: 0, carousel: 0 };
  let total = 0;
  for (const a of ads) {
    const f = String(a.ad_format || a.media_type || "").toLowerCase();
    const k = keys.find((x) => f.includes(x));
    if (k) { counts[k]++; total++; }
  }
  if (total > 0) return { image: pctOf(counts.image, total), video: pctOf(counts.video, total), carousel: pctOf(counts.carousel, total) };
  // fallback: trung bình rate snapshot (0–1)
  const avg = (field: string) => { const v = snap.map((r) => num((r as any)[field])).filter((x) => x > 0); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) : 0; };
  return { image: avg("skin_rejuvenation_image_rate"), video: avg("skin_rejuvenation_video_rate"), carousel: avg("skin_rejuvenation_carousel_rate") };
}

/** Funnel mix % từ adLevel.inferred_objective; fallback rate snapshot. */
function funnelMix(ads: AdLevelAnalysis[], snap: BrandWeeklySnapshot[]): Record<string, number> {
  const keys = ["messenger", "lead_form", "landing_page_conversion", "phone_call"] as const;
  const counts: Record<string, number> = { messenger: 0, lead_form: 0, landing_page_conversion: 0, phone_call: 0 };
  let total = 0;
  for (const a of ads) {
    const o = String(a.inferred_objective || "").toLowerCase();
    if ((keys as readonly string[]).includes(o)) { counts[o]++; total++; }
  }
  if (total > 0) return Object.fromEntries(keys.map((k) => [k, pctOf(counts[k], total)]));
  const avg = (field: string) => { const v = snap.map((r) => num((r as any)[field])).filter((x) => x > 0); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) : 0; };
  return {
    messenger: avg("skin_rejuvenation_messenger_rate"),
    lead_form: avg("skin_rejuvenation_lead_form_rate"),
    landing_page_conversion: avg("skin_rejuvenation_landing_page_conversion_rate"),
    phone_call: avg("skin_rejuvenation_phone_call_rate"),
  };
}

/** Visual rates % trung bình cho nhóm brand (từ brandVisualSummary). */
function visualRates(data: SpyDashboardData, brandNames: Set<string>): Record<string, number> {
  const rows = (data.brandVisualSummary ?? []).filter((v) => brandNames.has(String(v.brand)));
  const avg = (field: string) => { const v = rows.map((r) => num((r as any)[field])).filter((x) => x >= 0); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) : 0; };
  return {
    doctor: avg("doctor_rate"), ugc: avg("ugc_rate"),
    before_after: avg("before_after_rate"), offer_banner: avg("offer_banner_rate"),
    risk: avg("high_risk_rate"),
  };
}

/* ---------- public builders ---------- */
export function buildSerynSnapshot(data: SpyDashboardData): SerynBenchmarkSnapshot {
  const { own, ownAds } = splitGroups(data);
  const ownNames = new Set(getOwnSnapshotBrandNames(data));
  const ownBrandName = getOwnSnapshotBrandNames(data)[0] || "SERYN";
  const activeAds = own.reduce((a, r) => a + num(r.total_active_ads), 0);
  return {
    ownBrandName,
    hasData: own.length > 0 && activeAds > 0,
    activeAds,
    newAds: own.reduce((a, r) => a + num(r.new_ads_count), 0),
    stoppedAds: own.reduce((a, r) => a + num(r.stopped_ads_count), 0),
    pages: own.reduce((a, r) => a + num(r.num_pages_running), 0),
    topServices: labelsOf(own, "services_running"),
    topContentAngles: labelsOf(own, "main_angles"),
    topFormats: labelsOf(own, "main_content_formats"),
    topOffers: labelsOf(own, "offers_detected"),
    formatMix: formatMix(ownAds, own),
    funnelMix: funnelMix(ownAds, own),
    visualRates: visualRates(data, ownNames),
  };
}

export function buildCompetitorBenchmark(data: SpyDashboardData): CompetitorBenchmarkSnapshot {
  const { comp, compAds } = splitGroups(data);
  const compNames = new Set(comp.map((r) => String(r.brand_name)));
  const withAds = comp.filter((r) => num(r.total_active_ads) > 0);
  const totalAds = comp.reduce((a, r) => a + num(r.total_active_ads), 0);
  const top = [...comp].sort((a, b) => num(b.total_active_ads) - num(a.total_active_ads))[0];
  return {
    brandCount: comp.length,
    avgActiveAds: withAds.length ? Math.round(totalAds / withAds.length) : 0,
    topActiveAds: top ? num(top.total_active_ads) : 0,
    topCompetitor: top ? String(top.brand_name) : "—",
    topServices: labelsOf(comp, "services_running"),
    topContentAngles: labelsOf(comp, "main_angles"),
    topFormats: labelsOf(comp, "main_content_formats"),
    topOffers: labelsOf(comp, "offers_detected"),
    formatMix: formatMix(compAds, comp),
    funnelMix: funnelMix(compAds, comp),
    visualRates: visualRates(data, compNames),
  };
}

const notIn = (arr: string[], set: string[]) => {
  const s = new Set(set.map((x) => x.toLowerCase()));
  return arr.filter((x) => !s.has(x.toLowerCase()));
};

export function getContentAngleGaps(data: SpyDashboardData): string[] {
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  return notIn(c.topContentAngles, s.topContentAngles);
}
export function getServiceGaps(data: SpyDashboardData): string[] {
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  return notIn(c.topServices, s.topServices);
}
export function getFormatGaps(data: SpyDashboardData): string[] {
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  return (["video", "carousel", "image"] as const).filter((k) => (c.formatMix[k] || 0) - (s.formatMix[k] || 0) >= 15);
}
export function getFunnelGaps(data: SpyDashboardData): string[] {
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  return (["messenger", "lead_form", "landing_page_conversion", "phone_call"] as const)
    .filter((k) => (c.funnelMix[k] || 0) - (s.funnelMix[k] || 0) >= 15);
}

const FMT_VI: Record<string, string> = { image: "ảnh", video: "video", carousel: "carousel" };
const FUNNEL_VI: Record<string, string> = { messenger: "Messenger", lead_form: "lead form", landing_page_conversion: "trang đích", phone_call: "gọi điện" };

export function getSerynRecommendedTests(data: SpyDashboardData): SerynRecommendedTest[] {
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  const tests: SerynRecommendedTest[] = [];
  const missingAngles = notIn(c.topContentAngles, s.topContentAngles);
  const missingServices = notIn(c.topServices, s.topServices);
  const fmtGaps = getFormatGaps(data);
  const funnelGaps = getFunnelGaps(data);

  missingAngles.slice(0, 2).forEach((a) => tests.push({
    priority: "High", testType: "Content Angle",
    recommendation: `Test có kiểm soát góc "${viLabel(a)}" theo tông SERYN (điềm tĩnh, y khoa).`,
    reason: "Đối thủ đang lặp lại angle này nhưng SERYN chưa thấy dùng trong dữ liệu hiện có.",
    evidence: `Angle đối thủ hay dùng: ${c.topContentAngles.map(viLabel).join(", ") || "—"}.`,
    riskNote: /fear|nỗi lo|lão hóa/i.test(a) ? "Tránh fear-based; giữ 'kết quả tùy cơ địa'." : undefined,
  }));
  fmtGaps.forEach((k) => tests.push({
    priority: "Medium", testType: "Format",
    recommendation: `Bổ sung định dạng ${FMT_VI[k] || k} vào mix creative của SERYN.`,
    reason: `SERYN đang thấp hơn đối thủ về tỉ lệ ${FMT_VI[k] || k} (SERYN ${s.formatMix[k] || 0}% vs đối thủ ${c.formatMix[k] || 0}%).`,
    evidence: `Format mix đối thủ: ảnh ${c.formatMix.image}% · video ${c.formatMix.video}% · carousel ${c.formatMix.carousel}%.`,
  }));
  funnelGaps.forEach((k) => tests.push({
    priority: "Medium", testType: "Funnel",
    recommendation: `Thử tuyến ${FUNNEL_VI[k] || k} song song để đo phản hồi.`,
    reason: `Đối thủ dùng ${FUNNEL_VI[k] || k} nhiều hơn (đối thủ ${c.funnelMix[k] || 0}% vs SERYN ${s.funnelMix[k] || 0}%).`,
    evidence: "Tín hiệu funnel từ CTA/landing công khai.",
  }));
  missingServices.slice(0, 2).forEach((sv) => tests.push({
    priority: "Low", testType: "Content Angle",
    recommendation: `Cân nhắc nội dung giáo dục quanh dịch vụ "${viLabel(sv)}" nếu phù hợp định vị.`,
    reason: "Đối thủ đẩy mạnh dịch vụ này, SERYN chưa thấy trong dữ liệu.",
    evidence: `Dịch vụ đối thủ nổi bật: ${c.topServices.map(viLabel).join(", ") || "—"}.`,
  }));
  // Nếu SERYN neo offer/giá nhiều -> nhắc giữ premium
  if (s.topOffers.length && c.visualRates.offer_banner >= 30) {
    tests.push({
      priority: "Low", testType: "Offer",
      recommendation: "Giữ định vị premium, tránh đua giá — test offer dạng 'đánh giá/soi da' thay vì giảm giá sốc.",
      reason: "Thị trường bão hòa offer giảm sâu; đua giá làm loãng định vị SERYN.",
      evidence: `Tỉ lệ banner ưu đãi của đối thủ ~${c.visualRates.offer_banner}%.`,
    });
  }
  return tests.slice(0, 8);
}

export function buildSerynVsCompetitorComparison(data: SpyDashboardData): SerynVsCompetitorComparison {
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  const missingContentAngles = notIn(c.topContentAngles, s.topContentAngles);
  const missingServiceOpportunities = notIn(c.topServices, s.topServices);

  const volNote = !s.hasData
    ? "Chưa có dữ liệu ads công khai của SERYN để so sánh volume."
    : s.activeAds < c.avgActiveAds
      ? `SERYN (${s.activeAds}) đang thấp hơn trung bình đối thủ (${c.avgActiveAds}).`
      : `SERYN (${s.activeAds}) ở mức ngang/cao hơn trung bình đối thủ (${c.avgActiveAds}).`;

  const fmtGap = getFormatGaps(data);
  const funnelGap = getFunnelGaps(data);

  return {
    ownBrandName: s.ownBrandName,
    serynHasData: s.hasData,
    serynActiveAds: s.activeAds,
    competitorAvgActiveAds: c.avgActiveAds,
    topCompetitorActiveAds: c.topActiveAds,
    topCompetitorName: c.topCompetitor,
    serynTopServices: s.topServices,
    competitorTopServices: c.topServices,
    missingServiceOpportunities,
    serynTopContentAngles: s.topContentAngles,
    competitorTopContentAngles: c.topContentAngles,
    missingContentAngles,
    serynTopOffers: s.topOffers,
    competitorTopOffers: c.topOffers,
    offerGapNote: s.topOffers.length
      ? "SERYN có ghi nhận offer — nên kiểm tra có đang đua giá không; ưu tiên offer dạng đánh giá/soi da."
      : "SERYN chưa thấy offer nổi bật; đối thủ đang đẩy: " + (c.topOffers.join(", ") || "—") + ".",
    serynFormatMix: s.formatMix,
    competitorFormatMix: c.formatMix,
    formatGapNote: fmtGap.length ? `Định dạng SERYN đang thiếu so với đối thủ: ${fmtGap.map((k) => FMT_VI[k] || k).join(", ")}.` : "Mix định dạng của SERYN không lệch lớn so với đối thủ.",
    serynFunnelMix: s.funnelMix,
    competitorFunnelMix: c.funnelMix,
    funnelGapNote: funnelGap.length ? `Đối thủ dùng nhiều hơn: ${funnelGap.map((k) => FUNNEL_VI[k] || k).join(", ")}.` : "Cơ cấu funnel của SERYN tương đương đối thủ.",
    visualGapNote: `Bác sĩ/chuyên gia: SERYN ${s.visualRates.doctor}% vs đối thủ ${c.visualRates.doctor}% · UGC: ${s.visualRates.ugc}% vs ${c.visualRates.ugc}% · before/after: ${s.visualRates.before_after}% vs ${c.visualRates.before_after}%.`,
    riskGapNote: c.visualRates.risk >= 30 || c.visualRates.before_after >= 40
      ? "Đối thủ dùng nhiều before/after & claim rủi ro — SERYN KHÔNG copy nguyên xi, giữ câu chữ an toàn."
      : "Rủi ro claim của thị trường ở mức vừa; SERYN vẫn giữ nguyên tắc 'kết quả tùy cơ địa'.",
    recommendedTests: getSerynRecommendedTests(data),
  };
}

/** Ghi chú vị thế volume (dùng lại ở nhiều nơi). */
export function volumePositionNote(cmp: SerynVsCompetitorComparison): string {
  if (!cmp.serynHasData) return "Chưa có dữ liệu ads công khai của SERYN.";
  return cmp.serynActiveAds < cmp.competitorAvgActiveAds
    ? `SERYN đang thấp hơn trung bình đối thủ về volume ads (${cmp.serynActiveAds} vs ${cmp.competitorAvgActiveAds}).`
    : `SERYN ở mức ngang/cao hơn trung bình đối thủ (${cmp.serynActiveAds} vs ${cmp.competitorAvgActiveAds}).`;
}
