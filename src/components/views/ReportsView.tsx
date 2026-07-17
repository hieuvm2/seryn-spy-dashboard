import React, { useMemo, useState } from "react";
import {
  FileText, CalendarDays, Calendar, Copy, Check, TrendingUp, TrendingDown,
  Sparkles, ListChecks, Target, Info,
} from "lucide-react";
import type { SpyDashboardData, SpyReport, SpyReportType } from "../../types";
import { viLabel, humanizeText, isAdsDisclaimer, stripAdsDisclaimer } from "../../utils/spyData";

/* ============================================================
   Báo cáo Spy Ads — xem lại báo cáo tuần / tháng (lưu theo kỳ).
   Không tạo report trên frontend; chỉ HIỂN THỊ report đã lưu (Sheets/demo).
   List-fields lưu "key (count) | ..." hoặc "item | item" -> split("|").
   ============================================================ */

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };

/** Tách field list ("a | b | c") -> ["a","b","c"]. Rỗng -> []. */
function parseList(v?: string): string[] {
  return String(v ?? "").split("|").map((s) => s.trim()).filter(Boolean);
}

/** Đoạn văn dài -> các gạch đầu dòng ngắn: tách mục đánh số "(1)…(2)…" ra dòng
 *  riêng rồi cắt theo câu. Dùng cho tóm tắt điều hành (đọc nhanh, không lê thê). */
function toBullets(text?: string): string[] {
  const s = humanizeText(stripAdsDisclaimer(String(text ?? ""))).trim();
  if (!s) return [];
  const withMarks = s.replace(/\s*;?\s*\((\d+)\)\s*/g, "\n($1) "); // mỗi mục (n) xuống dòng
  return withMarks
    .split(/\n|(?<=[.!?])\s+/)      // xuống dòng thủ công hoặc hết câu
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

/** "YYYY-MM" -> "Tháng MM/YYYY". */
function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return y && mo ? `Tháng ${mo}/${y}` : m;
}

