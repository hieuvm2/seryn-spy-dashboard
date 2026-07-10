/* ============================================================
   Competitor Setup — quản lý watchlist đối thủ ngay trong dashboard.

   - Đọc tab "Competitors" qua Apps Script (nếu cấu hình); map tương thích
     cột cũ (brand_name/page_ids/page_urls/active/notes) mà pipeline dùng.
   - Ghi: localStorage draft (luôn) + upsert online qua Apps Script (nếu cấu hình).
   - Nếu online write chưa sẵn sàng -> chỉ lưu draft + cảnh báo.
   ============================================================ */
import type { Competitor, CompetitorStatus } from "../types";
import { isSheetsConfigured, apiGet, apiPost } from "./sheetsApi";
import { normalizeBrandName } from "./brandName";

const DRAFT_KEY = "seryn_competitors_v1";

/** Cột Sheet "Competitors" — GIỮ 5 cột pipeline đầu, thêm metadata dashboard. */
export const COMPETITOR_SHEET_TAB = "Competitors";
export const COMPETITOR_HEADERS = [
  "brand_name", "page_ids", "page_urls", "active", "notes",
  "category", "last_crawled_at", "last_status", "id",
] as const;

function slug(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
/** Hash xác định (không random) để fallback id ổn định khi slug rỗng. */
function stableHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
/** id ổn định theo brand để dashboard ↔ Sheet ↔ pipeline khớp khi upsert.
 *  Dùng normalizeBrandName GIỐNG pipeline (import-discovered) để tạo CÙNG id. */
export function competitorId(brand: string): string {
  const base = slug(normalizeBrandName(brand)) || slug(brand);
  return `cmp-${base || ("x-" + stableHash(String(brand || "")))}`;
}

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
function isTrue(v: unknown): boolean {
  return ["true", "1", "yes", "x", "có"].includes(str(v).trim().toLowerCase());
}

/** Chuẩn hóa Facebook Page URL. */
export function normalizePageUrl(raw: string): string {
  let u = str(raw).trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  try {
    const url = new URL(u);
    if (/facebook\.com$/i.test(url.hostname) || /facebook\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
      url.hostname = "www.facebook.com";
      url.search = ""; url.hash = "";
      return url.toString().replace(/\/$/, "");
    }
    return u;
  } catch { return u; }
}

/** Cố gắng lấy page_id dạng số từ URL (best-effort; không có thì rỗng). */
export function extractPageIdFromUrl(url: string): string {
  const m = str(url).match(/(?:profile\.php\?id=|\/)(\d{6,})/);
  return m ? m[1] : "";
}

/* ---------- (de)serialize Sheet ---------- */
export function competitorToRecord(c: Competitor): Record<string, string> {
  return {
    brand_name: str(c.brand),
    page_ids: str(c.page_id),
    page_urls: str(c.page_url),
    active: c.active ? "TRUE" : "FALSE",
    notes: str(c.notes),
    category: str(c.category),
    last_crawled_at: str(c.last_crawled_at),
    last_status: str(c.last_status),
    id: str(c.id || competitorId(c.brand)),
  };
}
export function recordToCompetitor(r: Record<string, unknown>): Competitor {
  const brand = str(r.brand_name ?? r.brand);
  const page_id = str(r.page_ids ?? r.page_id);
  const page_url = str(r.page_urls ?? r.page_url);
  const id = str(r.id) || competitorId(brand);
  return {
    id,
    brand,
    page_name: r.page_name ? str(r.page_name) : undefined,
    page_url: page_url || undefined,
    page_id: page_id || undefined,
    category: r.category ? str(r.category) : undefined,
    active: r.active === undefined ? true : isTrue(r.active),
    notes: r.notes ? str(r.notes) : undefined,
    last_crawled_at: r.last_crawled_at ? str(r.last_crawled_at) : undefined,
    last_status: (r.last_status ? str(r.last_status) : undefined) as CompetitorStatus | undefined,
  };
}

/* ---------- validate ---------- */
export type CompetitorValidation = { ok: boolean; errors: string[]; warnings: string[] };
export function validateCompetitor(c: Partial<Competitor>, existing: Competitor[]): CompetitorValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const brand = str(c.brand).trim();
  const pageUrl = str(c.page_url).trim();
  const pageId = str(c.page_id).trim();
  if (!brand) errors.push("Thiếu Brand name.");
  if (!pageUrl && !pageId) errors.push("Cần ít nhất Page URL hoặc Page ID.");
  if (pageId && !pageId.split("|").every((p) => /^\d{6,}$/.test(p.trim()))) errors.push("Page ID phải là chuỗi số (≥6 chữ số), nhiều id ngăn cách bằng |.");
  if (pageId) {
    const dup = existing.find((x) => x.id !== c.id && str(x.page_id).split("|").some((p) => pageId.split("|").includes(p.trim())));
    if (dup) errors.push(`Trùng page_id với "${dup.brand}".`);
  }
  if (brand) {
    const dupBrand = existing.find((x) => x.id !== c.id && slug(x.brand) === slug(brand));
    if (dupBrand) warnings.push(`Trùng tên brand với mục đã có ("${dupBrand.brand}").`);
  }
  if (pageUrl && !pageId && !extractPageIdFromUrl(pageUrl)) warnings.push("Chưa resolve được Page ID từ URL — sẽ lưu trạng thái needs_page_id.");
  return { ok: errors.length === 0, errors, warnings };
}

