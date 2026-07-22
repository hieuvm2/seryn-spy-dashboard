/* ============================================================
   report-export.mjs — Xuất dữ liệu spy ads mới nhất (từ Supabase) thành
   report-input.json để Claude agent phân tích (weekly skill report).
   Đọc-only, cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
   Loại own brand (SERYN) khỏi mọi thống kê ĐỐI THỦ; SERYN để riêng (self-audit).
   Chạy: node scripts/report-export.mjs [outfile]
   ============================================================ */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const URL = (process.env.SUPABASE_URL || "").trim();
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!URL || !KEY) { console.error("❌ Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const OUT = process.argv[2] || "report-input.json";
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const BAD = /^(no_clear_offer|unknown|none|n\/a|)$/i;
const isOwn = (name, type) => String(type).toLowerCase() === "own" || /seryn/i.test(String(name || ""));

async function ds(key) {
  const { data, error } = await sb.from("spy_data").select("rows, week_date").eq("dataset_key", key).single();
  if (error) return { rows: [], week_date: "" };
  return { rows: Array.isArray(data.rows) ? data.rows : [], week_date: data.week_date || "" };
}

const snapDS = await ds("brandWeeklySnapshot");
const week = snapDS.week_date || snapDS.rows[0]?.week_date || "";
const ad = (await ds("adLevelAnalysis")).rows;
const scaled = (await ds("scaledContentAnalysis")).rows;
const hookIntel = (await ds("hookIntelligence")).rows;
const vis = (await ds("visualPatternAnalysis")).rows;
const bvis = (await ds("brandVisualSummary")).rows;
const wsum = (await ds("weeklySummary")).rows;

const tally = (arr, key, clean = false) => {
  const m = new Map();
  for (const a of arr) { let v = String(a[key] ?? "").trim(); if (!v || (clean && BAD.test(v))) continue; m.set(v, (m.get(v) || 0) + 1); }
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
};
const fmt = (pairs, n = 8) => pairs.slice(0, n).map(([k, c]) => `${k} (${c})`).join(" | ");

const byBrand = new Map();
for (const a of ad) { const b = a.brand_name || "?"; (byBrand.get(b) || byBrand.set(b, []).get(b)).push(a); }
const snapOf = (b) => snapDS.rows.find((s) => s.brand_name === b) || {};

function profile(b, ads) {
  const s = snapOf(b);
  const hooks = new Map();
  for (const a of ads) {
    const k = clip(a.hook_normalized || a.hook_text || a.headline, 80).toLowerCase(); if (!k) continue;
    const cur = hooks.get(k) || { hook: clip(a.headline || a.hook_text, 170), days: 0, ads: 0, angle: a.content_angle, proof: a.proof_point, offer: a.offer_detected, isNew: false };
    cur.ads++; cur.days = Math.max(cur.days, num(a.days_active)); if (String(a.is_new_this_week) === "true") cur.isNew = true;
    hooks.set(k, cur);
  }
  const topHooks = [...hooks.values()].sort((x, y) => (y.ads - x.ads) || (y.days - x.days)).slice(0, 7)
    .map((h) => ({ hook: h.hook, ads: h.ads, days: h.days, angle: h.angle, proof: h.proof, offer: BAD.test(String(h.offer)) ? "" : h.offer, isNew: h.isNew }));
  return {
    brand: b, brand_type: ads[0]?.brand_type || s.brand_type || "competitor",
    active: num(s.total_active_ads) || ads.length, moi: num(s.new_ads_count), dung: num(s.stopped_ads_count), pages: num(s.num_pages_running),
    services: s.services_running || fmt(tally(ads, "service_category")),
    angles: fmt(tally(ads, "content_angle", true), 5), offers: fmt(tally(ads, "offer_detected", true), 6),
    proofs: fmt(tally(ads, "proof_point", true), 5), formats: fmt(tally(ads, "content_format", true), 5), funnel: fmt(tally(ads, "funnel_stage", true), 4),
    topHooks,
  };
}

const profiles = [...byBrand.entries()].map(([b, ads]) => profile(b, ads));
const competitors = profiles.filter((p) => !isOwn(p.brand, p.brand_type)).sort((a, b) => b.active - a.active);
const seryn = profiles.find((p) => isOwn(p.brand, p.brand_type)) || null;
const compAds = ad.filter((a) => !isOwn(a.brand_name, a.brand_type));

const market = {
  total_brands: competitors.length,
  total_active: competitors.reduce((s, p) => s + p.active, 0),
  total_new: competitors.reduce((s, p) => s + p.moi, 0),
  total_stopped: competitors.reduce((s, p) => s + p.dung, 0),
  total_pages: competitors.reduce((s, p) => s + p.pages, 0),
  top_services: fmt(tally(compAds, "service_category")),
  top_angles: fmt(tally(compAds, "content_angle", true)),
  top_offers: fmt(tally(compAds, "offer_detected", true)),
  top_proofs: fmt(tally(compAds, "proof_point", true)),
  top_formats: fmt(tally(compAds, "content_format", true)),
  top_funnel: fmt(tally(compAds, "funnel_stage", true)),
  movers_new: competitors.filter((p) => p.moi > 0).sort((a, b) => b.moi - a.moi).slice(0, 8).map((p) => `${p.brand} (${p.moi} mới)`).join(" | "),
  movers_stopped: competitors.filter((p) => p.dung > 0).sort((a, b) => b.dung - a.dung).slice(0, 8).map((p) => `${p.brand} (${p.dung} dừng)`).join(" | "),
};

const serynAds = seryn ? (byBrand.get(seryn.brand) || []).map((a) => ({
  hook: clip(a.headline || a.hook_text, 200), angle: a.content_angle, hookAngle: a.hook_angle,
  offer: BAD.test(String(a.offer_detected)) ? "" : a.offer_detected, proof: a.proof_point, format: a.content_format,
  funnel: a.funnel_stage, cta: a.cta, days: num(a.days_active), isNew: String(a.is_new_this_week) === "true",
})).sort((x, y) => y.days - x.days).slice(0, 22) : [];
const visRate = (r) => Math.round(num(r) * 100);
const serynVisual = (() => { const r = bvis.find((v) => isOwn(v.brand)); return r ? { doctor: visRate(r.doctor_rate), ugc: visRate(r.ugc_rate), before_after: visRate(r.before_after_rate), offer_banner: visRate(r.offer_banner_rate), luxury: num(r.avg_luxury_score), clinical: num(r.avg_clinical_score), formats: r.top_visual_formats, creatives: num(r.total_creatives) } : null; })();
const marketVisual = (() => { const c = bvis.filter((v) => !isOwn(v.brand)); const avg = (k) => c.length ? Math.round(c.reduce((s, v) => s + num(v[k]), 0) / c.length) : 0; return { luxury_avg: avg("avg_luxury_score"), clinical_avg: avg("avg_clinical_score"), offer_banner_pct: Math.round(c.reduce((s, v) => s + num(v.offer_banner_rate), 0) / (c.length || 1) * 100), before_after_pct: Math.round(c.reduce((s, v) => s + num(v.before_after_rate), 0) / (c.length || 1) * 100) }; })();

const scaledTop = scaled.filter((s) => !isOwn(s.brand_name)).map((s) => ({
  brand: s.brand_name, hook: clip(s.representative_hook, 150), ads: num(s.number_of_similar_ads || s.scale_level),
  days: num(s.longest_days_active || s.average_days_active), angle: s.content_angle, proof: s.proof_point,
  offer: BAD.test(String(s.offer_detected)) ? "" : s.offer_detected, why: clip(s.why_it_is_scaling, 120), seryn_action: s.seryn_should_copy_adapt_counter_avoid,
})).filter((s) => s.hook).sort((a, b) => (b.ads - a.ads) || (b.days - a.days)).slice(0, 15);

const hookClusters = hookIntel.map((h) => ({
  cluster: h.cluster_name, angle: h.hook_angle, pain: h.pain_point, proof: h.top_proof_type || h.proof_type,
  ads: num(h.ads_count), days: num(h.avg_active_days), brands: h.brands_using, pattern: clip(h.hook_pattern || h.hook_formula, 90),
  example: clip((String(h.example_hooks || "").split("|")[0]) || "", 150), objective: h.top_inferred_objective, recAction: h.recommended_seryn_action,
})).filter((h) => h.cluster && h.ads > 0).sort((a, b) => (b.ads - a.ads) || (b.days - a.days)).slice(0, 16);

const visualTop = vis.filter((v) => String(v.is_signal) === "true" && !isOwn(v.brand)).map((v) => ({ brand: v.brand, summary: clip(v.summary, 130), ads: num(v.ad_count), angle: v.visual_angle, format: v.visual_format, rec: v.recommended_seryn_response })).sort((a, b) => b.ads - a.ads).slice(0, 12);

const out = { week, market, seryn: seryn ? { ...seryn, ads_detail: serynAds, visual: serynVisual } : null, marketVisual, competitors, scaledContent: scaledTop, hookClusters, visualPatterns: visualTop, weeklySummary: wsum[0] || null };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`✅ ${OUT} — tuần ${week}: ${competitors.length} đối thủ, ${market.total_active} ad active (+${market.total_new}/-${market.total_stopped}); SERYN ${seryn ? seryn.active + " ad" : "n/a"}; ${scaledTop.length} scaled, ${hookClusters.length} hook cluster, ${visualTop.length} visual.`);
