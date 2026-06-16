/* ============================================================
   SERYN Spy — Exa run config + guards (server-side only)
   ------------------------------------------------------------
   Tập trung: đọc env, guard manual-only, clamp budget, hằng số chung.
   PHẠM VI EXA CỐ ĐỊNH: chỉ trẻ hóa da (service_category=skin_rejuvenation).
   KHÔNG research toàn ngành (all). KHÔNG service_category khác.
   ============================================================ */
import { SERVICE_CATEGORY } from "./schemas.mjs";

/** Phạm vi Exa duy nhất — trẻ hóa da. */
export const SERVICE_CATEGORIES = [SERVICE_CATEGORY];

/** Nhãn tìm kiếm (Vi/En) — chỉ trẻ hóa da (dùng cho detector/scoring). */
export const SERVICE_LABELS = {
  [SERVICE_CATEGORY]: "trẻ hóa da",
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
    // Market + service_category LUÔN cố định ở trẻ hóa da — không đọc từ env nữa.
    market: "skin rejuvenation aesthetic clinic",
    serviceCategory: SERVICE_CATEGORY,
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

/** Phạm vi Exa cố định: luôn chỉ trẻ hóa da, bỏ qua mọi tham số khác. */
export function resolveServiceCategories() {
  return [SERVICE_CATEGORY];
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
