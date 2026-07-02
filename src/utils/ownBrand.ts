/* ============================================================
   SERYN Spy — Own brand (SERYN) vs competitor
   ------------------------------------------------------------
   Phân biệt page/brand của CHÍNH SERYN với đối thủ, KHÔNG phá schema cũ:
   ưu tiên cột brand_type nếu có; nếu không thì derive từ `Own Brand Pages`
   (brand_name) hoặc tên chứa "seryn".
   ============================================================ */
import type { SpyDashboardData, OwnBrandPage } from "../types";

/** Chuẩn hóa tên brand để so khớp (bỏ dấu, thường hóa, gọn khoảng trắng). */
function normBrand(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

const truthy = (v: unknown) =>
  ["true", "1", "yes", "x", "có", "co"].includes(String(v ?? "").trim().toLowerCase());

/** Tên brand của SERYN lấy từ Own Brand Pages (mặc định luôn gồm "seryn"). */
function getOwnBrandNames(data: SpyDashboardData): string[] {
  const set = new Set<string>();
  for (const p of data.ownBrandPages ?? []) {
    const b = normBrand(p.brand_name);
    if (b) set.add(b);
  }
  set.add("seryn"); // fallback an toàn ngay cả khi chưa cấu hình tab
  return [...set];
}

/** brandName có phải của SERYN (own) không. */
export function isOwnBrand(brandName: string, ownBrandPages: OwnBrandPage[] = []): boolean {
  const n = normBrand(brandName);
  if (!n) return false;
  if (/\bseryn\b/.test(n) || n.includes("seryn")) return true;
  return (ownBrandPages ?? []).some((p) => {
    const b = normBrand(p.brand_name);
    return b && (n === b || n.includes(b) || b.includes(n));
  });
}

/** Row (ad/snapshot…) có phải own không — ưu tiên cột brand_type, fallback tên. */
export function isOwnRow(row: { brand_name?: string; brand_type?: string }, data: SpyDashboardData): boolean {
  if (String(row?.brand_type ?? "").toLowerCase() === "own") return true;
  if (String(row?.brand_type ?? "").toLowerCase() === "competitor") return false;
  return isOwnBrand(String(row?.brand_name ?? ""), data.ownBrandPages ?? []);
}

/** Danh sách brand_name (nguyên gốc) là own, xuất hiện trong snapshot. */
export function getOwnSnapshotBrandNames(data: SpyDashboardData): string[] {
  const owns = getOwnBrandNames(data);
  const out = new Set<string>();
  for (const r of data.brandWeeklySnapshot ?? []) {
    const n = normBrand(r.brand_name);
    if (String(r.brand_type ?? "").toLowerCase() === "own" || owns.some((o) => n === o || n.includes(o))) {
      if (r.brand_name) out.add(String(r.brand_name));
    }
  }
  return [...out];
}

/** Số page SERYN đã bật crawl (is_active & crawl_enabled & có page_id). */
export function ownPageCrawlStats(data: SpyDashboardData) {
  const pages = data.ownBrandPages ?? [];
  const active = pages.filter((p) => truthy(p.is_active));
  const crawlable = active.filter((p) => truthy(p.crawl_enabled) && String(p.page_id || "").trim());
  const missingId = pages.filter((p) => !String(p.page_id || "").trim());
  const disabled = pages.filter((p) => !truthy(p.crawl_enabled));
  return { total: pages.length, active: active.length, crawlable: crawlable.length, missingId: missingId.length, disabled: disabled.length };
}

export { truthy as isTruthyFlag };
