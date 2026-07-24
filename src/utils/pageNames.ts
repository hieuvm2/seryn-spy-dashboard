import type { SpyDashboardData } from "../types";

/** Map page_id -> page_name gom từ dữ liệu runtime.
 *  Nguồn (ưu tiên trước thắng): ownBrandPages (page SERYN luôn đúng tên) ->
 *  pageDirectory (directory tích lũy do pipeline gom từ mọi ad, phủ cả page phụ)
 *  -> adLevelAnalysis (tên từ ad trẻ hóa). CHỈ tên THẬT quan sát được — page_id
 *  không có tên thì KHÔNG thêm (UI fallback về chính page_id, không bịa tên). */
export function buildPageNameMap(data: SpyDashboardData): Map<string, string> {
  const m = new Map<string, string>();
  const put = (id: unknown, name: unknown) => {
    const i = String(id ?? "").trim();
    const n = String(name ?? "").trim();
    if (i && n && !m.has(i)) m.set(i, n);
  };
  for (const p of data.ownBrandPages ?? []) put(p.page_id, p.page_name);
  for (const e of data.pageDirectory ?? []) put(e.page_id, e.page_name);
  for (const a of data.adLevelAnalysis ?? []) put(a.page_id, a.page_name);
  return m;
}

/** Tên hiển thị cho 1 page_id: tên thật nếu có, ngược lại trả chính page_id. */
export function pageDisplayName(map: Map<string, string>, pageId: string): string {
  const id = String(pageId ?? "").trim();
  return map.get(id) || id;
}
