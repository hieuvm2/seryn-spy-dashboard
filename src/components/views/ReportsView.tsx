import React, { useMemo, useState } from "react";
import {
  FileText, CalendarDays, Calendar, Copy, Check, TrendingUp, TrendingDown,
  AlertTriangle, Sparkles, ListChecks, Building2, Target, ShieldAlert, Info,
} from "lucide-react";
import type { SpyDashboardData, SpyReport, SpyReportType } from "../../types";

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
    `(generated ${fmtDateTime(r.generated_at)} · TZ ${r.timezone})`,
    "",
    sec("1. TÓM TẮT ĐIỀU HÀNH", r.executive_summary),
    "",
    "2. CHỈ SỐ CHÍNH",
    `- Đối thủ theo dõi: ${num(r.total_brands_tracked)}`,
    `- Ads active${isMonthly ? " (cuối tháng)" : ""}: ${num(r.total_active_ads)}`,
    `- Ads mới: ${num(r.total_new_ads)}`,
    `- Ads dừng: ${num(r.total_stopped_ads)}`,
    `- Page theo dõi: ${num(r.total_pages_tracked)}`,
    `- Tỉ lệ crawl thành công: ${crawlRateLabel(r.crawl_success_rate)}`,
    "",
    sec("3. BIẾN ĐỘNG ĐỐI THỦ", r.key_competitor_moves),
    `Top movers: ${r.top_movers || "—"}`,
    `Tăng ad mới: ${r.top_new_ads_brands || "—"}`,
    `Giảm/dừng: ${r.top_stopped_ads_brands || "—"}`,
    "",
    `4. DỊCH VỤ / OFFER NỔI BẬT\n- Dịch vụ: ${r.top_services || "—"}\n- Offer: ${r.top_offers || "—"}`,
    "",
    sec("5. CONTENT ANGLE NỔI BẬT", r.notable_content_patterns),
    `Angle: ${r.top_content_angles || "—"}`,
    "",
    `6. CREATIVE / FORMAT / FUNNEL\n- Format: ${r.top_ad_formats || "—"}\n- Objective: ${r.top_objectives || "—"}`,
    sec("Visual patterns", r.notable_visual_patterns),
    "",
    sec("7. RỦI RO CLAIM", r.risk_warnings),
    "",
    sec("8. HÀM Ý CHO SERYN", r.seryn_implications),
    "",
    sec("9. HÀNH ĐỘNG ĐỀ XUẤT", r.recommended_actions),
    "",
    sec("SERYN VS ĐỐI THỦ", r.seryn_benchmark),
    "",
    `Lưu ý: ${r.data_quality_note || "Đây là báo cáo dựa trên dữ liệu ads công khai và tín hiệu lặp lại, không phải dữ liệu CPA/ROAS/spend thật."}`,
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
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5">
      <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

/* Map accent -> class cụ thể (Tailwind JIT KHÔNG sinh class từ chuỗi nội suy). */
const ICON_COLOR: Record<string, string> = {
  slate: "text-slate-500", cyan: "text-cyan-500", violet: "text-violet-500",
  amber: "text-amber-500", emerald: "text-emerald-500", rose: "text-rose-500",
};
const MOVER_TONE: Record<string, { wrap: string; icon: string }> = {
  cyan: { wrap: "border-cyan-100 bg-cyan-50/50", icon: "text-cyan-500" },
  emerald: { wrap: "border-emerald-100 bg-emerald-50/50", icon: "text-emerald-500" },
  rose: { wrap: "border-rose-100 bg-rose-50/50", icon: "text-rose-500" },
};

