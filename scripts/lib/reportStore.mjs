/* ============================================================
   SERYN Spy — Report persistence helpers
   ------------------------------------------------------------
   - Phát hiện creds Google (skip gọn khi chạy local không cấu hình).
   - Upsert report theo report_id (KHÔNG ghi đè kỳ khác). --force-new -> tạo
     report_id mới (hậu tố -rN) để giữ cả bản cũ.
   - Ghi markdown ra outputs/ để export/commit nếu muốn.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTab, writeTab } from "./sheets.mjs";
import { HEADERS } from "./schemas.mjs";
import { renderReportMarkdown } from "./reportGen.mjs";
import { pushDatasets, supabaseConfigured } from "./supabase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Có đủ creds để ghi Google Sheet không (GOOGLE_SHEET_ID + service account). */
export function hasSheetCreds() {
  const hasId = !!String(process.env.GOOGLE_SHEET_ID || "").trim();
  const hasAuth = !!String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim() ||
    (!!process.env.GOOGLE_SERVICE_ACCOUNT_FILE && fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_FILE));
  return hasId && hasAuth;
}

/**
 * Ghi report vào tab (upsert theo report_id, giữ mọi kỳ khác nguyên vẹn).
 * @returns {{ reportId: string, action: "create"|"update" }}
 */
export async function upsertReport(sheets, titles, tabName, row, { forceNew = false } = {}) {
  const headers = HEADERS.spyReports;
  const existing = await readTab(sheets, tabName);
  let reportId = row.report_id;

  const sameId = existing.find((r) => String(r.report_id) === String(reportId));
  if (forceNew && sameId) {
    // Giữ bản cũ, tạo report_id mới có hậu tố -rN.
    const base = reportId;
    let n = 2;
    while (existing.some((r) => String(r.report_id) === `${base}-r${n}`)) n++;
    reportId = `${base}-r${n}`;
  }
  const finalRow = { ...row, report_id: reportId };

  // dedup theo report_id (cùng kỳ -> cập nhật; khác kỳ -> giữ).
  const map = new Map();
  for (const r of existing) map.set(String(r.report_id), r);
  const action = map.has(String(reportId)) ? "update" : "create";
  map.set(String(reportId), { ...map.get(String(reportId)), ...finalRow });

  const rows = [...map.values()];
  await writeTab(sheets, titles, tabName, headers, rows);
  return { reportId, action, rows };
}

/**
 * Mirror 1 dataset report lên Supabase (dashboard đọc Supabase làm nguồn chính).
 * Upsert theo dataset_key -> chỉ đụng đúng dataset này, không ảnh hưởng dataset khác.
 * No-op (skipped) nếu chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
 * @param {"weeklyReports"|"monthlyReports"} datasetKey
 */
export async function pushReportToSupabase(datasetKey, rows, weekDate = "") {
  if (!supabaseConfigured()) return { skipped: true };
  try {
    const res = await pushDatasets({ [datasetKey]: rows }, weekDate);
    return { skipped: false, ...res };
  } catch (e) {
    return { skipped: false, ok: 0, fail: 1, errors: [String(e?.message || e)] };
  }
}

/** Ghi markdown report ra outputs/<subdir>/<report_id>.md. Lỗi -> chỉ cảnh báo. */
export function writeReportMarkdown(row, subdir) {
  try {
    const outDir = path.resolve(__dirname, "..", "..", "..", "outputs", subdir);
    fs.mkdirSync(outDir, { recursive: true });
    const mdPath = path.join(outDir, `${row.report_id}.md`);
    fs.writeFileSync(mdPath, renderReportMarkdown(row), "utf8");
    return mdPath;
  } catch (e) {
    console.warn("  [!] Không ghi được markdown file: " + (e?.message || e));
    return "";
  }
}
