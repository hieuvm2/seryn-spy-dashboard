import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Bookmark, FileText, ClipboardCopy, CheckCircle2, Trash2, Save, Inbox } from "lucide-react";
import type { SwipeFileItem, SerynAction } from "../../types";
import { normalizeNumber, orUnknown, viLabel, scaleMeta } from "../../utils/spyData";
import { loadSwipeFile, deleteSwipeItem, updateSwipeItem } from "../../utils/swipeFile";
import { addCreativeBrief, generateBriefFromSwipeItem } from "../../utils/briefs";

const ACTION_TONE: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  avoid: "bg-slate-100 text-slate-600 border-slate-200",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
};
const SCALE_TONE: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

type FilterKey = "all" | SerynAction;
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "copy", label: "Copy" },
  { key: "adapt", label: "Adapt" },
  { key: "counter", label: "Counter" },
  { key: "avoid", label: "Avoid" },
  { key: "monitor", label: "Monitor" },
];

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

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; }
}

export default function SwipeFileView({
  onGoToCreativeBriefs,
}: {
  onGoToCreativeBriefs?: () => void;
}) {
  const [items, setItems] = useState<SwipeFileItem[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [note, setNote] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  useEffect(() => { setItems(loadSwipeFile()); }, []);

  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2600); };

  const kpi = useMemo(() => ({
    total: items.length,
    adapt: items.filter((x) => String(x.action).toLowerCase() === "adapt").length,
    counter: items.filter((x) => String(x.action).toLowerCase() === "counter").length,
    avoid: items.filter((x) => String(x.action).toLowerCase() === "avoid").length,
  }), [items]);

  const rows = useMemo(() => {
    let list = [...items].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    if (filter !== "all") list = list.filter((x) => String(x.action).toLowerCase() === filter);
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter((x) =>
        [x.brand_name, x.hook, x.service_or_product, x.content_format, x.seryn_reframe, x.notes, (x.tags || []).join(" ")]
          .some((v) => String(v || "").toLowerCase().includes(k))
      );
    }
    return list;
  }, [items, filter, q]);

  const onDelete = (id: string) => { setItems(deleteSwipeItem(id)); flash("Đã xóa khỏi Swipe File."); };
  const onSaveNotes = (id: string) => {
    setItems(updateSwipeItem(id, { notes: draftNotes[id] ?? "" }));
    flash("Đã lưu ghi chú.");
  };
  const onCopyReframe = async (x: SwipeFileItem) => {
    const ok = await copyText(x.seryn_reframe || "");
    flash(ok ? "Đã copy SERYN reframe." : "Không copy được.");
  };
  const onBrief = (x: SwipeFileItem) => {
    addCreativeBrief(generateBriefFromSwipeItem(x));
    flash("Đã tạo Creative Brief. Mở tab Creative Briefs để xem.");
    onGoToCreativeBriefs?.();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">SWIPE FILE</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Kho hook/pattern đã lưu → biến thành brief cho SERYN</h2>
      </div>

      {note && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-4 h-4" /> {note}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Đã lưu", value: kpi.total, tone: "text-slate-900" },
          { label: "Adapt", value: kpi.adapt, tone: "text-amber-600" },
          { label: "Counter", value: kpi.counter, tone: "text-rose-600" },
          { label: "Avoid", value: kpi.avoid, tone: "text-slate-500" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p>
            <p className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {!items.length ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">Swipe File đang trống.</p>
          <p className="text-xs text-slate-400 font-medium">Vào tab <b>Top Hooks</b> hoặc <b>Nội dung nhân rộng</b> rồi bấm “Lưu Swipe File”.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm hook, đối thủ, ghi chú…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    filter === f.key ? "bg-cyan-600 text-white border-cyan-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {rows.map((x) => {
              const action = String(x.action).toLowerCase();
              const sl = normalizeNumber(x.scale_level);
              const m = scaleMeta(sl);
              return (
                <div key={x.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><Bookmark className="w-4 h-4 text-cyan-500" />{x.brand_name}</h4>
                    <div className="flex items-center gap-1.5">
                      {sl > 0 && <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${SCALE_TONE[m.tone]}`}>C{sl}</span>}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${ACTION_TONE[action] || ACTION_TONE.monitor}`}>{viLabel(action)}</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-800 font-semibold leading-relaxed">“{x.hook}”</p>

                  <div className="flex flex-wrap gap-1.5">
                    {!!viLabel(x.service_or_product) && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(x.service_or_product)}</span>}
                    {!!viLabel(x.content_format) && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(x.content_format)}</span>}
                    {(x.tags || []).map((t) => <span key={t} className="bg-cyan-50 border border-cyan-200 text-cyan-700 px-2 py-0.5 rounded text-[11px] font-semibold">#{t}</span>)}
                  </div>

                  {!!x.seryn_reframe && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">SERYN reframe</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{orUnknown(x.seryn_reframe)}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Ghi chú</p>
                    <textarea
                      value={draftNotes[x.id] ?? x.notes ?? ""}
                      onChange={(e) => setDraftNotes((d) => ({ ...d, [x.id]: e.target.value }))}
                      rows={2}
                      placeholder="Ý tưởng triển khai, điều cần tránh…"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300 resize-y"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono">Đã lưu {fmtDate(x.savedAt)}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    <button onClick={() => onSaveNotes(x.id)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
                      <Save className="w-3.5 h-3.5 text-slate-500" /> Lưu ghi chú
                    </button>
                    <button onClick={() => onBrief(x)} className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer">
                      <FileText className="w-3.5 h-3.5" /> Tạo Brief
                    </button>
                    <button onClick={() => onCopyReframe(x)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
                      <ClipboardCopy className="w-3.5 h-3.5 text-indigo-600" /> Copy reframe
                    </button>
                    <button onClick={() => onDelete(x.id)} className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </div>
                </div>
              );
            })}
            {!rows.length && <p className="text-sm text-slate-400 font-semibold">Không có mục nào khớp bộ lọc.</p>}
          </div>
        </>
      )}
    </motion.div>
  );
}
