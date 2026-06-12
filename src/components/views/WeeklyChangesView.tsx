import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle, Activity } from "lucide-react";
import type { SpyDashboardData, WeeklyChangeInsight } from "../../types";
import { getWeeklyChangeInsights, CHANGE_TYPE_LABELS, SEVERITY_TONE, signalLabel } from "../../utils/weeklyChanges";

const ACTION_TONE: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
  ignore: "bg-slate-100 text-slate-500 border-slate-200",
};

function pct(v: number | string) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; }

export default function WeeklyChangesView({ data }: { data: SpyDashboardData }) {
  const { items, source } = useMemo(() => getWeeklyChangeInsights(data), [data]);

  const [brand, setBrand] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"severity" | "confidence">("severity");

  const brands = useMemo(() => Array.from(new Set(items.map((x) => x.brand).filter(Boolean))).sort(), [items]);
  const types = useMemo(() => Array.from(new Set(items.map((x) => String(x.change_type)))), [items]);

  const SEV_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const rows = useMemo(() => {
    let list = items.filter((x) =>
      (brand === "all" || x.brand === brand) &&
      (type === "all" || String(x.change_type) === type) &&
      (severity === "all" || String(x.severity) === severity)
    );
    list = [...list].sort((a, b) =>
      sortBy === "severity"
        ? (SEV_RANK[String(b.severity)] || 0) - (SEV_RANK[String(a.severity)] || 0) || Number(b.confidence_score) - Number(a.confidence_score)
        : Number(b.confidence_score) - Number(a.confidence_score)
    );
    return list;
  }, [items, brand, type, severity, sortBy]);

  const kpi = useMemo(() => ({
    total: items.length,
    high: items.filter((x) => String(x.severity) === "high").length,
    up: items.filter((x) => String(x.change_type) === "brand_scaled_up").length,
    down: items.filter((x) => String(x.change_type) === "brand_scaled_down").length,
    themes: items.filter((x) => String(x.change_type) === "new_campaign_theme").length,
  }), [items]);

  const cards = [
    { label: "Tổng thay đổi", value: kpi.total, tone: "text-slate-900", Icon: Activity },
    { label: "Mức cao", value: kpi.high, tone: "text-rose-600", Icon: AlertTriangle },
    { label: "Scaling up", value: kpi.up, tone: "text-emerald-600", Icon: TrendingUp },
    { label: "Scaling down", value: kpi.down, tone: "text-amber-600", Icon: TrendingDown },
    { label: "Campaign mới", value: kpi.themes, tone: "text-indigo-600", Icon: Sparkles },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">THAY ĐỔI TUẦN</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Tín hiệu thay đổi chiến lược của đối thủ</h2>
        <p className="text-sm text-slate-600 font-medium">
          Không chỉ đếm ad mới/cũ — phát hiện scaling, đổi offer/hook, dịch chuyển dịch vụ/visual, page mới/ngừng.
          {source === "legacy" && <span className="text-amber-600 font-semibold"> · đang dùng dữ liệu cũ (chưa có tab Weekly Change Insights)</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1"><c.Icon className="w-3.5 h-3.5 text-slate-400" /><p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700">
          <option value="all">Tất cả brand</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700">
          <option value="all">Tất cả loại</option>
          {types.map((t) => <option key={t} value={t}>{CHANGE_TYPE_LABELS[t] || t}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700">
          <option value="all">Mọi mức</option>
          <option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "severity" | "confidence")} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700">
          <option value="severity">Sắp theo mức độ</option>
          <option value="confidence">Sắp theo độ tin cậy</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {rows.map((x: WeeklyChangeInsight) => (
          <div key={x.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-extrabold text-slate-800">{x.brand}</h4>
                <span className="text-[10px] text-slate-400 font-mono">{x.week_start}{x.previous_week_start ? ` ← ${x.previous_week_start}` : ""}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${SEVERITY_TONE[String(x.severity)] || SEVERITY_TONE.low}`}>{signalLabel(String(x.change_type))}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">{CHANGE_TYPE_LABELS[String(x.change_type)] || x.change_type}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
              <span>Mức: <b className="text-slate-700">{String(x.severity).toUpperCase()}</b></span>
              <span>Tin cậy: <b className="text-slate-700">{pct(x.confidence_score)}%</b></span>
            </div>

            <p className="text-sm text-slate-800 font-semibold leading-relaxed">{x.summary}</p>
            {x.evidence && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed"><b>Bằng chứng:</b> {x.evidence}</p>}

            {(x.previous_value || x.current_value) && (
              <p className="text-xs text-slate-600"><b>Thay đổi:</b> <span className="text-slate-400">{x.previous_value || "—"}</span> → <span className="text-slate-800 font-semibold">{x.current_value || "—"}</span></p>
            )}
            {x.affected_ads && <p className="text-[11px] text-slate-400 font-mono break-words">Ads: {x.affected_ads}</p>}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-semibold">Khuyến nghị SERYN</span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded border ${ACTION_TONE[String(x.recommended_action)] || ACTION_TONE.monitor}`}>{String(x.recommended_action).toUpperCase()}</span>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-slate-400 font-semibold">Không có tín hiệu nào khớp bộ lọc.</p>}
      </div>
    </motion.div>
  );
}
