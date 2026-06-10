/* ============================================================
   SERYN Spy Ads — data utilities
   CSV parsing (Vietnamese-safe), localStorage, table merge.
   ============================================================ */
import type { SpyDashboardData, SpyTableName, DataSourceType } from "../types";

const STORAGE_KEY = "seryn_spy_dashboard_data_v2";

/** Map a SpyDashboardData key to the signature column found in its CSV header. */
export const TABLE_SIGNATURES: Record<SpyTableName, string> = {
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
export const REQUIRED_COLUMNS: Record<SpyTableName, string[]> = {
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
export const WEEKLY_HISTORY_KEY = "seryn_spy_weekly_history_v1";

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

export function clearWeeklyHistory(): void {
  try { localStorage.removeItem(WEEKLY_HISTORY_KEY); } catch { /* noop */ }
}

/* ---------------- Nguồn dữ liệu (DEMO / CSV / FOLDER / SHEET) ---------------- */
const SOURCE_KEY = "seryn_spy_source_v2";

export const SOURCE_LABELS: Record<DataSourceType, string> = {
  demo: "DEMO DATA",
  "local-csv": "LOCAL CSV DATA",
  "local-folder": "LOCAL PROJECT FOLDER",
  "online-sheet": "ONLINE SHEET DATA",
};

export function saveSourceType(src: DataSourceType): void {
  try { localStorage.setItem(SOURCE_KEY, src); } catch { /* noop */ }
}
export function loadSourceType(): DataSourceType | null {
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    return v === "demo" || v === "local-csv" || v === "local-folder" || v === "online-sheet" ? v : null;
  } catch {
    return null;
  }
}
export function clearSourceType(): void {
  try { localStorage.removeItem(SOURCE_KEY); } catch { /* noop */ }
}

/* ---------------- Online data source: Google Sheets ---------------- */
export const ONLINE_API_PATH = "/api/sheets";

/** Tên snake_case (từ API) -> key trong SpyDashboardData. */
const ONLINE_KEYS: Record<string, SpyTableName> = {
  brand_weekly_snapshot: "brandWeeklySnapshot",
  ad_level_analysis: "adLevelAnalysis",
  scaled_content_analysis: "scaledContentAnalysis",
  weekly_strategy_change: "weeklyStrategyChange",
  seryn_content_recommendations: "serynContentRecommendations",
};

/** Gọi serverless function `/api/sheets`, parse 5 bảng (csv hoặc array),
 *  merge lên `base`. Ném lỗi nếu API hỏng hoặc không có bảng nào — để
 *  caller fallback về localStorage/sample. */
export async function fetchOnlineSheets(base: SpyDashboardData): Promise<{
  data: SpyDashboardData;
  loaded: SpyTableName[];
  errors: string[];
}> {
  const res = await fetch(ONLINE_API_PATH, { cache: "no-store" });
  let json: any = null;
  try { json = await res.json(); } catch { /* phản hồi không phải JSON */ }
  if (!res.ok) throw new Error((json && json.error) || `API HTTP ${res.status}`);
  if (!json || json.ok === false) throw new Error((json && json.error) || "API trả về dữ liệu không hợp lệ.");

  let next = base;
  const loaded: SpyTableName[] = [];
  const errors: string[] = Array.isArray(json?.errors)
    ? json.errors.map((e: any) => (e && e.key ? `${e.key}: ${e.error}` : String(e)))
    : [];

  for (const [snake, key] of Object.entries(ONLINE_KEYS) as [string, SpyTableName][]) {
    let rows: Record<string, string>[] | null = null;
    if (json?.csv && typeof json.csv[snake] === "string") {
      rows = parseCSV(json.csv[snake]);
    } else if (Array.isArray(json?.[snake])) {
      rows = json[snake] as Record<string, string>[];
    } else if (Array.isArray(json?.[key])) {
      rows = json[key] as Record<string, string>[];
    }
    if (rows && rows.length) {
      next = mergeImportedTable(next, key, rows);
      loaded.push(key);
    }
  }

  if (!loaded.length) throw new Error("Không nhận được bảng nào từ Google Sheets (kiểm tra cấu hình & quyền chia sẻ Sheet).");
  return { data: next, loaded, errors };
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

/** Bảng dịch nhãn enum (schema tiếng Anh) -> hiển thị tiếng Việt.
 *  Dữ liệu gốc giữ nguyên enum để tương thích CSV; chỉ đổi phần hiển thị. */
const VI_LABELS: Record<string, string> = {
  // content_format
  doctor_explainer: "Bác sĩ giải thích",
  before_after: "Trước / sau",
  offer_promotion: "Khuyến mãi",
  service_demo: "Demo dịch vụ",
  customer_testimonial: "Khách hàng kể",
  kol_review: "KOL đánh giá",
  educational_post: "Bài giáo dục",
  problem_solution: "Vấn đề – giải pháp",
  technology_proof: "Chứng minh công nghệ",
  facility_trust: "Cơ sở vật chất",
  consultation_lead: "Dẫn tư vấn",
  seasonal_campaign: "Chiến dịch theo mùa",
  ugc_style: "Khách tự quay",
  // hook_type / angle
  problem_led: "Khơi vấn đề",
  fear_based: "Dựa nỗi sợ",
  insight_led: "Khơi sự thật ngầm",
  doctor_authority: "Uy tín bác sĩ",
  offer_led: "Dẫn bằng ưu đãi",
  transformation_led: "Lột xác",
  social_proof: "Bằng chứng số đông",
  curiosity: "Tò mò",
  education_led: "Giáo dục",
  premium_positioning: "Định vị cao cấp",
  transformation: "Lột xác",
  medical_authority: "Uy tín y khoa",
  education: "Giáo dục",
  price_promotion: "Khuyến mãi giá",
  urgency: "Tạo gấp gáp",
  celebrity_proof: "Người nổi tiếng",
  premium_luxury: "Sang trọng cao cấp",
  technology: "Công nghệ",
  safety: "An toàn",
  personal_confidence: "Tự tin cá nhân",
  natural_rejuvenation: "Trẻ hóa tự nhiên",
  biological_foundation: "Nền tảng sinh học",
  // service_or_product
  skin_analysis: "Phân tích da",
  facial_rejuvenation: "Trẻ hóa da mặt",
  melasma_treatment: "Trị nám",
  pigmentation_treatment: "Trị sắc tố",
  acne_treatment: "Trị mụn",
  laser_treatment: "Điều trị laser",
  collagen_stimulation: "Kích thích collagen",
  lifting_firming: "Nâng cơ / căng da",
  filler_botox: "Filler / Botox",
  facial_contouring: "Tạo đường nét mặt",
  body_slimming: "Giảm béo",
  hair_removal: "Triệt lông",
  surgery: "Phẫu thuật",
  dental_aesthetics: "Nha khoa thẩm mỹ",
  anti_aging_consultation: "Tư vấn chống lão hóa",
  hormone_biology_assessment: "Đánh giá nền tảng sinh học",
  nutrition_lifestyle: "Dinh dưỡng / lối sống",
  // proof_point
  doctor_expert: "Bác sĩ chuyên môn",
  "kol_celebrity": "KOL / người nổi tiếng",
  technology_machine: "Công nghệ / máy móc",
  clinic_facility: "Cơ sở phòng khám",
  certificate_license: "Chứng nhận / giấy phép",
  scientific_explanation: "Giải thích khoa học",
  media_coverage: "Báo chí đưa tin",
  social_count: "Lượt tương tác",
  guarantee: "Cam kết / bảo hành",
  price_proof: "Bằng chứng giá",
  no_clear_proof: "Chưa rõ bằng chứng",
  customer_context: "Bối cảnh khách hàng",
  // cta
  "send message": "Nhắn tin",
  "call now": "Gọi ngay",
  "sign up": "Đăng ký",
  "learn more": "Tìm hiểu thêm",
  "book now": "Đặt lịch",
  "contact us": "Liên hệ",
  "get offer": "Nhận ưu đãi",
  comment: "Bình luận",
  // copy/adapt/counter/avoid
  copy: "Học theo",
  adapt: "Điều chỉnh",
  counter: "Phản đòn",
  avoid: "Tránh",
  monitor: "Theo dõi",
  // strategic_change_type
  came_online: "Bắt đầu chạy QC",
  still_dark: "Vẫn im ắng",
  went_dark: "Ngừng chạy QC",
  stable: "Ổn định",
  stable_creative_refresh: "Ổn định, xoay nội dung",
  scaling_up: "Đang tăng tốc",
  scaling_down: "Đang giảm tốc",
  offer_shift: "Đổi ưu đãi",
  format_shift: "Đổi định dạng",
  baseline_week: "Tuần nền",
  // recommendation_type
  content_format: "Định dạng nội dung",
  counter_offer: "Phản đòn ưu đãi",
  proof_strategy: "Chiến lược bằng chứng",
  niche_whitespace: "Ngách bỏ trống",
  format_test: "Thử định dạng",
  // priority
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

/** Dịch một token enum sang tiếng Việt (giữ nguyên nếu không có trong bảng). */
export function viLabel(value?: string): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (isMissing(raw)) return "chưa rõ";
  return VI_LABELS[raw.toLowerCase()] || raw;
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
      return { label: "Đang thử", tone: "slate" };
    case 2:
      return { label: "Mới nhân rộng", tone: "sky" };
    case 3:
      return { label: "Nhân rộng mạnh", tone: "amber" };
    case 4:
      return { label: "Thắng bền vững", tone: "rose" };
    default:
      return { label: "Chưa rõ", tone: "slate" };
  }
}

export { STORAGE_KEY };

/* ============================================================
   Tự động nạp từ thư mục project (File System Access API)
   Chrome/Edge. Người dùng chọn thư mục C:\seryn-spy-agent một
   lần -> đọc cả 5 CSV từ đường dẫn cố định.
   ============================================================ */

/** Đường dẫn 5 output trong project (tương đối từ thư mục gốc đã chọn). */
export const PROJECT_FILES: Record<SpyTableName, string> = {
  brandWeeklySnapshot: "outputs/weekly_snapshots/brand_weekly_snapshot.csv",
  adLevelAnalysis: "outputs/normalized_ads/ad_level_analysis.csv",
  scaledContentAnalysis: "outputs/normalized_ads/scaled_content_analysis.csv",
  weeklyStrategyChange: "outputs/weekly_snapshots/weekly_strategy_change.csv",
  serynContentRecommendations: "outputs/creative_briefs/seryn_content_recommendations.csv",
};

export function isDirectoryPickerSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === "function";
}

