/* ============================================================
   SERYN Spy — Exa query builders (server-side)
   ------------------------------------------------------------
   PHẠM VI CỐ ĐỊNH: chỉ trẻ hóa da / skin rejuvenation.
   KHÔNG query toàn ngành (aesthetic clinic market / spa market...).
   Luôn tôn trọng maxQueries (clamp ở runConfig).
   ============================================================ */

/** Query nghiên cứu thị trường trẻ hóa da. geo mặc định Vietnam/Hà Nội. */
const MARKET_QUERIES = [
  "trẻ hóa da clinic Vietnam trend",
  "trẻ hóa da Hà Nội thẩm mỹ viện",
  "trẻ hóa da ưu đãi clinic",
  "trẻ hóa da review clinic",
  "trẻ hóa da giá dịch vụ",
  "skin rejuvenation Vietnam aesthetic clinic",
  "laser trẻ hóa da clinic",
  "skin booster trẻ hóa da",
  "HIFU trẻ hóa da thẩm mỹ viện",
  "nâng cơ trẻ hóa da clinic",
  "căng bóng da clinic Vietnam",
  "tái tạo da trẻ hóa clinic",
  "exosome trẻ hóa da Vietnam",
];

/** Query tìm đối thủ trẻ hóa da — ưu tiên clinic/fanpage thật. */
const COMPETITOR_QUERIES = [
  "trẻ hóa da clinic Hà Nội",
  "trẻ hóa da thẩm mỹ viện Hà Nội",
  "skin rejuvenation clinic Vietnam",
  "laser trẻ hóa da thẩm mỹ viện",
  "skin booster clinic Hà Nội",
  "HIFU trẻ hóa da clinic",
  "nâng cơ trẻ hóa da thẩm mỹ viện",
  "site:facebook.com trẻ hóa da clinic",
  "site:facebook.com skin booster clinic",
  "site:facebook.com HIFU trẻ hóa da",
  "site:facebook.com thẩm mỹ viện trẻ hóa da",
];

/** Query nghiên cứu thị trường trẻ hóa da (cố định). */
export function buildMarketResearchQueries(_services, geo, maxQueries) {
  return geoize(MARKET_QUERIES, geo).slice(0, maxQueries);
}

/** Query tìm đối thủ trẻ hóa da (cố định). */
export function buildCompetitorQueries(_services, geo, maxQueries) {
  return geoize(COMPETITOR_QUERIES, geo).slice(0, maxQueries);
}

/** Query resolve website/fanpage cho 1 brand cụ thể (vẫn quanh trẻ hóa da). */
export function buildBrandResolveQueries(brand, geo) {
  return [
    `${brand} website`,
    `${brand} Facebook fanpage`,
    `${brand} trẻ hóa da ${geo || "Vietnam"}`,
  ];
}

/** Nếu geo không phải Vietnam/Hà Nội mặc định, chèn geo vào query không có địa danh. */
function geoize(list, geo) {
  const g = String(geo || "").trim();
  if (!g || /việt ?nam|vietnam|hà ?nội|ha ?noi/i.test(g)) return [...list];
  const out = [];
  const seen = new Set();
  for (const q of list) {
    const hasLoc = /vietnam|việt nam|hà nội|ha noi/i.test(q);
    const qq = hasLoc ? q : `${q} ${g}`;
    const k = qq.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(qq); }
  }
  return out;
}