/* ---- Màu biểu đồ (palette validate CVD-safe, giống báo cáo PDF) ---- */
const CH = { blue: "#2a78d6", aqua: "#1baf7a", red: "#e34948", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", baseline: "#c3c2b7", grid: "#e1e0d9" };

/** Parse "Brand (48 mới)" / "Brand ▲+44" / "Brand ▼-6" -> {name, value}. */
function parseBrandCounts(v?: string): { name: string; value: number }[] {
  return parseList(v)
    .map((item) => {
      const m = item.match(/^(.+?)\s*(?:\(|[▲▼])\s*([+−–-]?\s*\d+)/);
      if (!m) return null;
      const value = Math.abs(num(m[2].replace(/[−–]/g, "-")));
      const name = m[1].trim();
      return name && value >= 0 ? { name, value } : null;
    })
    .filter((x): x is { name: string; value: number } => !!x);
}

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try { return d.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return d.toISOString().slice(0, 16).replace("T", " "); }
}

function crawlRateLabel(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  return s.includes("%") ? s : `${s}%`;
}

/** Ghép full report text để "Copy Full Report" (đọc được, có cảnh báo dữ liệu). */
function composeFullReport(r: SpyReport): string {
  const sec = (title: string, body?: string) => {
    const items = parseList(body);
    const content = items.length > 1 ? items.map((s) => `- ${s}`).join("\n") : (body || "—");
    return `${title}\n${content}`;
  };
  const isMonthly = r.report_type === "monthly";
  const head = isMonthly
    ? `BÁO CÁO TỔNG KẾT THÁNG ${r.period_start.slice(0, 7)}`
    : `BÁO CÁO SPY ADS TUẦN ${r.period_start} → ${r.period_end}`;
  return [
    head,
    `(tạo lúc ${fmtDateTime(r.generated_at)} · múi giờ ${r.timezone})`,
    "",
    sec("1. TÓM TẮT ĐIỀU HÀNH", r.executive_summary),
    "",
    "2. CHỈ SỐ CHÍNH",
    `- Đối thủ theo dõi: ${num(r.total_brands_tracked)}`,
    `- Ads đang chạy${isMonthly ? " (cuối tháng)" : ""}: ${num(r.total_active_ads)}`,
    `- Ads mới: ${num(r.total_new_ads)}`,
    `- Ads dừng: ${num(r.total_stopped_ads)}`,
    `- Page theo dõi: ${num(r.total_pages_tracked)}`,
    `- Tỉ lệ crawl thành công: ${crawlRateLabel(r.crawl_success_rate)}`,
    "",
    sec("3. BIẾN ĐỘNG ĐỐI THỦ", r.key_competitor_moves),
    `Biến động mạnh nhất (top movers): ${r.top_movers || "—"}`,
    `Tăng ad mới: ${r.top_new_ads_brands || "—"}`,
    `Giảm/dừng: ${r.top_stopped_ads_brands || "—"}`,
    "",
    `4. DỊCH VỤ / ƯU ĐÃI NỔI BẬT\n- Dịch vụ: ${r.top_services || "—"}\n- Ưu đãi: ${r.top_offers || "—"}`,
    "",
    sec("5. CONTENT ANGLE NỔI BẬT", r.notable_content_patterns),
    `Angle: ${r.top_content_angles || "—"}`,
    "",
    `6. CREATIVE / FORMAT / FUNNEL\n- Format: ${r.top_ad_formats || "—"}\n- Objective: ${r.top_objectives || "—"}`,
    sec("Visual patterns", r.notable_visual_patterns),
    "",
    sec("7. HÀM Ý CHO SERYN", r.seryn_implications),
    "",
    sec("8. HÀNH ĐỘNG ĐỀ XUẤT", r.recommended_actions),
    "",
    sec("SERYN VS ĐỐI THỦ", r.seryn_benchmark),
  ].join("\n");
}

/* ---------------- small presentational pieces ---------------- */

function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch { /* clipboard có thể bị chặn — bỏ qua êm */ }
  };
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? "Đã copy" : label}
    </button>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "new" | "stopped" }) {
  const color = tone === "new" ? "text-emerald-600" : tone === "stopped" ? "text-rose-600" : "text-slate-900";
  const Arrow = tone === "new" ? TrendingUp : tone === "stopped" ? TrendingDown : null;
  const border = tone === "new" ? "border-emerald-200 bg-emerald-50/40" : tone === "stopped" ? "border-rose-200 bg-rose-50/40" : "border-slate-100 bg-slate-50";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${border}`}>
      <p className="text-[11px] uppercase font-mono tracking-wide text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-extrabold mt-0.5 leading-tight flex items-center gap-1 ${color}`}>
        {Arrow && <Arrow className="w-5 h-5 shrink-0" strokeWidth={2.75} />}{value}
      </p>
    </div>
  );
}

const MOVER_TONE: Record<string, { wrap: string; icon: string }> = {
  cyan: { wrap: "border-cyan-100 bg-cyan-50/50", icon: "text-cyan-500" },
  emerald: { wrap: "border-emerald-100 bg-emerald-50/50", icon: "text-emerald-500" },
  rose: { wrap: "border-rose-100 bg-rose-50/50", icon: "text-rose-500" },
};

/** Tách "Đầu mục: nội dung" (đầu mục ngắn) để dựng bảng 2 cột quét nhanh. */
function splitHead(s: string): { head: string; rest: string } | null {
  const i = s.indexOf(":");
  if (i > 0 && i <= 42) return { head: s.slice(0, i).trim(), rest: s.slice(i + 1).trim() };
  return null;
}

const PRIO_BADGE: Record<string, string> = {
  "ưu tiên cao": "bg-rose-50 text-rose-700 border-rose-200",
  "trung bình": "bg-amber-50 text-amber-700 border-amber-200",
  "thấp": "bg-slate-100 text-slate-600 border-slate-200",
};
const HEAD_BADGE: Record<string, string> = {
  "phản đòn": "bg-rose-50 text-rose-700 border-rose-200",
  "học hỏi": "bg-amber-50 text-amber-700 border-amber-200",
  "áp dụng": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "tránh": "bg-slate-100 text-slate-600 border-slate-200",
  "theo dõi": "bg-cyan-50 text-cyan-700 border-cyan-200",
};

/** Bảng quan sát: "Brand: nội dung" -> hàng [badge đậm | nội dung ngắn];
    "[Ưu tiên cao] việc..." -> badge màu theo mức ưu tiên. Bỏ câu miễn trừ. */