/* --- IndexedDB nhỏ gọn để nhớ thư mục đã chọn --- */
function idbOpen(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("seryn-spy-fs", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
export async function rememberDirHandle(handle: any): Promise<void> {
  const db = await idbOpen();
  if (db) db.transaction("kv", "readwrite").objectStore("kv").put(handle, "dir");
}
export async function getRememberedDirHandle(): Promise<any | null> {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    const r = db.transaction("kv", "readonly").objectStore("kv").get("dir");
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => resolve(null);
  });
}

export async function pickProjectDirectory(): Promise<any | null> {
  if (!isDirectoryPickerSupported()) return null;
  return (window as any).showDirectoryPicker({ mode: "read" });
}

export async function ensureDirReadPermission(handle: any): Promise<boolean> {
  try {
    const opts = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    return (await handle.requestPermission(opts)) === "granted";
  } catch {
    return false;
  }
}

async function readFileFromDir(dir: any, path: string): Promise<string | null> {
  try {
    const parts = path.split("/");
    let d = dir;
    for (let i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i]);
    const fh = await d.getFileHandle(parts[parts.length - 1]);
    const f = await fh.getFile();
    return await f.text();
  } catch {
    return null;
  }
}

/** Đọc cả 5 CSV từ thư mục đã chọn. Trả về rows từng bảng + danh sách
 *  đã nạp / thiếu. Không ném lỗi nếu thiếu file. */
export async function loadAllCsvFromDirectory(dir: any): Promise<{
  tables: Partial<Record<SpyTableName, Record<string, string>[]>>;
  loaded: SpyTableName[];
  missing: SpyTableName[];
}> {
  const tables: Partial<Record<SpyTableName, Record<string, string>[]>> = {};
  const loaded: SpyTableName[] = [];
  const missing: SpyTableName[] = [];
  for (const key of Object.keys(PROJECT_FILES) as SpyTableName[]) {
    const text = await readFileFromDir(dir, PROJECT_FILES[key]);
    const rows = text != null ? parseCSV(text) : [];
    if (rows.length) {
      tables[key] = rows;
      loaded.push(key);
    } else {
      missing.push(key);
    }
  }
  return { tables, loaded, missing };
}
