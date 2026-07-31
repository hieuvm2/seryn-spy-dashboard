/* ============================================================
   SERYN Spy — Cảnh báo content của CHÍNH SERYN (tab SERYN)
   ------------------------------------------------------------
   NGUỒN CHÍNH: các rủi ro claim "Nội bộ SERYN" trong BÁO CÁO TUẦN mới nhất
   (report.risk_warnings) — ĐỒNG NHẤT với phần "Rủi ro tuyên bố (claim)" ở
   tab Báo cáo. Khi CHƯA có báo cáo nào -> fallback tự dò content ad-level.
   Chỉ dựa dữ liệu đã có — không bịa thêm.
   ============================================================ */
import type { SpyDashboardData, SpyReport } from "../types";
import { isOwnRow } from "./ownBrand";

/** Nhóm cảnh báo: pháp lý VN / chính sách Meta / chuẩn thương hiệu / ghi nhận từ báo cáo tuần. */
export type AlertCategory = "law" | "meta" | "brand" | "report";

export const CATEGORY_VI: Record<AlertCategory, string> = {
  law: "Luật quảng cáo Việt Nam",
  meta: "Chính sách quảng cáo Meta",
  brand: "Chuẩn thương hiệu SERYN",
  report: "Ghi nhận từ báo cáo tuần",
};

export interface SerynContentAlert {
  severity: "High" | "Medium";
  /** Nhóm cảnh báo (để hiện badge + gom nhóm). */
  category: AlertCategory;
  /** Nhãn nguồn: tên luật quét, đầu mục báo cáo hoặc angle của content. */
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
  /** Căn cứ pháp lý / chính sách / chuẩn thương hiệu của cảnh báo. */
  basis?: string;
  /** Hướng xử lý cụ thể. */
  guidance?: string;
  /** (nguồn content) link QC ví dụ + số QC. */
  adUrl?: string;
  adsCount?: number;
}

export interface SerynAlertsResult {
  /** Nguồn cảnh báo đang dùng: báo cáo tuần / tự dò content / không có dữ liệu. */
  source: "report" | "content" | "none";
  /** Có nguồn để đánh giá cảnh báo không (báo cáo hoặc content). */
  hasData: boolean;
  /** Số QC đang chạy của SERYN đã được máy quét tuân thủ rà qua. */
  scannedAds: number;
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
      category: "report",
      label: head || "Nội bộ SERYN",
      message: rest || raw,
      flaggedPhrases: extractQuotedPhrases(raw),
    });
  }
  out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "High" ? -1 : 1));
  return out;
}

/* ---------- nguồn 2: máy quét tuân thủ — rà TOÀN BỘ QC đang chạy của SERYN ----------
   3 nhóm luật: (law) luật quảng cáo Việt Nam · (meta) chính sách quảng cáo Meta ·
   (brand) chuẩn thương hiệu SERYN. Chỉ báo khi có QC thật khớp — không suy diễn. */