export function statusFor(c: Competitor): CompetitorStatus {
  if (!c.active) return "inactive";
  if (!str(c.page_id).trim()) return "needs_page_id";
  if (c.last_status === "crawl_error") return "crawl_error";
  return "ok";
}

/* ---------- localStorage drafts ---------- */
function loadDrafts(): Competitor[] {
  try { const raw = localStorage.getItem(DRAFT_KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
function saveDrafts(list: Competitor[]): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(list)); } catch { /* noop */ }
}
function upsertLocal(c: Competitor): Competitor[] {
  const list = loadDrafts();
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  saveDrafts(list);
  return list;
}

/** Đã cấu hình endpoint ghi competitors chưa (Apps Script). */
export function competitorWriteConfigured(): boolean {
  return isSheetsConfigured();
}

/* ---------- API (online + fallback) ---------- */
function mergeById(base: Competitor[], overrides: Competitor[]): Competitor[] {
  const map = new Map<string, Competitor>();
  for (const c of base) map.set(c.id, c);
  for (const c of overrides) map.set(c.id, { ...map.get(c.id), ...c });
  return [...map.values()];
}

/** Vài đối thủ mẫu để demo khi chạy offline (sẽ seed vào draft lần đầu). */
const SAMPLE_COMPETITORS: Competitor[] = [
  { id: competitorId("JW Hàn Quốc"), brand: "JW Hàn Quốc", page_url: "https://www.facebook.com/benhvienjw.vn", page_id: "101055868985301|400844936646543", category: "hospital", active: true, notes: "demo" },
  { id: competitorId("Thu Cúc"), brand: "Thu Cúc", page_url: "https://www.facebook.com/thammythucuc.com.vn", page_id: "938714509514807", category: "hospital", active: true, notes: "demo" },
  { id: competitorId("Lavender By Chang"), brand: "Lavender By Chang", page_url: "https://www.facebook.com/LavenderByChang", page_id: "887334961357859", category: "luxury_spa", active: true, notes: "demo" },
  { id: competitorId("Ngọc Dung"), brand: "Ngọc Dung", page_url: "https://www.facebook.com/ngocdungbeautycenter", page_id: "372398605948395", category: "chain", active: false, notes: "demo · still dark" },
];

/** Đọc danh sách competitor: online (nếu cấu hình) + drafts local (ưu tiên local). */
export async function loadCompetitorsAsync(): Promise<{ items: Competitor[]; source: "online" | "local"; warning?: string }> {
  let drafts = loadDrafts();
  if (!isSheetsConfigured() && !drafts.length) {
    // Demo offline: seed danh sách mẫu để view không trống (lưu thành draft thật).
    saveDrafts(SAMPLE_COMPETITORS);
    drafts = SAMPLE_COMPETITORS;
  }
  if (isSheetsConfigured()) {
    try {
      const json = await apiGet({ type: "competitors" });
      if (Array.isArray(json.data)) {
        const online = (json.data as Record<string, unknown>[]).map(recordToCompetitor);
        return { items: mergeById(online, drafts), source: "online" };
      }
    } catch (e) {
      return { items: drafts, source: "local", warning: `Không đọc được Competitors online (${e instanceof Error ? e.message : e}). Đang dùng draft local.` };
    }
  }
  return { items: drafts, source: "local", warning: drafts.length ? undefined : "Chưa cấu hình Google Sheets — thao tác chỉ lưu local draft." };
}

function remoteUpsert(c: Competitor): void {
  if (!competitorWriteConfigured()) return;
  apiPost({ type: "competitors", action: "upsert", record: competitorToRecord(c) })
    .catch((e) => console.warn("Sync competitor thất bại — giữ draft local:", e));
}

