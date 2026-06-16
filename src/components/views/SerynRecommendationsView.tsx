import React, { useState } from "react";
import { motion } from "motion/react";
import { Lightbulb, Target, Quote, ShieldCheck, Download, ClipboardCopy, CheckCircle2, Zap } from "lucide-react";
import type { SpyDashboardData, SerynContentRecommendation } from "../../types";
import { orUnknown, splitChips, viLabel, isMissing, normalizeNumber } from "../../utils/spyData";

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

function inferAction(r: SerynContentRecommendation): string {
  if (!isMissing(r.recommended_action)) return String(r.recommended_action);
  switch (String(r.priority || "").toLowerCase()) {
    case "high": return "Test ngay";
    case "medium": return "Theo dõi và test nhỏ";
    case "low": return "Lưu reference";
    default: return "Theo dõi";
  }
}

const PRIO_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIO_TONE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-500 border-slate-200",
};

function Card({
  r,
  onCopyHook,
  onCopyCta,
}: {
  r: SerynContentRecommendation;
  onCopyHook: (r: SerynContentRecommendation) => void;
  onCopyCta: (r: SerynContentRecommendation) => void;
}) {
  const prio = String(r.priority || "").toLowerCase();
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-extrabold text-slate-800 flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-600" />
          <span>{viLabel(r.recommendation_type)}</span>
          <span className="text-slate-400 font-medium">· {orUnknown(r.seryn_content_niche)}</span>
        </h4>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${PRIO_TONE[prio] || PRIO_TONE.low}`}>{viLabel(r.priority)}</span>
      </div>

      <p className="text-xs text-slate-600"><b>Tín hiệu thị trường:</b> {orUnknown(r.market_signal)}</p>
      <p className="text-[11px] text-slate-500 font-mono leading-relaxed"><b>Bằng chứng:</b> {orUnknown(r.competitor_evidence)}</p>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
        <p className="text-sm text-slate-800 italic flex gap-2"><Quote className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-1" />{orUnknown(r.suggested_hook)}</p>
        <p className="text-xs text-slate-600"><b>Thông điệp:</b> {orUnknown(r.main_message)}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div><span className="text-slate-400 font-semibold uppercase">Định dạng</span><p className="text-slate-700 font-bold">{orUnknown(r.suggested_content_format)}</p></div>
        <div><span className="text-slate-400 font-semibold uppercase">Phong cách</span><p className="text-slate-700 font-bold">{orUnknown(r.content_style)}</p></div>
        <div><span className="text-slate-400 font-semibold uppercase">Lời kêu gọi</span><p className="text-cyan-700 font-bold">{orUnknown(r.cta)}</p></div>
        <div><span className="text-slate-400 font-semibold uppercase">Chỉ số đo</span><p className="text-slate-700 font-bold">{orUnknown(r.kpi)}</p></div>
      </div>

      {!!splitChips(r.proof_to_use).length && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {splitChips(r.proof_to_use).map((p) => (
            <span key={p} className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(p)}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <Zap className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-[10px] uppercase font-bold text-slate-400">Hành động</span>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">{inferAction(r)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => onCopyHook(r)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
          <ClipboardCopy className="w-3.5 h-3.5 text-indigo-600" /> Copy hook
        </button>
        <button onClick={() => onCopyCta(r)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer">
          <ClipboardCopy className="w-3.5 h-3.5 text-cyan-600" /> Copy CTA
        </button>
      </div>
    </div>
  );
}

const RECS_COLS = [
  "week_date", "recommendation_type", "market_signal", "competitor_evidence",
  "seryn_content_niche", "suggested_content_format", "suggested_hook", "content_style",
  "main_message", "proof_to_use", "cta", "kpi", "priority",
];
function csvCell(v: unknown): string {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function SerynRecommendationsView({ data }: { data: SpyDashboardData }) {
  const [note, setNote] = useState<string | null>(null);
  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2600); };

  const onCopyHook = async (r: SerynContentRecommendation) => { const ok = await copyText(String(r.suggested_hook || "")); flash(ok ? "Đã copy hook." : "Không copy được."); };
  const onCopyCta = async (r: SerynContentRecommendation) => { const ok = await copyText(String(r.cta || "")); flash(ok ? "Đã copy CTA." : "Không copy được."); };

  const recs = [...data.serynContentRecommendations].sort((a, b) => {
    const ra = PRIO_ORDER[String(a.priority).toLowerCase()] ?? 3;
    const rb = PRIO_ORDER[String(b.priority).toLowerCase()] ?? 3;
    return ra - rb;
  });

  const weekDate = data.brandWeeklySnapshot[0]?.week_date || "current";

  const exportCsv = () => {
    const lines = [RECS_COLS.join(",")];
    data.serynContentRecommendations.forEach((r) =>
      lines.push(RECS_COLS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","))
    );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seryn_content_recommendations_${weekDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNote("Đã xuất recommendations CSV.");
  };

  const buildPlan = (): string => {
    const uniq = (arr: (string | undefined)[]) =>
      Array.from(new Set(arr.filter((x): x is string => !!x && !isMissing(x))));
    const signals = uniq(recs.map((r) => r.market_signal));
    const formats = uniq(recs.map((r) => r.suggested_content_format));
    const hooks = uniq(recs.map((r) => r.suggested_hook));
    const ctas = uniq(recs.map((r) => r.cta));
    const scaled = [...data.scaledContentAnalysis].sort(
      (a, b) => normalizeNumber(b.scale_level) - normalizeNumber(a.scale_level)
    );
    const patterns = scaled.slice(0, 5).map(
      (s) => `- ${s.brand_name}: ${viLabel(s.content_format)} × ${viLabel(s.service_or_product)} (C${normalizeNumber(s.scale_level)}) — “${orUnknown(s.representative_hook)}”`
    );
    const tests = recs.slice(0, 5).map(
      (r, i) => `${i + 1}. [${viLabel(r.priority)}] ${viLabel(r.recommendation_type)} — “${orUnknown(r.suggested_hook)}” → ${orUnknown(r.cta)} (${inferAction(r)})`
    );
    return [
      `SERYN — KẾ HOẠCH NỘI DUNG TUẦN ${weekDate}`, "",
      "## Market signal", ...(signals.length ? signals.map((s) => `- ${s}`) : ["- (chưa có)"]), "",
      "## Top scaled content patterns", ...(patterns.length ? patterns : ["- (chưa có)"]), "",
      "## Recommended content formats", ...(formats.length ? formats.map((f) => `- ${f}`) : ["- (chưa có)"]), "",
      "## Recommended hooks", ...(hooks.length ? hooks.map((h) => `- ${h}`) : ["- (chưa có)"]), "",
      "## Recommended CTA", ...(ctas.length ? ctas.map((c) => `- ${c}`) : ["- (chưa có)"]), "",
      "## 5 content tests cho tuần tới", ...(tests.length ? tests : ["- (chưa có)"]),
    ].join("\n");
  };

  const copyPlan = async () => {
    const text = buildPlan();
    try {
      await navigator.clipboard.writeText(text);
      setNote("Đã copy weekly content plan vào clipboard.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      ta.remove();
      setNote("Đã copy weekly content plan (fallback).");
    }
  };

  const groups: { key: string; label: string }[] = [
    { key: "high", label: "Ưu tiên cao" },
    { key: "medium", label: "Ưu tiên trung bình" },
    { key: "low", label: "Ưu tiên thấp" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">GỢI Ý CHO SERYN</span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">SERYN nên chạy content gì tiếp theo</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={exportCsv} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 transition cursor-pointer">
            <Download className="w-4 h-4 text-indigo-600" /> Export CSV
          </button>
          <button onClick={copyPlan} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm transition cursor-pointer">
            <ClipboardCopy className="w-4 h-4" /> Copy weekly content plan
          </button>
        </div>
      </div>

      {note && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-4 h-4" /> {note}
        </div>
      )}

      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 font-medium">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>Nguyên tắc SERYN: không dọa dẫm, không gấp gáp rẻ tiền, không “trẻ hóa thần kỳ / xóa sạch nếp nhăn / lấy lại thanh xuân / trẻ hơn 10 tuổi / inbox ngay”. Lời kêu gọi ưu tiên: Đặt lịch phân tích gương mặt · Đặt lịch đánh giá nền tảng sinh học · Tìm hiểu thêm · Trao đổi với đội ngũ chuyên môn.</span>
      </div>

      {groups.map((g) => {
        const items = recs.filter((r) => String(r.priority).toLowerCase() === g.key);
        if (!items.length) return null;
        return (
          <div key={g.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">{g.label}</h3>
              <span className="text-xs text-slate-400 font-mono">({items.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {items.map((r, i) => <React.Fragment key={i}><Card r={r} onCopyHook={onCopyHook} onCopyCta={onCopyCta} /></React.Fragment>)}
            </div>
          </div>
        );
      })}
      {!recs.length && <p className="text-sm text-slate-400 font-semibold">Chưa có gợi ý.</p>}
    </motion.div>
  );
}
