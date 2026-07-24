/* ============================================================
   SERYN Spy — Page Directory (page_id -> page_name).
   ------------------------------------------------------------
   Gom TÊN page THẬT (từ ads đã cào — MỌI danh mục, trước khi lọc trẻ hóa)
   thành 1 directory TÍCH LŨY trên Supabase (dataset_key 'pageDirectory').
   Dashboard đọc để hiện TÊN page thay vì page_id — kể cả page phụ bị lọc
   khỏi adLevelAnalysis. CHỈ tên quan sát được trong dữ liệu, KHÔNG bịa.
   ============================================================ */
import { fetchDataset, pushDatasets } from "./supabase.mjs";

const clean = (s) => String(s ?? "").trim();

/** Gom [{page_id, page_name, brand_name}] từ mảng ads (mỗi ad có page_id + page_name). */
export function collectNamesFromAds(ads, brandName = "") {
  const out = [];
  for (const a of ads || []) {
    const id = clean(a.page_id);
    const nm = clean(a.page_name);
    if (id && nm) out.push({ page_id: id, page_name: nm, brand_name: clean(a.brand_name) || clean(brandName) });
  }
  return out;
}

/** Hợp nhất directory cũ + mới (union theo page_id). Tên MỚI khác rỗng thắng;
 *  giữ tên cũ nếu mới rỗng. PURE — test được. Trả rows sắp theo tên. */
export function mergeDirectory(existingRows, newRows) {
  const map = new Map();
  for (const r of existingRows || []) {
    const id = clean(r.page_id);
    if (id) map.set(id, { page_id: id, page_name: clean(r.page_name), brand_name: clean(r.brand_name) });
  }
  for (const r of newRows || []) {
    const id = clean(r.page_id);
    const nm = clean(r.page_name);
    if (!id || !nm) continue;
    const cur = map.get(id);
    map.set(id, { page_id: id, page_name: nm, brand_name: clean(r.brand_name) || cur?.brand_name || "" });
  }
  return [...map.values()].sort((a, b) => a.page_name.localeCompare(b.page_name, "vi"));
}

/** Đọc directory hiện có trên Supabase, merge newRows, đẩy lại (tích lũy).
 *  Trả {before, after, added}. Không đẩy nếu Supabase chưa cấu hình -> ném lỗi. */
export async function pushPageDirectory(newRows, weekDate = "") {
  const existing = await fetchDataset("pageDirectory");
  const merged = mergeDirectory(existing, newRows);
  await pushDatasets({ pageDirectory: merged }, weekDate);
  return { before: existing.length, after: merged.length, added: merged.length - existing.length };
}
