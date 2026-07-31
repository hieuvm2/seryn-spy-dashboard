/* ============================================================
   WeeklyReportModal — bản xem trước báo cáo Spy Ads (tải PDF).
   - Bấm "Tải PDF về" -> html2pdf.js render #seryn-report-doc thành file
     PDF tải thẳng về máy (không qua hộp thoại in).
   - THÂN báo cáo nằm ở ReportDocument.tsx (dùng chung với bản gửi email).
   - Print CSS (index.css) vẫn giữ để Ctrl+P in được nếu cần.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import type { SpyDashboardData, DataSourceType } from "../types";
import ReportDocument, { buildReportDocumentProps } from "./ReportDocument";

export default function WeeklyReportModal({
  open,
  data,
  dataSource,
  onClose,
}: {
  open: boolean;
  data: SpyDashboardData;
  dataSource: DataSourceType;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  // Đóng bằng phím Esc; khóa scroll nền khi mở.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  const { m, report } = buildReportDocumentProps(data, dataSource);

  return createPortal(
    <div className="rpt-overlay" role="dialog" aria-modal="true" aria-label="Báo cáo Spy Ads">
      {/* Thanh công cụ — không in */}
      <div className="rpt-toolbar no-print">
        <div className="rpt-toolbar-title">
          Báo cáo Spy Ads · tuần {m.weekDate}
        </div>
        <div className="rpt-toolbar-actions">
          <button
            className="rpt-btn rpt-btn-primary"
            disabled={downloading}
            onClick={async () => {
              const el = document.getElementById("seryn-report-doc");
              if (!el || downloading) return;
              setDownloading(true);
              try {
                // Nạp html2pdf khi cần (nặng ~500KB) — không phình bundle chính.
                const html2pdf = (await import("html2pdf.js")).default;
                // pagebreak được html2pdf hỗ trợ ở runtime nhưng thiếu trong type.d.ts
                // của package -> đưa qua spread để không vướng excess property check.
                const extra = { pagebreak: { mode: ["css", "legacy"], avoid: ".rpt-card, table, .rpt-kpi" } };
                await html2pdf()
                  .set({
                    margin: [8, 8, 10, 8],
                    filename: `seryn-spy-report-${m.weekDate}.pdf`,
                    image: { type: "jpeg", quality: 0.95 },
                    html2canvas: { scale: 2, useCORS: true, imageTimeout: 4000, backgroundColor: "#ffffff" },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                    ...extra,
                  })
                  .from(el)
                  .save();
              } catch {
                // html2pdf lỗi (hiếm) -> mở hộp thoại in làm đường lui.
                window.print();
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Đang tạo PDF…" : "Tải PDF về"}
          </button>
          <button className="rpt-btn rpt-btn-ghost" onClick={onClose} aria-label="Đóng">
            <X className="w-4 h-4" /> Đóng
          </button>
        </div>
      </div>

      <div className="rpt-scroll">
        <ReportDocument m={m} report={report} />
      </div>
    </div>,
    document.body,
  );
}
