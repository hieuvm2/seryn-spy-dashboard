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

/** Đoán brand name từ title/url (best-effort). */
export function extractCandidateBrand(result) {
  const title = str(result?.title);
  // cắt phần sau dấu | - – :  thường là tagline
  let brand = title.split(/[|\-–—:]/)[0].trim();
  if (!brand || brand.length < 2) {
    const d = extractDomain(str(result?.url)).split(".")[0];
    brand = d ? d.replace(/[^a-z0-9]+/gi, " ").trim() : "";
  }
  return brand.slice(0, 80);
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

  const competitor_relevance_score = Math.round(
    (service_match_score * 0.4 + geo_match_score * 0.3 + source_credibility_score * 0.3) * 100) / 100;

  const overall = (
    service_match_score * 0.25 +
    geo_match_score * 0.2 +
    source_credibility_score * 0.15 +
    website_confidence_score * 0.15 +
    fanpage_confidence_score * 0.25
  );
  return {
    service_match_score: round2(service_match_score),
    geo_match_score: round2(geo_match_score),
    source_credibility_score: round2(source_credibility_score),
    website_confidence_score: round2(website_confidence_score),
    fanpage_confidence_score: round2(fanpage_confidence_score),
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
