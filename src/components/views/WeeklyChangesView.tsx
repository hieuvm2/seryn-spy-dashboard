import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { normalizeNumber, orUnknown, splitChips, isMissing, viLabel } from "../../utils/spyData";

type Filter = "all" | "increased" | "new-offer" | "new-service" | "new-angle" | "no-change";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "increased", label: "Tăng ads" },
  { id: "new-offer", label: "Offer mới" },
  { id: "new-service", label: "Service mới" },
  { id: "new-angle", label: "Angle mới" },
  { id: "no-change", label: "Không đổi lớn" },
];

function Delta({ value }: { value?: number | string }) {
  const n = normalizeNumber(value);
  if (n > 0) return <span className="inline-flex items-center gap-1 text-emerald-600 font-bold"><ArrowUpRight className="w-4 h-4" />+{n}</span>;
  if (n < 0) return <span className="inline-flex items-center gap-1 text-rose-600 font-bold"><ArrowDownRight className="w-4 h-4" />{n}</span>;
  return <span className="inline-flex items-center gap-1 text-slate-400 font-bold"><Minus className="w-4 h-4" />0</span>;
}

function Chips({ value }: { value?: string }) {
  const items = splitChips(value);
  if (!items.length) return <span className="text-xs text-slate-400">chưa rõ</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(it)}</span>
      ))}
    </div>
  );
}

const TYPE_TONE: Record<string, string> = {
  came_online: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scaling_up: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scaling_down: "bg-rose-50 text-rose-700 border-rose-200",
  went_dark: "bg-rose-50 text-rose-700 border-rose-200",
  still_dark: "bg-slate-100 text-slate-500 border-slate-200",
  offer_shift: "bg-amber-50 text-amber-700 border-amber-200",
  format_shift: "bg-indigo-50 text-indigo-700 border-indigo-200",
  stable: "bg-slate-100 text-slate-500 border-slate-200",
  stable_creative_refresh: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function WeeklyChangesView({ data }: { data: SpyDashboardData }) {
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    return data.weeklyStrategyChange.filter((r) => {
      switch (filter) {
        case "increased": return normalizeNumber(r.active_ads_change) > 0;
        case "new-offer": return !isMissing(r.new_offers_detected);
        case "new-service": return !isMissing(r.new_services_detected);
        case "new-angle": return !isMissing(r.new_content_angles);
        case "no-change": {
          const t = String(r.strategic_change_type || "").toLowerCase();
          return t === "stable" || t === "still_dark" || t === "stable_creative_refresh";
        }
        default: return true;
      }
    });
  }, [data, filter]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">THAY ĐỔI TUẦN</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">So sánh tuần này với tuần trước</h2>
        <p className="text-sm text-slate-600 font-medium">Ai tăng/giảm quảng cáo · đổi ưu đãi · đổi dịch vụ · đổi góc nội dung.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${filter === f.id ? "bg-cyan-600 text-white border-cyan-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {rows.map((r) => {
          const t = String(r.strategic_change_type || "").toLowerCase();
          return (
            <div key={r.brand_name} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-slate-800">{r.brand_name}</h4>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${TYPE_TONE[t] || "bg-slate-100 text-slate-500 border-slate-200"}`}>{viLabel(r.strategic_change_type)}</span>
              </div>
              <div className="flex items-center gap-5 text-sm">
                <div><span className="text-[11px] text-slate-500 font-semibold uppercase mr-1.5">Δ QC</span><Delta value={r.active_ads_change} /></div>
                <div className="text-xs text-slate-500 font-mono">mới <b className="text-emerald-600">{orUnknown(r.new_ads_count)}</b> / dừng <b className="text-rose-600">{orUnknown(r.stopped_ads_count)}</b></div>
              </div>
              {!isMissing(r.new_services_detected) && <div><p className="text-[11px] text-slate-500 font-semibold uppercase mb-1">Dịch vụ mới</p><Chips value={r.new_services_detected} /></div>}
              {!isMissing(r.new_offers_detected) && <div><p className="text-[11px] text-slate-500 font-semibold uppercase mb-1">Ưu đãi mới</p><Chips value={r.new_offers_detected} /></div>}
              {!isMissing(r.new_content_angles) && <div><p className="text-[11px] text-slate-500 font-semibold uppercase mb-1">Góc mới</p><Chips value={r.new_content_angles} /></div>}
              <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5"><b>Thay đổi:</b> {orUnknown(r.change_summary)}</p>
              <p className="text-xs text-cyan-700 bg-cyan-50/60 border border-cyan-100 rounded-lg px-3 py-2 font-medium leading-relaxed"><b>SERYN:</b> {orUnknown(r.seryn_implication)}</p>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-slate-400 font-semibold">Không có đối thủ khớp bộ lọc.</p>}
      </div>
    </motion.div>
  );
}
