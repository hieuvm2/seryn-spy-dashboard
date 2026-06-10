/* ============================================================
   SERYN Spy — đồng bộ dữ liệu spy ads -> Google Sheets
   Chạy: npm run spy:sync   (local)

   ĐỌC 5 CSV output của agent (outputs/...) -> GHI thẳng vào 5 tab
   Google Sheets bằng Service Account (googleapis).

   .env:
     GOOGLE_SHEET_ID             = <id sheet đích>
     GOOGLE_SERVICE_ACCOUNT_FILE = <đường dẫn file JSON service account>
     OUTPUTS_DIR                 = (tùy chọn) mặc định <repo>/outputs

   YÊU CẦU: Share Google Sheet (Editor) cho client_email của service account.
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUTS_DIR = process.env.OUTPUTS_DIR || path.join(REPO_ROOT, "outputs");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SA_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function fail(msg) {
  console.error("\n[X] " + msg + "\n");
  process.exit(1);
}

if (!SHEET_ID) fail("Thiếu GOOGLE_SHEET_ID trong .env.");
if (!SA_FILE) fail("Thiếu GOOGLE_SERVICE_ACCOUNT_FILE trong .env.");
if (!fs.existsSync(SA_FILE)) {
  fail(
    `Không tìm thấy service account JSON tại:\n   ${SA_FILE}\n` +
    "  → Kiểm tra đường dẫn, và đã Share Google Sheet (Editor) cho client_email trong JSON chưa."
  );
}

/* tab name -> file CSV (tương đối trong outputs/) */
const TABS = [
  { tab: "Brand Weekly Snapshot", file: "weekly_snapshots/brand_weekly_snapshot.csv" },
  { tab: "Ad Level Analysis", file: "normalized_ads/ad_level_analysis.csv" },
  { tab: "Scaled Content Analysis", file: "normalized_ads/scaled_content_analysis.csv" },
  { tab: "Weekly Strategy Change", file: "weekly_snapshots/weekly_strategy_change.csv" },
  { tab: "SERYN Content Recommendations", file: "creative_briefs/seryn_content_recommendations.csv" },
];

/* CSV -> ma trận string[][] (gồm cả dòng header), Vietnamese-safe */
function parseCsvMatrix(text) {
  if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let field = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

async function writeSheet(sheets, titles, name, matrix) {
  if (!titles.includes(name)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
    titles.push(name);
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${name}'` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${name}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: matrix },
  });
}

async function main() {
  console.log(`\nSERYN Spy — sync outputs/ -> Google Sheets (service account)`);
  console.log(`Sheet ID: ${SHEET_ID}`);
  console.log(`Outputs : ${OUTPUTS_DIR}\n`);

  const auth = new google.auth.GoogleAuth({ keyFile: SA_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: "v4", auth });

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  } catch (e) {
    let saEmail = "";
    try { saEmail = JSON.parse(fs.readFileSync(SA_FILE, "utf8")).client_email; } catch {}
    fail(
      `Không mở được Google Sheet.\n  → Đã Share Sheet (Editor) cho service account chưa?\n` +
      (saEmail ? `     Email cần share: ${saEmail}\n` : "") +
      `  Chi tiết: ${e?.message || e}`
    );
  }
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);

  let okCount = 0, total = 0;
  for (const { tab, file } of TABS) {
    const p = path.join(OUTPUTS_DIR, file);
    if (!fs.existsSync(p)) {
      console.error(`  [!]  ${tab}: thiếu CSV (${file}) — bỏ qua.`);
      continue;
    }
    const matrix = parseCsvMatrix(fs.readFileSync(p, "utf8"));
    if (!matrix.length) {
      console.error(`  [!]  ${tab}: CSV rỗng — bỏ qua.`);
      continue;
    }
    try {
      await writeSheet(sheets, titles, tab, matrix);
      const dataRows = matrix.length - 1;
      console.log(`  [OK] ${tab}: ghi ${dataRows} dòng dữ liệu`);
      total += dataRows;
      okCount++;
    } catch (e) {
      console.error(`  [X]  ${tab}: ${e?.message || e}`);
    }
  }

  console.log(`\nXong: ${okCount}/${TABS.length} tab, tổng ${total} dòng.`);
  if (okCount === 0) {
    let saEmail = "";
    try { saEmail = JSON.parse(fs.readFileSync(SA_FILE, "utf8")).client_email; } catch {}
    console.error(
      `\n[!] Ghi 0 tab — thường do CHƯA Share Sheet (Editor) cho service account.\n` +
      (saEmail ? `    → Mở Sheet → Share → thêm: ${saEmail} → quyền Editor.\n` : "")
    );
  } else {
    console.log(`→ Mở dashboard bấm "Refresh Online Data" (hoặc reload) để thấy dữ liệu mới.`);
  }
  if (okCount < TABS.length) process.exitCode = 1;
}

main().catch((e) => fail(e?.message || String(e)));
