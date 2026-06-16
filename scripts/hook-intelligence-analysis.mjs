/* ============================================================
   SERYN Spy — Hook Intelligence & Ad Content Generator
   ------------------------------------------------------------
   Chạy:  npm run hooks:analyze

   Đọc Ad Level Analysis (trẻ hóa da) -> phân tích hook sâu (heuristic)
   -> cụm hook pattern -> chấm scale_signal / confidence / risk
   -> sinh content chạy ads (an toàn claim, KHÔNG copy nguyên văn đối thủ).

   Ghi (gộp tab, không tạo nhiều tab mới):
     - Hook Intelligence            (cụm hook pattern)
     - SERYN Content Recommendations (content chạy ads, source=hook_intelligence)
     - Weekly Change Insights        (hook_pattern_scaled / new_hook_pattern_detected / ...)
     - Crawl Runs                    (run_type=hook_intelligence)

   Thuật ngữ: scaling signal / repeated hook pattern / persistence signal /
   competitor hook signal / content opportunity. KHÔNG gọi "winning hook".
   ============================================================ */
import "dotenv/config";
import { getSheetsClient, readTab, writeTab, appendTab } from "./lib/sheets.mjs";
import { TAB, HEADERS, RUN_TYPE, SERVICE_CATEGORY } from "./lib/schemas.mjs";
import {
  analyzeHook, claimSafe, scaleSignal, generateAdContent, SCALE_SIGNAL,
} from "./lib/hookAnalysis.mjs";
import { currentMondayISO, nowISO, runId } from "./lib/runConfig.mjs";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const lc = (s) => String(s || "").toLowerCase();
const SKIN_RE = /trẻ hóa|căng bóng|tái tạo da|laser trẻ|skin booster|nâng cơ|hifu|\brf\b|thermage|ultherapy|exosome|collagen|mesotherapy|chảy xệ|lão hóa|nếp nhăn|kém đàn hồi|xỉn màu|da chùng/i;

/** Ad thuộc trẻ hóa da? (ưu tiên service_category; fallback theo text). */
function isSkinRejuvenation(a) {
  if (a.service_category) return a.service_category === SERVICE_CATEGORY;
  const t = `${a.service_or_product} ${a.hook_text} ${a.headline} ${a.primary_text}`;
  if (a.service_or_product === "facial_rejuvenation" || a.service_or_product === "lifting_firming" || a.service_or_product === "collagen_stimulation") return true;
  return SKIN_RE.test(t);
}