/** Section: nếu field list -> render bullet; nếu 1 đoạn -> render text. */
function Section({ icon: Icon, title, body, accent = "slate" }: { icon: any; title: string; body?: string; accent?: string }) {
  const items = parseList(body);
  const has = !!String(body ?? "").trim();
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className={`w-4 h-4 ${ICON_COLOR[accent] ?? ICON_COLOR.slate}`} />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {!has ? (
        <p className="text-xs text-slate-400 italic">Không có dữ liệu nổi bật trong kỳ.</p>
      ) : items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-slate-600 flex gap-2">
              <span className="text-slate-300 select-none">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] leading-relaxed text-slate-600">{body}</p>
      )}
    </div>
  );
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
            <span key={i} className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[11px] font-semibold border border-cyan-100">{it}</span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">—</p>
      )}
    </div>
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

      {/* Toggle weekly / monthly */}
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

      {reports.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
          {/* List */}
          <div className="space-y-2 lg:max-h-[78vh] lg:overflow-y-auto lg:pr-1">
            {reports.map((r) => {
              const active = selected?.report_id === r.report_id;
              return (
                <button
                  key={r.report_id}
                  onClick={() => setSelectedId(r.report_id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition ${
                    active ? "border-cyan-300 bg-cyan-50/60 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-[13px] font-bold text-slate-800 leading-snug">{r.title}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">{r.period_start} → {r.period_end}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] font-semibold">
                    <span className="text-slate-600">{num(r.total_active_ads)} active</span>
                    <span className="text-emerald-600">+{num(r.total_new_ads)} mới</span>
                    <span className="text-rose-500">−{num(r.total_stopped_ads)} dừng</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Tạo: {fmtDateTime(r.generated_at)}</p>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {selected && <ReportDetail report={selected} />}
        </div>
      )}

      {/* Manual run hint */}
      <ManualHint />
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
              {r.period_start} → {r.period_end} · TZ {r.timezone} · {fmtDateTime(r.generated_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton label="Copy Executive Summary" getText={() => r.executive_summary} />
            <CopyButton label="Copy Recommended Actions" getText={() => parseList(r.recommended_actions).map((s) => `- ${s}`).join("\n")} />
            <CopyButton label="Copy Full Report" getText={() => composeFullReport(r)} />
          </div>
        </div>

        {/* Executive summary */}
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[13px] leading-relaxed text-slate-700">{r.executive_summary}</p>
        </div>

        {/* KPI snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3">
          <Kpi label="Đối thủ" value={num(r.total_brands_tracked)} />
          <Kpi label="Ads active" value={num(r.total_active_ads)} />
          <Kpi label="Ads mới" value={`+${num(r.total_new_ads)}`} tone="new" />
          <Kpi label="Ads dừng" value={`−${num(r.total_stopped_ads)}`} tone="stopped" />
          <Kpi label="Page" value={num(r.total_pages_tracked)} />
          <Kpi label="Crawl OK" value={crawlRateLabel(r.crawl_success_rate)} />
        </div>
      </div>

      {/* Movers */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-bold text-slate-800">Top Movers</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <MoverCol icon={TrendingUp} title="Biến động (movers)" value={r.top_movers} accent="cyan" />
          <MoverCol icon={TrendingUp} title="Tăng ad mới" value={r.top_new_ads_brands} accent="emerald" />
          <MoverCol icon={TrendingDown} title="Giảm / dừng" value={r.top_stopped_ads_brands} accent="rose" />
        </div>
      </div>

      {/* Top patterns */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-bold text-slate-800">Tín hiệu nổi bật</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          <TopChips title="Dịch vụ" value={r.top_services} />
          <TopChips title="Offer" value={r.top_offers} />
          <TopChips title="Content angle" value={r.top_content_angles} />
          <TopChips title="Ad format" value={r.top_ad_formats} />
          <TopChips title="Objective / funnel" value={r.top_objectives} />
        </div>
      </div>

      <Section icon={Building2} title="Biến động đối thủ" body={r.key_competitor_moves} accent="cyan" />
      <Section icon={ListChecks} title="Content pattern đáng theo dõi" body={r.notable_content_patterns} accent="cyan" />
      <Section icon={Sparkles} title="Visual pattern" body={r.notable_visual_patterns} accent="violet" />
      <Section icon={ShieldAlert} title="Rủi ro claim" body={r.risk_warnings} accent="amber" />
      <Section icon={Target} title="Hàm ý cho SERYN" body={r.seryn_implications} accent="cyan" />
      <Section icon={ListChecks} title="Hành động đề xuất" body={r.recommended_actions} accent="emerald" />
      {!!String(r.seryn_benchmark ?? "").trim() && (
        <Section icon={Sparkles} title="SERYN vs Đối thủ" body={r.seryn_benchmark} accent="cyan" />
      )}

      {/* Data quality note */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[12px] leading-relaxed text-amber-800">
          {r.data_quality_note || "Đây là báo cáo dựa trên dữ liệu ads công khai và tín hiệu lặp lại, không phải dữ liệu CPA/ROAS/spend thật."}
        </p>
      </div>
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
        Hãy chạy {mode === "weekly" ? "weekly" : "monthly"} report workflow hoặc tạo report thủ công bằng lệnh bên dưới.
      </p>
    </div>
  );
}

function ManualHint() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Info className="w-4 h-4 text-slate-400" />
        <p className="text-xs font-bold text-slate-600">Tạo báo cáo thủ công (cần cấu hình Google Sheets)</p>
      </div>
      <div className="space-y-1.5">
        {[
          { cmd: "npm run report:weekly", desc: "Tạo báo cáo tuần trước (thứ Hai → Chủ Nhật)" },
          { cmd: "npm run report:monthly", desc: "Tạo báo cáo tổng kết tháng hiện tại" },
        ].map((c) => (
          <div key={c.cmd} className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-[12px] px-2 py-1 rounded bg-slate-900 text-slate-100">{c.cmd}</code>
            <span className="text-[11px] text-slate-500">{c.desc}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-2.5">
        Báo cáo được lưu theo từng kỳ trên Google Sheets (tab <span className="font-mono">Weekly Reports</span> / <span className="font-mono">Monthly Reports</span>),
        không ghi đè kỳ cũ. GitHub Actions tự chạy weekly mỗi thứ Hai và monthly vào ngày cuối tháng.
      </p>
    </div>
  );
}
