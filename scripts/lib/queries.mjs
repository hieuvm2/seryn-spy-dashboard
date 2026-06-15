/* ============================================================
   SERYN Spy — Exa query builders (server-side)
   ------------------------------------------------------------
   Dựng query theo market/geo/service. Luôn tôn trọng maxQueries.
   ============================================================ */
import { SERVICE_LABELS } from "./runConfig.mjs";

const label = (sc) => SERVICE_LABELS[sc] || sc || "thẩm mỹ";

/** Query nghiên cứu thị trường / trend. */
export function buildMarketResearchQueries(services, geo, maxQueries) {
  const out = [];
  const generic = [
    `${geo} beauty clinic market report`,
    `${geo} aesthetic medicine market growth`,
    `${geo} skincare treatment trend 2026`,
    `${geo} aesthetic clinic consumer demand`,
  ];
  for (const sc of services) {
    const s = label(sc);
    out.push(
      `${s} market trend ${geo} 2026`,
      `${s} nhu cầu ${geo}`,
      `${s} giá dịch vụ thẩm mỹ ${geo}`,
      `${s} review clinic ${geo}`,
    );
  }
  return dedupeCap([...generic, ...out], maxQueries);
}

/** Query tìm đối thủ (general + facebook + website/social). */
export function buildCompetitorQueries(services, geo, maxQueries) {
  const out = [];
  for (const sc of services) {
    const s = label(sc);
    out.push(
      `top clinic ${s} ${geo}`,
      `${s} thẩm mỹ viện ${geo} uy tín`,
      `${s} spa clinic ${geo} bảng giá`,
      `site:facebook.com ${s} thẩm mỹ ${geo}`,
      `site:facebook.com ${s} clinic ${geo} ưu đãi`,
    );
  }
  out.push(`best aesthetic clinic ${geo}`, `Vietnam aesthetic clinic ${geo}`);
  return dedupeCap(out, maxQueries);
}

/** Query resolve website/fanpage cho 1 brand cụ thể. */
export function buildBrandResolveQueries(brand, geo) {
  return [
    `${brand} website`,
    `${brand} Facebook fanpage`,
    `${brand} thẩm mỹ viện ${geo}`,
  ];
}

function dedupeCap(arr, max) {
  const seen = new Set();
  const out = [];
  for (const q of arr) {
    const k = q.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(q.trim());
    if (out.length >= max) break;
  }
  return out;
}
