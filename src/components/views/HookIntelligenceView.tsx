import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Zap, Search, ClipboardCopy, CheckCircle2, ShieldAlert, Layers, Megaphone, Filter, AlertTriangle, Info } from "lucide-react";
import type { SpyDashboardData, HookCluster, SerynContentRecommendation } from "../../types";
import { viLabel } from "../../utils/spyData";
import TopHooksView from "./TopHooksView";

const SC = "skin_rejuvenation";
const HOOK_SOURCE = "hook_intelligence";
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const lc = (s?: string) => String(s || "").toLowerCase();

/** Hook pattern hiển thị tiếng Việt từ category/formula/subcategory. */
function viPattern(c: HookCluster): string {
  const parts = [viLabel(c.hook_category), viLabel(c.hook_formula), viLabel(c.hook_subcategory)].filter((x) => x && x !== "Chưa rõ");
  const base = parts.join(" · ") || String(c.hook_pattern || "");
  return c.offer_linked === "TRUE" || c.top_offer_linked === "TRUE" ? `${base} · có ưu đãi` : base;
}
/** Tên cụm tiếng Việt (thay cluster_name có enum tiếng Anh). */
function viClusterName(c: HookCluster): string {
  const sub = viLabel(c.hook_subcategory);
  return `Trẻ hóa da · ${viLabel(c.hook_category)}${sub && sub !== "Chưa rõ" ? ` · ${sub}` : ""}`;
}
/** Diễn giải "vì sao có tín hiệu" bằng tiếng Việt (thay insight có enum tiếng Anh). */
function viWhy(c: HookCluster): string {
  const brands = String(c.brands_using || "").split("|").filter(Boolean).length;
  const days = c.avg_active_days && String(c.avg_active_days) !== "unknown"
    ? ` · trung bình chạy ${c.avg_active_days} ngày`
    : " · chưa rõ số ngày chạy (độ tin cậy thấp)";
  const riskNote = num(c.risk_score) >= 60 ? " · rủi ro câu chữ cao → nên tránh" : num(c.risk_score) >= 30 ? " · có rủi ro câu chữ → dùng bản an toàn" : "";
  const sig = (SIGNAL_VI as Record<string, string>)[String(c.scale_signal)] || String(c.scale_signal);
  return `${sig}: ${c.ads_count} quảng cáo của ${brands} thương hiệu dùng mẫu ${viLabel(c.hook_category)} / ${viLabel(c.hook_formula)} quanh "${c.pain_point}"${days}${riskNote}. Đây là tín hiệu hook đối thủ, không phải hook thắng chắc.`;
}

const SIGNAL_TONE: Record<string, string> = {
  none: "bg-slate-100 text-slate-500 border-slate-200",
  early_signal: "bg-slate-100 text-slate-600 border-slate-200",
  repeated_signal: "bg-sky-50 text-sky-700 border-sky-200",
  strong_persistence_signal: "bg-amber-50 text-amber-700 border-amber-200",
  evergreen_persistence_signal: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const SIGNAL_VI: Record<string, string> = {
  none: "Chưa có tín hiệu",
  early_signal: "Tín hiệu sớm",
  repeated_signal: "Lặp lại",
  strong_persistence_signal: "Bền vững (mạnh)",
  evergreen_persistence_signal: "Evergreen",
};
const ACTION_TONE: Record<string, string> = {
  copy_structure: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt_angle: "bg-amber-50 text-amber-700 border-amber-200",
  counter_positioning: "bg-rose-50 text-rose-700 border-rose-200",
  avoid_due_to_risk: "bg-slate-200 text-slate-700 border-slate-300",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
  test_now: "bg-cyan-50 text-cyan-700 border-cyan-200",
};
const ACTION_VI: Record<string, string> = {
  copy_structure: "Học cấu trúc",
  adapt_angle: "Điều chỉnh góc",
  counter_positioning: "Phản định vị",
  avoid_due_to_risk: "Tránh (rủi ro)",
  monitor: "Theo dõi",
  test_now: "Test ngay",
};
const RISK_TONE: Record<string, string> = {
  low: "text-emerald-600", medium: "text-amber-600", high: "text-rose-600",
};

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    try { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); return true; }
    catch { return false; }
  }
}

