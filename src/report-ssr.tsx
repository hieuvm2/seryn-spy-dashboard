/* ============================================================
   report-ssr — kết xuất bản báo cáo PDF ở phía máy chủ (Node).
   Dùng CHÍNH component ReportDocument mà dashboard đang hiển thị, nên
   bản gửi email luôn giống hệt bản "Tải PDF về" trên trình duyệt.

   Build: npm run build:report-ssr  ->  dist-ssr/report-ssr.js
   Gọi từ: scripts/email-weekly-report.mjs (Puppeteer in ra PDF).
   ============================================================ */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SpyDashboardData, DataSourceType } from "./types";
import ReportDocument, { buildReportDocumentProps, latestWeeklyReport } from "./components/ReportDocument";

export { latestWeeklyReport };

export interface RenderReportOptions {
  data: SpyDashboardData;
  dataSource?: DataSourceType;
  /** Nội dung khối CSS .rpt-* (đọc từ src/index.css) — nhúng thẳng vào <style>. */
  css: string;
  /** Logo dạng data-URI (Chromium không giải được đường dẫn "/" khi setContent). */
  logoDataUri?: string;
  /** Thẻ <style> phụ để nhúng font (data-URI woff2) — rỗng thì dùng Google Fonts. */
  fontCss?: string;
}

/** Trang HTML hoàn chỉnh, tự chứa — nạp thẳng vào Chromium rồi in PDF. */
export function renderReportHtml(opts: RenderReportOptions): string {
  const { data, dataSource = "online-supabase", css, logoDataUri, fontCss } = opts;
  const { m, report } = buildReportDocumentProps(data, dataSource);
  const body = renderToStaticMarkup(
    <ReportDocument m={m} report={report} logoSrc={logoDataUri || "/seryn-mark.png"} />,
  );
  // Không có font nhúng -> dùng Google Fonts (runner CI có mạng).
  const fonts = fontCss
    ? `<style>${fontCss}</style>`
    : `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />`;

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Báo cáo Spy Ads — ${escapeHtml(m.weekDate)}</title>
    ${fonts}
    <style>
      /* Reset tối thiểu — bản in không dùng Tailwind. */
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; background: #fff; }
      /* Khi in ra PDF, .rpt-doc là cả trang giấy: bỏ khung xem trước. */
      .rpt-doc { max-width: none !important; margin: 0 !important; border-radius: 0 !important;
                 box-shadow: none !important; padding: 0 !important; }
      @page { size: A4; margin: 12mm; }
      .rpt-doc, .rpt-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .rpt-section, .rpt-table, .rpt-kpi, .rpt-avoid, .rpt-chart, tr { break-inside: avoid; }
      .rpt-h2, .rpt-header { break-after: avoid; }
    </style>
    <style>${css}</style>
  </head>
  <body>${body}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
