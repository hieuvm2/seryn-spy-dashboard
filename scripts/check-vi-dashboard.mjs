/* ============================================================
   SERYN Spy — Quét tiếng Anh còn sót trong dữ liệu hiển thị (Supabase)
   Chạy: npm run vi:check
   Quét weeklyReports / weeklySummary / actionPlan; báo token tiếng Anh
   ngoài whitelist. Thấy leak -> bổ sung nhãn/cụm vào scripts/lib/viText.mjs
   (và src/utils/spyData.ts nếu là enum hiển thị) rồi chạy lại pipeline.
   ============================================================ */
import "dotenv/config";
import { findEnglishLeaks } from "./lib/viText.mjs";

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const get = async (key) => {
  const r = await fetch(`${URL}/rest/v1/spy_data?dataset_key=eq.${key}&select=rows`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "User-Agent": "node" },
  });
  return (await r.json())[0]?.rows || [];
};

const SKIP = /^(report_id|report_type|period_|generated|timezone|created_|source_|total_|crawl_|week_|action_id|owner|status|updated_|insight_type|priority|related_ad_ids|title)/;
for (const [ds, fields] of [
  ["weeklyReports", null],
  ["weeklySummary", ["executive_summary"]],
  ["actionPlan", ["insight", "evidence", "suggested_action"]],
]) {
  const rows = await get(ds);
  const leaks = new Map();
  for (const row of rows) {
    const keys = fields || Object.keys(row).filter((k) => !SKIP.test(k));
    for (const k of keys) {
      for (const w of findEnglishLeaks(row[k])) {
        if (!leaks.has(w)) leaks.set(w, `${ds}.${k}`);
      }
    }
  }
  console.log(`${ds}: ${rows.length} dòng — ${leaks.size ? "LEAK: " + [...leaks.entries()].map(([w, at]) => `${w} (${at})`).join(", ") : "sạch ✓"}`);
}
