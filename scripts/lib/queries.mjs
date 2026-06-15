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

/** Query tìm đối thủ — ưu tiên trang clinic/fanpage thật, hạn chế blog "giá/review". */
export function buildCompetitorQueries(services, geo, maxQueries) {
  const out = [];
  for (const sc of services) {
    const s = label(sc);
    out.push(
      // brand/clinic-oriented (ít ra bài SEO hơn "giá/review")
      `thẩm mỹ viện ${s} ${geo}`,
      `phòng khám da liễu ${s} ${geo}`,
      // fanpage-oriented (tăng khả năng ra Facebook page có page_id)
      `site:facebook.com thẩm mỹ viện ${s} ${geo}`,
      `site:facebook.com phòng khám ${s} ${geo}`,
    );
  }
  out.push(
    `thẩm mỹ viện uy tín ${geo}`,
    `phòng khám thẩm mỹ ${geo}`,
    `site:facebook.com thẩm mỹ viện ${geo}`,
  );
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
