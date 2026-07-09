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
import { buildReportModel, type ReportRecAction, type ReportBrandRow } from "../utils/reportData";

/* ---- Màu biểu đồ (palette đã validate: CVD ΔE 21.2, aqua dùng nhãn trực tiếp) ---- */
const CH = {
  blue: "#2a78d6", aqua: "#1baf7a", red: "#e34948",
  ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", baseline: "#c3c2b7",
};

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

/* ============================================================
   Biểu đồ top 5 đối thủ (SVG thuần — in PDF được, màu đã validate).
   1) QC đang chạy (thanh ngang, 1 màu)
   2) QC mới vs đã dừng (diverging: xanh phải / đỏ trái)
   3) Tỷ lệ Video & Messenger (2 series, nhãn % trực tiếp)
   ============================================================ */
const NAME_W = 118, ROW_H = 26, BAR_H = 13, CHART_W = 360, PAD_T = 6;
const nameTr = (s: string) => trunc(String(s || ""), 20);

function BrandLabel({ y, name }: { y: number; name: string }) {
  return (
    <text x={NAME_W - 6} y={y} textAnchor="end" dominantBaseline="middle"
      fontSize="10" fill={CH.ink2} fontWeight={600}>{nameTr(name)}</text>
  );
}
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="rpt-legend">
      {items.map((it) => (
        <span key={it.label} className="rpt-legend-item">
          <span className="rpt-legend-swatch" style={{ background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  );
}

/** 1) QC đang chạy — thanh ngang đơn sắc, giá trị ở cuối thanh. */
function ActiveAdsChart({ brands }: { brands: ReportBrandRow[] }) {
  const max = Math.max(...brands.map((b) => b.active), 1);
  const plotW = CHART_W - NAME_W - 34;
  const h = PAD_T + brands.length * ROW_H + 4;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${h}`} width="100%" role="img" aria-label="QC đang chạy của 5 đối thủ lớn nhất">
      <line x1={NAME_W} y1={PAD_T - 2} x2={NAME_W} y2={h - 2} stroke={CH.baseline} strokeWidth="1" />
      {brands.map((b, i) => {
        const y = PAD_T + i * ROW_H + (ROW_H - BAR_H) / 2;
        const w = Math.max((b.active / max) * plotW, 2);
        return (
          <g key={b.name}>
            <title>{`${b.name}: ${vn(b.active)} QC đang chạy`}</title>
            <BrandLabel y={y + BAR_H / 2} name={b.name} />
            <rect x={NAME_W} y={y} width={w} height={BAR_H} rx="3" fill={CH.blue} />
            <text x={NAME_W + w + 5} y={y + BAR_H / 2} dominantBaseline="middle"
              fontSize="10" fontWeight={700} fill={CH.ink} style={{ fontVariantNumeric: "tabular-nums" }}>{vn(b.active)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 2) QC mới vs đã dừng — diverging quanh trục 0. */
function NewStoppedChart({ brands }: { brands: ReportBrandRow[] }) {
  const max = Math.max(...brands.map((b) => Math.max(b.newAds, b.stopped)), 1);
  const cx = NAME_W + (CHART_W - NAME_W) / 2;
  const armW = (CHART_W - NAME_W) / 2 - 26;
  const h = PAD_T + brands.length * ROW_H + 4;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${h}`} width="100%" role="img" aria-label="QC mới và QC đã dừng của 5 đối thủ lớn nhất">
      <line x1={cx} y1={PAD_T - 2} x2={cx} y2={h - 2} stroke={CH.baseline} strokeWidth="1" />
      {brands.map((b, i) => {
        const y = PAD_T + i * ROW_H + (ROW_H - BAR_H) / 2;
        const wNew = (b.newAds / max) * armW;
        const wStop = (b.stopped / max) * armW;
        return (
          <g key={b.name}>
            <title>{`${b.name}: +${vn(b.newAds)} mới · −${vn(b.stopped)} dừng`}</title>
            <BrandLabel y={y + BAR_H / 2} name={b.name} />
            {b.stopped > 0 && <rect x={cx - wStop} y={y} width={Math.max(wStop, 2)} height={BAR_H} rx="3" fill={CH.red} />}
            {b.newAds > 0 && <rect x={cx + 1} y={y} width={Math.max(wNew, 2)} height={BAR_H} rx="3" fill={CH.blue} />}
            <text x={cx - wStop - 4} y={y + BAR_H / 2} textAnchor="end" dominantBaseline="middle"
              fontSize="9.5" fontWeight={700} fill={CH.ink} style={{ fontVariantNumeric: "tabular-nums" }}>{b.stopped ? `−${vn(b.stopped)}` : ""}</text>
            <text x={cx + wNew + 5} y={y + BAR_H / 2} dominantBaseline="middle"
              fontSize="9.5" fontWeight={700} fill={CH.ink} style={{ fontVariantNumeric: "tabular-nums" }}>{b.newAds ? `+${vn(b.newAds)}` : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 3) Tỷ lệ Video & Messenger — 2 thanh/brand, nhãn % trực tiếp (relief cho aqua). */
function RatesChart({ brands }: { brands: ReportBrandRow[] }) {
  const plotW = CHART_W - NAME_W - 40;
  const GROUP_H = 30, SUB_H = 10;
  const h = PAD_T + brands.length * GROUP_H + 4;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${h}`} width="100%" role="img" aria-label="Tỷ lệ video và messenger của 5 đối thủ lớn nhất">
      <line x1={NAME_W} y1={PAD_T - 2} x2={NAME_W} y2={h - 2} stroke={CH.baseline} strokeWidth="1" />
      {brands.map((b, i) => {
        const y0 = PAD_T + i * GROUP_H + 3;
        const rows = [
          { v: b.videoRate, color: CH.blue },
          { v: b.msgRate, color: CH.aqua },
        ];
        return (
          <g key={b.name}>
            <title>{`${b.name}: video ${pct(b.videoRate)} · messenger ${pct(b.msgRate)}`}</title>
            <BrandLabel y={y0 + SUB_H + 1} name={b.name} />
            {rows.map((r, j) => {
              const y = y0 + j * (SUB_H + 2);
              const w = Math.max(Math.min(r.v, 1) * plotW, 1.5);
              return (
                <g key={j}>
                  <rect x={NAME_W} y={y} width={w} height={SUB_H} rx="2.5" fill={r.color} />
                  <text x={NAME_W + w + 4} y={y + SUB_H / 2} dominantBaseline="middle"
                    fontSize="9" fontWeight={700} fill={CH.ink} style={{ fontVariantNumeric: "tabular-nums" }}>{pct(r.v)}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function TopCompetitorCharts({ brands }: { brands: ReportBrandRow[] }) {
  if (!brands.length) return null;
  return (
    <div className="rpt-charts">
      <div className="rpt-chart">
        <div className="rpt-chart-title">QC đang chạy</div>
        <ActiveAdsChart brands={brands} />
      </div>
      <div className="rpt-chart">
        <div className="rpt-chart-title">Biến động tuần — mới vs dừng</div>
        <Legend items={[{ color: CH.blue, label: "QC mới" }, { color: CH.red, label: "QC đã dừng" }]} />
        <NewStoppedChart brands={brands} />
      </div>
      <div className="rpt-chart">
        <div className="rpt-chart-title">Tỷ lệ định dạng trẻ hóa da</div>
        <Legend items={[{ color: CH.blue, label: "Video" }, { color: CH.aqua, label: "Messenger" }]} />
        <RatesChart brands={brands} />
      </div>
    </div>
  );
}

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
              Phạm vi: QC trẻ hóa da · {m.kpis.totalBrands} đối thủ trong danh sách theo dõi · Thị trường Việt Nam
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

          {/* ---- Biểu đồ 5 đối thủ lớn nhất ---- */}
          {m.brands.length > 0 && (
            <section className="rpt-section rpt-avoid">
              <h2 className="rpt-h2">5 đối thủ lớn nhất tuần này</h2>
              <TopCompetitorCharts brands={m.brands.slice(0, 5)} />
            </section>
          )}

          {/* ---- Bảng đối thủ ---- */}
          <section className="rpt-section">
            <h2 className="rpt-h2">Toàn cảnh đối thủ</h2>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Đối thủ</th><th className="num">Đang chạy</th><th className="num">Mới</th>
                  <th className="num">Dừng</th><th className="num">Nhân rộng</th>
                  <th className="num">Video</th><th className="num">Msg</th>
                  <th>Định dạng chính</th><th>Hook chính</th>
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
            {m.inactiveBrands > 0 && (
              <p className="rpt-note">
                Ẩn {m.inactiveBrands} đối thủ không chạy quảng cáo trẻ hóa da tuần này (0 QC đang chạy).
              </p>
            )}
          </section>

          {/* ---- Pattern thị trường ---- */}
          <section className="rpt-section rpt-avoid">
            <h2 className="rpt-h2">Pattern chủ đạo của thị trường</h2>
            <div className="rpt-pattern-grid">
              {[
                { t: "Top hook", items: m.patterns.hooks },
                { t: "Top ưu đãi", items: m.patterns.offers },
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
                <tr><th>Đối thủ</th><th className="num">Số QC</th><th>Định dạng</th><th>Hook đại diện</th><th>SERYN</th></tr>
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
                )) : <tr><td colSpan={5} className="rpt-muted">Chưa có cụm nội dung nhân rộng.</td></tr>}
              </tbody>
            </table>
          </section>

          {/* ---- Action plan ---- */}
          {m.actions.length ? (
            <section className="rpt-section">
              <h2 className="rpt-h2">Kế hoạch hành động ưu tiên</h2>
              <ol className="rpt-actions">
                {m.actions.map((a, i) => (
                  <li key={i} className="rpt-avoid">
                    <span className={`rpt-prio rpt-prio-${a.priority}`}>{viLabel(a.priority) || "—"}</span>
                    <b>{a.insight || viLabel(a.insightType)}</b>
                    {a.brand ? ` · ${a.brand}` : ""}
                    {a.suggested ? <div className="rpt-action-sub">→ {a.suggested}</div> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* ---- Footer / caveat ---- */}
          <footer className="rpt-footer">
            <div className="rpt-footer-brand">SERYN Clinic · Spy Ads Intelligence</div>
            <p className="rpt-footer-note">
              Phạm vi spy: chỉ QC <b>căng da / trẻ hóa da mặt</b> của {m.kpis.totalBrands} đối thủ trong danh sách theo dõi
              (đã loại nâng ngực, hút mỡ, nâng mũi, răng, triệt lông, filler/botox thuần…). Brand hiển thị 0 QC
              trẻ hóa da có thể vẫn chạy QC dịch vụ khác. Dữ liệu là tín hiệu quan sát, không phải kết quả
              ngân sách/chuyển đổi. Báo cáo nội bộ — không chia sẻ ra ngoài.
            </p>
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  );
}
