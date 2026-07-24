import type { SpyDashboardData } from "../types";

/** Map page_id -> page_name gom từ dữ liệu runtime (ownBrandPages + adLevelAnalysis).
 *  CHỈ tên THẬT quan sát được trong dữ liệu — page_id không có tên thì KHÔNG thêm
 *  (UI tự fallback về chính page_id, tuyệt đối không bịa tên). ownBrandPages ưu tiên
 *  trước để page SERYN luôn đúng tên. */
export function buildPageNameMap(data: SpyDashboardData): Map<string, string> {
  const m = new Map<string, string>();
  const put = (id: unknown, name: unknown) => {
    const i = String(id ?? "").trim();
    const n = String(name ?? "").trim();
    if (i && n && !m.has(i)) m.set(i, n);
  };
  for (const p of data.ownBrandPages ?? []) put(p.page_id, p.page_name);
  for (const a of data.adLevelAnalysis ?? []) put(a.page_id, a.page_name);
  return m;
}

/** Tên hiển thị cho 1 page_id: tên thật nếu có, ngược lại trả chính page_id. */
export function pageDisplayName(map: Map<string, string>, pageId: string): string {
  const id = String(pageId ?? "").trim();
  return map.get(id) || id;
}
