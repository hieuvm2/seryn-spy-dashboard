/* ============================================================
   SERYN Spy — Report builders (pure, no Sheets I/O)
   ------------------------------------------------------------
   Dựng SpyReport row (flat, sheet-friendly) cho weekly + monthly từ dữ
   liệu các tab pipeline đã ghi. KHÔNG gọi API, KHÔNG bịa số liệu.

   NGÔN NGỮ TRUNG TÍNH (BẮT BUỘC): không dùng "winner/winning/thắng chắc/
   thắng bền vững". Dùng "tín hiệu lặp lại / nội dung chạy dài ngày / đối thủ
   tăng tốc / đối thủ giảm hoạt động / pattern đáng theo dõi / rủi ro claim".
   ============================================================ */

import { viEnum, viText, viTopList, findEnglishLeaks } from "./viText.mjs";

/** Cảnh báo BẮT BUỘC đính kèm mọi report. */
export const DATA_DISCLAIMER =
  "Đây là báo cáo dựa trên dữ liệu ads công khai và tín hiệu lặp lại, " +
  "không phải dữ liệu CPA/ROAS/spend thật.";

/* ---- Việt hóa row báo cáo TRƯỚC khi lưu (dashboard hiển thị tiếng Việt
   ngay từ dữ liệu, không phải dịch đuổi). Field máy đọc (report_id, dates,
   KPI số) giữ nguyên. ---- */
const VI_TOP_FIELDS = ["top_services", "top_offers", "top_content_angles", "top_ad_formats", "top_objectives"];
const VI_TEXT_FIELDS = [
  "title", "executive_summary", "key_competitor_moves", "notable_content_patterns",
  "notable_visual_patterns", "risk_warnings", "seryn_implications", "recommended_actions",
  "seryn_benchmark", "data_quality_note",
];
export function viReportRow(row) {
  const out = { ...row };
  for (const f of VI_TOP_FIELDS) if (out[f]) out[f] = viTopList(out[f]);
  for (const f of VI_TEXT_FIELDS) if (out[f]) out[f] = viText(out[f]);
  // Chốt chặn: cảnh báo nếu còn từ tiếng Anh ngoài whitelist lọt vào narrative.
  const leaks = new Set();
  for (const f of VI_TEXT_FIELDS) for (const w of findEnglishLeaks(out[f])) leaks.add(w);
  if (leaks.size) console.warn(`  [vi] Còn từ tiếng Anh nghi lọt trong báo cáo: ${[...leaks].slice(0, 15).join(", ")} — bổ sung vào scripts/lib/viText.mjs nếu cần dịch.`);
  return out;
}

export const num = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Tách chuỗi chip "a|b, c" -> ["a","b","c"] (bỏ rỗng / unknown / no_clear_*). */
export function splitChips(v) {
  return String(v ?? "")
    .split(/[|,]/)
    .map((s) => clean(s))
    .filter((s) => s && !/^(unknown|none|no_clear_\w+|n\/a|-)$/i.test(s));
}

