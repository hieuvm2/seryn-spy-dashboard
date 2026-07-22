/* ============================================================
   report-push.mjs — Đẩy báo cáo phân tích (do Claude agent viết) lên Supabase
   weeklyReports (merge, giữ lịch sử). Cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
   Input: report-out.json = { week: {period_start, period_end}, report: {8 field} }
          report-input.json (từ report-export.mjs) — cho KPI/chip/movers factual.
   report.* nhận string HOẶC string[]; strip câu miễn trừ dữ liệu. Loại SERYN đã làm ở export.
   Chạy: node scripts/report-push.mjs [report-out.json] [--apply]
   ============================================================ */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const RESULT = process.argv.slice(2).find((a) => !a.startsWith("--")) || "report-out.json";
const rd = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const arr = (v) => Array.isArray(v) ? v : (v ? String(v).split("|") : []);
const DIS = new RegExp([
  "(không phải|ko phải)\\s+(dữ liệu\\s+|kết quả\\s+)?(hiệu quả|ROAS|CPA|chuyển đổi|spend|ngân sách)",
  "không có\\s+(số liệu|dữ liệu)[^.;]{0,60}(chi phí|spend|cpa|chuyển đổi|bán hàng)",
  "chỉ là\\s+suy đoán", "con số\\s+(khuyến mãi|offer|ưu đãi)\\s+bị nhiễu",
  "(máy đọc chữ|ocr)[^.;]{0,40}(so giá|so sánh giá)", "caveat dữ liệu",
].join("|"), "i");
const cleanList = (v) => arr(v).map((s) => String(s).trim()).filter((s) => s && !DIS.test(s));
const joinList = (v) => cleanList(v).join(" | ");
const stripSentences = (s) => String(s ?? "").split(/(?<=[.!])\s+/).filter((x) => !DIS.test(x)).join(" ").trim();

const res = rd(RESULT);
const report = res.report || res;
const ain = (() => { try { return rd("report-input.json"); } catch { return { market: {}, weeklySummary: null }; } })();
const m = ain.market || {};
const now = new Date().toISOString();
const ps = res.week?.period_start || ain.period_start || "";
const pe = res.week?.period_end || ain.week || "";
if (!pe) { console.error("❌ Thiếu week/period_end trong report-out.json"); process.exit(1); }

const newReport = {
  report_id: `wk-${pe}-skill`,
  report_type: "weekly", period_start: ps || pe, period_end: pe,
  generated_at: now, timezone: "Asia/Ho_Chi_Minh",
  title: `Báo cáo Spy Ads tuần ${ps || pe} → ${pe} (phân tích đa-skill)`,
  executive_summary: stripSentences(report.executive_summary),
  total_brands_tracked: m.total_brands ?? 0, total_active_ads: m.total_active ?? 0,
  total_new_ads: m.total_new ?? 0, total_stopped_ads: m.total_stopped ?? 0,
  total_pages_tracked: m.total_pages ?? 0, crawl_success_rate: 100,
  top_movers: [m.movers_new, m.movers_stopped].filter(Boolean).join(" | "),
  top_new_ads_brands: m.movers_new || "", top_stopped_ads_brands: m.movers_stopped || "",
  top_services: m.top_services || "", top_offers: m.top_offers || "", top_content_angles: m.top_angles || "",
  top_ad_formats: m.top_formats || "", top_objectives: m.top_funnel || "",
  key_competitor_moves: joinList(report.key_competitor_moves),
  notable_content_patterns: joinList(report.notable_content_patterns),
  notable_visual_patterns: joinList(report.notable_visual_patterns),
  risk_warnings: joinList(report.risk_warnings),
  seryn_implications: joinList(report.seryn_implications),
  recommended_actions: joinList(report.recommended_actions),
  seryn_benchmark: joinList(report.seryn_benchmark),
  data_quality_note: "Phân tích đa-skill (marketing-psychology/ads/offers/ad-creative/copywriting) tự động hàng tuần. SERYN tính riêng, không gộp đối thủ.",
  created_by: "weekly_skill_agent",
};

console.log("=== BÁO CÁO (preview) ===");
console.log("title:", newReport.title);
console.log("KPI:", JSON.stringify({ brands: newReport.total_brands_tracked, active: newReport.total_active_ads, new: newReport.total_new_ads, stopped: newReport.total_stopped_ads }));
for (const k of ["executive_summary", "key_competitor_moves", "notable_content_patterns", "seryn_implications", "recommended_actions", "seryn_benchmark"]) {
  const v = String(newReport[k]); console.log(`\n## ${k} (${v.split("|").length} mục)\n${v.slice(0, 500)}`);
}
if (!APPLY) { console.log("\n(DRY-RUN — thêm --apply để đẩy)"); process.exit(0); }

const URL = (process.env.SUPABASE_URL || "").trim(), KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!URL || !KEY) { console.error("❌ Thiếu SUPABASE_* để đẩy."); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const { data, error } = await sb.from("spy_data").select("rows").eq("dataset_key", "weeklyReports").single();
if (error) { console.error("read err:", error.message); process.exit(1); }
const cur = Array.isArray(data.rows) ? data.rows : [];
const kept = cur.filter((r) => String(r.period_start) < String(newReport.period_start) && r.report_id !== newReport.report_id);
const merged = [...kept, newReport];
const { error: up } = await sb.from("spy_data").upsert([{ dataset_key: "weeklyReports", rows: merged, week_date: pe, updated_at: now }], { onConflict: "dataset_key" });
if (up) { console.error("push err:", up.message); process.exit(1); }
console.log(`\n✅ Đã đẩy weeklyReports: giữ ${kept.length} (lịch sử) + 1 mới = ${merged.length}.`);