interface ComplianceRule {
  category: Exclude<AlertCategory, "report">;
  severity: "High" | "Medium";
  name: string;
  basis: string;
  guidance: string;
  /** RegExp source — quét không phân biệt hoa thường trên toàn văn QC. */
  pattern: string;
  describe: (n: number) => string;
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    category: "law", severity: "High",
    name: "Từ ngữ tuyệt đối: 'nhất', 'duy nhất', 'số 1'",
    pattern: "(tốt|đẹp|rẻ|hiệu quả|an toàn|uy tín|lớn)\\s*nhất|duy nhất|số\\s*(1|một)\\b|hàng đầu|độc quyền",
    describe: (n) => `${n} quảng cáo đang dùng từ ngữ tuyệt đối — nhóm từ bị cấm trong quảng cáo khi không có tài liệu chứng minh hợp pháp.`,
    basis: "Luật Quảng cáo (bản đang áp dụng, sửa đổi bởi Luật số 75/2025/QH15 — hiệu lực 01/01/2026): cấm dùng 'nhất', 'duy nhất', 'tốt nhất', 'số một' hoặc từ ngữ tương tự khi không có tài liệu hợp pháp chứng minh. Xử phạt theo Nghị định 87/2026/NĐ-CP (hiệu lực 15/5/2026, thay Nghị định 38/2021/NĐ-CP).",
    guidance: "Bỏ từ tuyệt đối hoặc chuẩn bị tài liệu chứng minh; thay bằng mô tả cụ thể, có số đo.",
  },
  {
    category: "law", severity: "High",
    name: "Cam kết kết quả tuyệt đối: 'xóa sạch', 'dứt điểm', 'vĩnh viễn'",
    pattern: "cam kết (kết quả|hiệu quả|hết|khỏi|sạch|trắng)|(bảo đảm|đảm bảo) (hiệu quả|kết quả)|100%\\s*(hiệu quả|hết|sạch|khỏi)|hiệu quả (100%|tuyệt đối)|vĩnh viễn|mãi mãi|dứt điểm|tận gốc|khỏi hẳn|chữa khỏi|xóa sạch|sạch (nám|nhăn|mụn)",
    describe: (n) => `${n} quảng cáo hứa kết quả tuyệt đối — dạng câu chữ dễ bị coi là quảng cáo sai sự thật hoặc gây nhầm lẫn về công dụng dịch vụ y khoa.`,
    basis: "Luật Quảng cáo (sửa đổi bởi Luật số 75/2025/QH15): cấm quảng cáo không đúng hoặc gây nhầm lẫn về chất lượng, công dụng dịch vụ; nội dung quảng cáo phải trung thực, chính xác, rõ ràng. Xử phạt theo Nghị định 87/2026/NĐ-CP.",
    guidance: "Hạ mức hứa xuống 'hỗ trợ cải thiện', 'làm mờ rõ hơn' và luôn kèm 'kết quả tùy cơ địa'.",
  },
  {
    category: "law", severity: "High",
    name: "Hứa kết quả tức thì / theo phút",
    pattern: "(trẻ lại|trẻ hóa|đẹp|căng|hết|giảm|hiệu quả|kết quả)[^.!?\\n]{0,15}(tức thì|ngay lập tức)|(sau|trong|chỉ)\\s*\\d+\\s*(phút|giờ)\\b|trẻ (hơn|ra)\\s*\\d+\\s*tuổi",
    describe: (n) => `${n} quảng cáo hứa hiệu quả tức thì hoặc theo mốc phút - giờ — với dịch vụ y khoa đây là lời hứa vượt quá căn cứ chuyên môn.`,
    basis: "Luật Quảng cáo (sửa đổi bởi Luật số 75/2025/QH15) — cấm gây nhầm lẫn về công dụng. Khám chữa bệnh thuộc nhóm dịch vụ đặc biệt, phải được xác nhận nội dung quảng cáo trước khi chạy theo Nghị định 342/2025/NĐ-CP (hiệu lực 15/02/2026, thay Nghị định 181/2013/NĐ-CP).",
    guidance: "Bỏ mốc thời gian phi thực tế; nếu muốn nói tiến độ, dùng mốc có số đo thật như 'số đo tại ngày 45'.",
  },
  {
    category: "law", severity: "Medium",
    name: "Người nổi tiếng nói về dịch vụ — luật mới 2026 siết",
    pattern: "\\bKOL\\b|\\bKOC\\b|beauty blogger|tiktoker|youtuber|hoa hậu|á hậu|diễn viên|ca sĩ|người mẫu|MC |nghệ sĩ|influencer|review thật|trải nghiệm thực tế",
    describe: (n) => `${n} quảng cáo có người nổi tiếng hoặc người có ảnh hưởng nói về dịch vụ — từ 2026 nhóm này có nghĩa vụ pháp lý riêng, làm sai thì cả người nói lẫn phòng khám cùng chịu trách nhiệm.`,
    basis: "Luật số 75/2025/QH15 (hiệu lực 01/01/2026) bổ sung nghĩa vụ cho 'người chuyển tải sản phẩm quảng cáo': phải kiểm chứng thông tin về dịch vụ, KHÔNG được giới thiệu nếu chưa dùng hoặc chưa hiểu rõ, và phải thông báo rõ đây là nội dung quảng cáo ngay trước và trong khi quảng cáo. Xử phạt theo Nghị định 87/2026/NĐ-CP.",
    guidance: "Hợp đồng với người nổi tiếng phải ghi rõ 3 điều: họ đã thực sự trải nghiệm dịch vụ, nội dung phải gắn nhãn quảng cáo (ví dụ '#quangcao' ngay đầu bài, không giấu trong thẻ), và không tự thêm cam kết kết quả ngoài kịch bản đã duyệt; lưu hồ sơ chứng minh họ đã dùng dịch vụ. LƯU Ý: nghĩa vụ này áp cho cả KHÁCH HÀNG THẬT xuất hiện trong quảng cáo — hai mẫu chuyện khách hàng đang chuẩn bị quay (cô giáo 52 tuổi, kế toán trưởng 45 tuổi) cũng phải gắn nhãn quảng cáo và có đồng ý bằng văn bản.",
  },
  {
    category: "meta", severity: "High",
    name: "Ám chỉ tình trạng cá nhân của người xem",
    pattern: "(bạn|chị|cô|em)[^.!?\\n]{0,25}(đang bị|bị (nám|sạm|nhăn|chảy xệ|hóp))|da (của )?(bạn|chị) đang",
    describe: (n) => `${n} quảng cáo nói thẳng 'bạn/chị đang bị…' — Meta xếp đây vào nhóm ám chỉ đặc điểm cá nhân và có thể từ chối phân phối.`,
    basis: "Meta Advertising Standards — Personal Attributes: cấm câu chữ khẳng định hoặc ám chỉ người xem có tình trạng cơ thể, sức khỏe cụ thể.",
    guidance: "Chuyển sang cách nói chung: 'làn da sau tuổi 40 thường…' thay vì 'da của bạn đang…'.",
  },
  {
    category: "meta", severity: "High",
    name: "Kết quả phi thực tế: 'lột xác', 'thần kỳ', trước/sau",
    pattern: "lột xác|thần kỳ|kỳ diệu|vi diệu|trước[^0-9a-zà-ỹ\\n]{0,6}sau",
    describe: (n) => `${n} quảng cáo dùng từ ngữ đổi đời tức khắc hoặc so sánh trước/sau — nhóm nội dung Meta hạn chế với ngành sức khỏe - làm đẹp.`,
    basis: "Meta Advertising Standards — Unrealistic Outcomes; nội dung trước/sau trong mảng sức khỏe - làm đẹp bị hạn chế hiển thị hoặc từ chối.",
    guidance: "Thay bằng số đo và mô tả quá trình; không dùng cặp ảnh trước/sau cường điệu.",
  },
  {
    category: "meta", severity: "Medium",
    name: "Khan hiếm, đếm ngược dàn dựng",
    pattern: "chỉ còn \\d+\\s*(suất|ngày|slot)|\\d+\\s*suất cuối|ngày cuối cùng|nhanh tay kẻo lỡ|số lượng có hạn",
    describe: (n) => `${n} quảng cáo dùng hạn chót hoặc số suất giới hạn — nếu hạn chót không có thật, đây là thông tin gây hiểu lầm.`,
    basis: "Meta Advertising Standards — Misleading Claims; đồng thời chạm điều cấm quảng cáo gây nhầm lẫn trong Luật Quảng cáo (sửa đổi bởi Luật số 75/2025/QH15).",
    guidance: "Chỉ dùng hạn chót có thật, có ngày kết thúc rõ ràng; không chạy 'chỉ còn 1 ngày' nhiều tuần liền.",
  },
  {
    category: "brand", severity: "High",
    name: "Kịch bản drama gia đình: 'giận chồng', 'vợ già'",
    pattern: "giận chồng|vợ già|chồng chê|bị chồng|anh nhà|chồng bỏ",
    describe: (n) => `${n} quảng cáo dùng kịch bản hôn nhân - chê bai ngoại hình, thuộc danh sách nội dung thương hiệu cấm dùng.`,
    basis: "Chuẩn thương hiệu SERYN: không drama hôn nhân, không hạ thấp người xem — định vị sang trọng kín đáo, y khoa điềm tĩnh.",
    guidance: "Thay bằng khung tự thân ('người nhận ra thay đổi đầu tiên là chính chị'); bản thay chạy ổn 14 ngày rồi mới tắt bản cũ, không nhân sang page mới.",
  },
  {
    category: "brand", severity: "High",
    name: "Hù dọa nỗi sợ lão hóa",
    pattern: "đừng để[^.!?\\n]{0,25}(già|lão hóa|xấu)|sợ (già|xấu|lão hóa)|già trước tuổi|già đi trông thấy",
    describe: (n) => `${n} quảng cáo mở bài bằng nỗi sợ già, xấu — trái nguyên tắc không đánh vào nỗi sợ của thương hiệu.`,
    basis: "Chuẩn thương hiệu SERYN: không FOMO rẻ tiền, không khai thác nỗi sợ lão hóa.",
    guidance: "Nói bằng dữ liệu ('điều gì đang thay đổi trong cấu trúc da') thay cho hình ảnh và câu chữ gây sợ.",
  },
  {
    category: "brand", severity: "Medium",
    name: "Dẫn dắt bằng 'miễn phí / 0đ' hàng loạt",
    pattern: "miễn phí|\\b0\\s*đ|giá sốc|đồng giá|chỉ từ\\s*\\d",
    describe: (n) => `${n} quảng cáo mở đầu bằng 'miễn phí, 0đ' — tự xếp SERYN vào rổ khuyến mãi đại trà, trái định hướng không đua giá.`,
    basis: "Chuẩn thương hiệu SERYN: không đua giá; mục tiêu kỳ 03/08 còn tối đa 45% quảng cáo dẫn bằng ưu đãi.",
    guidance: "Mỗi tuần thay 5-7 bản 'miễn phí/tặng' bằng khung giá trị Bản đồ Gương mặt (cơ chế 4 tầng).",
  },
  {
    category: "brand", severity: "Medium",
    name: "Nội dung lệch mùa đang chạy lại",
    pattern: "đón tết|quà tặng cuối năm|tết 20\\d\\d|giáng sinh|noel|megalive",
    describe: (n) => `${n} quảng cáo nói về Tết, quà cuối năm hoặc sự kiện đã qua nhưng vẫn đang chạy giữa kỳ hiện tại.`,
    basis: "Chuẩn thương hiệu SERYN: nội dung sai thời điểm làm giảm độ tin cậy của page.",
    guidance: "Tắt theo nguyên tắc có bản thay chạy ổn rồi mới tắt; rà lại lịch tự bật lại của các chiến dịch cũ.",
  },
];

