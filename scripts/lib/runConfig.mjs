/* ============================================================
   SERYN Spy — Exa run config + guards (server-side only)
   ------------------------------------------------------------
   Tập trung: đọc env, guard manual-only, clamp budget, hằng số chung.
   ============================================================ */

export const SERVICE_CATEGORIES = [
  "melasma_treatment",
  "acne_treatment",
  "skin_rejuvenation",
  "laser_treatment",
  "filler_botox",
  "facial_spa",
  "skin_booster",
  "body_slimming",
  "wellness_beauty",
];

/** Nhãn tìm kiếm (Vi/En) cho mỗi service category — dùng dựng query Exa. */
export const SERVICE_LABELS = {
  melasma_treatment: "điều trị nám",
  acne_treatment: "điều trị mụn",
  skin_rejuvenation: "trẻ hóa da",
  laser_treatment: "laser thẩm mỹ",
  filler_botox: "filler botox",
  facial_spa: "chăm sóc da mặt",
  skin_booster: "skin booster",
  body_slimming: "giảm béo",
  wellness_beauty: "thẩm mỹ wellness",
};

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const bool = (v) => ["true", "1", "yes"].includes(String(v || "").trim().toLowerCase());

/** Clamp 1..max. */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Đọc + chuẩn hóa config cho 1 run Exa (market research / discovery).
 * Áp dụng clamp budget (max 20) và mặc định an toàn.
 */
export function readRunConfig() {
  const maxQueriesRaw = num(process.env.EXA_MAX_QUERIES_PER_RUN, 10);
  const maxResultsRaw = num(process.env.EXA_MAX_RESULTS_PER_QUERY, 10);
  const maxQueries = clamp(maxQueriesRaw, 1, 20);
  const maxResults = clamp(maxResultsRaw, 1, 20);

  const cfg = {
    runMode: (process.env.MARKET_RESEARCH_RUN_MODE || "manual").trim().toLowerCase(),
    geo: (process.env.MARKET_RESEARCH_GEO || "Vietnam").trim(),
    market: (process.env.MARKET_RESEARCH_DEFAULT_MARKET || "clinic aesthetic beauty").trim(),
    serviceCategory: (process.env.MARKET_RESEARCH_SERVICE_CATEGORY || "all").trim(),
    sizingMode: (process.env.MARKET_SIZE_ESTIMATION_MODE || "directional").trim(),

    searchType: (process.env.EXA_SEARCH_TYPE || "auto").trim(),
    searchCountry: (process.env.EXA_SEARCH_COUNTRY || "VN").trim(),
    deepSearch: bool(process.env.EXA_ENABLE_DEEP_SEARCH),
    maxQueries,
    maxResults,
    maxQueriesClamped: maxQueriesRaw > 20,
    maxResultsClamped: maxResultsRaw > 20,

    autoImport: bool(process.env.AUTO_IMPORT_COMPETITORS),
    autoImportMinConfidence: num(process.env.COMPETITOR_AUTO_IMPORT_MIN_CONFIDENCE, 0.8),
    discoveryMinConfidence: num(process.env.COMPETITOR_DISCOVERY_MIN_CONFIDENCE, 0.55),
  };
  return cfg;
}

/**
 * Guard: chỉ chạy manual/on-demand. Trả { ok, reason }.
 * - Không EXA_API_KEY -> skip (không fail).
 * - Trong GitHub Actions nhưng event != workflow_dispatch -> skip.
 * - runMode != manual -> skip.
 */
export function manualGuard(cfg) {
  if (!(process.env.EXA_API_KEY || "").trim()) {
    return { ok: false, reason: "Thiếu EXA_API_KEY — bỏ qua Exa step (không phải lỗi)." };
  }
  const event = process.env.GITHUB_EVENT_NAME;
  if (event && event !== "workflow_dispatch") {
    return { ok: false, reason: `Exa chỉ chạy manual; GITHUB_EVENT_NAME=${event} -> skip.` };
  }
  if (cfg.runMode !== "manual") {
    return { ok: false, reason: `MARKET_RESEARCH_RUN_MODE=${cfg.runMode} (cần "manual") -> skip.` };
  }
  return { ok: true, reason: "" };
}

/** Danh sách service category áp dụng cho run (all -> toàn bộ default). */
export function resolveServiceCategories(serviceCategory) {
  const sc = String(serviceCategory || "all").trim().toLowerCase();
  if (sc === "all" || !sc) return [...SERVICE_CATEGORIES];
  if (SERVICE_CATEGORIES.includes(sc)) return [sc];
  return [sc]; // category lạ -> giữ nguyên (dùng như keyword)
}

export function nowISO() { return new Date().toISOString(); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function currentMondayISO() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
export function runId(prefix, weekDate) {
  return `${prefix}-${weekDate}-${Date.now().toString(36)}`;
}
