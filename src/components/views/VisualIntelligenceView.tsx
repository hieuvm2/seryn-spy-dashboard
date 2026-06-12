import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Image as ImageIcon, ShieldAlert, Stethoscope, Sparkles, Repeat, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import type { SpyDashboardData, VisualAnalysis, BrandVisualSummary, VisualPattern, SerynVisualAction } from "../../types";
import {
  getVisualAnalysis,
  buildBrandVisualSummaries,
  buildVisualPatterns,
  buildVisualClusters,
  saveVisualReview,
} from "../../utils/visualAnalysis";
import { statusLabel, statusTone } from "../../utils/incremental";

const fmt = (s: string) => String(s || "").replace(/_/g, " ");
const pct = (n: number | string) => `${Math.round(Number(n) * 100)}%`;

const RISK_TONE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};
const ACTION_TONE: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  avoid: "bg-slate-200 text-slate-600 border-slate-300",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
};
const ACTIONS: SerynVisualAction[] = ["copy", "adapt", "counter", "avoid", "monitor"];

function ScoreBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5"><span>{label}</span><span>{Math.round(value)}</span></div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

export default function VisualIntelligenceView({ data }: { data: SpyDashboardData }) {
  const base = useMemo(() => getVisualAnalysis(data), [data]);
  const [items, setItems] = useState<VisualAnalysis[]>(base.items);
  React.useEffect(() => { setItems(base.items); }, [base.items]);

  const summaries: BrandVisualSummary[] = useMemo(
    () => ((data.brandVisualSummary && data.brandVisualSummary.length) ? data.brandVisualSummary : buildBrandVisualSummaries(items)),
    [data.brandVisualSummary, items]
  );
  const patterns: VisualPattern[] = useMemo(
    () => ((data.visualPatternAnalysis && data.visualPatternAnalysis.length) ? data.visualPatternAnalysis : buildVisualPatterns(items)),
    [data.visualPatternAnalysis, items]
  );

  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("all");
  const [vformat, setVformat] = useState("all");
  const [risk, setRisk] = useState("all");
  const [action, setAction] = useState("all");
  const [note, setNote] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(true);
  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2400); };

  const brands = useMemo(() => Array.from(new Set(items.map((x) => x.brand).filter(Boolean))).sort(), [items]);
  const formats = useMemo(() => Array.from(new Set(items.map((x) => String(x.visual_format)))).sort(), [items]);

  const rows = useMemo(() => items.filter((x) =>
    (brand === "all" || x.brand === brand) &&
    (vformat === "all" || String(x.visual_format) === vformat) &&
    (risk === "all" || String(x.visual_risk_level) === risk) &&
    (action === "all" || String(x.seryn_action) === action) &&
    (!q.trim() || [x.brand, x.ad_id, x.visual_insight_summary, x.text_overlay_summary].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase())))
  ), [items, brand, vformat, risk, action, q]);

  const total = items.length || 1;
  const rate = (pred: (x: VisualAnalysis) => boolean) => Math.round((items.filter(pred).length / total) * 100);
  const kpi = [
    { label: "Before/After", value: rate((x) => x.before_after_presence), Icon: Repeat, tone: "text-indigo-600" },
    { label: "Doctor/Expert", value: rate((x) => x.doctor_presence), Icon: Stethoscope, tone: "text-cyan-600" },
    { label: "UGC style", value: rate((x) => x.visual_format === "ugc_selfie" || x.ugc_score >= 50), Icon: ImageIcon, tone: "text-emerald-600" },
    { label: "Offer banner", value: rate((x) => x.visual_format === "offer_banner" || x.offer_visual_presence), Icon: Sparkles, tone: "text-amber-600" },
    { label: "High risk", value: rate((x) => x.visual_risk_level === "high"), Icon: ShieldAlert, tone: "text-rose-600" },
  ];
  const topFormats = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of items) c[String(x.visual_format)] = (c[String(x.visual_format)] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  const onReview = (adId: string, patch: { seryn_action?: SerynVisualAction; review_note?: string }) => {
    saveVisualReview(adId, patch);
    setItems((prev) => prev.map((x) => (x.ad_id === adId ? { ...x, ...patch, reviewed: true } : x)));
    flash("Đã lưu review (local).");
  };

  const noAsset = !items.some((x) => x.has_media_asset);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">VISUAL INTELLIGENCE</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Phân tích creative (ảnh/video) của đối thủ</h2>
        <p className="text-sm text-slate-600 font-medium">
          Định dạng visual · before/after · bác sĩ · UGC · ưu đãi · điểm clinical/luxury/UGC · rủi ro compliance · pattern đang scale.
          {base.source === "derived" && <span className="text-amber-600 font-semibold"> · suy luận từ text ad (chưa có tab Visual Analysis)</span>}
        </p>
      </div>

      {note && <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-4 h-4" /> {note}</div>}
      {noAsset && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Limited analysis — no media asset available. Provider chưa trả thumbnail/media; điểm số dựa trên text + heuristic, độ tin cậy thấp hơn.</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpi.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1"><c.Icon className="w-3.5 h-3.5 text-slate-400" /><p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-extrabold ${c.tone}`}>{c.value}%</p>
          </div>
        ))}
      </div>

      {/* Top formats + Competitor Visual Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-800 mb-3">Top visual formats</h3>
          <div className="space-y-2">
            {topFormats.map(([f, n]) => (
              <div key={f} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-40 shrink-0 capitalize">{fmt(f)}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${(n / total) * 100}%` }} /></div>
                <span className="text-xs font-mono text-slate-500 w-8 text-right">{n}</span>
              </div>
            ))}
            {!topFormats.length && <p className="text-xs text-slate-400">Chưa có dữ liệu.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
          <h3 className="text-sm font-extrabold text-slate-800 mb-3">Competitor Visual Matrix</h3>
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 font-bold uppercase text-[10px]"><th className="text-left py-1">Brand</th><th>Creatives</th><th>B/A</th><th>Doctor</th><th>UGC</th><th>Offer</th><th>Risk</th></tr></thead>
            <tbody>
              {summaries.slice(0, 14).map((s) => (
                <tr key={s.brand} className="border-t border-slate-100">
                  <td className="text-left py-1.5 font-bold text-slate-700">{s.brand}</td>
                  <td className="text-center font-mono">{s.total_creatives}</td>
                  <td className="text-center">{pct(s.before_after_rate)}</td>
                  <td className="text-center">{pct(s.doctor_rate)}</td>
                  <td className="text-center">{pct(s.ugc_rate)}</td>
                  <td className="text-center">{pct(s.offer_banner_rate)}</td>
                  <td className="text-center">{pct(s.high_risk_rate)}</td>
                </tr>
              ))}
              {!summaries.length && <tr><td colSpan={7} className="text-slate-400 py-2">Chưa có dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Pattern table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-800 mb-3">Visual Pattern Analysis <span className="text-[11px] font-semibold text-slate-400">(≥3 ad cùng pattern = signal)</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 font-bold uppercase text-[10px]"><th className="text-left py-1">Brand</th><th className="text-left">Format</th><th className="text-left">Angle</th><th>Ads</th><th>Signal</th><th>SERYN</th></tr></thead>
            <tbody>
              {patterns.slice(0, 20).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="text-left py-1.5 font-bold text-slate-700">{p.brand}</td>
                  <td className="text-left capitalize">{fmt(String(p.visual_format))}</td>
                  <td className="text-left capitalize">{fmt(String(p.visual_angle))}</td>
                  <td className="text-center font-mono">{p.ad_count}</td>
                  <td className="text-center">{(p.is_signal === true || p.is_signal === "true" || p.is_signal === "TRUE") ? <span className="text-rose-600 font-bold">●</span> : <span className="text-slate-300">○</span>}</td>
                  <td className="text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ACTION_TONE[String(p.recommended_seryn_response)] || ACTION_TONE.monitor}`}>{String(p.recommended_seryn_response).toUpperCase()}</span></td>
                </tr>
              ))}
              {!patterns.length && <tr><td colSpan={6} className="text-slate-400 py-2">Chưa có pattern.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ad, brand, insight…" className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium w-56 focus:outline-none focus:ring-2 focus:ring-cyan-100" />
        </div>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"><option value="all">Mọi brand</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <select value={vformat} onChange={(e) => setVformat(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"><option value="all">Mọi format</option>{formats.map((f) => <option key={f} value={f}>{fmt(f)}</option>)}</select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"><option value="all">Mọi risk</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"><option value="all">Mọi action</option>{ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <button onClick={() => setGrouped((g) => !g)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${grouped ? "bg-cyan-600 text-white border-cyan-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`} title="Gom các creative giống nhau (1 đại diện/cụm)">
          {grouped ? "Đang gom creative" : "Hiện tất cả"}
        </button>
        <span className="text-xs text-slate-400 font-mono">{(grouped ? buildVisualClusters(rows) : rows).length}{grouped ? ` cụm / ${rows.length} ad` : " creatives"}</span>
      </div>

      {/* Visual cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(grouped ? buildVisualClusters(rows) : rows).slice(0, 60).map((x) => (
          <div key={x.ad_id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex gap-4">
            <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
              {x.thumbnail_url
                ? <img src={x.thumbnail_url} alt={x.ad_id} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : <ImageIcon className="w-7 h-7 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-extrabold text-slate-800 truncate flex items-center gap-1.5">
                    {x.brand}
                    {grouped && Number(x.cluster_size) > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">×{x.cluster_size}</span>}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{x.ad_id} · {x.creative_type}{x.reviewed ? " · ✓vision" : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${RISK_TONE[String(x.visual_risk_level)] || RISK_TONE.low}`}>{String(x.visual_risk_level).toUpperCase()} RISK</span>
                  {x.analysis_status && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusTone(x.analysis_status)}`}>{statusLabel(x.analysis_status)}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200 capitalize">{fmt(String(x.visual_format))}</span>
                {x.doctor_presence && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-cyan-50 text-cyan-700 border-cyan-200">Doctor</span>}
                {x.before_after_presence && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">Before/After</span>}
                {x.offer_visual_presence && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">Offer</span>}
                {(x.visual_format === "ugc_selfie" || x.ugc_score >= 50) && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">UGC</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreBar label="Clinical" value={x.clinical_score} tone="bg-cyan-500" />
                <ScoreBar label="Luxury" value={x.beauty_luxury_score} tone="bg-amber-500" />
                <ScoreBar label="UGC" value={x.ugc_score} tone="bg-emerald-500" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{x.visual_insight_summary}</p>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold">Action</span>
                <select
                  value={x.seryn_action}
                  onChange={(e) => onReview(x.ad_id, { seryn_action: e.target.value as SerynVisualAction })}
                  className={`text-[10px] font-bold px-2 py-1 rounded border ${ACTION_TONE[String(x.seryn_action)] || ACTION_TONE.monitor}`}
                >
                  {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {x.reviewed && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> reviewed</span>}
                <input
                  defaultValue={x.review_note || ""}
                  onBlur={(e) => { if (e.target.value !== (x.review_note || "")) onReview(x.ad_id, { review_note: e.target.value }); }}
                  placeholder="ghi chú review…"
                  className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-200"
                />
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-slate-400 font-semibold">Không có creative nào khớp bộ lọc.</p>}
      </div>
    </motion.div>
  );
}