function alertsFromComplianceScan(data: SpyDashboardData): { scanned: number; alerts: SerynContentAlert[] } {
  const own = (data.adLevelAnalysis ?? []).filter((a) => isOwnRow(a, data));
  const alerts: SerynContentAlert[] = [];
  for (const rule of COMPLIANCE_RULES) {
    const phrases = new Map<string, string>();
    let count = 0;
    let exampleUrl = "";
    for (const a of own) {
      const text = [a.headline, a.primary_text, a.hook_raw_text, a.hook_text, a.offer_detected]
        .map((x) => String(x ?? "")).join(" \n ");
      const m = text.match(new RegExp(rule.pattern, "gi"));
      if (!m || !m.length) continue;
      count++;
      for (const x of m) {
        const p = x.replace(/\s+/g, " ").trim();
        const k = p.toLowerCase();
        if (p.length >= 2 && !phrases.has(k)) phrases.set(k, p);
      }
      if (!exampleUrl) exampleUrl = adLibraryAdUrl(String(a.page_id ?? ""), String(a.ad_id ?? ""));
    }
    if (!count) continue;
    alerts.push({
      severity: rule.severity,
      category: rule.category,
      label: rule.name,
      message: rule.describe(count),
      flaggedPhrases: [...phrases.values()].slice(0, 8),
      basis: rule.basis,
      guidance: rule.guidance,
      adUrl: exampleUrl,
      adsCount: count,
    });
  }
  return { scanned: own.length, alerts };
}

