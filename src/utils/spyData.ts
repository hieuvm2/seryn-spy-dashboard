/* ============================================================
   SERYN Spy Ads — data utilities
   CSV parsing (Vietnamese-safe), localStorage, table merge.
   ============================================================ */
import type { SpyDashboardData, SpyTableName, DataSourceType } from "../types";

const STORAGE_KEY = "seryn_spy_dashboard_data_v2";

/** Map a SpyDashboardData key to the signature column found in its CSV header. */
const TABLE_SIGNATURES: Record<SpyTableName, string> = {
  brandWeeklySnapshot: "total_active_ads",
  adLevelAnalysis: "ad_snapshot_url",
  scaledContentAnalysis: "content_cluster_id",
  weeklyStrategyChange: "strategic_change_type",
  serynContentRecommendations: "recommendation_type",
};

export const TABLE_LABELS: Record<SpyTableName, string> = {
  brandWeeklySnapshot: "Tổng hợp tuần theo đối thủ",
  adLevelAnalysis: "Phân tích từng quảng cáo",
  scaledContentAnalysis: "Nội dung đang nhân rộng",
  weeklyStrategyChange: "Thay đổi chiến lược tuần",
  serynContentRecommendations: "Gợi ý nội dung cho SERYN",
};

/** Cột bắt buộc của mỗi dataset (Data Health Check). KHÔNG đổi schema gốc. */
const REQUIRED_COLUMNS: Record<SpyTableName, string[]> = {
  brandWeeklySnapshot: [
    "week_date", "brand_name", "total_active_ads", "services_running",
    "offers_detected", "main_content_formats", "main_angles", "scaled_content_count",
  ],
  adLevelAnalysis: [
    "week_date", "brand_name", "ad_id", "start_date", "days_active", "hook_text",
    "service_or_product", "content_format", "content_angle", "is_likely_scaled", "scale_level",
  ],
  scaledContentAnalysis: [
    "week_date", "brand_name", "representative_hook", "service_or_product", "content_format",
    "content_angle", "number_of_similar_ads", "longest_days_active", "scale_level",
    "why_it_is_scaling", "seryn_reframe",
  ],
  weeklyStrategyChange: [
    "week_date", "brand_name", "active_ads_change", "new_ads_count", "stopped_ads_count",
    "strategic_change_type", "change_summary", "seryn_implication",
  ],
  serynContentRecommendations: [
    "week_date", "recommendation_type", "market_signal", "competitor_evidence",
    "seryn_content_niche", "suggested_content_format", "suggested_hook", "content_style",
    "main_message", "proof_to_use", "cta", "priority",
  ],
};

export type DataHealthRow = {
  key: SpyTableName;
  label: string;
  loaded: boolean;
  rows: number;
  missingCols: string[];
};

/** Kiểm tra sức khỏe dữ liệu: loaded/missing, số dòng, cột bắt buộc còn thiếu. */
export function checkDataHealth(data: SpyDashboardData): DataHealthRow[] {
  return (Object.keys(REQUIRED_COLUMNS) as SpyTableName[]).map((key) => {
    const arr = ((data[key] as unknown) as Record<string, unknown>[]) || [];
    const rows = arr.length;
    const loaded = rows > 0;
    let missingCols: string[];
    if (loaded) {
      const present = new Set<string>();
      arr.forEach((row) => Object.keys(row).forEach((k) => present.add(k.toLowerCase())));
      missingCols = REQUIRED_COLUMNS[key].filter((c) => !present.has(c.toLowerCase()));
    } else {
      missingCols = REQUIRED_COLUMNS[key].slice();
    }
    return { key, label: TABLE_LABELS[key], loaded, rows, missingCols };
  });
}

/* ---------------- Lịch sử snapshot theo tuần ---------------- */
const WEEKLY_HISTORY_KEY = "seryn_spy_weekly_history_v1";

