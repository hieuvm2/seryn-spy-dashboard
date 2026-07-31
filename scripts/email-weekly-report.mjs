/* ============================================================
   email-weekly-report — gửi PDF "Báo cáo chi tiết" cho quản trị viên
   MỖI KHI dashboard có bảng phân tích MỚI.

   Cách hoạt động
     1. Đọc dataset `weeklyReports` trên Supabase, lấy báo cáo mới nhất
        (đúng bản mà tab "Phân tích báo cáo" đang hiện).
     2. Tính vân tay (hash) phần văn phân tích. So với nhật ký đã gửi lưu ở
        dataset `reportEmailLog` -> chưa gửi hoặc nội dung đã đổi thì mới gửi.
     3. Dựng HTML bằng CHÍNH component của dashboard (dist-ssr/report-ssr.js),
        in ra PDF bằng Chromium (Puppeteer), gửi kèm email.
     4. Ghi lại vào `reportEmailLog` để lần sau không gửi trùng.

   Chạy
     npm run report:email            # thử: dựng PDF + in xem trước, KHÔNG gửi
     npm run report:email -- --send  # gửi thật
     thêm --force để gửi lại dù đã gửi rồi.

   Quy ước --send giống scripts/report-push.mjs: mặc định là chạy thử.
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { fetchDataset, pushDatasets, supabaseConfigured } from "./lib/supabase.mjs";
import { sendMail, mailerConfigured, missingMailConfig, parseRecipients } from "./lib/mailer.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SSR_BUNDLE = path.join(ROOT, "dist-ssr", "report-ssr.js");
const CSS_FILE = path.join(ROOT, "src", "index.css");
const LOGO_FILE = path.join(ROOT, "public", "seryn-mark.png");
const LOG_KEY = "reportEmailLog";   // KHÔNG được thêm key này vào DATASET_TABS
const MAX_LOG = 60;

const argv = process.argv.slice(2);
const SEND = argv.includes("--send");
const FORCE = argv.includes("--force");
const env = (k, d = "") => String(process.env[k] ?? d).trim();

/* ---------- dữ liệu ---------- */

/** Các dataset mà buildReportModel cần (xem src/utils/reportData.ts). */
const NEEDED = [
  "weeklyReports", "brandWeeklySnapshot", "scaledContentAnalysis", "weeklySummary",
  "ownBrandPages", "adLevelAnalysis", "weeklyChangeInsights", "actionPlan",
  "swipeSuggestions", "hookIntelligence", "visualAnalysis",
];

async function loadDashboardData() {
  const data = {};
  for (const key of NEEDED) {
    try { data[key] = await fetchDataset(key); }
    catch { data[key] = []; }
  }
  return data;
}

/** Bản báo cáo mới nhất — cùng logic sắp xếp với dashboard. */
function latestReport(rows) {
  return [...(rows ?? [])].sort((a, b) =>
    String(b.period_start).localeCompare(String(a.period_start)) ||
    String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null;
}

/** Vân tay phần VĂN PHÂN TÍCH — đổi chữ là đổi hash, đổi generated_at thì không. */
const NARRATIVE_FIELDS = [
  "executive_summary", "key_competitor_moves", "notable_content_patterns",
  "notable_visual_patterns", "risk_warnings", "seryn_implications",
  "recommended_actions", "seryn_benchmark",
];
function narrativeHash(report) {
  const blob = NARRATIVE_FIELDS.map((f) => String(report?.[f] ?? "")).join("");
  return crypto.createHash("sha256").update(blob).digest("hex").slice(0, 16);
}

/* ---------- kết xuất PDF ---------- */

/** Lấy đúng khối CSS của bản in (.rpt-*) trong src/index.css. */
function readReportCss() {
  const css = fs.readFileSync(CSS_FILE, "utf8");
  const start = css.indexOf(".rpt-overlay");
  if (start < 0) throw new Error("Không tìm thấy khối CSS .rpt-* trong src/index.css");
  return css.slice(start);
}

function readLogoDataUri() {
  try {
    return "data:image/png;base64," + fs.readFileSync(LOGO_FILE).toString("base64");
  } catch { return ""; }
}

/** Font tiếng Việt nhúng sẵn (nếu có) — không có thì HTML dùng Google Fonts. */
function readFontCss() {
  const dir = path.join(ROOT, "public", "fonts");
  if (!fs.existsSync(dir)) return "";
  const faces = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".woff2"))) {
    const weight = (f.match(/(\d{3})/) || [])[1] || "400";
    const b64 = fs.readFileSync(path.join(dir, f)).toString("base64");
    faces.push(`@font-face{font-family:"Be Vietnam Pro";font-style:normal;font-weight:${weight};`
      + `font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`);
  }
  return faces.join("\n");
}