/** Đếm tần suất chip qua nhiều dòng cho 1 field -> [{key,count}] giảm dần. */
export function countChips(rows, field, limit = 8) {
  const map = new Map();
  for (const r of rows || []) {
    for (const chip of splitChips(r?.[field])) {
      map.set(chip, (map.get(chip) || 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** [{key,count}] -> "key (count) | key (count)". Rỗng -> "". */
export function topToString(items) {
  return (items || []).map((it) => `${it.key} (${it.count})`).join(" | ");
}

/** Parse ngược "key (count) | ..." -> [{key,count}] (để gộp ở monthly). */
export function parseTopField(str) {
  return String(str ?? "")
    .split("|")
    .map((s) => clean(s))
    .filter(Boolean)
    .map((s) => {
      const m = /^(.*?)\s*\((\d+)\)\s*$/.exec(s);
      return m ? { key: clean(m[1]), count: Number(m[2]) } : { key: s, count: 1 };
    })
    .filter((it) => it.key);
}

/** Gộp nhiều chuỗi top_* (mỗi chuỗi 1 tuần) -> 1 chuỗi cộng dồn count. */
export function mergeTopFields(strings, limit = 8) {
  const map = new Map();
  for (const s of strings || []) {
    for (const it of parseTopField(s)) map.set(it.key, (map.get(it.key) || 0) + it.count);
  }
  const items = [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  return topToString(items);
}

/** Nối list readable bằng " | " (dedup, bỏ rỗng, cap). */
export function joinList(items, limit = 8, sep = " | ") {
  const seen = new Set();
  const out = [];
  for (const raw of items || []) {
    const s = clean(raw);
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out.join(sep);
}

const inRange = (wd, start, end) => {
  const s = String(wd || "").slice(0, 10);
  return s && s >= start && s <= end;
};

/* ---------- SERYN own-brand benchmark ---------- */
function normName(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function isOwnName(name, ownNames = []) {
  const n = normName(name);
  if (!n) return false;
  if (n.includes("seryn")) return true;
  return (ownNames || []).some((o) => o && (n === o || n.includes(o)));
}

/**
 * Block text "SERYN vs Đối thủ" (parse bằng split("|") ở dashboard).
 * Trung tính (không "thua/kém"), không CPA/ROAS.
 */
export function serynBenchmarkBlock(snapshot, ownNames = []) {
  const own = (snapshot || []).filter((r) => isOwnName(r.brand_name, ownNames));
  const comp = (snapshot || []).filter((r) => !isOwnName(r.brand_name, ownNames));
  if (!own.length || own.reduce((a, r) => a + num(r.total_active_ads), 0) === 0) {
    return "Chưa có dữ liệu ads công khai của SERYN trong kỳ để so sánh (thêm page vào tab Own Brand Pages + crawl).";
  }
  const serynAds = own.reduce((a, r) => a + num(r.total_active_ads), 0);
  const compWithAds = comp.filter((r) => num(r.total_active_ads) > 0);
  const compAvg = compWithAds.length ? Math.round(comp.reduce((a, r) => a + num(r.total_active_ads), 0) / compWithAds.length) : 0;
  const top = [...comp].sort((a, b) => num(b.total_active_ads) - num(a.total_active_ads))[0];
  const keys = (rows, f) => countChips(rows, f).map((x) => x.key);
  const lc = (arr) => arr.map((x) => x.toLowerCase());
  const serynAngles = keys(own, "main_angles"), compAngles = keys(comp, "main_angles");
  const missingAngles = compAngles.filter((a) => !lc(serynAngles).includes(a.toLowerCase()));
  const serynFormats = keys(own, "main_content_formats"), compFormats = keys(comp, "main_content_formats");
  const missingFormats = compFormats.filter((f) => !lc(serynFormats).includes(f.toLowerCase()));
  const missingServices = keys(comp, "services_running").filter((s) => !lc(keys(own, "services_running")).includes(s.toLowerCase()));
  const viList = (arr, n) => arr.slice(0, n).map((x) => viEnum(x)).join(", ");
  const parts = [
    `Ads SERYN đang chạy: ${serynAds}`,
    `Trung bình ads đang chạy của đối thủ: ${compAvg}`,
    top ? `Đối thủ chạy mạnh nhất: ${clean(top.brand_name)} (${num(top.total_active_ads)})` : "",
    `Góc tiếp cận SERYN đang dùng: ${viList(serynAngles, 4) || "—"}`,
    `Góc đối thủ lặp lại nhưng SERYN chưa dùng: ${viList(missingAngles, 4) || "(không khác biệt lớn)"}`,
    `Định dạng SERYN đang thiếu: ${viList(missingFormats, 3) || "(không lệch lớn)"}`,
    `Dịch vụ đối thủ đẩy mạnh mà SERYN chưa đẩy: ${viList(missingServices, 4) || "—"}`,
    `Ưu đãi đối thủ đang đẩy mạnh: ${keys(comp, "offers_detected").slice(0, 4).join(", ") || "—"}`,
    serynAds < compAvg ? "SERYN đang thấp hơn trung bình đối thủ về số lượng ads." : "SERYN ở mức ngang/cao hơn trung bình đối thủ về số lượng ads.",
    "Rủi ro nếu học theo đối thủ: giữ câu chữ an toàn ('kết quả tùy cơ địa'), tránh trước/sau cường điệu & neo giá gốc.",
    `Đề xuất thử nghiệm: ${missingAngles.length ? `thử có kiểm soát góc "${viEnum(missingAngles[0])}" theo tông y khoa` : "củng cố tuyến nội dung giáo dục"}; giữ định vị cao cấp, không đua giá.`,
  ];
  return joinList(parts, 12);
}
const pct = (n) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : "");

/* ============================================================
   WEEKLY
   ============================================================ */

/**
 * Dựng 1 dòng SpyReport (weekly).
 * @param {object} ctx
 *   ctx.tabs   — { snapshot, ads, scaled, changes, crawlRuns, visualPatterns,
 *                  brandVisualSummary, weeklyStrategyChange, actionPlan, contentRecs }
 *   ctx.period — { period_start, period_end }
 *   ctx.meta   — { generatedAt, timezone, reportId, createdBy }
 * @returns {{ row: object, notes: string[] }}
 */
export function buildWeeklyReport(ctx) {
  const t = ctx.tabs || {};
  const { period_start, period_end } = ctx.period;
  const notes = [];

  let snapshot = (t.snapshot || []).filter((r) => inRange(r.week_date, period_start, period_end));
  if (!snapshot.length && (t.snapshot || []).length) {
    // Không có snapshot đúng kỳ -> dùng tuần mới nhất hiện có, ghi chú rõ.
    const weeks = [...new Set(t.snapshot.map((r) => String(r.week_date).slice(0, 10)).filter(Boolean))].sort();
    const latest = weeks[weeks.length - 1];
    snapshot = t.snapshot.filter((r) => String(r.week_date).slice(0, 10) === latest);
    notes.push(`Không có snapshot trong kỳ ${period_start}→${period_end}; dùng tuần gần nhất ${latest}.`);
  }
  const ads = (t.ads || []).filter((r) => inRange(r.week_date, period_start, period_end));
  const scaled = (t.scaled || []).filter((r) => inRange(r.week_date, period_start, period_end));
  const strat = (t.weeklyStrategyChange || []).filter((r) => inRange(r.week_date, period_start, period_end));
  const changes = (t.changes || []).filter((r) => inRange(r.week_start, period_start, period_end));
  const crawl = (t.crawlRuns || []).filter((r) => inRange(r.week_date, period_start, period_end));
  const recs = (t.contentRecs || []).filter((r) => !r.week_date || inRange(r.week_date, period_start, period_end));
  const actions = (t.actionPlan || []).filter((r) => !r.week_start || inRange(r.week_start, period_start, period_end));

  // Loại own brand (SERYN) khỏi MỌI thống kê/danh sách ĐỐI THỦ — SERYN có block benchmark riêng.
  const notOwn = (name) => !isOwnName(name, ctx.ownNames);
  const comp = snapshot.filter((r) => notOwn(r.brand_name));
  const compAds = ads.filter((r) => String(r.brand_type ?? "").toLowerCase() !== "own" && notOwn(r.brand_name));
  const compScaled = scaled.filter((s) => notOwn(s.brand_name));
  const compStrat = strat.filter((r) => notOwn(r.brand_name));
  const compChanges = changes.filter((c) => notOwn(c.brand));

  const brands = [...new Set(comp.map((r) => clean(r.brand_name)).filter(Boolean))];
  const totalBrands = brands.length;
  const totalActiveAds = comp.reduce((a, r) => a + num(r.total_active_ads), 0);
  const totalNewAds = comp.reduce((a, r) => a + num(r.new_ads_count), 0);
  const totalStoppedAds = comp.reduce((a, r) => a + num(r.stopped_ads_count), 0);
  const totalPages = comp.reduce((a, r) => a + num(r.num_pages_running), 0);

  // crawl success rate (latest weekly_spy run trong kỳ)
  const spyRuns = crawl.filter((r) => !r.run_type || /spy/i.test(r.run_type));
  const lastRun = spyRuns[spyRuns.length - 1];
  let crawlRate = "";
  if (lastRun) {
    const ok = num(lastRun.success_pages);
    const fail = num(lastRun.failed_pages);
    if (ok + fail > 0) crawlRate = pct(ok / (ok + fail));
  }

  // ---- movers ----
  const moverScore = (r) => {
    const ch = num(r.active_ads_change);
    return ch !== 0 ? ch : (num(r.new_ads_count) - num(r.stopped_ads_count));
  };
  const stratByBrand = compStrat.length ? compStrat : comp.map((s) => ({
    brand_name: s.brand_name, active_ads_change: s.weekly_change_summary ? "" : "",
    new_ads_count: s.new_ads_count, stopped_ads_count: s.stopped_ads_count,
  }));
  const sortedMovers = [...stratByBrand].sort((a, b) => moverScore(b) - moverScore(a));
  const risers = sortedMovers.filter((r) => moverScore(r) > 0).slice(0, 4)
    .map((r) => `${clean(r.brand_name)} ▲+${moverScore(r)}`);
  const decliners = sortedMovers.filter((r) => moverScore(r) < 0).slice(-3)
    .map((r) => `${clean(r.brand_name)} ▼${moverScore(r)}`);
  const topMovers = joinList([...risers, ...decliners], 7);

  const byNew = [...comp].sort((a, b) => num(b.new_ads_count) - num(a.new_ads_count))
    .filter((r) => num(r.new_ads_count) > 0).slice(0, 5)
    .map((r) => `${clean(r.brand_name)} (${num(r.new_ads_count)} mới)`);
  const byStopped = [...comp].sort((a, b) => num(b.stopped_ads_count) - num(a.stopped_ads_count))
    .filter((r) => num(r.stopped_ads_count) > 0).slice(0, 5)
    .map((r) => `${clean(r.brand_name)} (${num(r.stopped_ads_count)} dừng)`);

  // ---- top patterns (chỉ đối thủ) ----
  const topServices = topToString(countChips(comp, "services_running")) ||
    topToString(countChips(compAds, "service_or_product"));
  const topOffers = topToString(countChips(comp, "offers_detected")) ||
    topToString(countChips(compAds, "offer_detected"));
  const topAngles = topToString(countChips(comp, "main_angles")) ||
    topToString(countChips(compAds, "content_angle"));
  const topFormats = topToString(countChips(comp, "main_content_formats")) ||
    topToString(countChips(compAds, "ad_format"));
  const topObjectives = topToString(countChips(compAds, "inferred_objective")) ||
    topToString(countChips(comp, "skin_rejuvenation_top_inferred_objective"));

  // ---- narrative sections ----
  const keyMoves = joinList([
    ...compStrat
      .filter((r) => clean(r.change_summary))
      .sort((a, b) => Math.abs(moverScore(b)) - Math.abs(moverScore(a)))
      .map((r) => `${clean(r.brand_name)}: ${clean(r.change_summary)}`),
    ...compChanges
      .filter((c) => /high|medium/i.test(String(c.severity)))
      .map((c) => `${clean(c.brand)}: ${clean(c.summary)}`),
  ], 6);

  const contentPatterns = joinList([
    ...[...compScaled]
      .sort((a, b) => num(b.number_of_similar_ads) - num(a.number_of_similar_ads))
      .map((s) => {
        const ads_n = num(s.number_of_similar_ads);
        const days = num(s.longest_days_active);
        const hook = clean(s.representative_hook) || clean(s.content_format) || clean(s.service_or_product);
        const tail = days >= 30 ? " — nội dung chạy dài ngày" : (ads_n >= 3 ? " — tín hiệu lặp lại" : "");
        return `${clean(s.brand_name)}: ${hook} (${ads_n} ad${tail})`;
      }),
    ...recs.filter((r) => clean(r.market_signal)).map((r) => clean(r.market_signal)),
  ], 6);

  const visualPatterns = joinList([
    ...(t.visualPatterns || [])
      .filter((v) => (inRange(v.week_date, period_start, period_end) || !v.week_date) && notOwn(v.brand))
      .map((v) => `${clean(v.brand)}: ${clean(v.summary)}${num(v.ad_count) ? ` (${num(v.ad_count)} ad)` : ""}`),
    ...(t.brandVisualSummary || [])
      .filter((v) => (inRange(v.week_date, period_start, period_end) || !v.week_date) && notOwn(v.brand))
      .map((v) => {
        const a = clean(v.dominant_visual_angle);
        const f = clean(v.top_visual_formats);
        if (!a && !f) return "";
        return `${clean(v.brand)}: angle ${a || "—"}${f ? `, format ${f}` : ""}`;
      }),
  ], 6);

  // ---- risk warnings (claim risk) ----
  const riskItems = [];
  for (const v of t.visualAnalysis || []) {
    if (/high/i.test(String(v.promotion_claim_risk)) || /high/i.test(String(v.medical_claim_risk)) || num(v.claim_risk_score) >= 60) {
      riskItems.push(`${clean(v.brand)}: rủi ro claim — ${clean(v.visual_insight_summary) || clean(v.text_overlay_summary)}`);
    }
  }
  for (const c of compChanges) {
    if (/offer_changed/i.test(String(c.change_type)) && /high|medium/i.test(String(c.severity))) {
      riskItems.push(`${clean(c.brand)}: thay đổi offer mạnh (${clean(c.current_value)}) — theo dõi rủi ro đua giá.`);
    }
  }
  const riskWarnings = joinList(riskItems.length ? riskItems : ["Chưa phát hiện rủi ro claim nổi bật trong kỳ."], 6);

  const serynImplications = joinList([
    ...compStrat.filter((r) => clean(r.seryn_implication)).map((r) => `${clean(r.brand_name)}: ${clean(r.seryn_implication)}`),
    ...comp.filter((r) => clean(r.seryn_opportunity)).map((r) => `${clean(r.brand_name)}: ${clean(r.seryn_opportunity)}`),
    ...recs.filter((r) => clean(r.insight)).map((r) => clean(r.insight)),
  ], 6);

  const recommendedActions = joinList([
    ...actions.filter((a) => clean(a.suggested_action))
      .map((a) => `[${clean(a.priority) || "medium"}] ${clean(a.suggested_action)}`),
    ...recs.filter((r) => clean(r.recommended_action) || clean(r.recommended_seryn_action))
      .map((r) => clean(r.recommended_action) || clean(r.recommended_seryn_action)),
  ], 8);

  // ---- executive summary ----
  const leader = [...comp].sort((a, b) => num(b.total_active_ads) - num(a.total_active_ads))[0];
  const riser = [...comp].sort((a, b) => num(b.new_ads_count) - num(a.new_ads_count))[0];
  const execParts = [
    `Tuần ${period_start} → ${period_end}: theo dõi ${totalBrands} đối thủ, ` +
      `${totalActiveAds.toLocaleString("vi-VN")} ad trẻ hóa da đang chạy ` +
      `(+${totalNewAds} mới, −${totalStoppedAds} dừng) trên ${totalPages} page.`,
  ];
  if (leader && num(leader.total_active_ads) > 0)
    execParts.push(`Khối lượng cao nhất: ${clean(leader.brand_name)} (${num(leader.total_active_ads)} ad).`);
  if (riser && num(riser.new_ads_count) > 0)
    execParts.push(`Tăng tốc mạnh nhất: ${clean(riser.brand_name)} (+${num(riser.new_ads_count)} ad mới).`);
  if (crawlRate) execParts.push(`Tỉ lệ crawl page thành công: ${crawlRate}.`);
  execParts.push("Đọc số liệu như tín hiệu ads công khai, không phải hiệu quả chuyển đổi.");
  const executiveSummary = execParts.join(" ");

  // ---- data quality note ----
  const dqParts = [];
  if (!snapshot.length) dqParts.push("Không có dữ liệu snapshot trong kỳ.");
  if (notes.length) dqParts.push(...notes);
  if (lastRun && num(lastRun.failed_pages) > 0) dqParts.push(`${num(lastRun.failed_pages)} page crawl lỗi trong kỳ.`);
  dqParts.push(DATA_DISCLAIMER);

  const row = {
    report_id: ctx.meta.reportId,
    report_type: "weekly",
    period_start, period_end,
    generated_at: ctx.meta.generatedAt,
    timezone: ctx.meta.timezone,
    title: `Báo cáo Spy Ads tuần ${period_start} → ${period_end}`,
    executive_summary: executiveSummary,
    total_brands_tracked: totalBrands,
    total_active_ads: totalActiveAds,
    total_new_ads: totalNewAds,
    total_stopped_ads: totalStoppedAds,
    total_pages_tracked: totalPages,
    crawl_success_rate: crawlRate,
    top_movers: topMovers,
    top_new_ads_brands: joinList(byNew, 5),
    top_stopped_ads_brands: joinList(byStopped, 5),
    top_services: topServices,
    top_offers: topOffers,
    top_content_angles: topAngles,
    top_ad_formats: topFormats,
    top_objectives: topObjectives,
    key_competitor_moves: keyMoves,
    notable_content_patterns: contentPatterns,
    notable_visual_patterns: visualPatterns,
    risk_warnings: riskWarnings,
    seryn_implications: serynImplications,
    recommended_actions: recommendedActions,
    source_week_dates: period_start,
    source_report_ids: "",
    data_quality_note: joinList(dqParts, 6, " "),
    created_by: ctx.meta.createdBy || "generate-weekly-report",
    seryn_benchmark: serynBenchmarkBlock(snapshot, ctx.ownNames),
  };
  return { row: viReportRow(row), notes };
}

/** Render report row -> markdown text (template PHẦN 10). Dùng cho file .md. */
export function renderReportMarkdown(row) {
  const list = (v) => {
    const items = String(v ?? "").split("|").map((s) => clean(s)).filter(Boolean);
    return items.length ? items.map((s) => `- ${s}`).join("\n") : "- (không có dữ liệu nổi bật)";
  };
  if (row.report_type === "monthly") {
    return [
      `BÁO CÁO TỔNG KẾT THÁNG ${String(row.period_start).slice(0, 7)}`,
      `(${row.period_start} → ${row.period_end}, generated ${row.generated_at}, TZ ${row.timezone})`,
      ``,
      `1. TÓM TẮT THÁNG\n${row.executive_summary}`,
      ``,
      `2. CHỈ SỐ CHÍNH`,
      `- Đối thủ theo dõi: ${row.total_brands_tracked}`,
      `- Ads active cuối tháng: ${row.total_active_ads}`,
      `- Ads mới trong tháng: ${row.total_new_ads}`,
      `- Ads dừng trong tháng: ${row.total_stopped_ads}`,
      `- Page theo dõi: ${row.total_pages_tracked}`,
      `- Tỉ lệ crawl thành công: ${row.crawl_success_rate || "n/a"}`,
      ``,
      `3. DIỄN BIẾN CHÍNH TRONG THÁNG\n${list(row.key_competitor_moves)}`,
      ``,
      `4. ĐỐI THỦ ĐÁNG CHÚ Ý\n${list(row.top_movers)}`,
      ``,
      `5. DỊCH VỤ / OFFER ĐƯỢC ĐẨY MẠNH\n- Dịch vụ: ${row.top_services || "n/a"}\n- Offer: ${row.top_offers || "n/a"}`,
      ``,
      `6. CONTENT PATTERN LẶP LẠI NHIỀU\n${list(row.notable_content_patterns)}`,
      ``,
      `7. FORMAT / FUNNEL NỔI BẬT\n- Format: ${row.top_ad_formats || "n/a"}\n- Objective/funnel: ${row.top_objectives || "n/a"}\n${list(row.notable_visual_patterns)}`,
      ``,
      `8. RỦI RO CLAIM / POLICY\n${list(row.risk_warnings)}`,
      ``,
      `9. KẾT LUẬN CHIẾN LƯỢC (HÀM Ý CHO SERYN)\n${list(row.seryn_implications)}`,
      ``,
      `10. KẾ HOẠCH HÀNH ĐỘNG THÁNG SAU\n${list(row.recommended_actions)}`,
      ``,
      `BENCHMARK SERYN VS THỊ TRƯỜNG TRONG THÁNG\n${list(row.seryn_benchmark)}`,
      ``,
      `Nguồn tổng hợp: ${row.source_week_dates || "—"}`,
      ``,
      `Lưu ý: ${DATA_DISCLAIMER}`,
    ].join("\n");
  }
  return [
    `BÁO CÁO SPY ADS TUẦN ${row.period_start} → ${row.period_end}`,
    `(generated ${row.generated_at}, TZ ${row.timezone})`,
    ``,
    `1. TÓM TẮT ĐIỀU HÀNH\n${row.executive_summary}`,
    ``,
    `2. CHỈ SỐ CHÍNH`,
    `- Đối thủ theo dõi: ${row.total_brands_tracked}`,
    `- Ads active: ${row.total_active_ads}`,
    `- Ads mới: ${row.total_new_ads}`,
    `- Ads dừng: ${row.total_stopped_ads}`,
    `- Page theo dõi: ${row.total_pages_tracked}`,
    `- Tỉ lệ crawl thành công: ${row.crawl_success_rate || "n/a"}`,
    ``,
    `3. BIẾN ĐỘNG ĐỐI THỦ\n- Movers: ${row.top_movers || "n/a"}\n- Tăng ad mới: ${row.top_new_ads_brands || "n/a"}\n- Giảm/dừng: ${row.top_stopped_ads_brands || "n/a"}\n${list(row.key_competitor_moves)}`,
    ``,
    `4. DỊCH VỤ / OFFER NỔI BẬT\n- Dịch vụ: ${row.top_services || "n/a"}\n- Offer: ${row.top_offers || "n/a"}`,
    ``,
    `5. CONTENT ANGLE NỔI BẬT\n- Angle: ${row.top_content_angles || "n/a"}\n${list(row.notable_content_patterns)}`,
    ``,
    `6. CREATIVE / FORMAT / FUNNEL\n- Format: ${row.top_ad_formats || "n/a"}\n- Objective: ${row.top_objectives || "n/a"}\n${list(row.notable_visual_patterns)}`,
    ``,
    `7. RỦI RO CLAIM\n${list(row.risk_warnings)}`,
    ``,
    `8. HÀM Ý CHO SERYN\n${list(row.seryn_implications)}`,
    ``,
    `9. HÀNH ĐỘNG ĐỀ XUẤT TUẦN TỚI\n${list(row.recommended_actions)}`,
    ``,
    `SERYN VS ĐỐI THỦ TRONG TUẦN\n${list(row.seryn_benchmark)}`,
    ``,
    `Lưu ý: ${DATA_DISCLAIMER}`,
  ].join("\n");
}

/* ============================================================
   MONTHLY
   ============================================================ */

/** Đếm số thứ Hai (tuần) có trong khoảng [start,end] — ước lượng số tuần kỳ vọng. */
function countMondays(start, end) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  let d = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  let n = 0;
  while (d <= last) {
    if (d.getUTCDay() === 1) n++;
    d = new Date(d.getTime() + 86400000);
  }
  return n;
}

/**
 * Dựng 1 dòng SpyReport (monthly) từ weekly reports trong tháng + raw data fallback.
 * @param {object} ctx
 *   ctx.weeklyReports — rows tab `Weekly Reports` thuộc tháng (đã lọc).
 *   ctx.tabs          — raw tabs fallback (snapshot/ads/scaled/changes/contentRecs...)
 *   ctx.period        — { period_start, period_end, month }
 *   ctx.meta          — { generatedAt, timezone, reportId, createdBy }
 * @returns {{ row: object, notes: string[] }}
 */
export function buildMonthlyReport(ctx) {
  const wr = ctx.weeklyReports || [];
  const t = ctx.tabs || {};
  const { period_start, period_end, month } = ctx.period;
  const notes = [];

  // Sắp xếp weekly reports theo period_start để lấy "cuối tháng".
  const wrSorted = [...wr].sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
  const lastWeekly = wrSorted[wrSorted.length - 1];

  // Loại own brand (SERYN) khỏi snapshot fallback — SERYN không tính là đối thủ.
  const notOwn = (name) => !isOwnName(name, ctx.ownNames);
  const snapshotMonth = (t.snapshot || [])
    .filter((r) => inRange(r.week_date, period_start, period_end) && notOwn(r.brand_name));

  // total brands: max theo tuần (watchlist ổn định) hoặc distinct snapshot (đã loại own).
  const totalBrands = Math.max(
    0,
    ...wr.map((r) => num(r.total_brands_tracked)),
    new Set(snapshotMonth.map((r) => clean(r.brand_name)).filter(Boolean)).size,
  );

  // ads active CUỐI THÁNG: weekly report cuối cùng; fallback snapshot tuần mới nhất.
  let totalActiveAds = lastWeekly ? num(lastWeekly.total_active_ads) : 0;
  if (!lastWeekly && snapshotMonth.length) {
    const weeks = [...new Set(snapshotMonth.map((r) => String(r.week_date).slice(0, 10)))].sort();
    const latest = weeks[weeks.length - 1];
    totalActiveAds = snapshotMonth.filter((r) => String(r.week_date).slice(0, 10) === latest)
      .reduce((a, r) => a + num(r.total_active_ads), 0);
  }

  // new/stopped: cộng dồn cả tháng từ weekly reports; fallback snapshot.
  let totalNewAds = wr.reduce((a, r) => a + num(r.total_new_ads), 0);
  let totalStoppedAds = wr.reduce((a, r) => a + num(r.total_stopped_ads), 0);
  if (!wr.length) {
    totalNewAds = snapshotMonth.reduce((a, r) => a + num(r.new_ads_count), 0);
    totalStoppedAds = snapshotMonth.reduce((a, r) => a + num(r.stopped_ads_count), 0);
  }
  const totalPages = Math.max(0, ...wr.map((r) => num(r.total_pages_tracked)),
    snapshotMonth.reduce((a, r) => a + num(r.num_pages_running), 0));

  // crawl rate: trung bình các tuần có số.
  const rates = wr.map((r) => num(String(r.crawl_success_rate).replace("%", ""))).filter((n) => n > 0);
  const crawlRate = rates.length ? `${Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)}%` : "";

  // top_*: gộp từ weekly reports; fallback raw nếu trống.
  const topFrom = (field, rawRows, rawField) => {
    const merged = mergeTopFields(wr.map((r) => r[field]));
    return merged || topToString(countChips(rawRows, rawField));
  };
  const topServices = topFrom("top_services", snapshotMonth, "services_running");
  const topOffers = topFrom("top_offers", snapshotMonth, "offers_detected");
  const topAngles = topFrom("top_content_angles", snapshotMonth, "main_angles");
  const topFormats = topFrom("top_ad_formats", snapshotMonth, "main_content_formats");
  const topObjectives = mergeTopFields(wr.map((r) => r.top_objectives)) ||
    topToString(countChips((t.ads || []).filter((r) => inRange(r.week_date, period_start, period_end)), "inferred_objective"));
  const topMovers = mergeTopFields(wr.map((r) => r.top_movers)) ||
    joinList(wr.map((r) => r.top_movers), 7);
  const topNew = mergeTopFields(wr.map((r) => r.top_new_ads_brands));
  const topStopped = mergeTopFields(wr.map((r) => r.top_stopped_ads_brands));

  // narrative: gộp unique từ weekly reports (mỗi field là chuỗi " | ").
  const collect = (field, limit) => joinList(
    wr.flatMap((r) => String(r[field] || "").split("|").map((s) => s.trim())),
    limit,
  );
  const keyMoves = collect("key_competitor_moves", 8);
  const contentPatterns = collect("notable_content_patterns", 8);
  const visualPatterns = collect("notable_visual_patterns", 6);
  const riskWarnings = collect("risk_warnings", 6) || "Chưa phát hiện rủi ro claim nổi bật trong tháng.";
  const serynImplications = collect("seryn_implications", 8);
  const recommendedActions = collect("recommended_actions", 10);

  const expectedWeeks = countMondays(period_start, period_end);
  const partial = wr.length < expectedWeeks;

  const execParts = [
    `Tháng ${month}: tổng hợp ${wr.length}/${expectedWeeks} báo cáo tuần. ` +
      `Theo dõi ${totalBrands} đối thủ; cuối tháng ghi nhận ${totalActiveAds.toLocaleString("vi-VN")} ad trẻ hóa da đang chạy ` +
      `(+${totalNewAds} mới, −${totalStoppedAds} dừng trong tháng).`,
  ];
  if (topMovers) execParts.push(`Đối thủ biến động đáng chú ý: ${topMovers.split("|")[0].trim()}.`);
  execParts.push("Số liệu phản ánh tín hiệu ads công khai, không phải hiệu quả chuyển đổi thực tế.");
  const executiveSummary = execParts.join(" ");

  const dqParts = [];
  if (partial) dqParts.push("Tháng này thiếu một số weekly reports, báo cáo được tổng hợp một phần từ dữ liệu hiện có.");
  if (!wr.length) dqParts.push("Không có weekly report nào trong tháng — tổng hợp trực tiếp từ dữ liệu pipeline.");
  dqParts.push(DATA_DISCLAIMER);

  const row = {
    report_id: ctx.meta.reportId,
    report_type: "monthly",
    period_start, period_end,
    generated_at: ctx.meta.generatedAt,
    timezone: ctx.meta.timezone,
    title: `Báo cáo tổng kết tháng ${month}`,
    executive_summary: executiveSummary,
    total_brands_tracked: totalBrands,
    total_active_ads: totalActiveAds,
    total_new_ads: totalNewAds,
    total_stopped_ads: totalStoppedAds,
    total_pages_tracked: totalPages,
    crawl_success_rate: crawlRate,
    top_movers: topMovers,
    top_new_ads_brands: topNew,
    top_stopped_ads_brands: topStopped,
    top_services: topServices,
    top_offers: topOffers,
    top_content_angles: topAngles,
    top_ad_formats: topFormats,
    top_objectives: topObjectives,
    key_competitor_moves: keyMoves,
    notable_content_patterns: contentPatterns,
    notable_visual_patterns: visualPatterns,
    risk_warnings: riskWarnings,
    seryn_implications: serynImplications,
    recommended_actions: recommendedActions,
    source_week_dates: joinList(wrSorted.map((r) => `${r.period_start}→${r.period_end}`), 6),
    source_report_ids: wrSorted.map((r) => r.report_id).filter(Boolean).join("|"),
    data_quality_note: joinList(dqParts, 5, " "),
    created_by: ctx.meta.createdBy || "generate-monthly-report",
    seryn_benchmark: serynBenchmarkBlock(snapshotMonth, ctx.ownNames),
  };
  return { row: viReportRow(row), notes };
}
