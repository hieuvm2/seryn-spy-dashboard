/* ============================================================
   SERYN Spy — Exa.ai client helper (server-side only)
   ------------------------------------------------------------
   KHÔNG import vào frontend. Dùng process.env.EXA_API_KEY.
   Gọi Exa /search (kèm contents) qua fetch (Node 20 có sẵn fetch).

   Hàm:
     exaSearch(query, options)   -> { ok, query, results, error }
     normalizeExaResult(result)  -> object chuẩn hóa
     classifySourceType(result)  -> enum source_type
     extractDomain(url)          -> domain
     buildContentHash(input)     -> sha1 hex
   ============================================================ */
import crypto from "node:crypto";

const EXA_ENDPOINT = "https://api.exa.ai/search";

export function extractDomain(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.hostname.replace(/^www\./, "");
  } catch { return ""; }
}

export function buildContentHash(input) {
  const s = typeof input === "string" ? input : JSON.stringify(input ?? "");
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

const SOCIAL_DOMAINS = ["facebook.com", "instagram.com", "tiktok.com", "youtube.com", "threads.net"];
const REVIEW_DOMAINS = ["foody.vn", "google.com/maps", "tripadvisor", "review", "danhgia"];
const GOV_TLDS = [".gov", ".gov.vn", "moh.gov", "gso.gov"];
const NEWS_HINTS = ["vnexpress", "tuoitre", "thanhnien", "dantri", "cafef", "vietnamnet", "zingnews", "news", "bao", "tin"];
const REPORT_HINTS = ["statista", "mordor", "grandview", "research", "report", "marketresearch", "euromonitor", "nielsen"];

/** Phân loại loại nguồn cho 1 result Exa. */
export function classifySourceType(result) {
  const url = String(result?.url || "");
  const domain = extractDomain(url).toLowerCase();
  const title = String(result?.title || "").toLowerCase();
  const blob = (domain + " " + title);
  if (GOV_TLDS.some((t) => domain.includes(t))) return "government";
  if (REPORT_HINTS.some((t) => blob.includes(t))) return "report";
  if (SOCIAL_DOMAINS.some((d) => domain.endsWith(d) || domain.includes(d))) return "social_page";
  if (REVIEW_DOMAINS.some((t) => blob.includes(t))) return "review_site";
  if (NEWS_HINTS.some((t) => blob.includes(t))) return "news";
  // clinic/landing page heuristic: domain riêng + từ khóa dịch vụ trong title
  if (/clinic|tham\s*my|thẩm\s*mỹ|spa|beauty|aesthetic|da\s*lieu|da\s*liễu/i.test(blob)) {
    return /khuyen\s*mai|uu\s*dai|ưu\s*đãi|bang\s*gia|bảng\s*giá|đặt\s*lịch|dat\s*lich/i.test(blob)
      ? "competitor_landing_page" : "clinic_website";
  }
  if (/blog|wordpress|medium|tips|review/i.test(blob)) return "blog";
  return "unknown";
}

/** Chuẩn hóa 1 result Exa về schema chung. */
export function normalizeExaResult(result) {
  const url = String(result?.url || "").trim();
  const text = String(result?.text || "");
  const summary = String(result?.summary || "");
  const highlights = Array.isArray(result?.highlights) ? result.highlights : [];
  return {
    url,
    domain: extractDomain(url),
    title: String(result?.title || "").trim(),
    author: String(result?.author || "").trim(),
    published_date: String(result?.publishedDate || result?.published_date || "").trim(),
    source_type: classifySourceType(result),
    summary: summary.slice(0, 1200),
    highlights: highlights.map((h) => String(h)).slice(0, 8),
    text: text.slice(0, 8000),
    score: typeof result?.score === "number" ? result.score : null,
    content_hash: buildContentHash(url + "::" + (text || summary || result?.title || "")),
  };
}

/**
 * Gọi Exa /search. Lỗi 1 query KHÔNG throw — trả { ok:false, error }.
 * options: { numResults, type, country, useText(bool), category }
 */
export async function exaSearch(query, options = {}) {
  const apiKey = (process.env.EXA_API_KEY || "").trim();
  if (!apiKey) return { ok: false, query, results: [], error: "missing_exa_api_key" };

  const numResults = Math.max(1, Math.min(20, Number(options.numResults) || 10));
  const body = {
    query: String(query || "").trim(),
    type: options.type || "auto",
    numResults,
    contents: {
      text: options.useText === false ? false : { maxCharacters: 3000 },
      summary: true,
      highlights: { numSentences: 2, highlightsPerUrl: 3 },
    },
  };
  if (options.country) body.userLocation = options.country;
  if (options.category) body.category = options.category;
  if (Array.isArray(options.includeDomains) && options.includeDomains.length) {
    body.includeDomains = options.includeDomains;
  }

  try {
    const res = await fetch(EXA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, query, results: [], error: `HTTP ${res.status} ${txt.slice(0, 200)}` };
    }
    const json = await res.json();
    const raw = Array.isArray(json?.results) ? json.results : [];
    return { ok: true, query, results: raw.map(normalizeExaResult), error: "" };
  } catch (e) {
    return { ok: false, query, results: [], error: e?.message || String(e) };
  }
}
