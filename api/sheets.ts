/* ============================================================
   Vercel Serverless Function — proxy đọc Google Sheets.
   KHÔNG nhúng service account JSON / secret vào frontend.
   Cấu hình bằng Environment Variables trên Vercel (server-side):

   Cách A — Google Sheet public (gviz CSV, không cần key):
     GSHEET_ID = <spreadsheet id>      (Sheet share "Anyone with link: Viewer")
     (tùy chọn) GTAB_SNAPSHOT / GTAB_ADS / GTAB_SCALED / GTAB_CHANGES / GTAB_RECS
                để ghi đè tên tab nếu khác mặc định.

   Cách B — Google Apps Script Web App trả JSON:
     APPS_SCRIPT_URL = https://script.google.com/macros/s/XXX/exec
     (nếu set APPS_SCRIPT_URL thì ưu tiên dùng cách này)

   Trả về: { ok, source, csv?: {key: "<csv text>"}, errors? }  hoặc JSON Apps Script.
   ============================================================ */

type AnyReq = any;
type AnyRes = any;

const TAB_DEFAULTS: Record<string, string> = {
  brand_weekly_snapshot: "Brand Weekly Snapshot",
  ad_level_analysis: "Ad Level Analysis",
  scaled_content_analysis: "Scaled Content Analysis",
  weekly_strategy_change: "Weekly Strategy Change",
  seryn_content_recommendations: "SERYN Content Recommendations",
};
const TAB_ENV: Record<string, string> = {
  brand_weekly_snapshot: "GTAB_SNAPSHOT",
  ad_level_analysis: "GTAB_ADS",
  scaled_content_analysis: "GTAB_SCALED",
  weekly_strategy_change: "GTAB_CHANGES",
  seryn_content_recommendations: "GTAB_RECS",
};

export default async function handler(req: AnyReq, res: AnyRes) {
  try {
    // Cách B: proxy Apps Script Web App (JSON)
    const appsScript = process.env.APPS_SCRIPT_URL;
    if (appsScript) {
      const r = await fetch(appsScript);
      if (!r.ok) return res.status(502).json({ ok: false, error: `Apps Script HTTP ${r.status}` });
      const data = await r.json();
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json({ ok: true, source: "apps_script", ...data });
    }

    // Cách A: đọc trực tiếp Google Sheet public qua gviz CSV
    const id = process.env.GSHEET_ID;
    if (!id) {
      return res.status(500).json({
        ok: false,
        error: "Chưa cấu hình GSHEET_ID hoặc APPS_SCRIPT_URL trên Vercel (Settings → Environment Variables).",
      });
    }

    const csv: Record<string, string> = {};
    const errors: { key: string; error: string }[] = [];
    for (const key of Object.keys(TAB_DEFAULTS)) {
      const tab = process.env[TAB_ENV[key]] || TAB_DEFAULTS[key];
      const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
      try {
        const r = await fetch(url, { redirect: "follow" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        // Sheet riêng tư trả về trang HTML đăng nhập thay vì CSV.
        if (/^\s*<(?:!doctype|html)/i.test(text)) {
          throw new Error("Sheet không public hoặc sai tên tab");
        }
        csv[key] = text;
      } catch (e: any) {
        errors.push({ key, error: String(e?.message || e) });
      }
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      ok: Object.keys(csv).length > 0,
      source: "google_sheets",
      csv,
      errors,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