/** Fallback ad_format nếu chưa có (ad cũ chưa qua weekly mới). */
function fmtOf(a) {
  if (a.ad_format && a.ad_format !== "unknown") return a.ad_format;
  const m = lc(a.media_type);
  if (/video|reel/.test(m)) return "video";
  if (/carousel|album/.test(m)) return "carousel";
  if (/image|photo|img/.test(m)) return "image";
  return "unknown";
}
/** Fallback inferred_objective nếu chưa có. */
function objOf(a) {
  if (a.inferred_objective && a.inferred_objective !== "unknown") return a.inferred_objective;
  const c = lc(a.cta);
  if (/message|nhắn|inbox|chat/.test(c)) return "messenger";
  if (/call|gọi/.test(c)) return "phone_call";
  if (/sign up|đăng ký/.test(c)) return "lead_form";
  if (/learn more|tìm hiểu|xem/.test(c)) return "website_traffic";
  return "unknown";
}
const mode = (arr) => {
  const m = {}; for (const x of arr) { if (!x) continue; m[x] = (m[x] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
};

async function main() {
  console.log("\nSERYN Hook Intelligence — service_category=skin_rejuvenation");
  const weekDate = currentMondayISO();
  const run_id = runId("hook", weekDate);
  const started_at = nowISO();

  let ctx;
  try { ctx = await getSheetsClient(); }
  catch (e) { console.error("[X] " + (e?.message || e)); process.exit(1); }
  const { sheets, titles } = ctx;

  const ads = (await readTab(sheets, TAB.adLevel)).filter(isSkinRejuvenation);
  if (!ads.length) { console.log("[SKIP] Không có ad trẻ hóa da trong Ad Level Analysis."); process.exit(0); }
  console.log(`Ads trẻ hóa da: ${ads.length}`);

  // ---- phân tích hook cho từng ad (recompute để chạy được cả trên data cũ) ----
  const enriched = ads.map((a) => {
    const hk = analyzeHook(a);
    return {
      ad_id: a.ad_id || "", brand: a.brand_name || a.brand || "",
      raw: hk.hook_raw_text, ...hk,
      ad_format: fmtOf(a), inferred_objective: objOf(a),
      days: num(a.days_active),
    };
  }).filter((x) => x.raw && x.raw.length >= 4);

  // ---- cluster theo (category|formula|subcategory|offer) ----
  const groups = new Map();
  for (const e of enriched) {
    const key = `${e.hook_category}|${e.hook_formula}|${e.hook_subcategory}|${e.hook_offer_linked === "TRUE" ? "offer" : "no_offer"}`;
    (groups.get(key) || groups.set(key, []).get(key)).push(e);
  }

  const clusterRows = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue; // cần ít nhất 2 ad để gọi là pattern
    const [cat, formula, sub, offerTag] = key.split("|");
    const brands = [...new Set(list.map((x) => x.brand).filter(Boolean))];
    const daysVals = list.map((x) => x.days).filter((d) => d > 0);
    const hasDays = daysVals.length > 0;
    const avgDays = hasDays ? Math.round(daysVals.reduce((s, d) => s + d, 0) / daysVals.length) : 0;
    const signal = scaleSignal({ adsCount: list.length, brandsUsing: brands.length, avgActiveDays: avgDays, hasDays });
    const pain = mode(list.map((x) => x.hook_pain_point).filter((p) => p && p !== "unknown")) || "dấu hiệu lão hóa da";
    const desire = mode(list.map((x) => x.hook_desired_outcome).filter((d) => d && d !== "unknown")) || "da trẻ trung, căng bóng";
    const angle = mode(list.map((x) => x.hook_angle));
    const avgStrength = Math.round(list.reduce((s, x) => s + num(x.hook_strength_score), 0) / list.length);
    const avgRisk = Math.round(list.reduce((s, x) => s + num(x.hook_risk_score), 0) / list.length);
    const maxRisk = Math.max(...list.map((x) => num(x.hook_risk_score)));
    const risk = Math.round(0.5 * avgRisk + 0.5 * maxRisk);
    const avgConfRaw = list.reduce((s, x) => s + num(x.hook_confidence_score), 0) / list.length;
    const confidence = Math.round((hasDays ? avgConfRaw : avgConfRaw * 0.7) * 100) / 100;
    const topOfferLinked = mode(list.map((x) => x.hook_offer_linked));
    const topProof = mode(list.map((x) => x.hook_proof_type));
    const topFmt = mode(list.map((x) => x.ad_format));
    const topObj = mode(list.map((x) => x.inferred_objective));
    const exampleAds = list.slice(0, 5).map((x) => x.ad_id).filter(Boolean).join("|");
    const exampleHooks = [...new Set(list.map((x) => x.raw))].slice(0, 3).join(" || ");

    const action = recommendAction({ signal, risk, angle, cat, confidence });
    const needsReview =
      (avgStrength >= 70 && confidence < 0.5) || risk >= 60 ||
      (cat === "unknown" && list.length >= 4) ||
      (["early_signal", "repeated_signal"].includes(signal) && brands.length >= 2 && confidence < 0.5);

    const cid = `hc-${weekDate}-${slug(`${cat}-${formula}-${sub}-${offerTag}`)}`.slice(0, 64);
    const insight = buildInsight({ signal, ads: list.length, brands: brands.length, cat, formula, pain, avgDays, hasDays, risk });

    clusterRows.push({
      hook_cluster_id: cid, week_date: weekDate, service_category: SERVICE_CATEGORY,
      cluster_name: clusterName(cat, sub, pain), hook_pattern: `${cat} + ${formula} + ${sub}${offerTag === "offer" ? " + offer" : ""}`,
      hook_category: cat, hook_subcategory: sub, hook_formula: formula, hook_angle: angle,
      pain_point: pain, desired_outcome: desire, offer_linked: topOfferLinked, proof_type: topProof,
      ads_count: list.length, brands_using: brands.join("|"), example_ads: exampleAds, example_hooks: exampleHooks,
      avg_active_days: hasDays ? avgDays : "unknown",
      top_offer_linked: topOfferLinked, top_proof_type: topProof, top_ad_format: topFmt, top_inferred_objective: topObj,
      scale_signal: signal, confidence_score: confidence, risk_score: risk, hook_strength_score: avgStrength,
      insight, recommended_seryn_action: action, needs_claude_hook_review: needsReview ? "TRUE" : "FALSE",
      created_at: nowISO(),
    });
  }

  // sort: persistence signal desc, ads desc, strength desc
  const sigRank = (s) => SCALE_SIGNAL.indexOf(s);
  clusterRows.sort((a, b) => (sigRank(b.scale_signal) - sigRank(a.scale_signal)) || (b.ads_count - a.ads_count) || (b.hook_strength_score - a.hook_strength_score));

  console.log(`Clusters: ${clusterRows.length}`);
  await writeTab(sheets, titles, TAB.hookIntelligence, HEADERS.hookIntelligence, clusterRows);

  // ---- content cho cluster ưu tiên (an toàn + đủ tín hiệu) ----
  const priority = clusterRows.filter((c) =>
    c.recommended_seryn_action !== "avoid_due_to_risk" &&
    ["repeated_signal", "strong_persistence_signal", "evergreen_persistence_signal"].includes(c.scale_signal),
  ).slice(0, 12);

  const recRows = priority.map((c) => {
    const content = generateAdContent(c);
    const safe = claimSafe(c.example_hooks);
    return {
      week_date: weekDate, source: RUN_TYPE.hookIntel, service_category: SERVICE_CATEGORY,
      recommendation_type: "hook_content_opportunity",
      market_signal: c.insight, competitor_evidence: `competitor hook signal: ${c.example_hooks}`,
      seryn_content_niche: "Trẻ hóa da từ nền tảng sinh học", insight: c.insight,
      suggested_content_format: c.top_ad_format, suggested_hook: content.headline_options.split(" | ")[0],
      suggested_content_angle: c.hook_angle, suggested_offer_angle: "Đặt lịch soi da / đánh giá nền tảng sinh học (không FOMO)",
      content_style: "scientific_calm_premium", main_message: content.ad_copy_short,
      proof_to_use: c.proof_type, cta: "Đặt lịch soi da", kpi: "qualified_booking",
      priority: c.scale_signal.includes("persistence") ? "High" : "Medium",
      confidence_score: c.confidence_score, source_urls: "",
      // hook content
      recommendation_id: `rec-${c.hook_cluster_id}`, source_hook_cluster_id: c.hook_cluster_id,
      source_brands: c.brands_using, hook_pattern: c.hook_pattern, competitor_signal: c.scale_signal,
      recommended_seryn_action: c.recommended_seryn_action, content_angle: c.hook_angle,
      target_audience: "phụ nữ quan tâm trẻ hóa da (U30–U45)", pain_point: c.pain_point, desired_outcome: c.desired_outcome,
      proof_needed: c.proof_type, offer_suggestion: "Soi da / đánh giá nền tảng sinh học (không đua giá)",
      risk_note: c.risk_score >= 30 ? "Có cụm hook rủi ro claim — dùng claim_safe_version." : "Rủi ro claim thấp.",
      claim_risk_level: safe.claim_risk_level, claim_safe_version: safe.claim_safe_version, avoid_phrases: safe.avoid_phrases,
      ad_copy_short: content.ad_copy_short, ad_copy_medium: content.ad_copy_medium, ad_copy_long: content.ad_copy_long,
      headline_options: content.headline_options, primary_text_options: content.primary_text_options, cta_options: content.cta_options,
      visual_direction: content.visual_direction, video_opening_3s: content.video_opening_3s,
      messenger_script_angle: content.messenger_script_angle, landing_page_angle: content.landing_page_angle,
      needs_claude_hook_review: c.needs_claude_hook_review,
    };
  });

  // merge an toàn: giữ row khác source, thay row hook_intelligence của tuần này
  const existingRecs = await readTab(sheets, TAB.contentRecs);
  const newRecKeys = new Set(recRows.map((r) => r.recommendation_id));
  const keptRecs = existingRecs.filter((r) => !(String(r.source) === RUN_TYPE.hookIntel && newRecKeys.has(r.recommendation_id)));
  await writeTab(sheets, titles, TAB.contentRecs, HEADERS.contentRecs, [...keptRecs, ...recRows]);

  // ---- Weekly Change Insights (hook) ----
  const insightRows = buildHookChangeInsights(clusterRows, weekDate);
  if (insightRows.length) await appendTab(sheets, titles, TAB.changeInsights, HEADERS_CHANGE, insightRows);

  // ---- Crawl Runs log ----
  await appendTab(sheets, titles, TAB.crawlRuns, HEADERS.crawlRuns, [{
    crawl_run_id: run_id, run_id, run_type: RUN_TYPE.hookIntel, started_at, finished_at: nowISO(),
    week_date: weekDate, provider: "heuristic", service_category: SERVICE_CATEGORY,
    total_ads_fetched: ads.length, candidates_found: clusterRows.length,
    new_items_count: recRows.length, changed_items_count: insightRows.length,
    failed_items_count: clusterRows.filter((c) => c.needs_claude_hook_review === "TRUE").length,
    status: "ok", error_summary: "", cost_guard_status: "ok",
  }]);

  const needReview = clusterRows.filter((c) => c.needs_claude_hook_review === "TRUE").length;
  console.log(`\n[DONE] ${run_id} — clusters=${clusterRows.length} content_recs=${recRows.length} change_insights=${insightRows.length} needs_claude_review=${needReview}`);
  if (needReview) console.log(`→ ${needReview} cluster cần Claude review (xem docs/claude-hook-review-prompt.md).`);
}

/* Header Weekly Change Insights (khớp weekly-spy-sync). */
const HEADERS_CHANGE = "id,brand,week_start,previous_week_start,change_type,severity,confidence_score,summary,evidence,affected_ads,previous_value,current_value,recommended_action".split(",");

function recommendAction({ signal, risk, angle, cat, confidence }) {
  if (risk >= 60) return "avoid_due_to_risk";
  if (["strong_persistence_signal", "evergreen_persistence_signal"].includes(signal) && (angle === "offer_led" || cat === "offer_promotion" || cat === "fear_loss_aversion")) return "counter_positioning";
  if (["medical_trust", "education_led", "technology_based", "expert_consultation", "problem_diagnosis"].includes(angle)) return "adapt_angle";
  if (["strong_persistence_signal", "evergreen_persistence_signal"].includes(signal) && confidence >= 0.5) return "copy_structure";
  if (["none", "early_signal"].includes(signal)) return "monitor";
  return "test_now";
}

function buildInsight({ signal, ads, brands, cat, formula, pain, avgDays, hasDays, risk }) {
  const persist = hasDays ? ` · avg active ${avgDays} ngày` : " · thiếu active_days (confidence thấp)";
  const riskNote = risk >= 60 ? " · risky hook (claim mạnh) -> cân nhắc avoid" : risk >= 30 ? " · có rủi ro claim -> dùng bản an toàn" : "";
  return `${signal}: ${ads} ad / ${brands} brand dùng hook ${cat}/${formula} quanh "${pain}"${persist}${riskNote}. Đây là competitor hook signal, không phải winning hook.`;
}

function clusterName(cat, sub, pain) {
  const subTxt = sub && sub !== "unknown" ? sub : pain;
  return `skin_rejuvenation · ${cat} · ${subTxt}`;
}

function buildHookChangeInsights(clusters, weekDate) {
  const rows = [];
  let n = 0;
  const push = (change_type, severity, c, summary) => {
    rows.push({
      id: `hk-${weekDate}-${change_type}-${++n}`, brand: (c.brands_using || "").split("|")[0] || "multi",
      week_start: weekDate, previous_week_start: "", change_type, severity,
      confidence_score: c.confidence_score, summary,
      evidence: c.insight, affected_ads: c.example_ads, previous_value: "", current_value: c.scale_signal,
      recommended_action: mapAction(c.recommended_seryn_action),
    });
  };
  for (const c of clusters) {
    if (["strong_persistence_signal", "evergreen_persistence_signal"].includes(c.scale_signal))
      push("hook_pattern_scaled", "medium", c, `Hook pattern "${c.hook_pattern}" đang có persistence signal (${c.ads_count} ad).`);
    else if (c.scale_signal === "repeated_signal" && (c.brands_using || "").split("|").length >= 2)
      push("new_hook_pattern_detected", "low", c, `Repeated hook pattern "${c.hook_pattern}" xuất hiện ở nhiều brand.`);
    if (Number(c.risk_score) >= 60)
      push("risky_hook_detected", "high", c, `Hook pattern "${c.hook_pattern}" có claim risk cao — SERYN nên tránh.`);
    if (c.recommended_seryn_action === "adapt_angle" || c.recommended_seryn_action === "copy_structure")
      push("seryn_content_opportunity", "medium", c, `Content opportunity: pattern "${c.hook_pattern}" phù hợp để SERYN ${c.recommended_seryn_action}.`);
  }
  return rows.slice(0, 40);
}
function mapAction(a) {
  return ({ avoid_due_to_risk: "ignore", counter_positioning: "counter", adapt_angle: "adapt", copy_structure: "copy", test_now: "adapt", monitor: "monitor" })[a] || "monitor";
}
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

main().catch((e) => { console.error("\n[X] " + (e?.stack || e?.message || e)); process.exit(1); });
