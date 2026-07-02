/* ============================================================
   SERYN Spy — Competitor Discovery helpers (server-side)
   ------------------------------------------------------------
   Extract + score + dedupe competitor candidate từ result Exa.
   KHÔNG bịa page_id. Vanity URL -> needs_page_id.
   ============================================================ */
import { extractDomain } from "./exaClient.mjs";
import { detectServices, detectOffers, detectPrices } from "./marketResearchUtils.mjs";

const str = (v) => (v === undefined || v === null ? "" : String(v));
const lc = (s) => str(s).toLowerCase();

/** Chuẩn hóa tên brand: bỏ dấu, hậu tố pháp lý, lowercase, gọn. */
export function normalizeBrandName(name) {
  let s = lc(name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  s = s.replace(/\b(benh vien|tham my vien|phong kham|clinic|spa|beauty|center|aesthetic|hospital|jsc|co\.?,? ?ltd|company)\b/g, " ");
  return s.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Lấy domain website (loại social). */
export function extractWebsiteUrl(result) {
  const url = str(result?.url);
  const domain = extractDomain(url);
  if (/facebook\.com|instagram\.com|tiktok\.com|youtube\.com/i.test(domain)) return "";
  return url;
}

// Tín hiệu title KHÔNG phải tên brand (bài SEO/blog/câu hỏi).
const JUNK_TITLE_SIGNALS = [
  "?", "bao nhiêu", "giá bao", "chi phí", "bảng giá", "báo giá", "là gì",
  "gồm những gì", "có nên", "có tốt", "có hiệu quả", "cách ", "tại sao",
  "như thế nào", "review", "đánh giá", "top ", "tốp ", "list ", "danh sách",
  "kinh nghiệm", "lưu ý", "webtretho", "wiki", "hỏi đáp", "tư vấn", "tin tức",
];
// Tiền tố chung cần bỏ khi đứng đầu title.
const GENERIC_PREFIX = /^(giới thiệu|trang chủ|home|về chúng tôi|dịch vụ|bảng giá|báo giá|khuyến mãi|ưu đãi|tin tức|blog|liên hệ|website chính thức)\b[\s:–—\-|]*/i;
// Đuôi site-name cần bỏ.
const TRAILING_SUFFIX = /\s*[-–—|]\s*(facebook|trang chủ|home|official|chính hãng|website).*$/i;

/** Title có vẻ là bài blog/SEO/câu hỏi (không phải tên brand)? */
export function looksLikeJunkTitle(title) {
  const t = lc(title).trim();
  if (!t || t.length < 2) return true;
  return JUNK_TITLE_SIGNALS.some((w) => t.includes(w));
}

// Tên KHÔNG phải brand: tiêu đề generic (Giới thiệu/Trang chủ…) hoặc thuần thuật ngữ dịch vụ.
// So khớp trên chuỗi ĐÃ chuẩn hóa (bỏ dấu) để tránh lỗi \b với ký tự tiếng Việt.
const GENERIC_PHRASES = new Set(
  ["trang chu", "gioi thieu", "home", "ve chung toi", "dich vu", "san pham", "bang gia",
   "bao gia", "khuyen mai", "uu dai", "tin tuc", "blog", "lien he", "website", "trang chinh"],
);
const SERVICE_STOPWORDS = new Set(
  "tre hoa da mat hifu nang co collagen laser cang chi skin booster ultherapy thermage rf exosome meso mesotherapy filler botox lifting cong nghe lieu trinh dich vu san pham nam mun pico co2 sera core fractional toan dien vung"
    .split(" ").filter(Boolean),
);
/** brand_name có đáng tin là tên đối thủ không? Loại tiêu đề generic + tên thuần dịch vụ
 *  (vd "Giới thiệu", "Trang chủ", "Trẻ hóa da", "HIFU", "Nâng Cơ Trẻ Hóa") để KHÔNG import/spy nhầm. */
export function isValidCompetitorBrand(name) {
  const n = str(name).trim();
  if (n.length < 2 || looksLikeJunkTitle(n)) return false;
  const normFull = normalizeBrandName(n);
  if (!normFull || GENERIC_PHRASES.has(normFull)) return false;
  const core = normFull.split(" ").filter((t) => t && !SERVICE_STOPWORDS.has(t));
  return core.length > 0; // còn ít nhất 1 token riêng (không phải thuần dịch vụ/generic)
}

// Domain tổng hợp/blog/diễn đàn — không phải brand clinic.
const AGGREGATOR_DOMAINS = /facebook|instagram|tiktok|youtube|google|wordpress|blogspot|medium|webtretho|tienphong|vnexpress|dantri|foody|shopee|lazada|tiki|news|bao|wiki/i;
// Subdomain chung cần bỏ để lấy label brand thật.
const GENERIC_SUBDOMAIN = new Set(["www", "blog", "tin", "news", "shop", "m", "web", "store", "vi", "en"]);

/** Brand suy ra từ domain (khi title là junk): "thammyvienthienha.vn" -> "Thammyvienthienha". */
export function brandFromDomain(url) {
  const d = extractDomain(str(url));
  if (!d || AGGREGATOR_DOMAINS.test(d)) return "";
  // bỏ subdomain chung (blog., tin.…), lấy label đăng ký chính.
  const parts = d.split(".").filter((p) => !GENERIC_SUBDOMAIN.has(p));
  const label = (parts[0] || "").replace(/[^a-z0-9]+/gi, " ").trim();
  if (!label || label.length < 3) return "";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Đoán brand name (best-effort). Title junk -> ưu tiên domain; FB result ->
 * giữ page name (đã được làm sạch). Trả "" nếu không lấy được brand đáng tin.
 */
export function extractCandidateBrand(result) {
  const url = str(result?.url);
  const isFb = /facebook\.com/i.test(extractDomain(url));
  let title = str(result?.title).replace(TRAILING_SUFFIX, "").trim();

  // FB result: title chính là page name -> chỉ làm sạch, không coi là junk.
  if (isFb) {
    const seg = title.split(/[|\-–—:]/)[0].replace(GENERIC_PREFIX, "").trim();
    return seg.slice(0, 80);
  }

  // Non-FB từ site tổng hợp/báo/diễn đàn -> KHÔNG phải đối thủ, bỏ.
  if (AGGREGATOR_DOMAINS.test(extractDomain(url))) return "";

  // Non-FB: nếu title là bài SEO/câu hỏi -> lấy brand từ domain.
  if (looksLikeJunkTitle(title)) {
    return brandFromDomain(url).slice(0, 80);
  }

  let brand = title.split(/[|\-–—:]/)[0].replace(GENERIC_PREFIX, "").trim();
  if (!brand || brand.length < 2 || looksLikeJunkTitle(brand)) {
    brand = brandFromDomain(url);
  }
  return brand.slice(0, 80);
}

/**
 * Điểm chất lượng brand (0–1): tên giống doanh nghiệp thật (có từ khóa
 * clinic/spa/thẩm mỹ, hoặc là proper noun ngắn gọn) cao; câu hỏi/blog thấp.
 */
export function brandQualityScore(brand) {
  const b = lc(brand).trim();
  if (!b || b.length < 2) return 0;
  if (looksLikeJunkTitle(b)) return 0.15;
  let s = 0.5;
  if (/clinic|spa|tham\s*my|thẩm\s*mỹ|beauty|aesthetic|da\s*liễu|da\s*lieu|bệnh viện|benh vien|phòng khám|phong kham|center|viện/i.test(b)) s += 0.35;
  const words = b.split(/\s+/).length;
  if (words <= 5) s += 0.1;       // tên brand thường ngắn
  if (words > 8) s -= 0.25;       // câu dài -> giống tiêu đề bài viết
  return Math.max(0, Math.min(1, Math.round(s * 100) / 100));
}

/** Tìm mọi link social trong text/result. */
export function extractSocialLinks(textOrResult) {
  const text = typeof textOrResult === "string"
    ? textOrResult
    : [textOrResult?.url, textOrResult?.text, textOrResult?.summary, (textOrResult?.highlights || []).join(" ")].join(" ");
  const grab = (re) => [...new Set((text.match(re) || []).map((u) => u.replace(/[)\]\.,"'>]+$/, "")))];
  return {
    facebook: grab(/https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[A-Za-z0-9_.\-/?=&%]+/gi),
    instagram: grab(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/gi),
    tiktok: grab(/https?:\/\/(?:www\.)?tiktok\.com\/@?[A-Za-z0-9_.\-/]+/gi),
  };
}

/** Chuẩn hóa Facebook URL (bỏ query/hash, www). */
export function normalizeFacebookUrl(url) {
  let u = str(url).trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  try {
    const x = new URL(u);
    if (!/facebook\.com$/i.test(x.hostname.replace(/^www\./, ""))) return u;
    const idParam = x.searchParams.get("id");
    x.hostname = "www.facebook.com";
    let path = x.pathname.replace(/\/+$/, "");
    x.search = ""; x.hash = "";
    if (idParam && /^\d{6,}$/.test(idParam)) {
      return `https://www.facebook.com/profile.php?id=${idParam}`;
    }
    return `https://www.facebook.com${path}`;
  } catch { return u; }
}

export function isNumericPageId(value) {
  return /^\d{6,}$/.test(str(value).trim());
}

/** Lấy numeric page_id từ URL nếu rõ ràng; vanity URL -> "". */
export function extractFacebookPageIdFromUrl(url) {
  const u = str(url);
  const m1 = u.match(/[?&]id=(\d{6,})/);
  if (m1) return m1[1];
  // facebook.com/<digits> hoặc /pages/.../<digits>
  const m2 = u.match(/facebook\.com\/(?:pages\/[^/]+\/)?(\d{8,})(?:[/?]|$)/i);
  if (m2) return m2[1];
  return "";
}

/**
 * Chấm điểm 1 candidate. context: { geo, serviceCategory }
 * Trả các sub-score + overall_confidence_score (0–1).
 */
export function scoreCompetitorCandidate(candidate, context = {}) {
  const text = lc([candidate.brand_name, candidate.website_url, candidate.facebook_url,
    candidate.detected_services, candidate.evidence_summary, candidate.source_types].join(" "));

  const services = candidate.detected_services || detectServices(text);
  const serviceCat = lc(context.serviceCategory || "");
  const geo = lc(context.geo || "");

  const service_match_score = services
    ? (serviceCat && serviceCat !== "all" && services.includes(serviceCat) ? 1 : 0.7)
    : 0.3;
  const geo_match_score = !geo || geo === "vietnam"
    ? (/việt nam|vietnam|hà nội|hồ chí minh|tphcm|sài gòn|đà nẵng|vn/i.test(text) ? 0.9 : 0.5)
    : (text.includes(geo) ? 1 : 0.5);

  const credMap = { news: 0.8, report: 0.85, government: 0.9, clinic_website: 0.65, competitor_landing_page: 0.6, blog: 0.5, review_site: 0.5, social_page: 0.55, unknown: 0.4 };
  const types = str(candidate.source_types).split("|").filter(Boolean);
  const source_credibility_score = types.length
    ? Math.max(...types.map((t) => credMap[t] ?? 0.4))
    : 0.4;

  const website_confidence_score = candidate.website_url ? 0.8 : 0.3;
  const fanpage_confidence_score = isNumericPageId(candidate.facebook_page_id)
    ? 0.95 : (candidate.facebook_url ? 0.55 : 0.2);

  const brand_quality_score = brandQualityScore(candidate.brand_name);

  const competitor_relevance_score = Math.round(
    (service_match_score * 0.4 + geo_match_score * 0.3 + source_credibility_score * 0.3) * 100) / 100;

  // Mục tiêu cuối là spy ads qua Facebook page_id -> fanpage quan trọng hơn website.
  // Nhiều clinic chỉ chạy ad qua page FB, không có website chính.
  const base = (
    service_match_score * 0.25 +
    geo_match_score * 0.2 +
    source_credibility_score * 0.15 +
    website_confidence_score * 0.1 +
    fanpage_confidence_score * 0.3
  );
  // Brand junk (tiêu đề blog/câu hỏi) bị phạt mạnh để không nổi lên đầu danh sách.
  const overall = base * (0.4 + 0.6 * brand_quality_score);
  return {
    service_match_score: round2(service_match_score),
    geo_match_score: round2(geo_match_score),
    source_credibility_score: round2(source_credibility_score),
    website_confidence_score: round2(website_confidence_score),
    fanpage_confidence_score: round2(fanpage_confidence_score),
    brand_quality_score: round2(brand_quality_score),
    competitor_relevance_score,
    overall_confidence_score: round2(overall),
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Dedupe theo page_id / facebook_url chuẩn hóa / website_domain /
 * (normalized_brand_name + geo). Đánh dấu duplicate_of nếu trùng.
 * existingCompetitors: rows tab Competitors. previousDiscovery: rows tab Competitor Discovery.
 */
export function dedupeCompetitorCandidates(candidates, existingCompetitors = [], previousDiscovery = []) {
  const seen = new Map(); // key -> discovery_id/brand
  const register = (rows, idField) => {
    for (const r of rows) {
      const pid = str(r.page_ids ?? r.facebook_page_id ?? r.page_id);
      pid.split("|").filter(Boolean).forEach((p) => isNumericPageId(p) && seen.set("pid:" + p.trim(), str(r[idField] || r.brand_name || r.brand)));
      const fb = normalizeFacebookUrl(str(r.page_urls ?? r.facebook_url));
      if (fb) seen.set("fb:" + lc(fb), str(r[idField] || r.brand_name || r.brand));
      const dom = lc(str(r.website_domain || extractDomain(str(r.website_url))));
      if (dom) seen.set("dom:" + dom, str(r[idField] || r.brand_name || r.brand));
      const nb = normalizeBrandName(str(r.brand_name ?? r.brand ?? r.normalized_brand_name));
      const g = lc(str(r.geo || ""));
      if (nb) seen.set("nb:" + nb + "|" + g, str(r[idField] || r.brand_name || r.brand));
    }
  };
  register(existingCompetitors, "id");
  register(previousDiscovery, "discovery_id");

  return candidates.map((c) => {
    const keys = [];
    str(c.facebook_page_id).split("|").filter(Boolean).forEach((p) => isNumericPageId(p) && keys.push("pid:" + p.trim()));
    const fb = normalizeFacebookUrl(c.facebook_url); if (fb) keys.push("fb:" + lc(fb));
    const dom = lc(c.website_domain || extractDomain(c.website_url)); if (dom) keys.push("dom:" + dom);
    const nb = normalizeBrandName(c.brand_name); const g = lc(c.geo || "");
    if (nb) keys.push("nb:" + nb + "|" + g);

    let dupOf = "";
    for (const k of keys) { if (seen.has(k)) { dupOf = seen.get(k); break; } }
    // tự đăng ký để dedupe trong cùng batch
    keys.forEach((k) => { if (!seen.has(k)) seen.set(k, c.brand_name); });
    return { ...c, duplicate_of: dupOf };
  });
}

/* ============================================================
   ENRICHMENT — phone / address / fanpage cho scraper
   ============================================================ */

/** Chuẩn hóa số điện thoại VN: +84/84 -> 0; chỉ nhận 10–11 số bắt đầu 0. */
export function normalizePhoneVN(phone) {
  let p = str(phone).replace(/[^\d+]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length >= 11) p = "0" + p.slice(2);
  p = p.replace(/\D/g, "");
  return /^0\d{8,10}$/.test(p) ? p : "";
}

/** Trích mọi số điện thoại VN từ text (đã normalize, dedupe). */
export function extractPhones(text) {
  const t = str(text);
  const raw = t.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,10}/g) || [];
  const out = [];
  for (const r of raw) { const n = normalizePhoneVN(r); if (n && !out.includes(n)) out.push(n); }
  return out;
}

/** Hotline ưu tiên: số đứng sau "hotline"; fallback số đầu tiên. */
export function extractHotline(text) {
  const t = str(text);
  const m = t.match(/hotline[:\s]*((?:\+?84|0)(?:[\s.\-]?\d){8,10})/i);
  if (m) { const n = normalizePhoneVN(m[1]); if (n) return n; }
  return extractPhones(t)[0] || "";
}

const ADDR_CUES = /(địa chỉ|address|cơ sở|chi nhánh|cs\d)[:\s]/i;
const CITY_CUE = /(hà nội|tp\.?\s*hcm|hồ chí minh|sài gòn|đà nẵng|quận\s|phường\s|đường\s|số\s*\d)/i;
/** Trích đoạn địa chỉ (best-effort): câu sau cue "Địa chỉ", hoặc câu chứa thành phố/đường + số. */
export function extractAddresses(text) {
  const t = str(text).replace(/\s+/g, " ");
  const out = [];
  const cueMatch = t.match(new RegExp(`${ADDR_CUES.source}([^.|\n]{6,90})`, "i"));
  if (cueMatch) out.push(cueMatch[2].trim().replace(/[,;]\s*$/, ""));
  for (const seg of t.split(/[.|\n•]/)) {
    const s = seg.trim();
    if (s.length >= 8 && s.length <= 90 && CITY_CUE.test(s) && /\d/.test(s) && !out.includes(s)) out.push(s);
    if (out.length >= 2) break;
  }
  return out;
}

/** Query Exa bổ sung để tìm fanpage cho 1 candidate có website nhưng thiếu FB. */
export function buildFanpageQueries(candidate, geo) {
  const brand = str(candidate.brand_name).trim();
  const domain = str(candidate.website_domain || extractDomain(candidate.website_url)).trim();
  const out = [];
  if (brand) {
    out.push(`"${brand}" facebook`);
    out.push(`"${brand}" site:facebook.com`);
    out.push(`"${brand}" fanpage ${geo || ""}`.trim());
  }
  if (domain) out.push(`"${domain}" facebook`);
  // tối đa 3 query/candidate (cost guard)
  return [...new Set(out)].slice(0, 3);
}

