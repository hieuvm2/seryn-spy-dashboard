import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Search, Flame, Info, Bookmark, FileText, CheckCircle2 } from "lucide-react";
import type { SpyDashboardData, ScaledContentAnalysis, SerynAction } from "../../types";
import { normalizeNumber, orUnknown, scaleMeta, viLabel } from "../../utils/spyData";
import { addSwipeItem, genId } from "../../utils/swipeFile";
import { addCreativeBrief, generateBriefFromSwipeItem } from "../../utils/briefs";

function scaledToSwipe(r: ScaledContentAnalysis) {
  const action = (String(r.seryn_should_copy_adapt_counter_avoid || "monitor").toLowerCase() || "monitor") as SerynAction;
  return {
    id: genId(),
    savedAt: new Date().toISOString(),
    sourceType: "scaled_content" as const,
    brand_name: r.brand_name,
    hook: String(r.representative_hook || "").trim(),
    service_or_product: r.service_or_product,
    content_format: r.content_format,
    content_angle: r.content_angle,
    offer_detected: r.offer_detected,
    proof_point: r.proof_point,
    scale_level: r.scale_level,
    reason_to_save: r.why_it_is_scaling,
    action,
    seryn_reframe: r.seryn_reframe,
    notes: "",
    tags: ["scaled"],
  };
}

const TONE: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

const CACA: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  avoid: "bg-slate-100 text-slate-600 border-slate-200",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
};

function ScaleBadge({ level }: { level: ScaledContentAnalysis["scale_level"] }) {
  const n = normalizeNumber(level);
  const m = scaleMeta(n);
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${TONE[m.tone]}`}>C{n} · {m.label}</span>;
}

export default function ScaledContentView({
  data,
  onGoToCreativeBriefs,
}: {
  data: SpyDashboardData;
  onGoToCreativeBriefs?: () => void;
}) {
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2600); };
  const onSave = (r: ScaledContentAnalysis) => { addSwipeItem(scaledToSwipe(r)); flash(`Đã lưu vào Swipe File: ${r.brand_name}`); };
  const onBrief = (r: ScaledContentAnalysis) => {
    addCreativeBrief(generateBriefFromSwipeItem(scaledToSwipe(r)));
    flash("Đã tạo Creative Brief. Mở tab Creative Briefs để xem.");
    onGoToCreativeBriefs?.();
  };

  const rows = useMemo(() => {
    const list = [...data.scaledContentAnalysis].sort(
      (a, b) => normalizeNumber(b.scale_level) - normalizeNumber(a.scale_level)
    );
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(k)));
  }, [data, q]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-rose-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-rose-600 font-bold">NỘI DUNG NHÂN RỘNG</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Đối thủ đang nhân rộng nội dung gì → SERYN phản ứng thế nào</h2>
      </div>

      {note && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-4 h-4" /> {note}
        </div>
      )}

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 font-semibold">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>“Khả năng đang nhân rộng dựa trên thời lượng chạy + lặp lại — chưa xác nhận hiệu quả/lợi nhuận”. Không có dữ liệu ngân sách/chuyển đổi.</span>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm đối thủ, dịch vụ, câu mở…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {rows.map((r) => {
          const caca = String(r.seryn_should_copy_adapt_counter_avoid || "").toLowerCase();
          return (
            <div key={r.content_cluster_id || r.representative_ad_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><Flame className="w-4 h-4 text-rose-500" />{r.brand_name}</h4>
                <ScaleBadge level={r.scale_level} />
              </div>
              <p className="text-sm text-slate-700 italic leading-relaxed">“{orUnknown(r.representative_hook)}”</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(r.content_format)}</span>
                <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(r.service_or_product)}</span>
                <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(r.content_angle)}</span>
                {!!orUnknown(r.offer_detected) && r.offer_detected && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{orUnknown(r.offer_detected)}</span>}
              </div>
              <p className="text-xs text-slate-500 font-mono">
                <b className="text-slate-700">{orUnknown(r.number_of_similar_ads)}</b> QC tương tự · dài nhất <b className="text-slate-700">{orUnknown(r.longest_days_active)} ngày</b> · TB {orUnknown(r.average_days_active)} ngày
              </p>
              <p className="text-xs text-slate-600"><b>Vì sao nhân rộng:</b> {orUnknown(r.why_it_is_scaling)}</p>
              <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${CACA[caca] || CACA.monitor}`}>{viLabel(r.seryn_should_copy_adapt_counter_avoid)}</span>
                <span className="text-xs text-slate-600 flex-1">{orUnknown(r.seryn_reframe)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onSave(r)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
                  <Bookmark className="w-3.5 h-3.5 text-cyan-600" /> Lưu Swipe File
                </button>
                <button onClick={() => onBrief(r)} className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer">
                  <FileText className="w-3.5 h-3.5" /> Tạo Brief
                </button>
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-slate-400 font-semibold">Chưa có nội dung nhân rộng.</p>}
      </div>
    </motion.div>
  );
}
