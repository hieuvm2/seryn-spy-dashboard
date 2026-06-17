/* ============================================================
   SERYN Spy — Page ID resolver (ScrapeCreators search/companies)
   ------------------------------------------------------------
   brand name (+ context) -> Meta page_id list, để spy ads tự động.
   ScrapeCreators endpoint: /v1/facebook/adLibrary/search/companies?query=
   -> { searchResults: [{ name, page_id, ... }] }.

   NGUYÊN TẮC: CHỈ trả page_id do API trả về (KHÔNG bịa). Chỉ nhận match
   tên mạnh (đã chuẩn hóa) để tránh spy nhầm brand. Trả "danh sách page"
   (các page cùng tên brand) cho brand có nhiều page.
   ============================================================ */
import { isNumericPageId, normalizeBrandName } from "./competitorDiscoveryUtils.mjs";

const SEARCH_URL = "https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies";

function apiKeys() {
  return String(process.env.ADS_SOURCE_API_KEY || "").split(",").map((s) => s.trim()).filter(Boolean);
}
/** Có thể resolve không (cần ScrapeCreators key). */
export function pageIdResolverAvailable() { return apiKeys().length > 0; }

/** Điểm khớp tên (0..1) sau khi chuẩn hóa (bỏ dấu + hậu tố clinic/spa…). */
export function nameMatchScore(resultName, brand) {
  const rn = normalizeBrandName(resultName);
  const bn = normalizeBrandName(brand);
  if (!rn || !bn) return 0;
  if (rn === bn) return 1;
  if (rn.includes(bn) || bn.includes(rn)) return 0.88;
  const rt = new Set(rn.split(" ").filter(Boolean));
  const bt = bn.split(" ").filter(Boolean);
  if (!bt.length || !rt.size) return 0;
  const inter = bt.filter((t) => rt.has(t)).length;
  const ratio = inter / Math.max(rt.size, bt.length);
  return ratio; // partial (sẽ dưới ngưỡng nếu yếu)
}

/** Chuẩn hóa domain (bỏ protocol/www/path) để đối chiếu corroboration. */
function normDomain(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/[?#].*$/, "").trim();
}
/** Domain từ 1 result (nếu API trả kèm website/url) — best-effort, nhiều tên field. */
function resultDomain(r) {
  return normDomain(r.website ?? r.url ?? r.link ?? r.page_url ?? r.domain ?? r.website_url ?? "");
}
function domainHit(wantDom, rDom) {
  if (!wantDom || !rDom) return false;
  return rDom === wantDom || rDom.endsWith("." + wantDom) || wantDom.endsWith("." + rDom) || rDom.includes(wantDom) || wantDom.includes(rDom);
}

/** PURE: chọn page từ danh sách kết quả search (không gọi mạng — test được).
 *  Match theo tên brand (chuẩn hóa); nếu API trả kèm website thì domain khớp được
 *  CỘNG điểm (corroboration) để chọn đúng brand khi tên trùng. Lấy match mạnh nhất +
 *  các page CÙNG TÊN CHUẨN HÓA (variant cùng brand). KHÔNG loại theo domain (field có thể vắng). */
export function pickPages(results, brand, opts = {}) {
  const minScore = opts.minScore ?? 0.85;
  const maxPages = opts.maxPages ?? 3;
  const wantDom = normDomain(opts.domain);
  const scored = (results || [])
    .map((r) => {
      const dHit = domainHit(wantDom, resultDomain(r));
      const base = nameMatchScore(r.name, brand);
      return {
        page_id: String(r.page_id ?? r.pageId ?? "").trim(),
        name: String(r.name ?? "").trim(),
        likes: Number(r.likes ?? r.likeCount ?? r.followers ?? 0) || 0,
        verified: !!(r.verified ?? r.is_verified ?? r.isVerified),
        domainHit: dHit,
        // domain khớp -> đẩy điểm lên ~1 để brand đúng thắng khi tên trùng.
        score: dHit ? Math.max(base, 0.97) : base,
      };
    })
    .filter((r) => r.name && isNumericPageId(r.page_id) && r.score >= minScore)
    .sort((a, b) => (b.score - a.score) || (Number(b.domainHit) - Number(a.domainHit)) || (Number(b.verified) - Number(a.verified)) || (b.likes - a.likes));
  if (!scored.length) return { pageIds: [], pages: [], best: null };
  const best = scored[0];
  const bestNorm = normalizeBrandName(best.name);
  // best + các page CÙNG tên chuẩn hóa (variant cùng brand), khử trùng page_id.
  const picked = [];
  const seen = new Set();
  for (const p of scored) {
    if (p !== best && normalizeBrandName(p.name) !== bestNorm) continue;
    if (seen.has(p.page_id)) continue;
    seen.add(p.page_id); picked.push(p);
    if (picked.length >= maxPages) break;
  }
  return { pageIds: picked.map((p) => p.page_id), pages: picked, best };
}

async function searchCompanies(query) {
  const keys = apiKeys();
  if (!keys.length) throw new Error("Thiếu ADS_SOURCE_API_KEY để resolve page_id.");
  const u = new URL(SEARCH_URL);
  u.searchParams.set("query", query);
  let lastErr = "";
  for (const key of keys) {
    try {
      const res = await fetch(u.toString(), { headers: { "x-api-key": key } });
      if (res.status === 401 || res.status === 403) { lastErr = `auth ${res.status}`; continue; }
      if (res.status === 429) { lastErr = "rate_limited"; continue; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { lastErr = json.message || `http ${res.status}`; continue; }
      // chỉ nhận mảng (API lỗi/khác shape -> [] để không vỡ vòng lặp for..of).
      const arr = [json.searchResults, json.results, json.companies].find((x) => Array.isArray(x));
      return arr || [];
    } catch (e) { lastErr = e?.message || String(e); }
  }
  throw new Error(lastErr || "ScrapeCreators search lỗi/hết credit.");
}

/** Resolve page IDs cho 1 brand. Trả { pageIds, pages, best, query, error }.
 *  Thử query theo tên brand, rồi tên + geo nếu chưa có match mạnh. */
export async function resolvePageIds(brand, ctx, opts = {}) {
  const c = ctx || {};
  const b = String(brand || "").trim();
  if (!b) return { pageIds: [], pages: [], best: null, error: "empty_brand" };
  const pickOpts = { ...opts, domain: c.domain };
  const queries = [b];
  if (c.domain) queries.push(`${b} ${c.domain}`.trim());
  if (c.geo) queries.push(`${b} ${c.geo}`.trim());
  const merged = new Map(); // page_id -> raw result
  let usedQuery = "";
  for (const q of queries) {
    let results;
    try { results = await searchCompanies(q); }
    catch (e) { if (!merged.size) return { pageIds: [], pages: [], best: null, query: q, error: e?.message || String(e) }; break; }
    usedQuery = q;
    for (const r of results) {
      const id = String(r.page_id ?? r.pageId ?? "").trim();
      if (id && !merged.has(id)) merged.set(id, r);
    }
    const probe = pickPages([...merged.values()], b, pickOpts);
    if (probe.best && probe.best.score >= (opts.minScore ?? 0.85)) break; // đủ mạnh -> dừng (tiết kiệm credit)
  }
  const picked = pickPages([...merged.values()], b, pickOpts);
  return { ...picked, query: usedQuery };
}
