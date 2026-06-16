import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Zap, Search, ClipboardCopy, CheckCircle2, ShieldAlert, Brain, Megaphone, FileText, LayoutList, Info } from "lucide-react";
import type { SpyDashboardData, HookCluster } from "../../types";
import { viLabel } from "../../utils/spyData";
import TopHooksView from "./TopHooksView";
import {
  buildEnhancedHookCards, formatBriefForCopy, formatRewriteGroupForCopy, formatScriptOutlineForCopy,
  type EnhancedHookCard, type HookStatusLabel,
} from "../../utils/hookIntelligence";

const SC = "skin_rejuvenation";
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const lc = (s?: string) => String(s || "").toLowerCase();

/* ---------- display helpers (VN) ---------- */
function viPattern(c: HookCluster): string {
  const parts = [viLabel(c.hook_category), viLabel(c.hook_formula), viLabel(c.hook_subcategory)].filter((x) => x && x !== "Chưa rõ");
  const base = parts.join(" · ") || String(c.hook_pattern || "");
  return c.offer_linked === "TRUE" || c.top_offer_linked === "TRUE" ? `${base} · có ưu đãi` : base;
}

const STATUS_VI: Record<HookStatusLabel, string> = {
  "Evergreen Pattern": "Evergreen",
  "Strong Repeated Signal": "Lặp lại mạnh",
  "Rising Pattern": "Đang nổi",
  "Monitor": "Theo dõi",
  "Low Confidence": "Tin cậy thấp",
  "High Risk": "Rủi ro cao",
};
const STATUS_TONE: Record<HookStatusLabel, string> = {
  "Evergreen Pattern": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Strong Repeated Signal": "bg-amber-50 text-amber-700 border-amber-200",
  "Rising Pattern": "bg-sky-50 text-sky-700 border-sky-200",
  "Monitor": "bg-slate-100 text-slate-600 border-slate-200",
  "Low Confidence": "bg-slate-100 text-slate-500 border-slate-200",
  "High Risk": "bg-rose-50 text-rose-700 border-rose-200",
};
const ACTION_VI: Record<string, string> = {
  copy_structure: "Học cấu trúc", adapt_angle: "Điều chỉnh góc", counter_positioning: "Phản định vị",
  avoid_due_to_risk: "Tránh (rủi ro)", monitor: "Theo dõi", test_now: "Test ngay",
};
function scoreTone(s: number): string {
  return s >= 70 ? "bg-emerald-600 text-white" : s >= 50 ? "bg-amber-500 text-white" : "bg-slate-400 text-white";
}
function riskTextTone(r: "Low" | "Medium" | "High"): string {
  return r === "High" ? "text-rose-600" : r === "Medium" ? "text-amber-600" : "text-emerald-600";
}

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    try { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); return true; }
    catch { return false; }
  }
}

type TabKey = "overview" | "psychology" | "rewrite" | "brief" | "risk";
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "overview", label: "Tổng quan", icon: LayoutList },
  { key: "psychology", label: "Tâm lý", icon: Brain },
  { key: "rewrite", label: "SERYN viết lại", icon: Megaphone },
  { key: "brief", label: "Creative Brief", icon: FileText },
  { key: "risk", label: "Rủi ro & An toàn", icon: ShieldAlert },
];

