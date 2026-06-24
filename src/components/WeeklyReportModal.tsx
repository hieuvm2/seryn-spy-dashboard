/* ============================================================
   WeeklyReportModal — bản xem trước báo cáo Spy Ads (in / lưu PDF).
   - Mở overlay xem trước; bấm "Lưu PDF" -> window.print() (chọn "Lưu thành PDF").
   - Print CSS (index.css) chỉ in #seryn-report-doc, ẩn phần còn lại.
   - Tiếng Việt chuẩn (font hệ thống/web), giữ nhận diện SERYN.
   ============================================================ */
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { SpyDashboardData, DataSourceType } from "../types";
import { viLabel } from "../utils/spyData";
import { buildReportModel, type ReportRecAction } from "../utils/reportData";

const ACTION_LABEL: Record<ReportRecAction, string> = {
  adapt: "ADAPT — Học hỏi & làm tốt hơn",
  counter: "COUNTER — Phản đòn định vị",
  avoid: "AVOID — Tránh, lệch định vị",
  copy: "COPY — Có thể áp dụng trực tiếp",
  monitor: "MONITOR — Theo dõi tiếp",
};

const pct = (r: number) => `${Math.round((r || 0) * 100)}%`;
const vn = (n: number) => n.toLocaleString("vi-VN");
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

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
  const m = buildReportModel(data, dataSource);

  const kpiCards: Array<{ label: string; value: string }> = [
    { label: "Đối thủ theo dõi", value: vn(m.kpis.totalBrands) },
    { label: "Đang chạy QC", value: `${m.kpis.activeBrands}/${m.kpis.totalBrands}` },
    { label: "Tổng QC trẻ hóa da", value: vn(m.kpis.totalAds) },
    { label: "QC mới", value: `+${vn(m.kpis.newAds)}` },
    { label: "QC đã dừng", value: `−${vn(m.kpis.stoppedAds)}` },
    { label: "Cụm nhân rộng", value: vn(m.kpis.scaledClusters) },
  ];

  return createPortal(
    <div className="rpt-overlay" role="dialog" aria-modal="true" aria-label="Báo cáo Spy Ads">
      {/* Thanh công cụ — không in */}
      <div className="rpt-toolbar no-print">
        <div className="rpt-toolbar-title">
          Báo cáo Spy Ads · tuần {m.weekDate}
        </div>
        <div className="rpt-toolbar-actions">
          <button className="rpt-btn rpt-btn-primary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Lưu PDF / In
          </button>
          <button className="rpt-btn rpt-btn-ghost" onClick={onClose} aria-label="Đóng">
            <X className="w-4 h-4" /> Đóng
          </button>
        </div>
      </div>

      <div className="rpt-scroll">
        <article id="seryn-report-doc" className="rpt-doc">
          {/* ---- Header thương hiệu ---- */}
          <header className="rpt-header">
            <div className="rpt-header-top">
              <img src="/seryn-mark.png" alt="SERYN" className="rpt-logo" />
              <div className="rpt-brand">
                <div className="rpt-brand-name">SERYN</div>
                <div className="rpt-brand-slogan">TRẺ HÓA TỪ NỀN TẢNG SINH HỌC</div>
              </div>
            </div>
            <h1 className="rpt-title">Báo cáo Spy Ads đối thủ — Tuần {m.weekDate}</h1>
            <div className="rpt-meta">
              Phạm vi: ad trẻ hóa da · {m.kpis.totalBrands} đối thủ watchlist · Thị trường Vietnam
              {m.generatedAt ? ` · Xuất lúc ${m.generatedAt}` : ""} · Nguồn: {m.sourceLabel}
            </div>
          </header>

          {/* ---- KPI ---- */}
          <section className="rpt-section rpt-avoid">
            <div className="rpt-kpis">
              {kpiCards.map((k) => (
                <div className="rpt-kpi" key={k.label}>
                  <div className="rpt-kpi-value">{k.value}</div>
                  <div className="rpt-kpi-label">{k.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Tóm tắt điều hành ---- */}
          <section className="rpt-section rpt-avoid">
            <h2 className="rpt-h2">Tóm tắt điều hành</h2>
            <p className="rpt-exec">{m.execSummary}</p>
            <p className="rpt-note">
              Chất lượng dữ liệu: {m.kpis.dataQuality}/100{m.kpis.failedPages ? ` · ${m.kpis.failedPages} page crawl lỗi` : ""}.
              Tín hiệu từ dữ liệu ads (số lượng + thời gian chạy), không phải kết quả ROAS/CPA.
            </p>
          </section>

          {/* ---- Bảng đối thủ ---- */}
          <section className="rpt-section">
            <h2 className="rpt-h2">Toàn cảnh đối thủ</h2>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Đối thủ</th><th className="num">Active</th><th className="num">Mới</th>
                  <th className="num">Dừng</th><th className="num">Scale</th>
                  <th className="num">Video</th><th className="num">Msg</th>
                  <th>Format chính</th><th>Hook chính</th>
                </tr>
              </thead>
              <tbody>
                {m.brands.map((b) => (
                  <tr key={b.name}>
                    <td className="rpt-strong">{b.name}</td>
                    <td className="num">{vn(b.active)}</td>
                    <td className="num pos">{b.newAds ? `+${b.newAds}` : "0"}</td>
                    <td className="num neg">{b.stopped ? `−${b.stopped}` : "0"}</td>
                    <td className="num">{vn(b.scaled)}</td>
                    <td className="num">{b.active ? pct(b.videoRate) : "—"}</td>
                    <td className="num">{b.active ? pct(b.msgRate) : "—"}</td>
                    <td>{viLabel(b.topFormat) || "—"}</td>
                    <td>{viLabel(b.topHook) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ---- Pattern thị trường ---- */}
          <section className="rpt-section rpt-avoid">
            <h2 className="rpt-h2">Pattern chủ đạo của thị trường</h2>
            <div className="rpt-pattern-grid">
              {[
                { t: "Top hook", items: m.patterns.hooks },
                { t: "Top offer", items: m.patterns.offers },
                { t: "Top định dạng", items: m.patterns.formats },
                { t: "Top dịch vụ", items: m.patterns.services },
                { t: "Top góc tiếp cận", items: m.patterns.angles },
              ].map((g) => (
                <div className="rpt-pattern-col" key={g.t}>
                  <div className="rpt-pattern-title">{g.t}</div>
                  {g.items.length ? (
                    <div className="rpt-chips">
                      {g.items.slice(0, 8).map((it, i) => (
                        <span className="rpt-chip" key={i}>
                          {viLabel(it.key)} <b>{vn(it.count)}</b>
                        </span>
                      ))}
                    </div>
                  ) : <span className="rpt-muted">chưa rõ</span>}
                </div>
              ))}
            </div>
          </section>

          {/* ---- Khuyến nghị chiến lược SERYN ---- */}
          <section className="rpt-section">
            <h2 className="rpt-h2">Khuyến nghị chiến lược cho SERYN</h2>
            {m.recommendations.length ? m.recommendations.map((r) => (
              <div className={`rpt-rec rpt-rec-${r.action} rpt-avoid`} key={r.action}>
                <div className="rpt-rec-head">{ACTION_LABEL[r.action]}</div>
                <ul className="rpt-rec-list">
                  {r.items.map((it, i) => (
                    <li key={i}>
                      <b>{it.brand}</b>
                      {it.format ? ` · ${viLabel(it.format)}` : ""}
                      {it.hook ? ` — “${trunc(it.hook, 90)}”` : ""}
                      {it.reframe ? <div className="rpt-rec-reframe">→ {trunc(it.reframe, 160)}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )) : <p className="rpt-muted">Chưa có khuyến nghị từ cụm nội dung tuần này.</p>}
          </section>

          {/* ---- Cụm content đang nhân rộng ---- */}
          <section className="rpt-section">
            <h2 className="rpt-h2">Cụm nội dung đối thủ đang nhân rộng</h2>
            <table className="rpt-table">
              <thead>
                <tr><th>Đối thủ</th><th className="num">Số ad</th><th>Format</th><th>Hook đại diện</th><th>SERYN</th></tr>
              </thead>
              <tbody>
                {m.scaledClusters.length ? m.scaledClusters.map((s, i) => (
                  <tr key={i}>
                    <td className="rpt-strong">{s.brand}</td>
                    <td className="num">{vn(s.ads)}</td>
                    <td>{viLabel(s.format) || "—"}</td>
                    <td>{trunc(s.hook, 70) || "—"}</td>
                    <td className="rpt-action-cell">{s.action || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="rpt-muted">Chưa có cụm nội dung scale.</td></tr>}
              </tbody>
            </table>
          </section>

          {/* ---- Thay đổi chiến lược tuần ---- */}
          {m.changes.length ? (
            <section className="rpt-section">
              <h2 className="rpt-h2">Thay đổi chiến lược đáng chú ý</h2>
              <ul className="rpt-changes">
                {m.changes.map((c, i) => (
                  <li key={i} className="rpt-avoid">
                    <span className={`rpt-sev rpt-sev-${c.severity}`}>{c.severity || "—"}</span>
                    <b>{c.brand}</b> · <span className="rpt-type">{viLabel(c.type)}</span>
                    {c.summary ? <> — {trunc(c.summary, 140)}</> : null}
                    {c.action ? <span className="rpt-rec-tag"> [{c.action}]</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ---- Action plan ---- */}
          {m.actions.length ? (
            <section className="rpt-section">
              <h2 className="rpt-h2">Action Plan ưu tiên</h2>
              <ol className="rpt-actions">
                {m.actions.map((a, i) => (
                  <li key={i} className="rpt-avoid">
                    <span className={`rpt-prio rpt-prio-${a.priority}`}>{a.priority || "—"}</span>
                    <b>{a.insight || a.insightType}</b>
                    {a.brand ? ` · ${a.brand}` : ""}
                    {a.suggested ? <div className="rpt-action-sub">→ {a.suggested}</div> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* ---- Swipe file ---- */}
          {m.swipes.length ? (
            <section className="rpt-section">
              <h2 className="rpt-h2">Swipe file — ad đáng lưu để tham khảo</h2>
              <ul className="rpt-swipes">
                {m.swipes.map((s, i) => (
                  <li key={i} className="rpt-avoid">
                    <b>{s.brand}</b>
                    {s.hook ? ` — “${trunc(s.hook, 80)}”` : ""}
                    {s.offer ? <span className="rpt-swipe-offer"> · {s.offer}</span> : ""}
                    {s.whySave ? <div className="rpt-action-sub">Vì sao lưu: {trunc(s.whySave, 130)}</div> : null}
                    {s.howAdapt ? <div className="rpt-action-sub">SERYN adapt: {trunc(s.howAdapt, 130)}</div> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ---- Footer / caveat ---- */}
          <footer className="rpt-footer">
            <div className="rpt-footer-brand">SERYN Clinic · Spy Ads Intelligence</div>
            <p className="rpt-footer-note">
              Phạm vi spy: chỉ ad <b>căng da / trẻ hóa da mặt</b> của {m.kpis.totalBrands} đối thủ trong watchlist
              (đã loại nâng ngực, hút mỡ, nâng mũi, răng, triệt lông, filler/botox thuần…). Brand hiển thị 0 ad
              trẻ hóa da có thể vẫn chạy ad dịch vụ khác. Dữ liệu là tín hiệu quan sát, không phải kết quả
              ngân sách/chuyển đổi. Báo cáo nội bộ — không chia sẻ ra ngoài.
            </p>
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  );
}
