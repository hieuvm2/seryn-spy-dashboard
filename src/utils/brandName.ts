/* ============================================================
   Brand name normalize + validate (frontend).
   ------------------------------------------------------------
   GIỮ ĐỒNG BỘ với scripts/lib/competitorDiscoveryUtils.mjs
   (normalizeBrandName / isValidCompetitorBrand) để frontend (approve →
   tự add watchlist) và pipeline (auto-import) tạo CÙNG id + CÙNG luật loại
   tên rác. Đổi một bên thì đổi bên kia.
   ============================================================ */
const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const lc = (s: unknown): string => str(s).toLowerCase();

/** Chuẩn hóa tên brand: bỏ dấu, hậu tố pháp lý/loại hình, lowercase, gọn. */
export function normalizeBrandName(name: string): string {
  let s = lc(name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  s = s.replace(/\b(benh vien|tham my vien|phong kham|clinic|spa|beauty|center|aesthetic|hospital|jsc|co\.?,? ?ltd|company)\b/g, " ");
  return s.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const JUNK_TITLE_SIGNALS = [
  "?", "bao nhiêu", "giá bao", "chi phí", "bảng giá", "báo giá", "là gì",
  "gồm những gì", "có nên", "có tốt", "có hiệu quả", "cách ", "tại sao",
  "như thế nào", "review", "đánh giá", "top ", "tốp ", "list ", "danh sách",
  "kinh nghiệm", "lưu ý", "webtretho", "wiki", "hỏi đáp", "tư vấn", "tin tức",
];
function looksLikeJunkTitle(title: string): boolean {
  const t = lc(title).trim();
  if (!t || t.length < 2) return true;
  return JUNK_TITLE_SIGNALS.some((w) => t.includes(w));
}

const GENERIC_PHRASES = new Set([
  "trang chu", "gioi thieu", "home", "ve chung toi", "dich vu", "san pham", "bang gia",
  "bao gia", "khuyen mai", "uu dai", "tin tuc", "blog", "lien he", "website", "trang chinh",
]);
const SERVICE_STOPWORDS = new Set(
  "tre hoa da mat hifu nang co collagen laser cang chi skin booster ultherapy thermage rf exosome meso mesotherapy filler botox lifting cong nghe lieu trinh dich vu san pham nam mun pico co2 sera core fractional toan dien vung"
    .split(" ").filter(Boolean),
);

/** brand_name có đáng tin là tên đối thủ không? Loại tiêu đề generic + tên thuần dịch vụ. */
export function isValidCompetitorBrand(name: string): boolean {
  const n = str(name).trim();
  if (n.length < 2 || looksLikeJunkTitle(n)) return false;
  const normFull = normalizeBrandName(n);
  if (!normFull || GENERIC_PHRASES.has(normFull)) return false;
  const core = normFull.split(" ").filter((t) => t && !SERVICE_STOPWORDS.has(t));
  return core.length > 0;
}
