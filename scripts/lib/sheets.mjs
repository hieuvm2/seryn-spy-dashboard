/* ============================================================
   SERYN Spy — Shared Google Sheets I/O (server-side only)
   ------------------------------------------------------------
   Dùng chung cho các script Exa Market Research & Competitor
   Discovery. KHÔNG import vào frontend (chứa logic service account).

   ENV:
     GOOGLE_SHEET_ID               (bắt buộc)
     GOOGLE_SERVICE_ACCOUNT_JSON   (nội dung JSON — GitHub Actions)
     GOOGLE_SERVICE_ACCOUNT_FILE   (fallback local: đường dẫn file JSON)

   Helper:
     getSheetsClient()                       -> { sheets, titles }
     readTab(sheets, name)                   -> [{header:value}]
     writeTab(sheets, titles, name, headers, rows)   (clear + ghi)
     appendTab(sheets, titles, name, headers, rows)  (giữ lịch sử)
     upsertTab(sheets, titles, name, headers, rows, keyFn)  (upsert theo key)
   ============================================================ */
import fs from "node:fs";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export function getSheetId() {
  return (process.env.GOOGLE_SHEET_ID || "").trim();
}

export function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    let creds;
    try { creds = JSON.parse(raw); }
    catch (e) { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ: " + (e?.message || e)); }
    return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file && fs.existsSync(file)) {
    return new google.auth.GoogleAuth({ keyFile: file, scopes: SCOPES });
  }
  throw new Error(
    "Thiếu credentials service account.\n" +
    "  → Đặt GOOGLE_SERVICE_ACCOUNT_JSON (GitHub Actions) hoặc GOOGLE_SERVICE_ACCOUNT_FILE (local).\n" +
    "  → Nhớ Share Google Sheet (Editor) cho client_email của service account."
  );
}

/** Mở Sheet, trả về client + danh sách tab title hiện có. */
export async function getSheetsClient() {
  const SHEET_ID = getSheetId();
  if (!SHEET_ID) throw new Error("Thiếu GOOGLE_SHEET_ID.");
  const auth = buildAuth();
  const sheets = google.sheets({ version: "v4", auth });
  let meta;
  try { meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID }); }
  catch (e) { throw new Error(`Không mở được Google Sheet (đã Share Editor cho service account chưa?): ${e?.message || e}`); }
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);
  return { sheets, titles, sheetId: SHEET_ID };
}

/** Đọc 1 tab -> mảng object keyed theo header. Tab thiếu -> []. */
export async function readTab(sheets, name) {
  const SHEET_ID = getSheetId();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${name}'` });
  } catch { return []; }
  const values = res.data.values || [];
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h || "").trim());
  return values.slice(1)
    .filter((row) => row.some((c) => String(c || "").trim() !== ""))
    .map((row) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = row[i] != null ? String(row[i]) : ""; });
      return o;
    });
}

async function ensureTab(sheets, titles, name, headers) {
  const SHEET_ID = getSheetId();
  if (!titles.includes(name)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
    titles.push(name);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `'${name}'!A1`, valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    return true; // mới tạo
  }
  return false;
}

const cellStr = (v) => (v === undefined || v === null ? "" : String(v));

/** Clear + ghi đè toàn bộ tab. */
export async function writeTab(sheets, titles, name, headers, rows) {
  const SHEET_ID = getSheetId();
  await ensureTab(sheets, titles, name, headers);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${name}'` });
  const matrix = [headers, ...rows.map((r) => headers.map((h) => cellStr(r[h])))];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: `'${name}'!A1`, valueInputOption: "RAW",
    requestBody: { values: matrix },
  });
  console.log(`  [OK] ${name}: ghi ${rows.length} dòng`);
}

/** Append (giữ lịch sử) — tạo tab + header nếu chưa có; không clear. */
export async function appendTab(sheets, titles, name, headers, rows) {
  const SHEET_ID = getSheetId();
  await ensureTab(sheets, titles, name, headers);
  if (!rows.length) { console.log(`  [OK] ${name}: +0 dòng`); return; }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: `'${name}'!A1`, valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows.map((r) => headers.map((h) => cellStr(r[h]))) },
  });
  console.log(`  [OK] ${name}: +${rows.length} dòng (append)`);
}

/**
 * Upsert theo key: đọc tab cũ, merge các row mới (cùng key -> ghi đè), rồi
 * ghi lại toàn bộ. keyFn(row) -> string. Không xóa row cũ không liên quan.
 */
export async function upsertTab(sheets, titles, name, headers, rows, keyFn) {
  const existing = await readTab(sheets, name);
  const map = new Map();
  for (const r of existing) map.set(keyFn(r), r);
  for (const r of rows) map.set(keyFn(r), { ...map.get(keyFn(r)), ...r });
  await writeTab(sheets, titles, name, headers, [...map.values()]);
}