async function renderPdf(html) {
  let puppeteer;
  try { puppeteer = (await import("puppeteer")).default; }
  catch { throw new Error("Thiếu gói puppeteer — chạy: npm i puppeteer"); }

  const launch = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  if (env("PUPPETEER_EXECUTABLE_PATH")) launch.executablePath = env("PUPPETEER_EXECUTABLE_PATH");

  const browser = await puppeteer.launch(launch);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);   // chờ font -> không vỡ dấu tiếng Việt
    return await page.pdf({
      format: "A4",
      printBackground: true,                            // giữ nền cam của thẻ KPI
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
  } finally {
    await browser.close();
  }
}

/* ---------- nhật ký đã gửi ---------- */

async function readLog() {
  try { return await fetchDataset(LOG_KEY); } catch { return []; }
}
async function appendLog(entry, weekDate) {
  const rows = await readLog();
  rows.push(entry);
  const trimmed = rows.slice(-MAX_LOG);
  const res = await pushDatasets({ [LOG_KEY]: trimmed }, weekDate);
  if (res.fail) console.warn("  [!] Ghi nhật ký gửi mail lỗi:", res.errors.slice(0, 2).join(" | "));
}

/* ---------- nội dung email ---------- */

function buildEmailBody(report, hash) {
  const bullets = String(report.executive_summary ?? "")
    .split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1).slice(0, 4);
  const li = bullets.map((b) => `<li style="margin-bottom:6px;line-height:1.55">${esc(b)}</li>`).join("");
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;max-width:640px">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e85f4b;font-weight:700">SERYN Competitor Tracker</p>
  <h1 style="margin:0 0 12px;font-size:19px;color:#1b234c">${esc(report.title || "Báo cáo Spy Ads")}</h1>
  <p style="margin:0 0 14px;font-size:13px;color:#6b7280">Kỳ ${esc(report.period_start)} → ${esc(report.period_end)} · bản phân tích mới trên dashboard.</p>
  ${li ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1b234c">Vài ý chính</p><ul style="margin:0 0 16px;padding-left:18px;font-size:13px">${li}</ul>` : ""}
  <p style="margin:0 0 16px;font-size:13px">Bản đầy đủ nằm trong tệp PDF đính kèm.</p>
  <p style="margin:0;font-size:11px;color:#9ca3af">Thư tự động gửi khi dashboard có bảng phân tích mới · mã bản ${esc(hash)}</p>
</div>`;
  const text = `${report.title}\nKỳ ${report.period_start} → ${report.period_end}\n\n`
    + bullets.join("\n") + `\n\nBản đầy đủ trong tệp PDF đính kèm. (mã bản ${hash})`;
  return { html, text };
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- main ---------- */

async function main() {
  console.log("\nSERYN — Gửi email báo cáo chi tiết\n");
  if (!supabaseConfigured()) throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  if (env("REPORT_MAIL_ENABLED", "true").toLowerCase() === "false") {
    console.log("  REPORT_MAIL_ENABLED=false -> tắt tính năng, thoát.");
    return;
  }
  if (!fs.existsSync(SSR_BUNDLE)) {
    throw new Error(`Chưa build bản kết xuất máy chủ (${path.relative(ROOT, SSR_BUNDLE)}).\n`
      + "  Chạy: npm run build:report-ssr");
  }

  const data = await loadDashboardData();
  const report = latestReport(data.weeklyReports);
  if (!report) { console.log("  Chưa có báo cáo tuần nào trên Supabase — không gửi."); return; }

  const hash = narrativeHash(report);
  const id = String(report.report_id || "");
  console.log(`  Báo cáo mới nhất : ${id}`);
  console.log(`  Kỳ               : ${report.period_start} → ${report.period_end}`);
  console.log(`  Mã bản phân tích : ${hash}`);

  const log = await readLog();
  const already = log.find((r) => r.report_id === id && r.narrative_hash === hash);
  if (already && !FORCE) {
    console.log(`  Bản này đã gửi lúc ${already.sent_at} -> bỏ qua (dùng --force để gửi lại).`);
    return;
  }
  const prev = log.filter((r) => r.report_id === id).pop();
  console.log(`  Lý do gửi        : ${!prev ? "báo cáo mới" : prev.narrative_hash !== hash ? "văn phân tích đã đổi" : "ép gửi lại (--force)"}`);

  // Dựng HTML bằng chính component của dashboard.
  const { renderReportHtml } = await import(new URL(`file://${SSR_BUNDLE.replace(/\\/g, "/")}`));
  const fontCss = readFontCss();
  console.log(`  Font tiếng Việt  : ${fontCss ? "nhúng sẵn từ public/fonts" : "tải Google Fonts (cần mạng)"}`);
  const html = renderReportHtml({
    data, dataSource: "online-supabase",
    css: readReportCss(), logoDataUri: readLogoDataUri(), fontCss,
  });

  const outDir = path.join(ROOT, "outputs", "report_pdf");
  fs.mkdirSync(outDir, { recursive: true });
  const stem = `seryn-bao-cao-${report.period_start || "moi-nhat"}`;
  fs.writeFileSync(path.join(outDir, `${stem}.html`), html);

  const pdf = await renderPdf(html);
  const pdfPath = path.join(outDir, `${stem}.pdf`);
  fs.writeFileSync(pdfPath, pdf);
  console.log(`  PDF              : ${path.relative(ROOT, pdfPath)} (${Math.round(pdf.length / 1024)} KB)`);

  const to = parseRecipients(env("REPORT_MAIL_TO") || "hieuvm2@seryn.vn");
  const prefix = env("REPORT_MAIL_SUBJECT_PREFIX", "[SERYN Spy]");
  const subject = `${prefix} Báo cáo chi tiết tuần ${report.period_start} → ${report.period_end}`;
  const { html: mailHtml, text } = buildEmailBody(report, hash);

  if (!SEND) {
    console.log("\n  -- CHẠY THỬ (chưa gửi) --");
    console.log(`  Người nhận : ${to.join(", ")}`);
    console.log(`  Tiêu đề    : ${subject}`);
    console.log(`  Đính kèm   : ${stem}.pdf`);
    console.log(`  Cấu hình mail: ${mailerConfigured() ? "đã đủ" : "THIẾU " + missingMailConfig().join(", ")}`);
    console.log("\n  Gửi thật: npm run report:email -- --send\n");
    return;
  }

  const res = await sendMail({
    to, subject, html: mailHtml, text,
    attachments: [{ filename: `${stem}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  console.log(`  [OK] Đã gửi tới ${res.accepted} người nhận${res.id ? ` (id ${res.id})` : ""}.`);

  await appendLog({
    report_id: id,
    narrative_hash: hash,
    period_start: report.period_start,
    period_end: report.period_end,
    sent_at: new Date().toISOString(),
    sent_to: to.join(","),
    pdf_kb: Math.round(pdf.length / 1024),
  }, report.period_start);
  console.log("  Đã ghi nhật ký gửi (dataset reportEmailLog).\n");
}

main().catch((e) => { console.error("[X] " + (e?.stack || e?.message || e)); process.exit(1); });
