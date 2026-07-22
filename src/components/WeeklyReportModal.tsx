/* ============================================================
   WeeklyReportModal — bản xem trước báo cáo Spy Ads (tải PDF).
   - Bấm "Tải PDF về" -> html2pdf.js render #seryn-report-doc thành file
     PDF tải thẳng về máy (không qua hộp thoại in).
   - Print CSS (index.css) vẫn giữ để Ctrl+P in được nếu cần.
   - Tiếng Việt chuẩn (font hệ thống/web), giữ nhận diện SERYN.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import type { SpyDashboardData, DataSourceType, SpyReport } from "../types";
import { viLabel, isAdsDisclaimer } from "../utils/spyData";
import { buildReportModel, type ReportBrandRow } from "../utils/reportData";

/* ---- Màu biểu đồ (palette đã validate: CVD ΔE 21.2, aqua dùng nhãn trực tiếp) ---- */
const CH = {
  blue: "#2a78d6", aqua: "#1baf7a", red: "#e34948",
  ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", baseline: "#c3c2b7",
};

const pct = (r: number) => `${Math.round((r || 0) * 100)}%`;
const vn = (n: number) => n.toLocaleString("vi-VN");
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ---- Đọc phân tích THẬT từ weeklyReports (giống tab Phân tích báo cáo) — KHÔNG template ---- */
const parseList = (v?: string) => String(v ?? "").split("|").map((s) => s.trim()).filter(Boolean);
const toBullets = (t?: string) =>
  String(t ?? "").replace(/\s*;?\s*\((\d+)\)\s*/g, "\n($1) ")
    .split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1);

/** Danh sách "Đầu mục: nội dung" -> in đậm đầu mục (nếu có). Bỏ câu miễn trừ dữ liệu. */
function ObsList({ items }: { items: string[] }) {
  const list = items.filter((s) => !isAdsDisclaimer(s));
  if (!list.length) return null;
  return (
    <ul className="rpt-narr">
      {list.map((raw, i) => {
        const j = raw.indexOf(":");
        const head = j > 0 && j <= 46 ? raw.slice(0, j).trim() : null;
        const rest = head ? raw.slice(j + 1).trim() : raw;
        return <li key={i}>{head && <b className="rpt-narr-head">{head}: </b>}{rest}</li>;
      })}
    </ul>
  );
}

/** Danh sách hành động "[Ưu tiên cao] …" -> badge mức ưu tiên. Bỏ câu miễn trừ dữ liệu. */
function ActionList({ items }: { items: string[] }) {
  const list = items.filter((s) => !isAdsDisclaimer(s));
  if (!list.length) return null;
  return (
    <ul className="rpt-narr">
      {list.map((raw, i) => {
        const pm = raw.match(/^\[(.+?)\]\s*(.*)$/);
        const prio = pm ? pm[1] : null;
        const rest = pm ? pm[2] : raw;
        const cls = /cao/i.test(prio || "") ? "high" : /trung|medium/i.test(prio || "") ? "medium" : "low";
        return <li key={i}>{prio && <span className={`rpt-prio rpt-prio-${cls}`}>{prio}</span>}{rest}</li>;
      })}
    </ul>
  );
}

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
  const m = buildReportModel(data, dataSource);
  // Phân tích THẬT — lấy báo cáo tuần mới nhất (đúng nội dung tab "Phân tích báo cáo").
  const report: SpyReport | null = [...(data.weeklyReports ?? [])].sort((a, b) =>
    String(b.period_start).localeCompare(String(a.period_start)) ||
    String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null;
  const execBullets = toBullets(report?.executive_summary).filter((b) => !isAdsDisclaimer(b));

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
              QC trẻ hóa da · {m.kpis.totalBrands} đối thủ · Việt Nam{m.generatedAt ? ` · ${m.generatedAt}` : ""}
            </div>
          </header>

          {/* ---- Tóm tắt điều hành (phân tích THẬT từ báo cáo) ---- */}
          {execBullets.length > 0 && (
            <section className="rpt-section rpt-avoid">
              <h2 className="rpt-h2">Tóm tắt điều hành</h2>
              <ul className="rpt-narr">
                {execBullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </section>
          )}

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

          {/* ---- Biến động đối thủ (phân tích THẬT) ---- */}
          {parseList(report?.key_competitor_moves).length > 0 && (
            <section className="rpt-section">
              <h2 className="rpt-h2">Đối thủ làm gì tuần này</h2>
              <ObsList items={parseList(report?.key_competitor_moves)} />
            </section>
          )}

          {/* ---- Mẫu nội dung & hình ảnh (phân tích THẬT) ---- */}
          {(parseList(report?.notable_content_patterns).length > 0 || parseList(report?.notable_visual_patterns).length > 0) && (
            <section className="rpt-section rpt-avoid">
              <h2 className="rpt-h2">Mẫu nội dung &amp; hình ảnh đáng chú ý</h2>
              <ObsList items={parseList(report?.notable_content_patterns)} />
              {parseList(report?.notable_visual_patterns).length > 0 && (
                <>
                  <div className="rpt-pattern-title" style={{ marginTop: 10 }}>Hình ảnh / creative</div>
                  <ObsList items={parseList(report?.notable_visual_patterns)} />
                </>
              )}
            </section>
          )}

          {/* ---- Rủi ro & lưu ý (phân tích THẬT) ---- */}
          {parseList(report?.risk_warnings).length > 0 && (
            <section className="rpt-section rpt-avoid">
              <h2 className="rpt-h2">Rủi ro &amp; lưu ý</h2>
              <ObsList items={parseList(report?.risk_warnings)} />
            </section>
          )}

          {/* ---- Khuyến nghị cho SERYN (phân tích THẬT — hàm ý + hành động) ---- */}
          {(parseList(report?.seryn_implications).length > 0 || parseList(report?.recommended_actions).length > 0) && (
            <section className="rpt-section">
              <h2 className="rpt-h2">Khuyến nghị cho SERYN</h2>
              {parseList(report?.seryn_implications).length > 0 && (
                <>
                  <div className="rpt-pattern-title">Hàm ý chiến lược</div>
                  <ObsList items={parseList(report?.seryn_implications)} />
                </>
              )}
              {parseList(report?.recommended_actions).length > 0 && (
                <>
                  <div className="rpt-pattern-title" style={{ marginTop: 10 }}>Hành động đề xuất</div>
                  <ActionList items={parseList(report?.recommended_actions)} />
                </>
              )}
            </section>
          )}

          {/* ---- SERYN vs đối thủ (phân tích THẬT) ---- */}
          {parseList(report?.seryn_benchmark).length > 0 && (
            <section className="rpt-section rpt-avoid">
              <h2 className="rpt-h2">SERYN so với đối thủ</h2>
              <ObsList items={parseList(report?.seryn_benchmark)} />
            </section>
          )}

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
                    <td>{trunc(s.hook, 52) || "—"}</td>
                    <td className="rpt-action-cell">{s.action || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="rpt-muted">Chưa có cụm nội dung nhân rộng.</td></tr>}
              </tbody>
            </table>
          </section>

          {/* ---- Footer / caveat ---- */}
          <footer className="rpt-footer">
            <div className="rpt-footer-brand">SERYN Clinic · Spy Ads Intelligence</div>
            <p className="rpt-footer-note">
              Chỉ tính QC <b>trẻ hóa da mặt</b> ({m.kpis.totalBrands} đối thủ; đã loại nâng ngực/hút mỡ/mũi/răng/triệt lông/filler…). SERYN tính riêng. Báo cáo nội bộ.
            </p>
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  );
}
