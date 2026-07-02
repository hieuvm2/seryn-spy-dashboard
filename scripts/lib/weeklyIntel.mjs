/* ============================================================
   SERYN Spy — Weekly Intelligence generator (server-side)
   ------------------------------------------------------------
   Tạo Weekly Intelligence Report cho team marketing dùng mỗi thứ Hai.

   KIẾN TRÚC (không phá pipeline cũ):
   - Nguồn dữ liệu = các tab pipeline weekly-spy đã ghi:
       "Ad Level Analysis"  (= Ads_Master + Content_Analysis)
       "Visual Analysis"    (= Visual_Analysis)
       "Crawl Runs" + "Page Crawl Logs" (= Crawl_Log)
       "Brand Weekly Snapshot", "Competitors", "Swipe File"
   - Đầu ra MỚI (không đụng tab cũ):
       "Weekly_Summary", "Action_Plan", "Swipe_File_Suggestions"
   - Exa KHÔNG liên quan ở đây (chỉ chạy thủ công).
   ============================================================ */
import crypto from "node:crypto";

const str = (v) => (v === undefined || v === null ? "" : String(v));
const lc = (v) => str(v).toLowerCase();
const num = (v) => { const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const isTrue = (v) => ["true", "1", "yes", "x", "có"].includes(lc(v).trim());
const isActive = (a) => lc(a.status) === "active" || lc(a.status) === "ok" || str(a.status) === "" ? lc(a.status) !== "inactive" && lc(a.status) !== "stopped" : true;

/* ---------- date / id ---------- */
export function getWeekRange(weekDateISO) {
  // weekDateISO = thứ Hai (ISO). week_end = +6 ngày (Chủ Nhật).
  const start = new Date((weekDateISO || new Date().toISOString().slice(0, 10)) + "T00:00:00Z");
  const day = start.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // về thứ Hai
  start.setUTCDate(start.getUTCDate() + diff);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  return { week_start: start.toISOString().slice(0, 10), week_end: end.toISOString().slice(0, 10) };
}
export function generateRunId(prefix, weekDate, seed = "") {
  const h = crypto.createHash("sha1").update(prefix + weekDate + seed + Date.now()).digest("hex").slice(0, 6);
  return `${prefix}-${weekDate}-${h}`;
}

/* ---------- normalize / dedupe / hash ---------- */
export function normalizeBrandName(name) {
  return lc(name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
}
export function normalizePageId(v) {
  const s = str(v).trim();
  return /^\d{6,}$/.test(s) ? s : "";
}
export function buildAdDedupeKey(ad) {
  const id = str(ad.ad_id).trim();
  if (id) return "id:" + id;
  // fallback signature: page_id + ad_text + landing + media
  const sig = [normalizePageId(ad.page_id), lc(ad.primary_text || ad.ad_text), lc(ad.landing_url || ""), lc(ad.media_url || "")].join("|");
  return "sig:" + crypto.createHash("sha1").update(sig).digest("hex").slice(0, 16);
}

/* ---------- safe JSON for sheet cells ---------- */
export function stringifySheetJsonField(value) {
  try { return JSON.stringify(value ?? null); } catch { return "null"; }
}
export function parseSheetJsonField(raw, fallback = null) {
  const s = str(raw).trim();
  if (!s) return fallback;
  try { const v = JSON.parse(s); return v; } catch { return fallback; }
}

/* ---------- aggregation helpers ---------- */
function topCounts(items, n = 5) {
  const m = new Map();
  for (const x of items) { const k = str(x).trim(); if (!k || k === "unknown" || k === "no_clear_offer") continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
}
function sampleBrands(ads, predicate, n = 3) {
  return [...new Set(ads.filter(predicate).map((a) => a.brand_name).filter(Boolean))].slice(0, n);
}

/* ============================================================
   DATA QUALITY
   ============================================================ */
export function calculateDataQualityScore({ crawlRun = {}, pageLogs = [], competitors = [], ads = [], provider = "" } = {}) {
  const warnings = [];
  let score = 100;

  const failedPages = num(crawlRun.failed_pages) || pageLogs.filter((p) => ["error", "failed"].includes(lc(p.status))).length;
  if (failedPages > 0) { const d = Math.min(40, failedPages * 8); score -= d; warnings.push(`${failedPages} page crawl thất bại (−${d}).`); }

  const activeCompetitors = competitors.filter((c) => isTrue(c.active) || lc(c.status) === "active" || str(c.active) === "");
  const missingPid = activeCompetitors.filter((c) => !normalizePageId(c.page_id) && !str(c.page_ids).split("|").some(normalizePageId)).map((c) => c.brand_name || c.brand).filter(Boolean);
  if (missingPid.length) { const d = Math.min(20, missingPid.length * 5); score -= d; warnings.push(`${missingPid.length} đối thủ active thiếu page_id (−${d}).`); }

  const total = ads.length || 1;
  const noText = ads.filter((a) => !str(a.primary_text || a.ad_text).trim() && !str(a.headline).trim()).length;
  if (noText / total > 0.5) { score -= 20; warnings.push(`>50% ad thiếu nội dung text (−20).`); }
  else if (noText / total > 0.2) { score -= 10; warnings.push(`>20% ad thiếu nội dung text (−10).`); }

  const noMedia = ads.filter((a) => !str(a.media_url).trim() && !str(a.thumbnail_url).trim()).length;
  if (noMedia / total > 0.5) { score -= 10; warnings.push(`>50% ad thiếu media/thumbnail (−10).`); }

  const carried = num(crawlRun.carried_forward_count);
  if (carried > 0) { const d = Math.min(20, 8 + Math.floor(carried / 10)); score -= d; warnings.push(`${carried} ad carried_forward (crawl lỗi, dùng lại dữ liệu cũ) (−${d}).`); }

  const isMock = lc(provider || crawlRun.provider) === "mock";
  if (isMock) { score -= 30; warnings.push(`Đang dùng MOCK provider — KHÔNG phải ads thật (−30).`); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    overall_data_quality_score: score,
    warnings,
    failed_pages: failedPages,
    missing_page_id_competitors: missingPid,
    carried_forward_count: carried,
    mock_provider: isMock,
  };
}

/* ============================================================
   WEEKLY SUMMARY
   ============================================================ */
export function generateWeeklySummary({ ads = [], snapshot = [], crawlRun = {}, competitors = [], newCompetitorsCount = 0, dataQuality, weekDate } = {}) {
  const { week_start, week_end } = getWeekRange(weekDate);
  const activeAds = ads.filter(isActive);
  const newAds = ads.filter((a) => isTrue(a.is_new_this_week));
  const scaledAds = ads.filter((a) => isTrue(a.is_likely_scaled));

  const byBrandActive = topCounts(activeAds.map((a) => a.brand_name), 5);
  const byBrandNew = topCounts(newAds.map((a) => a.brand_name), 5);
  const topHooks = topCounts(activeAds.map((a) => a.hook_type), 6);
  const topOffers = topCounts(activeAds.map((a) => a.offer_detected), 6);
  const topServices = topCounts(activeAds.map((a) => a.service_or_product), 6);
  const topFormats = topCounts(activeAds.map((a) => a.content_format), 6);

  const totalBrands = new Set(activeAds.map((a) => a.brand_name)).size || snapshot.length;
  const totalPages = num(crawlRun.total_pages) || new Set(activeAds.map((a) => a.page_id).filter(Boolean)).size;
  const dq = dataQuality || calculateDataQualityScore({ crawlRun, competitors, ads });

  const lead = byBrandActive[0];
  const surger = byBrandNew[0];
  const execBits = [
    `Tuần ${week_start} → ${week_end}: theo dõi ${totalBrands} brand, ${activeAds.length} ad active (${newAds.length} ad mới).`,
    lead ? `Dẫn đầu volume: ${lead.key} (${lead.count} ad).` : "",
    surger && surger.count >= 3 ? `Tăng tốc nhiều nhất: ${surger.key} (+${surger.count} ad mới).` : "",
    topHooks[0] ? `Hook phổ biến nhất: ${topHooks[0].key}.` : "",
    topOffers[0] ? `Offer nổi bật: ${topOffers[0].key}.` : "",
    dq.overall_data_quality_score < 70 ? `⚠ Chất lượng dữ liệu thấp (${dq.overall_data_quality_score}/100) — đọc số liệu thận trọng.` : `Chất lượng dữ liệu: ${dq.overall_data_quality_score}/100.`,
    activeAds.length < 5 ? "⚠ Ít dữ liệu tuần này — kết luận chỉ mang tính tham khảo." : "",
  ].filter(Boolean);

  return {
    week_start, week_end, generated_at: new Date().toISOString(),
    total_brands_tracked: totalBrands,
    total_pages_tracked: totalPages,
    total_ads_active: activeAds.length,
    total_new_ads: newAds.length,
    total_updated_ads: num(crawlRun.changed_ads_count),
    total_crawl_failed_pages: dq.failed_pages,
    top_brands_by_active_ads: stringifySheetJsonField(byBrandActive),
    top_brands_by_new_ads: stringifySheetJsonField(byBrandNew),
    top_hooks: stringifySheetJsonField(topHooks),
    top_offers: stringifySheetJsonField(topOffers),
    top_service_types: stringifySheetJsonField(topServices),
    top_creative_formats: stringifySheetJsonField(topFormats),
    scaled_ads_count: scaledAds.length,
    new_competitors_count: newCompetitorsCount,
    data_quality_score: dq.overall_data_quality_score,
    executive_summary: execBits.join(" "),
    // tiện cho action plan / dashboard (không bắt buộc lưu)
    _internal: { byBrandActive, byBrandNew, topHooks, topOffers, topServices, topFormats, dq, week_start, activeAds, newAds, scaledAds },
  };
}

/* ============================================================
   ACTION PLAN (rule-based)
   ============================================================ */
export function generateActionPlan({ summary, weekDate } = {}) {
  const I = summary?._internal;
  if (!I) return [];
  const { byBrandNew, topHooks, topOffers, topFormats, dq, week_start, activeAds } = I;
  const rows = [];
  const mk = (priority, insight_type, insight, evidence, suggested_action, related_brand = "", related_ad_ids = "") => ({
    action_id: generateRunId("act", week_start, insight_type + related_brand + insight.slice(0, 20)),
    week_start, priority, insight_type, insight, evidence, suggested_action,
    related_brand, related_ad_ids,
    owner: "", status: "new",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });

  // Rule 5 (data quality) FIRST nếu thấp -> high priority cảnh báo.
  if (dq.overall_data_quality_score < 70) {
    rows.push(mk("high", "data_quality_warning",
      `Chất lượng dữ liệu tuần này thấp (${dq.overall_data_quality_score}/100).`,
      dq.warnings.slice(0, 4).join(" "),
      "Sửa page crawl lỗi / bổ sung page_id trước khi tin kết luận tuần này."));
  }

  // Rule 1: brand tăng ads mạnh
  for (const b of byBrandNew) {
    if (b.count < 4) continue;
    const ids = activeAds.filter((a) => a.brand_name === b.key && isTrue(a.is_new_this_week)).map((a) => a.ad_id).filter(Boolean).slice(0, 8);
    rows.push(mk(b.count >= 10 ? "high" : "medium", "competitor_scaling",
      `${b.key} đang đẩy mạnh ad mới (+${b.count} ad tuần này).`,
      `${b.count} ad mới được phát hiện cho ${b.key}.`,
      "Review top new ads của brand này và tạo 3 creative phản đòn trong tuần.",
      b.key, ids.join("|")));
  }

  // Rule 2: hook lặp lại nhiều
  for (const h of topHooks.slice(0, 2)) {
    if (h.count < 5) continue;
    rows.push(mk(h.count >= 12 ? "high" : "medium", "hook_trend",
      `Hook "${h.key}" xuất hiện nhiều (${h.count} ad).`,
      `${h.count} ad dùng hook_type=${h.key}; brand mẫu: ${sampleBrands(activeAds, (a) => a.hook_type === h.key).join(", ")}.`,
      `Test góc hook "${h.key}" với offer/định vị của SERYN (giữ tông khoa học, không FOMO).`));
  }

  // Rule 3: offer phổ biến nhiều brand
  for (const o of topOffers.slice(0, 2)) {
    const brands = sampleBrands(activeAds, (a) => a.offer_detected === o.key, 5);
    if (brands.length < 2) continue;
    rows.push(mk("medium", "offer_trend",
      `Offer "${o.key}" xuất hiện ở nhiều brand (${brands.length}+).`,
      `Brand dùng offer này: ${brands.join(", ")}.`,
      "Tạo offer-variant hoặc counter-offer định hướng giá trị (đánh giá nền tảng sinh học) thay vì đua giá."));
  }

  // Rule 4: creative format trend
  const TREND_FORMATS = ["ugc_selfie", "before_after", "doctor_explainer", "doctor_expert", "customer_testimonial", "testimonial_screenshot"];
  for (const f of topFormats.slice(0, 3)) {
    if (f.count < 5 || !TREND_FORMATS.some((t) => lc(f.key).includes(t.split("_")[0]))) continue;
    rows.push(mk(f.count >= 12 ? "high" : "medium", "creative_format_trend",
      `Định dạng creative "${f.key}" đang nhiều (${f.count} ad).`,
      `${f.count} ad dùng format=${f.key}; brand mẫu: ${sampleBrands(activeAds, (a) => a.content_format === f.key).join(", ")}.`,
      `Sản xuất 3 creative dùng format "${f.key}" theo tông SERYN.`));
  }

  // giới hạn 15 action, ưu tiên high > medium > low
  const rank = { high: 0, medium: 1, low: 2 };
  return rows.sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)).slice(0, 15);
}

/* ============================================================
   SWIPE FILE CANDIDATES
   ============================================================ */
export function generateSwipeFileCandidates({ ads = [], visual = [], existingSwipe = [], summary, weekDate, max = 12 } = {}) {
  const { week_start } = getWeekRange(weekDate);
  const visualByAd = new Map(visual.map((v) => [str(v.ad_id), v]));
  const existingKeys = new Set(existingSwipe.map((s) => str(s.ad_id || s.hook).trim().toLowerCase()).filter(Boolean));
  const I = summary?._internal;
  const topBrands = new Set((I?.byBrandActive || []).slice(0, 4).map((b) => b.key));
  const hotHooks = new Set((I?.topHooks || []).filter((h) => h.count >= 5).map((h) => h.key));
  const hotOffers = new Set((I?.topOffers || []).filter((o) => o.count >= 3).map((o) => o.key));

  const scored = [];
  for (const a of ads.filter(isActive)) {
    const days = num(a.days_active);
    const v = visualByAd.get(str(a.ad_id));
    const reasons = [];
    let score = 0;
    if (days >= 14) { score += days >= 30 ? 3 : 2; reasons.push(`chạy ${days} ngày (bền)`); }
    if (isTrue(a.is_likely_scaled)) { score += 2; reasons.push("đang nhân rộng"); }
    if (hotHooks.has(a.hook_type)) { score += 1; reasons.push(`hook trend "${a.hook_type}"`); }
    if (hotOffers.has(a.offer_detected)) { score += 1; reasons.push(`offer phổ biến "${a.offer_detected}"`); }
    if (isTrue(a.is_new_this_week) && topBrands.has(a.brand_name)) { score += 2; reasons.push(`ad mới của top brand ${a.brand_name}`); }
    if (score < 3) continue;
    const key = str(a.ad_id || a.hook_text).trim().toLowerCase();
    if (!key || existingKeys.has(key)) continue;
    existingKeys.add(key);
    scored.push({
      swipe_id: generateRunId("sw", week_start, key),
      week_start, ad_id: str(a.ad_id), brand_name: a.brand_name,
      ad_url: a.ad_snapshot_url || a.ad_url || "", media_url: (v?.media_url) || a.media_url || "",
      thumbnail_url: (v?.thumbnail_url) || a.thumbnail_url || "",
      hook: a.hook_text || "", offer: a.offer_detected || "", angle: a.content_angle || "",
      format: a.content_format || (v?.visual_format) || "",
      why_save: reasons.join("; "),
      how_to_adapt: `Giữ cấu trúc, đổi sang tông SERYN: khoa học, calm, CTA "Đặt lịch phân tích gương mặt". Tránh FOMO/giảm giá sốc.`,
      status: "new", saved_at: new Date().toISOString(),
      _score: score,
    });
  }
  return scored.sort((a, b) => b._score - a._score).slice(0, max).map(({ _score, ...r }) => r);
}

/* ============================================================
   MARKDOWN REPORT
   ============================================================ */
export function generateMarkdownReport({ summary, actions = [], swipe = [], dataQuality } = {}) {
  const I = summary?._internal || {};
  const dq = dataQuality || I.dq || {};
  const list = (json) => (Array.isArray(json) ? json : parseSheetJsonField(json, []))
    .map((x) => `${x.key} (${x.count})`).join(", ") || "—";
  const moves = (I.byBrandActive || []).slice(0, 8).map((b) => {
    const newN = (I.byBrandNew || []).find((x) => x.key === b.key)?.count || 0;
    return `| ${b.key} | ${b.count} | ${newN} |`;
  }).join("\n");

  return [
    `# SERYN Weekly Spy Report`,
    ``,
    `**Week:** ${summary.week_start} → ${summary.week_end}  ·  generated ${summary.generated_at}`,
    ``,
    `## Executive Summary`,
    summary.executive_summary,
    ``,
    `## Data Quality`,
    `**Score:** ${summary.data_quality_score}/100`,
    dq.mock_provider ? `> ⚠ Đang dùng MOCK provider — KHÔNG phải ads thật.` : ``,
    ...(dq.warnings || []).map((w) => `- ${w}`),
    (dq.warnings || []).length ? `` : `- Không có cảnh báo đáng kể.`,
    ``,
    `## Top Competitor Moves`,
    `| Brand | Active ads | New ads |`,
    `|---|---|---|`,
    moves || `| — | 0 | 0 |`,
    ``,
    `## Top Hooks`,
    list(summary.top_hooks),
    ``,
    `## Top Offers`,
    list(summary.top_offers),
    ``,
    `## Creative Formats`,
    list(summary.top_creative_formats),
    ``,
    `## Action Plan`,
    ...(actions.length ? actions.map((a) => `- **[${a.priority}] ${a.insight_type}** — ${a.insight}\n  - ${a.suggested_action}`) : [`- Không có action nào tuần này.`]),
    ``,
    `## Swipe File Candidates`,
    ...(swipe.length ? swipe.map((s) => `- **${s.brand_name}** — ${s.hook || "(no hook)"} · ${s.why_save}${s.ad_url ? `\n  - ${s.ad_url}` : ""}`) : [`- Chưa có ad đáng lưu.`]),
    ``,
    `---`,
    `*Tách bạch facts (số liệu crawl) vs khuyến nghị. Không kết luận đối thủ tắt ad khi crawl lỗi (carried_forward). Directional, không phải audited.*`,
  ].filter((x) => x !== undefined).join("\n");
}