export function loadWeeklyHistory(): Record<string, SpyDashboardData> {
  try {
    const raw = localStorage.getItem(WEEKLY_HISTORY_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

/** Lưu snapshot hiện tại vào lịch sử, keyed theo week_date. Trả về week_date đã lưu (hoặc null). */
export function saveWeekToHistory(data: SpyDashboardData): string | null {
  const wk = data.brandWeeklySnapshot && data.brandWeeklySnapshot[0]
    ? String(data.brandWeeklySnapshot[0].week_date || "").trim()
    : "";
  if (!wk || isMissing(wk)) return null;
  try {
    const hist = loadWeeklyHistory();
    hist[wk] = data;
    localStorage.setItem(WEEKLY_HISTORY_KEY, JSON.stringify(hist));
    return wk;
  } catch {
    return null;
  }
}

/** Danh sách tuần đã lưu, mới nhất trước. */
export function getHistoryWeeks(): string[] {
  return Object.keys(loadWeeklyHistory()).sort((a, b) => (a < b ? 1 : -1));
}

/* ---------------- Nguồn dữ liệu (DEMO / CSV / SHEET / SUPABASE) ---------------- */
const SOURCE_KEY = "seryn_spy_source_v2";

export const SOURCE_LABELS: Record<DataSourceType, string> = {
  demo: "DỮ LIỆU MẪU",
  "local-csv": "CSV THỦ CÔNG",
  "online-sheet": "GOOGLE SHEETS",
  "online-supabase": "SUPABASE",
  "offline-cache": "BẢN OFFLINE",
};

export function saveSourceType(src: DataSourceType): void {
  try { localStorage.setItem(SOURCE_KEY, src); } catch { /* noop */ }
}
export function loadSourceType(): DataSourceType | null {
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    return v === "demo" || v === "local-csv" || v === "online-sheet" || v === "online-supabase" || v === "offline-cache" ? v : null;
  } catch {
    return null;
  }
}
export function clearSourceType(): void {
  try { localStorage.removeItem(SOURCE_KEY); } catch { /* noop */ }
}

/** Parse CSV text into row objects. Handles quoted fields, escaped quotes,
 *  CRLF, a UTF-8 BOM and Vietnamese characters. Never throws on ragged rows. */
export function parseCSV(text: string): Record<string, string>[] {
  if (!text) return [];
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* skip */
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const clean = rows.filter(
    (r) => r.length > 1 || (r.length === 1 && r[0].trim() !== "")
  );
  if (!clean.length) return [];

  const header = clean[0].map((h) => String(h || "").trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < clean.length; r++) {
    const raw = clean[r];
    if (!raw || raw.every((v) => String(v).trim() === "")) continue;
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = i < raw.length ? String(raw[i]).trim() : "";
    });
    out.push(obj);
  }
  return out;
}

/** Coerce anything to a finite number; non-numeric -> 0. */
export function normalizeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = parseFloat(String(value).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Split a pipe/comma/semicolon-separated cell into clean chips. */
export function splitChips(value?: string): string[] {
  if (!value) return [];
  const t = String(value).trim();
  if (!t || isMissing(t)) return [];
  return t
    .split(/[|;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Chip đầu tiên trong chuỗi "a|b|c" (rỗng nếu không có). */
export function firstChip(value?: string): string {
  return splitChips(value)[0] ?? "";
}

/** True when a value should be treated as "no data". */
export function isMissing(v: unknown): boolean {
  const t = String(v == null ? "" : v)
    .trim()
    .toLowerCase();
  return (
    t === "" ||
    t === "unknown" ||
    t === "missing_data" ||
    t === "none" ||
    t === "first_week_no_comparison_available"
  );
}

/** Display helper: trả về giá trị hoặc "chưa rõ". */
export function orUnknown(v: unknown): string {
  return isMissing(v) ? "chưa rõ" : String(v).trim();
}

/** Detect which spy table a parsed CSV belongs to (by header signature). */
export function detectTable(rows: Record<string, string>[]): SpyTableName | null {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]).map((c) => c.toLowerCase());
  for (const key of Object.keys(TABLE_SIGNATURES) as SpyTableName[]) {
    if (cols.includes(TABLE_SIGNATURES[key])) return key;
  }
  return null;
}

/** Replace one table inside the dataset, leaving the others intact. */
export function mergeImportedTable(
  data: SpyDashboardData,
  tableName: SpyTableName,
  rows: Record<string, string>[]
): SpyDashboardData {
  return { ...data, [tableName]: rows as never };
}

export function loadSpyDataFromLocalStorage(): SpyDashboardData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.brandWeeklySnapshot)) {
      return parsed as SpyDashboardData;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSpyDataToLocalStorage(data: SpyDashboardData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Không lưu được dữ liệu spy vào localStorage:", e);
  }
}

export function clearSpyDataLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Không xóa được localStorage:", e);
  }
}

/** Count frequency of chip values across a column, sorted desc. */
export function countChips(
  rows: Array<Record<string, any>>,
  field: string
): { label: string; n: number }[] {
  const map: Record<string, { label: string; n: number }> = {};
  rows.forEach((r) => {
    splitChips(r[field]).forEach((item) => {
      const k = item.toLowerCase();
      if (!map[k]) map[k] = { label: item, n: 0 };
      map[k].n++;
    });
  });
  return Object.values(map).sort((a, b) => b.n - a.n);
}

/** Scale-level metadata for badges. */
export function scaleMeta(level: unknown): { label: string; tone: "slate" | "sky" | "amber" | "rose" } {
  const n = normalizeNumber(level);
  switch (n) {
    case 1:
      return { label: "Tín hiệu yếu", tone: "slate" };
    case 2:
      return { label: "Tín hiệu lặp lại", tone: "sky" };
    case 3:
      return { label: "Tín hiệu mạnh", tone: "amber" };
    case 4:
      return { label: "Chạy dài ngày (bền)", tone: "rose" };
    default:
      return { label: "Cần theo dõi", tone: "slate" };
  }
}