function ObservationTable({ title, body }: { title?: string; body?: string }) {
  const items = parseList(body).filter((it) => !isAdsDisclaimer(it)).map((it) => humanizeText(it));
  if (!items.length) return null;
  return (
    <div>
      {title && <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">{title}</p>}
      <table className="w-full">
        <tbody>
          {items.map((raw, i) => {
            const pm = raw.match(/^\[(.+?)\]\s*(.*)$/);
            const sp = pm ? null : splitHead(raw);
            const head = pm ? pm[1] : sp?.head;
            const rest = pm ? pm[2] : sp ? sp.rest : raw;
            const badge = (head && (PRIO_BADGE[head.toLowerCase()] || HEAD_BADGE[head.toLowerCase()])) || "bg-slate-50 border-slate-200 text-slate-700";
            return (
              <tr key={i} className="border-b border-slate-100 last:border-0 align-top">
                <td className="py-2 pr-3 w-32 sm:w-44">
                  {head && <span className={`inline-block px-2 py-0.5 rounded-md border text-[12px] font-bold leading-snug ${badge}`}>{head}</span>}
                </td>
                <td className="py-2 text-[14px] leading-relaxed text-slate-700">{rest}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Biểu đồ thanh mini từ chuỗi "key (count) | ..." — thay chip cloud, đọc nhanh hơn.
    Không parse được số -> fallback chips. */
function MiniBars({ title, value }: { title: string; value?: string }) {
  const items = parseList(value)
    .map((it) => { const m = it.match(/^(.+?)\s*\((\d+)/); return m ? { label: viLabel(m[1].trim()), count: num(m[2]) } : null; })
    .filter((x): x is { label: string; count: number } => !!x && !!x.label)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  if (!items.length) return <TopChips title={title} value={value} />;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div>
      <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1.5">{title}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={`${it.label}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 truncate text-slate-600 font-semibold" title={it.label}>{it.label}</span>
            <div className="flex-1 h-2.5 rounded-[3px] bg-slate-100 overflow-hidden">
              <div className="h-full rounded-[3px]" style={{ width: `${Math.max((it.count / max) * 100, 3)}%`, background: CH.blue }} />
            </div>
            <span className="w-8 text-right text-slate-800 font-bold tabular-nums">{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Việt hóa chip "key (count)": dịch phần key qua viLabel, giữ "(count)". */
function chipLabel(it: string): string {
  const m = it.match(/^(.*?)\s*(\([^)]*\))?$/);
  if (!m) return viLabel(it);
  const key = viLabel(m[1].trim());
  return m[2] ? `${key} ${m[2]}` : key;
}

/** Top chips dạng "key (count)". */
function TopChips({ title, value }: { title: string; value?: string }) {
  const items = parseList(value);
  return (
    <div>
      <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1.5">{title}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[11px] font-semibold border border-cyan-100">{chipLabel(it)}</span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">—</p>
      )}
    </div>
  );
}

/* ---------------- charts (SVG thuần, palette validate) ---------------- */

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  );
}

/** Biến động top 5 đối thủ trong kỳ — diverging: dừng (đỏ, trái) vs mới (xanh, phải).
 *  Dựng bằng HTML để hiện ĐỦ tên đối thủ + căn trái/phải đồng bộ (cột số cố định 2 bên,
 *  hai thanh đối xứng quanh trục giữa). */
function MoversChart({ newBrands, stoppedBrands }: { newBrands?: string; stoppedBrands?: string }) {
  const news = parseBrandCounts(newBrands);
  const stops = parseBrandCounts(stoppedBrands);
  const byName = new Map<string, { name: string; added: number; stopped: number }>();
  for (const n of news) byName.set(n.name.toLowerCase(), { name: n.name, added: n.value, stopped: 0 });
  for (const s of stops) {
    const k = s.name.toLowerCase();
    const cur = byName.get(k);
    if (cur) cur.stopped = s.value; else byName.set(k, { name: s.name, added: 0, stopped: s.value });
  }
  const rows = [...byName.values()].sort((a, b) => (b.added + b.stopped) - (a.added + a.stopped)).slice(0, 5);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => Math.max(r.added, r.stopped)), 1);
  const barW = (v: number) => (v > 0 ? `${Math.max((v / max) * 100, 4)}%` : "0%");

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2" title={`${r.name}: +${r.added} mới · −${r.stopped} dừng`}>
          {/* Tên đối thủ — hiện đầy đủ, căn phải về phía trục */}
          <div className="w-28 sm:w-52 shrink-0 text-right text-[12px] font-semibold text-slate-700 leading-tight">{r.name}</div>
          {/* Số QC dừng — cột cố định, căn phải (đồng bộ mọi hàng) */}
          <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums" style={{ color: CH.red }}>{r.stopped > 0 ? `−${r.stopped}` : ""}</span>
          {/* Thanh "đã dừng" — mọc từ trục sang trái */}
          <div className="flex-1 flex justify-end min-w-0"><div className="h-3.5 rounded-sm" style={{ width: barW(r.stopped), background: CH.red }} /></div>
          {/* Trục giữa */}
          <div className="w-px self-stretch bg-slate-300 shrink-0" />
          {/* Thanh "mới" — mọc từ trục sang phải */}
          <div className="flex-1 flex justify-start min-w-0"><div className="h-3.5 rounded-sm" style={{ width: barW(r.added), background: CH.blue }} /></div>
          {/* Số QC mới — cột cố định, căn trái (đồng bộ mọi hàng) */}
          <span className="w-9 shrink-0 text-left text-[11px] font-bold tabular-nums" style={{ color: CH.blue }}>{r.added > 0 ? `+${r.added}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** Xu hướng qua các kỳ báo cáo — 3 series: active / mới / dừng (cùng đơn vị QC). */
function TrendChart({ reports }: { reports: SpyReport[] }) {
  // Khử trùng kỳ (cùng period_start tạo nhiều lần -> giữ bản generated_at mới nhất).
  const byPeriod = new Map<string, SpyReport>();
  for (const r of [...reports].sort((a, b) =>
    String(a.period_start).localeCompare(String(b.period_start)) ||
    String(a.generated_at).localeCompare(String(b.generated_at)))) {
    byPeriod.set(String(r.period_start), r);
  }
  const pts = [...byPeriod.values()]
    .slice(-8)
    .map((r) => ({
      label: String(r.period_start).slice(5), // MM-DD
      active: num(r.total_active_ads), added: num(r.total_new_ads), stopped: num(r.total_stopped_ads),
    }));
  if (pts.length < 2) return null;

  const W = 720, H = 170, L = 40, R = 46, T = 10, B = 26;
  const plotW = W - L - R, plotH = H - T - B;
  const max = Math.max(...pts.flatMap((p) => [p.active, p.added, p.stopped]), 1);
  const x = (i: number) => L + (i / (pts.length - 1)) * plotW;
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const line = (key: "active" | "added" | "stopped") => pts.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");
  const series: { key: "active" | "added" | "stopped"; color: string; label: string }[] = [
    { key: "active", color: CH.blue, label: "Ads đang chạy" },
    { key: "added", color: CH.aqua, label: "Ads mới" },
    { key: "stopped", color: CH.red, label: "Ads dừng" },
  ];
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  // Nhãn giá trị cuối đường: đẩy tách nhau ≥11px để không chồng chữ.
  const endLabels = series
    .map((s) => ({ color: s.color, v: pts[pts.length - 1][s.key], ly: y(pts[pts.length - 1][s.key]) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].ly - endLabels[i - 1].ly < 11) endLabels[i].ly = endLabels[i - 1].ly + 11;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Xu hướng ads đang chạy, mới, dừng qua các kỳ báo cáo">
      {ticks.map((tv) => (
        <g key={tv}>
          <line x1={L} y1={y(tv)} x2={W - R} y2={y(tv)} stroke={CH.grid} strokeWidth="1" />
          <text x={L - 5} y={y(tv)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill={CH.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{tv}</text>
        </g>
      ))}
      {pts.map((p, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill={CH.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{p.label}</text>
      ))}
      {series.map((s) => (
        <g key={s.key}>
          <polyline points={line(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p[s.key])} r="3" fill={s.color} stroke="#fff" strokeWidth="1.5">
              <title>{`${p.label} · ${s.label}: ${p[s.key]}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {endLabels.map((l, i) => (
        <text key={i} x={W - R + 6} y={l.ly} dominantBaseline="middle" fontSize="9.5" fontWeight={700} fill={CH.ink2} style={{ fontVariantNumeric: "tabular-nums" }}>{l.v}</text>
      ))}
    </svg>
  );
}

/* ---------------- main view ---------------- */

export default function ReportsView({ data }: { data: SpyDashboardData }) {
  const [mode, setMode] = useState<SpyReportType>("weekly");

  const reports = useMemo(() => {
    const arr = (mode === "weekly" ? data.weeklyReports : data.monthlyReports) ?? [];
    // sắp xếp mới nhất trước (theo period_start, rồi generated_at).
    return [...arr].sort((a, b) => {
      const p = String(b.period_start).localeCompare(String(a.period_start));
      return p !== 0 ? p : String(b.generated_at).localeCompare(String(a.generated_at));
    });
  }, [data.weeklyReports, data.monthlyReports, mode]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => reports.find((r) => r.report_id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId],
  );

  // Nhãn kỳ báo cáo cho dropdown: tuần -> "Tuần A → B"; tháng -> "Tháng MM/YYYY".
  const periodLabel = (r: SpyReport) =>
    mode === "monthly" ? monthLabel(String(r.period_start).slice(0, 7)) : `Tuần ${r.period_start} → ${r.period_end}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-600" />
          <h1 className="text-xl font-bold text-slate-900">Báo cáo Spy Ads</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Xem lại báo cáo tuần và tổng kết tháng của dữ liệu spy ads đối thủ.
        </p>
      </div>

      {/* Toggle weekly / monthly + chọn kỳ báo cáo (trên cùng) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          {([
            { id: "weekly", label: "Báo cáo tuần", icon: CalendarDays },
            { id: "monthly", label: "Báo cáo tháng", icon: Calendar },
          ] as const).map((t) => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setMode(t.id); setSelectedId(null); }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition ${
                  active ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        {reports.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 min-w-[240px]">
            <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selected?.report_id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-transparent text-[13px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              {reports.map((r) => (
                <option key={r.report_id} value={r.report_id}>{periodLabel(r)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Xu hướng qua các kỳ — theo dõi nhanh không cần mở từng báo cáo */}
      {reports.length >= 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            <h3 className="text-base font-bold text-slate-800">Xu hướng qua các kỳ {mode === "weekly" ? "tuần" : "tháng"}</h3>
          </div>
          <ChartLegend items={[{ color: CH.blue, label: "Ads đang chạy" }, { color: CH.aqua, label: "Ads mới" }, { color: CH.red, label: "Ads dừng" }]} />
          <TrendChart reports={reports} />
        </div>
      )}

      {reports.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        selected && <ReportDetail report={selected} />
      )}

    </div>
  );
}

function ReportDetail({ report: r }: { report: SpyReport }) {
  return (
    <div className="space-y-4 min-w-0">
      {/* Title + copy actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{r.title}</h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {r.period_start} → {r.period_end} · Múi giờ {r.timezone} · {fmtDateTime(r.generated_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton label="Copy tóm tắt điều hành" getText={() => r.executive_summary} />
            <CopyButton label="Copy hành động đề xuất" getText={() => parseList(r.recommended_actions).map((s) => `- ${s}`).join("\n")} />
            <CopyButton label="Copy toàn bộ báo cáo" getText={() => composeFullReport(r)} />
          </div>
        </div>

        {/* Executive summary — gạch đầu dòng ngắn gọn */}
        {(() => {
          const bullets = toBullets(r.executive_summary);
          if (!bullets.length) return null;
          return (
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="text-[11px] uppercase font-mono tracking-wide text-slate-500 font-bold mb-2">Tóm tắt điều hành</p>
              <ul className="space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-slate-800">
                    <span className="text-cyan-600 font-bold shrink-0 mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* KPI snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <Kpi label="Đối thủ" value={num(r.total_brands_tracked)} />
          <Kpi label="Ads đang chạy" value={num(r.total_active_ads)} />
          <Kpi label="Ads mới" value={`+${num(r.total_new_ads)}`} tone="new" />
          <Kpi label="Ads dừng" value={`−${num(r.total_stopped_ads)}`} tone="stopped" />
        </div>
      </div>

      {/* Biến động top 5 đối thủ trong kỳ — biểu đồ; fallback dạng chữ nếu không parse được */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-cyan-500" />
          <h3 className="text-base font-bold text-slate-800">Biến động top 5 đối thủ trong kỳ</h3>
        </div>
        {parseBrandCounts(r.top_new_ads_brands).length + parseBrandCounts(r.top_stopped_ads_brands).length > 0 ? (
          <>
            <ChartLegend items={[{ color: CH.blue, label: "QC mới" }, { color: CH.red, label: "QC đã dừng" }]} />
            <MoversChart newBrands={r.top_new_ads_brands} stoppedBrands={r.top_stopped_ads_brands} />
          </>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3 mt-2">
            <MoverCol icon={TrendingUp} title="Biến động mạnh nhất" value={r.top_movers} accent="cyan" />
            <MoverCol icon={TrendingUp} title="Tăng ad mới" value={r.top_new_ads_brands} accent="emerald" />
            <MoverCol icon={TrendingDown} title="Giảm / dừng" value={r.top_stopped_ads_brands} accent="rose" />
          </div>
        )}
        {/* Diễn giải biến động — bảng brand | quan sát */}
        {!!String(r.key_competitor_moves ?? "").trim() && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <ObservationTable title="Diễn giải" body={r.key_competitor_moves} />
          </div>
        )}
      </div>

      {/* Tín hiệu nổi bật — biểu đồ thanh mini theo từng chiều */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-500" />
          <h3 className="text-base font-bold text-slate-800">Tín hiệu nổi bật</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          <MiniBars title="Dịch vụ" value={r.top_services} />
          <MiniBars title="Ưu đãi" value={r.top_offers} />
          <MiniBars title="Góc nội dung" value={r.top_content_angles} />
          <MiniBars title="Định dạng QC" value={r.top_ad_formats} />
          <MiniBars title="Mục tiêu / phễu" value={r.top_objectives} />
        </div>
      </div>

      {/* Mẫu nội dung & hình ảnh — bảng brand | quan sát */}
      {(!!String(r.notable_content_patterns ?? "").trim() || !!String(r.notable_visual_patterns ?? "").trim()) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-violet-500" />
            <h3 className="text-base font-bold text-slate-800">Mẫu nội dung &amp; hình ảnh đáng chú ý</h3>
          </div>
          <ObservationTable title="Nội dung" body={r.notable_content_patterns} />
          <ObservationTable title="Hình ảnh / creative" body={r.notable_visual_patterns} />
        </div>
      )}

      {/* Khuyến nghị cho SERYN — bảng có badge chiến lược / mức ưu tiên */}
      {(!!String(r.seryn_implications ?? "").trim() || !!String(r.recommended_actions ?? "").trim()) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" />
            <h3 className="text-base font-bold text-slate-800">Khuyến nghị cho SERYN</h3>
          </div>
          <ObservationTable title="Hàm ý chiến lược" body={r.seryn_implications} />
          <ObservationTable title="Hành động đề xuất" body={r.recommended_actions} />
        </div>
      )}

      {/* SERYN so với đối thủ — bảng chỉ số | giá trị */}
      {!!String(r.seryn_benchmark ?? "").trim() && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-slate-800">SERYN so với đối thủ</h3>
          </div>
          <ObservationTable body={r.seryn_benchmark} />
        </div>
      )}

    </div>
  );
}

function MoverCol({ icon: Icon, title, value, accent }: { icon: any; title: string; value?: string; accent: string }) {
  const items = parseList(value);
  const tone = MOVER_TONE[accent] ?? MOVER_TONE.cyan;
  return (
    <div className={`rounded-xl border ${tone.wrap} p-3`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${tone.icon}`} />
        <p className="text-[11px] font-bold text-slate-600">{title}</p>
      </div>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((it, i) => <li key={i} className="text-[12px] text-slate-600">{it}</li>)}
        </ul>
      ) : <p className="text-[11px] text-slate-400 italic">—</p>}
    </div>
  );
}

function EmptyState({ mode }: { mode: SpyReportType }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-bold text-slate-700">Chưa có báo cáo nào.</p>
      <p className="text-xs text-slate-500 mt-1.5">
        Hãy chạy workflow báo cáo {mode === "weekly" ? "tuần" : "tháng"} hoặc tạo báo cáo thủ công bằng lệnh bên dưới.
      </p>
    </div>
  );
}

