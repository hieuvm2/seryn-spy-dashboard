/* ============================================================
   SERYN Spy — Market Sizing (DIRECTIONAL estimate only)
   ------------------------------------------------------------
   KHÔNG có keyword volume -> method = "directional_estimate".
   Luôn low/mid/high + assumptions + evidence_sources + missing_data.
   KHÔNG tạo cảm giác chính xác giả. Thiếu dữ liệu -> confidence thấp.
   ============================================================ */

const num = (v) => { const n = Number(String(v).replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };
const round = (n) => Math.round(n);

/**
 * Ước lượng directional TAM/SAM/SOM.
 * Vì KHÔNG có dữ liệu audited, dùng anchor giả định khiêm tốn + tín hiệu để
 * scale band low/mid/high. confidence phản ánh độ giàu dữ liệu.
 */
export function estimateMarketSize({
  geo = "Vietnam",
  market = "clinic aesthetic beauty",
  service_category = "all",
  trendSignals = [],
  competitorActivity = [],
  marketSources = [],
  assumptions = [],
} = {}) {
  const currency = "USD";

  // tín hiệu định lượng có thật?
  const numbersFound = marketSources.filter((s) => String(s.detected_market_numbers || "").trim()).length;
  const pricesFound = marketSources.filter((s) => String(s.detected_prices || "").trim()).length;
  const sourceCount = marketSources.length;
  const competitorCount = competitorActivity.length;

  // anchor TAM directional (USD/năm) — khiêm tốn, KHÔNG audited.
  // Cả nước (all): ~ vài trăm triệu USD; theo 1 service: nhỏ hơn nhiều.
  const baseAll = 250_000_000; // directional anchor cho toàn thị trường thẩm mỹ VN
  const categoryFactor = service_category && service_category !== "all" ? 0.12 : 1;
  const geoFactor = /hà nội|hồ chí minh|tphcm|sài gòn|đà nẵng/i.test(geo) ? 0.35 : 1;

  const tam_mid = round(baseAll * categoryFactor * geoFactor);
  const tam_low = round(tam_mid * 0.5);
  const tam_high = round(tam_mid * 2);

  // SAM ~ phần thị trường có thể phục vụ (digital-reachable, phân khúc cao cấp)
  const samShare = 0.25;
  const sam_mid = round(tam_mid * samShare);
  const sam_low = round(tam_low * samShare * 0.8);
  const sam_high = round(tam_high * samShare * 1.2);

  // SOM ~ phần SERYN có thể chiếm (mới, premium, 1 clinic) — rất nhỏ
  const somShare = 0.03;
  const som_mid = round(sam_mid * somShare);
  const som_low = round(sam_low * somShare * 0.6);
  const som_high = round(sam_high * somShare * 1.5);

  // confidence: tăng theo lượng số liệu/price/source thật; nền thấp.
  let confidence = 0.2;
  if (numbersFound > 0) confidence += Math.min(0.25, numbersFound * 0.08);
  if (pricesFound > 0) confidence += Math.min(0.15, pricesFound * 0.03);
  if (sourceCount >= 5) confidence += 0.1;
  if (competitorCount >= 3) confidence += 0.1;
  confidence = Math.round(Math.min(0.8, confidence) * 100) / 100; // trần 0.8: directional

  const missing = [];
  if (!numbersFound) missing.push("no_audited_market_numbers");
  if (!pricesFound) missing.push("no_price_data");
  if (sourceCount < 5) missing.push("few_sources");
  if (!competitorCount) missing.push("no_competitor_activity_signal");

  const evidence_sources = marketSources
    .slice()
    .sort((a, b) => num(b.credibility_score) - num(a.credibility_score))
    .slice(0, 6)
    .map((s) => s.source_url)
    .filter(Boolean)
    .join("|");

  const baseAssumptions = [
    `Anchor directional dựa trên thị trường thẩm mỹ ${geo} (không audited).`,
    `Category factor=${categoryFactor}, geo factor=${geoFactor}.`,
    `SAM≈${Math.round(samShare * 100)}% TAM (digital-reachable, premium).`,
    `SOM≈${Math.round(somShare * 100)}% SAM (1 clinic premium mới).`,
  ];

  return {
    tam_low, tam_mid, tam_high,
    sam_low, sam_mid, sam_high,
    som_low, som_mid, som_high,
    currency,
    method: "directional_estimate",
    assumptions: [...baseAssumptions, ...assumptions].join(" | "),
    evidence_sources,
    confidence_score: confidence,
    missing_data: missing.join("|") || "none",
    analyst_notes: "Directional estimate, KHÔNG phải số liệu audited. Dùng để định hướng, không phải con số tuyệt đối.",
  };
}