export default function HookIntelligenceView({ data }: { data: SpyDashboardData }) {
  const clusters = useMemo<HookCluster[]>(
    () => (data.hookIntelligence ?? []).filter((c) => !c.service_category || c.service_category === SC),
    [data.hookIntelligence],
  );
  const recsByCluster = useMemo(() => {
    const m = new Map<string, SerynContentRecommendation>();
    for (const r of data.serynContentRecommendations ?? []) {
      if (String(r.source) === HOOK_SOURCE && r.source_hook_cluster_id) m.set(String(r.source_hook_cluster_id), r);
    }
    return m;
  }, [data.serynContentRecommendations]);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2400); };
  const doCopy = async (t?: string) => { const ok = await copyText(String(t || "")); flash(ok ? "Đã copy." : "Không copy được."); };

  // Không có dữ liệu cluster -> empty state + fallback list hook cũ (vẫn dùng được).
  if (!clusters.length) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
          <Layers className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Chưa có cụm Hook Intelligence cho trẻ hóa da.</p>
          <p className="text-xs text-slate-500 mt-1">Chạy <code className="font-mono text-cyan-700">npm run hooks:analyze</code> để tạo cụm hook + content. Bên dưới là danh sách hook nhanh từ dữ liệu hiện có.</p>
        </div>
        <TopHooksView data={data} />
      </div>
    );
  }

  const filtered = clusters.filter((c) => {
    if (!q.trim()) return true;
    const k = q.toLowerCase();
    return [c.hook_pattern, c.cluster_name, c.pain_point, c.desired_outcome, c.hook_category, c.example_hooks].some((v) => lc(v as string).includes(k));
  });
  const sel = clusters.find((c) => c.hook_cluster_id === selected) || filtered[0] || clusters[0];
  const selRec = sel ? recsByCluster.get(String(sel.hook_cluster_id)) : undefined;

  const byFormat = (f: string) => clusters.filter((c) => c.top_ad_format === f);
  const byObj = (o: string) => clusters.filter((c) => c.top_inferred_objective === o);
  const risky = clusters.filter((c) => num(c.risk_score) >= 30).sort((a, b) => num(b.risk_score) - num(a.risk_score));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Header />
      {note && <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-4 h-4" /> {note}</div>}

      <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Đây là <b>tín hiệu hook đối thủ</b> (lặp lại / bền vững), không phải “hook thắng chắc”. Mọi câu của SERYN đều được viết lại an toàn câu chữ, không sao chép nguyên văn đối thủ.
      </div>

      {/* A. Top Hook Patterns */}
      <Section icon={Zap} title="A. Mẫu hook nổi bật (trẻ hóa da)">
        <div className="relative max-w-md mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm hook pattern, pain, desire…" className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 font-mono uppercase tracking-wider">
              <tr className="text-left border-b border-slate-100">
                <th className="py-2 pr-2">#</th><th className="pr-2">Mẫu hook</th><th className="pr-2">Nỗi đau → Mong muốn</th>
                <th className="pr-2">Ad</th><th className="pr-2">Hãng</th><th className="pr-2">Tín hiệu</th>
                <th className="pr-2">Rủi ro</th><th className="pr-2">Tin cậy</th><th>SERYN</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const active = sel && c.hook_cluster_id === sel.hook_cluster_id;
                return (
                  <tr key={c.hook_cluster_id} onClick={() => setSelected(String(c.hook_cluster_id))}
                    className={`border-b border-slate-50 cursor-pointer ${active ? "bg-cyan-50/60" : "hover:bg-slate-50"}`}>
                    <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                    <td className="pr-2 font-bold text-slate-800">{viPattern(c)}</td>
                    <td className="pr-2 text-slate-500">{c.pain_point} → {c.desired_outcome}</td>
                    <td className="pr-2 text-slate-600">{String(c.ads_count ?? 0)}</td>
                    <td className="pr-2 text-slate-600">{String(c.brands_using || "").split("|").filter(Boolean).length}</td>
                    <td className="pr-2"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SIGNAL_TONE[String(c.scale_signal)] || SIGNAL_TONE.none}`}>{SIGNAL_VI[String(c.scale_signal)] || c.scale_signal}</span></td>
                    <td className={`pr-2 font-bold ${num(c.risk_score) >= 60 ? "text-rose-600" : num(c.risk_score) >= 30 ? "text-amber-600" : "text-slate-500"}`}>{num(c.risk_score)}</td>
                    <td className="pr-2 text-slate-600">{Math.round(num(c.confidence_score) * 100)}%</td>
                    <td><span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${ACTION_TONE[String(c.recommended_seryn_action)] || ACTION_TONE.monitor}`}>{ACTION_VI[String(c.recommended_seryn_action)] || c.recommended_seryn_action}</span></td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={9} className="py-3 text-slate-400">Không có cụm hook khớp.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {sel && (
        <>
          {/* B. Cluster Detail */}
          <Section icon={Layers} title="B. Chi tiết cụm hook" desc={viClusterName(sel)}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 text-xs">
                <KV k="Mẫu hook" v={viPattern(sel)} />
                <KV k="Nhóm · Công thức · Góc" v={`${viLabel(sel.hook_category)} · ${viLabel(sel.hook_formula)} · ${viLabel(sel.hook_angle)}`} />
                <KV k="Nỗi đau" v={sel.pain_point} />
                <KV k="Mong muốn" v={sel.desired_outcome} />
                <KV k="Thương hiệu dùng" v={String(sel.brands_using || "").split("|").filter(Boolean).join(", ")} />
                <KV k="Số ad · Ngày chạy TB" v={`${sel.ads_count} ad · ${sel.avg_active_days} ngày`} />
                <KV k="Ưu đãi · Bằng chứng" v={`${sel.top_offer_linked === "TRUE" ? "có ưu đãi" : "không ưu đãi"} · ${viLabel(sel.top_proof_type)}`} />
                <KV k="Định dạng · Mục tiêu" v={`${viLabel(sel.top_ad_format)} · ${viLabel(sel.top_inferred_objective)}`} />
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Hook đối thủ đang dùng (ví dụ — KHÔNG sao chép)</p>
                  <p className="text-xs text-slate-600 italic">{sel.example_hooks}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Vì sao có tín hiệu này</p>
                  <p className="text-xs text-slate-700">{viWhy(sel)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SIGNAL_TONE[String(sel.scale_signal)]}`}>{SIGNAL_VI[String(sel.scale_signal)]}</span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${ACTION_TONE[String(sel.recommended_seryn_action)]}`}>SERYN: {ACTION_VI[String(sel.recommended_seryn_action)]}</span>
                  {String(sel.needs_claude_hook_review) === "TRUE" && <span className="px-2 py-0.5 rounded border text-[10px] font-bold bg-violet-50 text-violet-700 border-violet-200">cần Claude review</span>}
                </div>
              </div>
            </div>
          </Section>

          {/* C. Content Generator */}
          <Section icon={Megaphone} title="C. Tạo nội dung quảng cáo (chạy ngay)" desc={selRec ? undefined : "Cụm này chưa được sinh nội dung (chỉ sinh cho cụm có tín hiệu lặp/bền + an toàn câu chữ)."}>
            {selRec ? (
              <div className="space-y-3">
                <CopyBlock label="Nội dung ngắn" text={selRec.ad_copy_short} onCopy={doCopy} />
                <CopyBlock label="Nội dung vừa" text={selRec.ad_copy_medium} onCopy={doCopy} />
                <CopyBlock label="Nội dung dài" text={selRec.ad_copy_long} onCopy={doCopy} />
                <div className="grid md:grid-cols-2 gap-3">
                  <ListBlock label="Tiêu đề gợi ý" items={String(selRec.headline_options || "").split(" | ")} onCopy={doCopy} />
                  <ListBlock label="Nút CTA gợi ý" items={String(selRec.cta_options || "").split(" | ")} onCopy={doCopy} />
                </div>
                <CopyBlock label="Mở video 3 giây đầu" text={String(selRec.video_opening_3s || "").split(" || ").join("\n")} onCopy={doCopy} />
                <div className="grid md:grid-cols-2 gap-3">
                  <CopyBlock label="Kịch bản Messenger" text={selRec.messenger_script_angle} onCopy={doCopy} />
                  <CopyBlock label="Góc landing page" text={selRec.landing_page_angle} onCopy={doCopy} />
                </div>
                <CopyBlock label="Định hướng hình ảnh" text={selRec.visual_direction} onCopy={doCopy} />
              </div>
            ) : <p className="text-xs text-slate-400">Chọn một cụm có tín hiệu lặp/bền để xem nội dung.</p>}
          </Section>
        </>
      )}

      {/* D. Hook x Format / Funnel */}
      <Section icon={Filter} title="D. Hook × Định dạng / Phễu">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <MiniList title="Đi với Video" items={byFormat("video")} />
          <MiniList title="Đi với Image" items={byFormat("image")} />
          <MiniList title="Kéo Messenger" items={byObj("messenger")} />
          <MiniList title="Kéo Landing/Conversion" items={byObj("landing_page_conversion")} />
        </div>
      </Section>

      {/* E. Risk & Safe Claim */}
      <Section icon={ShieldAlert} title="E. Rủi ro & Câu chữ an toàn">
        {risky.length ? (
          <div className="space-y-2">
            {risky.slice(0, 8).map((c) => {
              const rec = recsByCluster.get(String(c.hook_cluster_id));
              return (
                <div key={c.hook_cluster_id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">{viPattern(c)}</p>
                    <span className={`text-[11px] font-bold ${num(c.risk_score) >= 60 ? RISK_TONE.high : RISK_TONE.medium}`}>rủi ro {num(c.risk_score)}</span>
                  </div>
                  {!!rec?.avoid_phrases && <p className="text-[11px] text-rose-600 mt-1"><b>Tránh:</b> {rec.avoid_phrases}</p>}
                  {!!rec?.claim_safe_version && <p className="text-[11px] text-emerald-700 mt-0.5"><b>Bản an toàn:</b> {rec.claim_safe_version}</p>}
                  {!rec && <p className="text-[11px] text-slate-500 mt-1">Cụm có claim mạnh — SERYN nên tránh hoặc viết lại theo hướng “hỗ trợ cải thiện, kết quả tùy cơ địa”.</p>}
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-slate-400">Không có cụm hook rủi ro claim cao.</p>}
        <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="font-bold text-slate-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Cụm từ nên tránh trong ngành thẩm mỹ</p>
          <p>“trẻ hơn 10 tuổi”, “xóa sạch nếp nhăn”, “trị dứt điểm lão hóa”, “hiệu quả 100%” → đổi thành “hỗ trợ cải thiện dấu hiệu lão hóa”, “giúp da trông căng mịn hơn”, “kết quả tùy cơ địa và tình trạng da”.</p>
        </div>
      </Section>
    </motion.div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
      <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">PHÂN TÍCH HOOK</span>
      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Phân tích Hook &amp; Tạo nội dung quảng cáo — Trẻ hóa da</h2>
      <p className="text-sm text-slate-500">Gom mẫu hook của đối thủ → tín hiệu lặp/bền + rủi ro câu chữ → nội dung SERYN viết lại, dùng chạy quảng cáo ngay.</p>
    </div>
  );
}
function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1"><Icon className="w-4.5 h-4.5 text-cyan-600" /><h3 className="text-sm font-extrabold text-slate-900">{title}</h3></div>
      {desc && <p className="text-xs text-slate-500 mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}
function KV({ k, v }: { k: string; v?: string | number }) {
  return <div><span className="font-bold text-slate-600">{k}: </span><span className="text-slate-500">{String(v ?? "—")}</span></div>;
}
function CopyBlock({ label, text, onCopy }: { label: string; text?: string; onCopy: (t?: string) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
        <button onClick={() => onCopy(text)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500"><ClipboardCopy className="w-3.5 h-3.5" /> Copy</button>
      </div>
      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{text || "—"}</p>
    </div>
  );
}
function ListBlock({ label, items, onCopy }: { label: string; items: string[]; onCopy: (t?: string) => void }) {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
        <button onClick={() => onCopy(clean.join("\n"))} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500"><ClipboardCopy className="w-3.5 h-3.5" /> Copy</button>
      </div>
      <ul className="text-xs text-slate-700 space-y-0.5 list-disc pl-4">{clean.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  );
}
function MiniList({ title, items }: { title: string; items: HookCluster[] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">{title}</p>
      {items.length ? (
        <ul className="space-y-1">{items.slice(0, 5).map((c) => <li key={c.hook_cluster_id} className="text-[11px] text-slate-700 truncate">• {viPattern(c)} <span className="text-slate-400">({String(c.ads_count)} ad)</span></li>)}</ul>
      ) : <p className="text-[11px] text-slate-400">—</p>}
    </div>
  );
}