/** Gộp page_id (pipe) khử trùng, giữ thứ tự. */
function mergePageIds(existing: string, incoming: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of `${str(existing)}|${str(incoming)}`.split("|").map((x) => x.trim()).filter(Boolean)) {
    if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out.join("|");
}

export function createCompetitor(input: Partial<Competitor>): { competitor: Competitor; synced: boolean } {
  const brand = str(input.brand).trim();
  const id = input.id || competitorId(brand);
  const newPid = str(input.page_id || (input.page_url ? extractPageIdFromUrl(str(input.page_url)) : "")).trim();
  // Nếu đã có competitor cùng id -> MERGE (không ghi đè mất page_id/field cũ).
  const prev = loadDrafts().find((x) => x.id === id);
  const c: Competitor = {
    id,
    brand: brand || str(prev?.brand),
    page_name: input.page_name || prev?.page_name,
    page_url: input.page_url ? normalizePageUrl(str(input.page_url)) : prev?.page_url,
    page_id: (prev?.page_id ? mergePageIds(str(prev.page_id), newPid) : newPid) || undefined,
    category: input.category || prev?.category,
    active: input.active ?? prev?.active ?? true,
    notes: input.notes || prev?.notes,
    createdAt: prev?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  c.last_status = statusFor(c);
  upsertLocal(c);
  remoteUpsert(c);
  return { competitor: c, synced: competitorWriteConfigured() };
}

export function updateCompetitor(id: string, patch: Partial<Competitor>): Competitor | null {
  const list = loadDrafts();
  const i = list.findIndex((x) => x.id === id);
  const base = i >= 0 ? list[i] : { id, brand: "", active: true } as Competitor;
  const next: Competitor = { ...base, ...patch, id, updatedAt: new Date().toISOString() };
  if (patch.page_url !== undefined) next.page_url = patch.page_url ? normalizePageUrl(patch.page_url) : undefined;
  next.last_status = statusFor(next);
  upsertLocal(next);
  remoteUpsert(next);
  return next;
}

export function toggleCompetitorActive(id: string, active: boolean): Competitor | null {
  return updateCompetitor(id, { active });
}

/** Soft-delete: đánh dấu inactive (không xóa cứng). */
export function softDeleteCompetitor(id: string): Competitor | null {
  return updateCompetitor(id, { active: false, notes: "(đã ẩn)" });
}

/** Xóa local theo id. */
function removeLocal(id: string): void {
  saveDrafts(loadDrafts().filter((x) => x.id !== id));
}
export type DeleteResult = { synced: boolean; deletedOnline: boolean; error?: string };
/** XÓA HẲN đối thủ khỏi watchlist (local + Sheet). Pipeline sẽ không spy brand này nữa.
 *  CHỜ Apps Script xóa xong rồi mới trả về — caller phải await trước khi reload,
 *  nếu không danh sách online (còn dòng cũ) sẽ merge đè lại và đối thủ "hồi sinh".
 *  Apps Script match theo CỘT id của Sheet — dòng thiếu id sẽ trả deletedOnline=false. */
export async function deleteCompetitor(id: string): Promise<DeleteResult> {
  removeLocal(id);
  if (!competitorWriteConfigured()) return { synced: false, deletedOnline: false };
  try {
    const res = await apiPost({ type: "competitors", action: "delete", record: { id } });
    return { synced: true, deletedOnline: res.deleted === true };
  } catch (e) {
    return { synced: true, deletedOnline: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------- Test crawl (MVP — kiểm tra cấu hình, chưa gọi backend thật) ---------- */
export type CrawlResult = { ok: boolean; status: CompetitorStatus; message: string };
export function testCrawl(c: Competitor): CrawlResult {
  if (!c.active) return { ok: false, status: "inactive", message: "Competitor đang inactive — bật active trước khi crawl." };
  const ids = str(c.page_id).split("|").map((x) => x.trim()).filter(Boolean);
  if (!ids.length) return { ok: false, status: "needs_page_id", message: "Chưa có page_id — không thể crawl." };
  if (!ids.every((p) => /^\d{6,}$/.test(p))) return { ok: false, status: "crawl_error", message: "page_id sai định dạng (phải là số)." };
  // MVP: chưa gọi provider thật từ frontend (tránh lộ key). Báo trạng thái mô phỏng.
  return { ok: true, status: "ok", message: `Định dạng hợp lệ (${ids.length} page). Crawl thật chạy ở GitHub Actions/pipeline.` };
}
