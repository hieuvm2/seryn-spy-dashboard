/* ============================================================
   Competitor Discovery — đọc candidate + cập nhật review status.
   - Dashboard CHỈ đọc Google Sheets (qua Apps Script) cho dữ liệu Exa.
   - Ghi (approve/reject/edit page_id) đi qua Apps Script record tab
     `competitor_discovery` (idField=discovery_id). Nếu chưa cấu hình
     write -> lưu localStorage draft override để UI phản hồi tức thì.
   - KHÔNG gọi Exa từ frontend. KHÔNG bịa page_id.
   ============================================================ */
import type { CompetitorDiscoveryCandidate } from "../types";
import { isSheetsConfigured, apiPost } from "./remoteData";
import { createCompetitor } from "./competitors";
import { isValidCompetitorBrand } from "./brandName";

const DRAFT_KEY = "seryn_discovery_overrides_v1";

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
export function isNumericPageId(v: unknown): boolean {
  return /^\d{6,}$/.test(str(v).trim());
}

/** ready_for_spy chỉ true khi approved + brand + numeric page_id + conf>=0.65. */
export function computeReadyForSpy(c: CompetitorDiscoveryCandidate): boolean {
  const status = str(c.status).toLowerCase();
  const okStatus = status === "approved" || status === "imported_to_competitors";
  const conf = Number(c.overall_confidence_score) || 0;
  return okStatus && !!str(c.brand_name) && isNumericPageId(c.facebook_page_id) && conf >= 0.65;
}

/* ---------- localStorage override (khi chưa có write online) ---------- */
type Override = Partial<CompetitorDiscoveryCandidate> & { discovery_id: string };
function loadOverrides(): Record<string, Override> {
  try { const raw = localStorage.getItem(DRAFT_KEY); const o = raw ? JSON.parse(raw) : {}; return o && typeof o === "object" ? o : {}; }
  catch { return {}; }
}
function saveOverride(o: Override): void {
  const all = loadOverrides();
  all[o.discovery_id] = { ...all[o.discovery_id], ...o };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(all)); } catch { /* noop */ }
}

/** Áp override local lên danh sách candidate online (online + local merge). */
export function applyOverrides(list: CompetitorDiscoveryCandidate[]): CompetitorDiscoveryCandidate[] {
  const ov = loadOverrides();
  return list.map((c) => {
    const o = ov[str(c.discovery_id)];
    const merged = o ? { ...c, ...o } : c;
    return { ...merged, ready_for_spy: computeReadyForSpy(merged) ? "TRUE" : "FALSE" };
  });
}

export function discoveryWriteConfigured(): boolean {
  return isSheetsConfigured();
}

/**
 * Cập nhật 1 candidate (status / facebook_page_id / notes...).
 * Luôn lưu override local; nếu cấu hình online -> POST record tab.
 */
async function updateCandidate(
  candidate: CompetitorDiscoveryCandidate,
  patch: Partial<CompetitorDiscoveryCandidate>,
): Promise<{ ok: boolean; synced: boolean; message: string }> {
  const next = { ...candidate, ...patch, discovery_id: str(candidate.discovery_id) };
  next.ready_for_spy = computeReadyForSpy(next) ? "TRUE" : "FALSE";
  next.updated_at = new Date().toISOString();
  saveOverride(next as Override);

  if (!discoveryWriteConfigured()) {
    return { ok: true, synced: false, message: "Lưu draft local (chưa cấu hình Google Sheets write)." };
  }
  try {
    await apiPost({ type: "competitor_discovery", action: "update", record: next });
    return { ok: true, synced: true, message: "Đã cập nhật lên Google Sheets." };
  } catch (e) {
    return { ok: true, synced: false, message: `Lưu local; sync online lỗi: ${e instanceof Error ? e.message : e}` };
  }
}

/** Duyệt candidate -> approved + TỰ thêm vào watchlist Competitors ngay nếu đã có
 *  page_id numeric (để hiện liền trong Cấu hình đối thủ & spy lần sau). Candidate
 *  thiếu page_id sẽ được pipeline tự resolve + import ở lần spy kế tiếp. */
export async function approveCandidate(c: CompetitorDiscoveryCandidate) {
  const res = await updateCandidate(c, { status: "approved", reviewed_at: new Date().toISOString() });
  try {
    if (isNumericPageId(c.facebook_page_id) && isValidCompetitorBrand(str(c.brand_name))) {
      createCompetitor({
        brand: str(c.brand_name),
        page_id: str(c.facebook_page_id),
        page_url: str(c.facebook_url) || undefined,
        category: str(c.business_type) || undefined,
        active: true,
        notes: "auto từ Phát hiện đối thủ" + (c.evidence_summary ? ": " + str(c.evidence_summary).slice(0, 80) : ""),
      });
    }
  } catch (e) {
    console.warn("Tự thêm vào watchlist thất bại (vẫn approved):", e);
  }
  return res;
}
export const rejectCandidate = (c: CompetitorDiscoveryCandidate) =>
  updateCandidate(c, { status: "rejected", reviewed_at: new Date().toISOString() });
export const markDuplicate = (c: CompetitorDiscoveryCandidate) =>
  updateCandidate(c, { status: "duplicate" });
export function setPageId(c: CompetitorDiscoveryCandidate, pageId: string) {
  const pid = str(pageId).trim();
  const patch: Partial<CompetitorDiscoveryCandidate> = { facebook_page_id: pid };
  if (isNumericPageId(pid) && str(c.status) === "needs_page_id") patch.status = "needs_review";
  return updateCandidate(c, patch);
}