/* ---------- tìm QC của SERYN chứa 1 cụm từ (khi bấm chip cụm vi phạm) ---------- */
export interface MatchedAd {
  adId: string;
  pageId: string;       // để mở trang Ad Library của page (link ad lẻ hay bị Meta ẩn)
  text: string;         // tiêu đề/hook của ad
  fullText: string;     // TOÀN VĂN nội dung ad (primary_text) — hiển thị thẳng, không cần Facebook
  snippet: string;      // đoạn văn chứa cụm khớp (có thể = text)
  thumbnail: string;    // ảnh creative (fbcdn, có thể hết hạn token -> fallback placeholder)
  searchPhrase: string; // ~9 từ liền nhau quanh chỗ khớp — tra exact-phrase ra ĐÚNG bài
  adFormat: string;
  daysActive: number;
  cta: string;
  offer: string;
  pageName: string;
  url: string;
}
export interface PhraseMatchResult {
  ads: MatchedAd[];
  /** Nguyên cụm đã tra (giữ dấu) khi có QC khớp; rỗng nếu không QC nào chứa. */
  matchedFragment: string;
  /** Luôn false — chỉ khớp CHÍNH XÁC nguyên cụm, không khớp gần đúng. Giữ field cho tương thích. */
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

/** Tra exact-phrase trên Ad Library (VN) — ra ĐÚNG creative chứa câu này.
 *  Đã test thật: q trong ngoặc kép + search_type=keyword_exact_phrase khớp đúng bài
 *  (bỏ ngoặc kép trong câu vẫn khớp; dấu phẩy giữ được). Ad quá mới chưa có lượt
 *  hiển thị thì Meta chưa index -> "No ads match" (dùng link trang page thay thế). */
export function adLibraryPhraseSearchUrl(phrase: string): string {
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&q=${encodeURIComponent(`"${phrase}"`)}&search_type=keyword_exact_phrase&media_type=all`;
}

/** Mở ĐÚNG 1 bài trên Ad Library: popup chi tiết ad trên nền danh sách QC của page.
 *  Đã test thật: ad được Meta index -> popup hiện nguyên bài (Library ID + nội dung);
 *  ad quá mới/0 lượt hiển thị -> popup "Ad isn't in the ad library", đóng popup là
 *  thấy danh sách QC của page để tìm tay (fallback tốt hơn search ra trang trống). */
export function adLibraryAdUrl(pageId: string, adId: string): string {
  const pid = String(pageId ?? "").trim();
  const aid = String(adId ?? "").trim();
  return "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&media_type=all"
    + (pid ? `&view_all_page_id=${encodeURIComponent(pid)}` : "")
    + (aid ? `&id=${encodeURIComponent(aid)}` : "");
}

/** ~9 từ NGUYÊN VĂN đầu tiên của text ad (bỏ ngoặc kép/emoji) — cụm tra exact-phrase. */
export function searchPhraseOf(text: string, totalWords = 9): string {
  return String(text ?? "")
    .replace(/["“”'‘’]/g, " ")
    .replace(/[^0-9a-zA-ZÀ-ỹà-ỹ\s.,!?%–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, totalWords)
    .join(" ");
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

/** ~9 từ NGUYÊN VĂN liền nhau quanh chỗ khớp `frag` — dùng tra exact-phrase ra đúng bài.
 *  Bỏ ngoặc kép/emoji đầu-cuối từ (Meta vẫn khớp khi thiếu ngoặc, đã test thật). */
function searchPhraseAround(fields: string[], frag: string, totalWords = 9): string {
  const fragWords = frag.split(" ").filter(Boolean).length;
  for (const raw of fields) {
    const full = String(raw).replace(/\s+/g, " ").trim();
    const idx = norm(full).indexOf(frag); // norm giữ nguyên độ dài (bỏ dấu + thường hóa)
    if (idx < 0) continue;
    const words = full.split(" ");
    // tìm chỉ số TỪ chứa vị trí khớp
    let pos = 0, wStart = 0;
    for (let w = 0; w < words.length; w++) {
      const end = pos + words[w].length;
      if (idx < end) { wStart = w; break; }
      pos = end + 1;
    }
    const before = Math.max(0, Math.floor((totalWords - fragWords) / 2));
    const s = Math.max(0, wStart - before);
    const chunk = words.slice(s, s + Math.max(totalWords, fragWords + 2)).join(" ");
    // bỏ ngoặc kép + ký tự ngoài chữ/số/dấu câu cơ bản (emoji…) rồi gọn khoảng trắng
    return chunk
      .replace(/["“”'‘’]/g, " ")
      .replace(/[^0-9a-zA-ZÀ-ỹà-ỹ\s.,!?%–-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

/** Các QC của CHÍNH SERYN có nội dung chứa `phrase`.
 *  Tìm trên MỌI field text (hook/headline/primary_text/offer) của adLevelAnalysis +
 *  scaledContentAnalysis (own). CHÍNH XÁC 100%: chỉ trả QC chứa NGUYÊN CỤM (không phân
 *  biệt hoa/thường/dấu). KHÔNG đoán/khớp cụm con — không QC nào chứa nguyên cụm -> rỗng.
 *  Khử trùng theo ad_id/nội dung. */
export function findOwnAdsByPhrase(data: SpyDashboardData, phrase: string): PhraseMatchResult {
  const key = norm(phrase);
  if (!key) return { ads: [], matchedFragment: "", approximate: false };

  // Index ảnh creative theo ad_id (từ visualAnalysis) — để hiện thẳng trong dashboard.
  const thumbById = new Map<string, string>();
  for (const v of data.visualAnalysis ?? []) {
    const id = String((v as any).ad_id || "");
    if (!id) continue;
    const t = (v as any).thumbnail_url || (v as any).media_url || ((v as any).image_urls || [])[0] || (v as any).video_preview_url || "";
    if (t) thumbById.set(id, String(t));
  }

  // Gom nguồn own (ad-level + scaled) về 1 dạng chung để quét text.
  type Src = { adId: string; pageId: string; text: string; fullText: string; thumbnail: string; fields: string[]; adFormat: string; daysActive: number; cta: string; offer: string; pageName: string; url: string };
  const srcs: Src[] = [];
  for (const a of data.adLevelAnalysis ?? []) {
    if (!isOwnRow(a, data)) continue;
    const adId = String(a.ad_id || "");
    srcs.push({
      adId, pageId: String(a.page_id || ""),
      text: String(a.hook_raw_text || a.hook_text || a.headline || a.primary_text || ""),
      fullText: String(a.primary_text || a.hook_raw_text || a.hook_text || a.headline || ""),
      thumbnail: thumbById.get(adId) || "",
      fields: [a.hook_raw_text, a.hook_text, a.headline, a.primary_text, a.hook_normalized, a.offer_detected].map((x) => String(x ?? "")).filter(Boolean),
      adFormat: fmtLabel(a), daysActive: numOf(a.days_active), cta: String(a.cta || ""),
      offer: String(a.offer_detected || ""), pageName: String(a.page_name || ""), url: String(a.ad_snapshot_url || ""),
    });
  }
  for (const s of data.scaledContentAnalysis ?? []) {
    if (!isOwnRow(s, data)) continue;
    const repId = String(s.representative_ad_id || "");
    srcs.push({
      adId: String(s.representative_ad_id || s.content_cluster_id || ""), pageId: String((s as { page_id?: unknown }).page_id || ""),
      text: String(s.representative_hook || ""),
      fullText: String(s.representative_hook || ""),
      thumbnail: thumbById.get(repId) || "",
      fields: [s.representative_hook, s.offer_detected].map((x) => String(x ?? "")).filter(Boolean),
      adFormat: fmtLabel(s), daysActive: numOf(s.longest_days_active), cta: "",
      offer: String(s.offer_detected || ""), pageName: "", url: "",
    });
  }

  // CHÍNH XÁC 100% — CHỈ hiển thị QC chứa NGUYÊN CỤM (khớp toàn bộ `phrase`).
  // KHÔNG đoán, KHÔNG tụt xuống cụm con (n-gram). Không có QC nào chứa nguyên cụm -> trả rỗng.
  const origPhrase = String(phrase ?? "").replace(/\s+/g, " ").trim(); // giữ dấu, để hiển thị
  const collect = (frag: string): MatchedAd[] => {
    const seen = new Set<string>();
    const out: MatchedAd[] = [];
    for (const s of srcs) {
      if (!s.fields.some((f) => norm(f).includes(frag))) continue;
      const dedup = s.adId || s.text.toLowerCase();
      if (!dedup || seen.has(dedup)) continue;
      seen.add(dedup);
      out.push({
        adId: s.adId, pageId: s.pageId, text: s.text, fullText: s.fullText, thumbnail: s.thumbnail,
        snippet: snippetAround(s.fields, frag) || s.text,
        searchPhrase: searchPhraseAround(s.fields, frag) || s.text.slice(0, 80),
        adFormat: s.adFormat, daysActive: s.daysActive, cta: s.cta, offer: s.offer, pageName: s.pageName, url: s.url,
      });
    }
    return out.sort((a, b) => b.daysActive - a.daysActive);
  };

  const ads = collect(key); // key = norm(phrase) — khớp nguyên cụm (không phân biệt hoa/thường/dấu)
  return { ads, matchedFragment: ads.length ? origPhrase : "", approximate: false };
}

/** Cảnh báo content SERYN — máy quét tuân thủ (luật VN / Meta / thương hiệu)
 *  chạy trên MỌI QC đang chạy của SERYN, cộng thêm ghi nhận từ báo cáo tuần. */
export function buildSerynAlerts(data: SpyDashboardData): SerynAlertsResult {
  const report = latestWeeklyReport(data);
  const scan = alertsFromComplianceScan(data);
  const reportAlerts = report ? alertsFromReport(report) : [];
  const sevRank: Record<string, number> = { High: 0, Medium: 1 };
  const catRank: Record<AlertCategory, number> = { law: 0, meta: 1, brand: 2, report: 3 };
  const alerts = [...scan.alerts, ...reportAlerts].sort((a, b) =>
    catRank[a.category] - catRank[b.category] ||
    sevRank[a.severity] - sevRank[b.severity] ||
    (b.adsCount ?? 0) - (a.adsCount ?? 0),
  );
  const hasData = !!report || scan.scanned > 0;
  return {
    source: report ? "report" : scan.scanned > 0 ? "content" : "none",
    hasData,
    scannedAds: scan.scanned,
    alerts,
  };
}
