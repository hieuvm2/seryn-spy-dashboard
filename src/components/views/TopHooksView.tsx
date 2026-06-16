import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Zap, ClipboardCopy, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import type { SpyDashboardData, TopHookItem } from "../../types";
import { normalizeNumber, orUnknown, viLabel, scaleMeta } from "../../utils/spyData";
import { buildTopHooks, isSerynSafeHook } from "../../utils/topHooks";

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

type FilterKey = "all" | "strong" | "evergreen" | "offer" | "doctor" | "education" | "fear" | "safe";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "strong", label: "Scale mạnh" },
  { key: "evergreen", label: "Chạy bền (evergreen)" },
  { key: "offer", label: "Theo offer" },
  { key: "doctor", label: "Theo bác sĩ" },
  { key: "education", label: "Giáo dục" },
  { key: "fear", label: "Hù dọa" },
  { key: "safe", label: "An toàn SERYN" },
];

function daysOf(h: TopHookItem) {
  return Math.max(normalizeNumber(h.days_active), normalizeNumber(h.longest_days_active));
}
function lc(s?: string) { return String(s || "").toLowerCase(); }
function matchFilter(h: TopHookItem, f: FilterKey): boolean {
  const text = lc(h.hook_text);
  const ht = lc(h.hook_type);
  const blob = `${text} ${ht} ${lc(h.content_angle)} ${lc(h.offer_detected)}`;
  switch (f) {
    case "all": return true;
    case "strong": return normalizeNumber(h.scale_level) >= 3;
    case "evergreen": return daysOf(h) >= 30;
    case "offer": return /\d+\s*k\b/i.test(text) || /\d+%/.test(text) || /giảm|ưu đãi|miễn phí|trợ giá|sale|off|tặng/.test(blob) || ht.includes("offer");
    case "doctor": return /bác sĩ|chuyên gia|y khoa|cơ chế/.test(blob) || ht.includes("doctor");
    case "education": return /giải thích|kiến thức|hiểu|tại sao|vì sao|nền tảng/.test(blob) || ht.includes("education") || ht.includes("insight");
    case "fear": return /xấu|xệ|già|nhăn|tàn phá|lão hóa đang|sợ/.test(blob) || ht.includes("fear");
    case "safe": return isSerynSafeHook(h);
  }
}

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

export default function TopHooksView({ data }: { data: SpyDashboardData }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [note, setNote] = useState<string | null>(null);

  const all = useMemo(() => buildTopHooks(data), [data]);

  const rows = useMemo(() => {
    let list = all.filter((h) => matchFilter(h, filter));
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter((h) =>
        [h.brand_name, h.hook_text, h.hook_type, h.service_or_product, h.content_angle, h.seryn_rewrite]
          .some((v) => String(v || "").toLowerCase().includes(k))
      );
    }
    return list;
  }, [all, filter, q]);

  const kpi = useMemo(() => ({
    total: all.length,
    strong: all.filter((h) => normalizeNumber(h.scale_level) >= 3).length,
    evergreen: all.filter((h) => daysOf(h) >= 30).length,
    safe: all.filter((h) => isSerynSafeHook(h)).length,
  }), [all]);

  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2600); };

  const onCopy = async (h: TopHookItem) => {
    const ok = await copyText(h.seryn_rewrite || "");
    flash(ok ? "Đã copy câu viết lại." : "Không copy được.");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">TOP HOOKS</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Câu mở đối thủ đang dùng nhiều nhất → SERYN học &amp; viết lại</h2>
      </div>

      {note && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-4 h-4" /> {note}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng hook", value: kpi.total, tone: "text-slate-900" },
          { label: "Scale mạnh (C3+)", value: kpi.strong, tone: "text-rose-600" },
          { label: "Chạy bền ≥30 ngày", value: kpi.evergreen, tone: "text-amber-600" },
          { label: "An toàn SERYN", value: kpi.safe, tone: "text-emerald-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p>
            <p className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm hook, đối thủ, dịch vụ…"
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
        {rows.map((h) => {
          const action = lc(h.seryn_action) || "monitor";
          const sl = normalizeNumber(h.scale_level);
          const m = scaleMeta(sl);
          const safe = isSerynSafeHook(h);
          return (
            <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-500" />{h.brand_name}</h4>
                <div className="flex items-center gap-1.5">
                  {sl > 0 && <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${SCALE_TONE[m.tone]}`}>C{sl} · {m.label}</span>}
                  {safe && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Safe</span>}
                </div>
              </div>

              <p className="text-sm text-slate-800 font-semibold leading-relaxed">“{h.hook_text}”</p>

              <div className="flex flex-wrap gap-1.5">
                {!!viLabel(h.hook_type) && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(h.hook_type)}</span>}
                {!!viLabel(h.service_or_product) && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(h.service_or_product)}</span>}
                {!!viLabel(h.content_format) && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(h.content_format)}</span>}
                {daysOf(h) > 0 && <span className="bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded text-[11px] font-mono font-semibold">{daysOf(h)} ngày</span>}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${ACTION_TONE[action] || ACTION_TONE.monitor}`}>{viLabel(action)}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SERYN viết lại</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{orUnknown(h.seryn_rewrite)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={() => onCopy(h)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
                  <ClipboardCopy className="w-3.5 h-3.5 text-indigo-600" /> Copy câu viết lại
                </button>
                {!!h.ad_snapshot_url && (
                  <a href={h.ad_snapshot_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-600 px-2 py-1.5 rounded-lg text-xs font-bold transition">
                    <ExternalLink className="w-3.5 h-3.5" /> Ad
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-slate-400 font-semibold">Chưa có hook nào khớp bộ lọc.</p>}
      </div>
    </motion.div>
  );
}