export default function HookIntelligenceView({ data }: { data: SpyDashboardData }) {
  const clusters = useMemo<HookCluster[]>(
    () => (data.hookIntelligence ?? []).filter((c) => !c.service_category || c.service_category === SC),
    [data.hookIntelligence],
  );
  const cards = useMemo<EnhancedHookCard[]>(
    () => buildEnhancedHookCards(clusters, data.serynContentRecommendations ?? []),
    [clusters, data.serynContentRecommendations],
  );

  const [q, setQ] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fFormat, setFFormat] = useState("all");
  const [fObjective, setFObjective] = useState("all");
  const [fRisk, setFRisk] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [note, setNote] = useState<string | null>(null);

  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2200); };
  const doCopy = async (t?: string, msg = "Đã copy.") => { const ok = await copyText(String(t || "")); flash(ok ? msg : "Không copy được."); };

  const opts = useMemo(() => {
    const uniq = (fn: (c: HookCluster) => string | undefined) =>
      [...new Set(cards.map((c) => fn(c.cluster)).filter((x): x is string => !!x && x !== "unknown"))];
    return {
      category: uniq((c) => c.hook_category),
      format: uniq((c) => c.top_ad_format),
      objective: uniq((c) => c.top_inferred_objective),
    };
  }, [cards]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (fCategory !== "all" && c.cluster.hook_category !== fCategory) return false;
      if (fStatus !== "all" && c.statusLabel !== fStatus) return false;
      if (fFormat !== "all" && c.cluster.top_ad_format !== fFormat) return false;
      if (fObjective !== "all" && c.cluster.top_inferred_objective !== fObjective) return false;
      if (fRisk !== "all" && c.riskLevel !== fRisk) return false;
      if (q.trim()) {
        const k = q.toLowerCase();
        const blob = `${viPattern(c.cluster)} ${c.cluster.pain_point} ${c.cluster.desired_outcome} ${c.exampleHooks.join(" ")} ${c.relatedBrands.join(" ")}`.toLowerCase();
        if (!blob.includes(k)) return false;
      }
      return true;
    });
  }, [cards, fCategory, fStatus, fFormat, fObjective, fRisk, q]);

  const selected = filtered.find((c) => c.cluster.hook_cluster_id === selectedId) || filtered[0];

  const summary = useMemo(() => ({
    total: cards.length,
    highConf: cards.filter((c) => c.confidenceLevel === "High").length,
    rising: cards.filter((c) => c.statusLabel === "Rising Pattern" || c.statusLabel === "Strong Repeated Signal").length,
    evergreen: cards.filter((c) => c.statusLabel === "Evergreen Pattern").length,
    highRisk: cards.filter((c) => c.riskLevel === "High").length,
  }), [cards]);

  // Empty state -> fallback view cũ
  if (!clusters.length) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
          <LayoutList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Chưa có cụm Hook Intelligence cho trẻ hóa da.</p>
          <p className="text-xs text-slate-500 mt-1">Chạy <code className="font-mono text-cyan-700">npm run hooks:analyze</code> để tạo cụm hook + content. Bên dưới là danh sách hook nhanh từ dữ liệu hiện có.</p>
        </div>
        <TopHooksView data={data} />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <Header />
      {note && <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-lg"><CheckCircle2 className="w-4 h-4" /> {note}</div>}

      <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Đây là <b>tín hiệu hook đối thủ</b> (lặp lại / bền vững), không phải “hook thắng chắc”. <span className="font-normal text-cyan-700/80">Score là proxy từ dữ liệu public — không phải hiệu suất quảng cáo thật.</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Tổng pattern" value={summary.total} tone="text-slate-900" />
        <Stat label="Tin cậy cao" value={summary.highConf} tone="text-emerald-600" />
        <Stat label="Đang nổi / Lặp lại" value={summary.rising} tone="text-sky-600" />
        <Stat label="Evergreen" value={summary.evergreen} tone="text-amber-600" />
        <Stat label="Rủi ro cao" value={summary.highRisk} tone="text-rose-600" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm pattern, pain, hook…"
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
        </div>
        <Select value={fCategory} onChange={setFCategory} all="Tất cả nhóm" options={opts.category.map((v) => ({ value: v, label: viLabel(v) }))} />
        <Select value={fStatus} onChange={setFStatus} all="Mọi trạng thái" options={(Object.keys(STATUS_VI) as HookStatusLabel[]).map((v) => ({ value: v, label: STATUS_VI[v] }))} />
        <Select value={fFormat} onChange={setFFormat} all="Mọi định dạng" options={opts.format.map((v) => ({ value: v, label: viLabel(v) }))} />
        <Select value={fObjective} onChange={setFObjective} all="Mọi mục tiêu" options={opts.objective.map((v) => ({ value: v, label: viLabel(v) }))} />
        <Select value={fRisk} onChange={setFRisk} all="Mọi mức rủi ro" options={[{ value: "Low", label: "Rủi ro thấp" }, { value: "Medium", label: "Rủi ro vừa" }, { value: "High", label: "Rủi ro cao" }]} />
      </div>

      {/* Master-detail */}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* LEFT: list */}
        <div className="space-y-2.5">
          {filtered.map((c, i) => {
            const active = selected && c.cluster.hook_cluster_id === selected.cluster.hook_cluster_id;
            return (
              <button key={c.cluster.hook_cluster_id} onClick={() => { setSelectedId(String(c.cluster.hook_cluster_id)); setTab("overview"); }}
                className={`w-full text-left bg-white border rounded-2xl p-4 shadow-sm transition ${active ? "border-cyan-400 ring-1 ring-cyan-200" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">#{i + 1}</span>
                    <p className="font-extrabold text-slate-800 text-sm truncate">{viPattern(c.cluster)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-lg ${scoreTone(c.hookScore)}`}>{c.hookScore}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_TONE[c.statusLabel]}`}>{STATUS_VI[c.statusLabel]}</span>
                  <span className="text-[10px] text-slate-500">{c.cluster.pain_point} → {c.cluster.desired_outcome}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-slate-500">
                  <span>{num(c.cluster.ads_count)} ad</span>
                  <span>{c.relatedBrands.length} hãng</span>
                  <span>{String(c.cluster.avg_active_days) === "unknown" ? "—" : `${c.cluster.avg_active_days}ng`}</span>
                  <span>{viLabel(c.cluster.top_ad_format)}</span>
                  <span>{viLabel(c.cluster.top_inferred_objective)}</span>
                  <span className={riskTextTone(c.riskLevel)}>rủi ro {c.riskLevel === "Low" ? "thấp" : c.riskLevel === "Medium" ? "vừa" : "cao"}</span>
                </div>
              </button>
            );
          })}
          {!filtered.length && <p className="text-sm text-slate-400 font-semibold bg-white border border-slate-200 rounded-2xl p-6 text-center">Không có pattern nào khớp bộ lọc. Thử bỏ bớt filter.</p>}
        </div>

        {/* RIGHT: detail */}
        <div className="lg:sticky lg:top-4">
          {selected ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">{viPattern(selected.cluster)}</p>
                    <p className="text-[11px] text-slate-500">{selected.cluster.pain_point} → {selected.cluster.desired_outcome}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-extrabold px-2.5 py-1 rounded-lg ${scoreTone(selected.hookScore)}`}>{selected.hookScore}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_TONE[selected.statusLabel]}`}>{STATUS_VI[selected.statusLabel]}</span>
                  <Badge>Tin cậy: {selected.confidenceLevel}</Badge>
                  <Badge tone={riskTextTone(selected.riskLevel)}>Rủi ro: {selected.riskLevel}</Badge>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-cyan-50 text-cyan-700 border-cyan-200">SERYN: {ACTION_VI[String(selected.cluster.recommended_seryn_action)] || selected.cluster.recommended_seryn_action}</span>
                </div>
              </div>

              {/* tabs */}
              <div className="flex border-b border-slate-100 overflow-x-auto">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${tab === t.key ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {tab === "overview" && <OverviewTab c={selected} onCopy={doCopy} />}
                {tab === "psychology" && <PsychologyTab c={selected} />}
                {tab === "rewrite" && <RewriteTab c={selected} onCopy={doCopy} />}
                {tab === "brief" && <BriefTab c={selected} onCopy={doCopy} />}
                {tab === "risk" && <RiskTab c={selected} onCopy={doCopy} />}
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">Chọn một pattern để xem chi tiết.</p>}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================ tabs ============================================================ */
function OverviewTab({ c, onCopy }: { c: EnhancedHookCard; onCopy: (t?: string, m?: string) => void }) {
  const cl = c.cluster;
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <KV k="Nhóm" v={viLabel(cl.hook_category)} />
        <KV k="Công thức" v={viLabel(cl.hook_formula)} />
        <KV k="Góc tiếp cận" v={viLabel(cl.hook_angle)} />
        <KV k="Mục tiêu (suy luận)" v={viLabel(cl.top_inferred_objective)} />
        <KV k="Số ad" v={String(num(cl.ads_count))} />
        <KV k="Số hãng" v={String(c.relatedBrands.length)} />
        <KV k="Ngày chạy TB" v={String(cl.avg_active_days) === "unknown" ? "Chưa rõ" : `${cl.avg_active_days} ngày`} />
        <KV k="Định dạng chính" v={viLabel(cl.top_ad_format)} />
        <KV k="Ưu đãi" v={cl.top_offer_linked === "TRUE" ? "Có" : "Không"} />
        <KV k="Bằng chứng" v={viLabel(cl.top_proof_type)} />
      </div>
      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Vì sao có tín hiệu này</p>
        <p className="text-slate-700">{c.psychology.whyItMayWork}</p>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hook đối thủ (ví dụ — KHÔNG sao chép)</p>
          <CopyBtn onClick={() => onCopy(c.exampleHooks.join("\n"), "Đã copy hook gốc.")} />
        </div>
        {c.relatedBrands.length > 0 && <p className="text-[11px] text-slate-500 mb-1">Hãng: {c.relatedBrands.join(", ")}</p>}
        <ul className="space-y-0.5 text-slate-600 italic list-disc pl-4">
          {c.exampleHooks.length ? c.exampleHooks.map((h, i) => <li key={i}>{h}</li>) : <li>N/A</li>}
        </ul>
      </div>
    </div>
  );
}

function PsychologyTab({ c }: { c: EnhancedHookCard }) {
  const p = c.psychology;
  const risky = num(c.cluster.risk_score) >= 30;
  return (
    <div className="space-y-2 text-xs">
      <KV k="Nỗi đau (pain)" v={p.painPoint} />
      <KV k="Mong muốn (desire)" v={p.desire} />
      <KV k="Niềm tin kích hoạt" v={p.beliefTrigger} />
      <KV k="Gỡ phản đối" v={p.objectionRemoved} />
      <KV k="Cảm xúc chủ đạo" v={p.emotionalTrigger} />
      <KV k="Mức độ nhận thức" v={p.awarenessStage} />
      <KV k="Ý định phễu" v={p.funnelIntent} />
      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 mt-2">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Vì sao có thể hiệu quả</p>
        <p className="text-slate-700">{p.whyItMayWork}</p>
      </div>
      <div className={`rounded-xl border p-3 ${risky ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
        <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${risky ? "text-rose-600" : "text-slate-400"}`}>Lưu ý rủi ro</p>
        <p className={risky ? "text-rose-700 font-semibold" : "text-slate-700"}>{p.riskNote}</p>
      </div>
    </div>
  );
}

function RewriteTab({ c, onCopy }: { c: EnhancedHookCard; onCopy: (t?: string, m?: string) => void }) {
  const r = c.rewrites;
  const groups: { label: string; items: string[] }[] = [
    { label: "Direct Response", items: r.directResponse },
    { label: "Premium Clinic Tone", items: r.premiumClinicTone },
    { label: "Safe Compliance Tone", items: r.safeComplianceTone },
    { label: "Mở video 3 giây", items: r.videoOpening3s },
    { label: "Meta Ads Caption", items: r.metaAdsCaption },
  ];
  return (
    <div className="space-y-3">
      {!c.rec && <p className="text-[11px] text-slate-400 italic">Cụm này chưa có content sinh sẵn — đang dùng bản template SERYN (vẫn dùng được).</p>}
      {groups.map((g) => (
        <div key={g.label} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{g.label}</p>
            <CopyBtn label="Copy nhóm" onClick={() => onCopy(formatRewriteGroupForCopy(g.items), `Đã copy nhóm: ${g.label}.`)} />
          </div>
          <ul className="space-y-1.5">
            {g.items.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <button onClick={() => onCopy(s, "Đã copy câu.")} className="shrink-0 mt-0.5 text-indigo-500 hover:text-indigo-600" title="Copy"><ClipboardCopy className="w-3.5 h-3.5" /></button>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BriefTab({ c, onCopy }: { c: EnhancedHookCard; onCopy: (t?: string, m?: string) => void }) {
  const b = c.miniBrief;
  const prioTone = b.testPriority === "High" ? "text-emerald-600" : b.testPriority === "Medium" ? "text-amber-600" : "text-slate-500";
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <CopyBtn label="Copy brief" onClick={() => onCopy(formatBriefForCopy(b), "Đã copy brief.")} />
        <CopyBtn label="Copy script" onClick={() => onCopy(formatScriptOutlineForCopy(b), "Đã copy script outline.")} />
        <CopyBtn label="Copy core message" onClick={() => onCopy(b.coreMessage, "Đã copy core message.")} />
        <CopyBtn label="Copy CTA" onClick={() => onCopy(b.cta, "Đã copy CTA.")} />
        <span className={`ml-auto text-[11px] font-bold ${prioTone}`}>Ưu tiên test: {b.testPriority}</span>
      </div>
      <KV k="Objective" v={b.objective} />
      <KV k="Angle" v={b.angle} />
      <KV k="Target audience" v={b.targetAudience} />
      <KV k="Core message" v={b.coreMessage} />
      <KV k="Opening scene" v={b.openingScene} />
      <KV k="Visual direction" v={b.visualDirection} />
      <KV k="Proof element" v={b.proofElement} />
      <KV k="Offer suggestion" v={b.offerSuggestion} />
      <KV k="CTA" v={b.cta} />
      <KV k="Content format" v={b.contentFormat} />
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Script outline (4 scene)</p>
        <ol className="space-y-0.5 text-slate-700 list-decimal pl-4">
          <li>{b.scriptOutline.scene1}</li>
          <li>{b.scriptOutline.scene2}</li>
          <li>{b.scriptOutline.scene3}</li>
          <li>{b.scriptOutline.scene4}</li>
        </ol>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-0.5">Compliance</p>
        <p className="text-amber-800">{b.complianceWarning}</p>
      </div>
      <KV k="Recommended action" v={b.recommendedAction} />
    </div>
  );
}

function RiskTab({ c, onCopy }: { c: EnhancedHookCard; onCopy: (t?: string, m?: string) => void }) {
  const safe = c.rec?.claim_safe_version || c.rewrites.safeComplianceTone[0] || "";
  const avoid = c.rec?.avoid_phrases || "";
  const r = num(c.cluster.risk_score);
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-extrabold ${riskTextTone(c.riskLevel)}`}>Risk {r}/100</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${c.riskLevel === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : c.riskLevel === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{c.riskLevel}</span>
      </div>
      <p className="text-slate-700">{c.psychology.riskNote}</p>
      {!!avoid && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[10px] uppercase font-bold text-rose-600 tracking-wider mb-0.5">Cụm từ nên tránh</p>
          <p className="text-rose-700">{avoid}</p>
        </div>
      )}
      {!!safe && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Bản an toàn (dùng được)</p>
            <CopyBtn onClick={() => onCopy(safe, "Đã copy bản an toàn.")} />
          </div>
          <p className="text-emerald-800">{safe}</p>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
        <p className="font-bold text-slate-600 mb-1">Tránh trong ngành thẩm mỹ</p>
        <p>“trẻ hơn 10 tuổi”, “xóa sạch nếp nhăn”, “trị dứt điểm”, “hiệu quả 100%”, “cam kết kết quả”, “vĩnh viễn” → đổi thành “hỗ trợ cải thiện dấu hiệu lão hóa”, “giúp da trông săn chắc, căng mịn hơn”, “kết quả tùy cơ địa và tình trạng da”.</p>
      </div>
    </div>
  );
}

/* ============================================================ small UI ============================================================ */
function Header() {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
      <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">TOP HOOKS INTELLIGENCE</span>
      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Top Hooks Intelligence</h2>
      <p className="text-sm text-slate-500">Xếp hạng hook đối thủ, giải mã tâm lý khách hàng và tạo content/brief SERYN có thể test ngay.</p>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}
function Select({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white max-w-[10rem]">
      <option value="all">{all}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function KV({ k, v }: { k: string; v?: string }) {
  return <div><span className="font-bold text-slate-600">{k}: </span><span className="text-slate-600">{v && v !== "Chưa rõ" ? v : "N/A"}</span></div>;
}
function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 border-slate-200 ${tone || "text-slate-600"}`}>{children}</span>;
}
function CopyBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500">
      <ClipboardCopy className="w-3.5 h-3.5" /> {label || "Copy"}
    </button>
  );
}
