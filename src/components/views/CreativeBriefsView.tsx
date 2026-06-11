import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { FileText, ClipboardCopy, CheckCircle2, Trash2, Inbox, ChevronDown, ChevronUp, Download } from "lucide-react";
import type { CreativeBrief } from "../../types";
import { loadCreativeBriefsAsync, deleteCreativeBrief, briefToMarkdown } from "../../utils/briefs";

const SRC_LABEL: Record<string, string> = {
  swipe_file: "Từ Swipe File",
  recommendation: "Từ gợi ý SERYN",
  scaled_content: "Từ nội dung nhân rộng",
  hook: "Từ Top Hooks",
};
const SRC_TONE: Record<string, string> = {
  swipe_file: "bg-cyan-50 text-cyan-700 border-cyan-200",
  recommendation: "bg-amber-50 text-amber-700 border-amber-200",
  scaled_content: "bg-rose-50 text-rose-700 border-rose-200",
  hook: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); return true;
    } catch { return false; }
  }
}
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; } }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{title}</p>
      <div className="text-xs text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}
function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return <span className="text-slate-400">(chưa có)</span>;
  return <ul className="list-disc pl-4 space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

export default function CreativeBriefsView() {
  const [briefs, setBriefs] = useState<CreativeBrief[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    loadCreativeBriefsAsync().then(({ items }) => { if (!cancelled) setBriefs(items); });
    return () => { cancelled = true; };
  }, []);
  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2600); };

  const kpi = useMemo(() => ({
    total: briefs.length,
    fromSwipe: briefs.filter((b) => b.sourceType === "swipe_file" || b.sourceType === "hook").length,
    fromRec: briefs.filter((b) => b.sourceType === "recommendation").length,
  }), [briefs]);

  const onDelete = (id: string) => { setBriefs(deleteCreativeBrief(id)); flash("Đã xóa Creative Brief."); };
  const onCopy = async (b: CreativeBrief) => {
    const ok = await copyText(b.markdown || briefToMarkdown(b));
    flash(ok ? "Đã copy Markdown brief." : "Không copy được.");
  };
  const onDownload = (b: CreativeBrief) => {
    const md = b.markdown || briefToMarkdown(b);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seryn_brief_${b.id}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    flash("Đã tải Markdown brief.");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">CREATIVE BRIEFS</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Brief content SERYN — sẵn sàng đưa cho team sản xuất</h2>
      </div>

      {note && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-4 h-4" /> {note}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng brief", value: kpi.total, tone: "text-slate-900" },
          { label: "Từ Swipe/Hook", value: kpi.fromSwipe, tone: "text-cyan-600" },
          { label: "Từ gợi ý SERYN", value: kpi.fromRec, tone: "text-amber-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p>
            <p className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {!briefs.length ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">Chưa có Creative Brief nào.</p>
          <p className="text-xs text-slate-400 font-medium">Bấm “Tạo Brief” ở <b>Top Hooks</b>, <b>Swipe File</b>, <b>Nội dung nhân rộng</b> hoặc <b>Gợi ý cho SERYN</b>.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {briefs.map((b) => {
            const isOpen = open[b.id];
            return (
              <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1.5">
                    <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-cyan-600" />{b.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${SRC_TONE[b.sourceType] || SRC_TONE.hook}`}>{SRC_LABEL[b.sourceType] || b.sourceType}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{fmtDate(b.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => onCopy(b)} className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer">
                      <ClipboardCopy className="w-3.5 h-3.5" /> Copy Markdown
                    </button>
                    <button onClick={() => onDownload(b)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
                      <Download className="w-3.5 h-3.5 text-indigo-600" /> .md
                    </button>
                    <button onClick={() => onDelete(b.id)} className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  <Section title="Objective">{b.objective}</Section>
                  <Section title="SERYN Angle">{b.seryn_angle}</Section>
                  <Section title="Core Message">{b.core_message}</Section>
                  <Section title="CTA">{b.cta}</Section>
                  <Section title="Hook options"><Bullets items={b.hook_options} /></Section>
                  <Section title="Proof points"><Bullets items={b.proof_points} /></Section>
                </div>

                <button onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))} className="flex items-center gap-1.5 text-xs font-bold text-cyan-700 hover:text-cyan-600 cursor-pointer">
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {isOpen ? "Thu gọn" : "Xem đầy đủ brief"}
                </button>

                {isOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-slate-100">
                    <Section title="Market signal">{b.market_signal || "(chưa có)"}</Section>
                    <Section title="Competitor evidence">{b.competitor_evidence || "(chưa có)"}</Section>
                    <Section title="Target audience">{b.target_audience}</Section>
                    <Section title="Content format">{b.content_format}</Section>
                    <Section title="Script outline"><Bullets items={b.script_outline} /></Section>
                    <Section title="Visual direction">{b.visual_direction}</Section>
                    <Section title="KPI">{b.kpi}</Section>
                    <Section title="Do"><Bullets items={b.dos} /></Section>
                    <Section title="Don't"><Bullets items={b.donts} /></Section>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
