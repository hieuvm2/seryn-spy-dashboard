import React, { useMemo, useState } from "react";
import {
  CalendarRange, ShieldCheck, AlertTriangle, Swords, Zap, Tag, LayoutGrid,
  ClipboardList, Bookmark, Copy, Check, ExternalLink,
} from "lucide-react";
import type { SpyDashboardData, WeeklySummary, ActionPlanItem, SwipeSuggestion } from "../../types";
import {
  parseTopList, dataQualityReport, latestWeek, buildMarkdownReport, updateActionStatus,
} from "../../utils/weeklyIntel";
import { viLabel, humanizeText } from "../../utils/spyData";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* Gợi ý cụ thể cho SERYN theo từng giá trị (hook type / offer / format). */
const HOOK_SUGGEST: Record<string, string> = {
  offer_led: "Đừng đua giá — chuyển thành soi da/đánh giá cá nhân hóa",
  doctor_authority: "Học cấu trúc bác sĩ, nâng lên nền tảng sinh học",
  medical_authority: "Học cấu trúc bác sĩ, nâng lên nền tảng sinh học",
  fear_based: "Tránh hù dọa — đổi sang giáo dục điềm tĩnh",
  problem_led: "Khơi đúng vấn đề da rồi dẫn tới soi da",
  consultation_led: "Mời soi da / tư vấn cá nhân hóa",
  social_proof: "Dùng review thật + giải thích cơ chế",
  transformation_led: "Nhấn kết quả tự nhiên (kết quả tùy cơ địa)",
  education_led: "Giáo dục nền tảng sinh học, dẫn tới tư vấn",
  premium_positioning: "Định vị cao cấp, không FOMO",
  curiosity: "Giữ tò mò nhưng kèm thông tin đúng",
};
const FORMAT_SUGGEST: Record<string, string> = {
  offer_promotion: "Tránh banner giá — làm bản editorial cao cấp",
  doctor_explainer: "Reel bác sĩ giải thích nền tảng sinh học",
  technology_proof: "Giải thích công nghệ kèm chỉ định cá nhân hóa",
  before_after: "Hạn chế before/after — nhấn kết quả tự nhiên",
  customer_testimonial: "Câu chuyện khách hàng + lý giải bác sĩ",
  consultation_lead: "Landing/booking soi da cá nhân hóa",
  educational_post: "Bài giáo dục dẫn tới soi da",
  kol_review: "KOL kèm phân tích bác sĩ, tránh hứa hẹn",
  facility_trust: "Khoe cơ sở + đội ngũ chuyên môn",
  problem_solution: "Khơi vấn đề → giải pháp cá nhân hóa",
};
function suggestFor(kind: "hook" | "offer" | "format", key: string): string {
  const k = String(key || "").toLowerCase();
  if (kind === "hook") return HOOK_SUGGEST[k] || "Cân nhắc test theo tông SERYN (điềm tĩnh, cao cấp)";
  if (kind === "format") return FORMAT_SUGGEST[k] || "Sản xuất bản SERYN: khoa học, cao cấp";
  // offer: theo từ khóa
  if (/miễn phí/.test(k)) return "Đổi 'miễn phí' → soi da miễn phí có giá trị";
  if (/giảm|ưu đãi|khuyến mãi|sale|off|trợ giá|đồng giá/.test(k) || /\d/.test(k)) return "Phản đòn: đổi giảm giá → giá trị chỉ định đúng";
  return "Tạo counter-offer theo tông SERYN (không đua giá)";
}

const PRIO_COLOR: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_COLOR: Record<string, string> = {
  new: "bg-cyan-50 text-cyan-700 border-cyan-200",
  reviewed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ignored: "bg-slate-100 text-slate-500 border-slate-200",
};

function Card({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className="w-4.5 h-4.5 text-cyan-600" />
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
      </div>
      {desc && <p className="text-xs text-slate-500 mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-cyan-200 bg-cyan-50/40" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className={`text-xl font-extrabold ${accent ? "text-cyan-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function TopTable({ raw, kind }: { raw: unknown; kind: "hook" | "offer" | "format" }) {
  const items = parseTopList(raw);
  if (!items.length) return <p className="text-xs text-slate-400">Chưa có dữ liệu.</p>;
  return (
    <table className="w-full text-xs">
      <thead className="text-slate-400 font-mono uppercase tracking-wider">
        <tr className="text-left border-b border-slate-100"><th className="py-2 pr-3">Giá trị</th><th className="pr-3">Số ad</th><th>Gợi ý</th></tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} className="border-b border-slate-50">
            <td className="py-2 pr-3 font-bold text-slate-800">{kind === "offer" ? it.key : viLabel(it.key)}</td>
            <td className="pr-3 text-cyan-600 font-mono font-bold">{it.count}</td>
            <td className="text-slate-500">{suggestFor(kind, it.key)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function WeeklyIntelligenceView({ data }: { data: SpyDashboardData }) {
  const summaries = data.weeklySummary ?? [];
  const summary: WeeklySummary | undefined = latestWeek(summaries);
  const week = summary?.week_start;
  const actions = useMemo(
    () => (data.actionPlan ?? []).filter((a) => !week || a.week_start === week),
    [data.actionPlan, week]);
  const swipe = useMemo(
    () => (data.swipeSuggestions ?? []).filter((s) => !week || s.week_start === week),
    [data.swipeSuggestions, week]);

  const [prioFilter, setPrioFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const dq = dataQualityReport(summary);
  const byActive = parseTopList(summary?.top_brands_by_active_ads);
  const byNew = parseTopList(summary?.top_brands_by_new_ads);

  const filteredActions = actions
    .map((a) => ({ ...a, status: localStatus[a.action_id] ?? a.status }))
    .filter((a) => (prioFilter === "all" || a.priority === prioFilter) && (statusFilter === "all" || a.status === statusFilter));

  async function setActionStatus(a: ActionPlanItem, status: string) {
    setLocalStatus((m) => ({ ...m, [a.action_id]: status }));
    await updateActionStatus(a, status);
  }

  function copyMarkdown() {
    const md = buildMarkdownReport(summary, actions, swipe);
    navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <Header onCopy={copyMarkdown} copied={copied} hasData={false} />
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <CalendarRange className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Chưa có Weekly Intelligence Report.</p>
          <p className="text-xs text-slate-500 mt-1">Chạy weekly spy (GitHub Actions) — report tự sinh sau mỗi lần crawl. Hoặc chạy <code className="font-mono text-cyan-700">npm run report:weekly</code>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header onCopy={copyMarkdown} copied={copied} hasData />

      {/* 1. Executive Summary */}
      <Card icon={CalendarRange} title="Tóm tắt điều hành" desc={`Tuần ${summary.week_start} → ${summary.week_end} · tạo lúc ${summary.generated_at || "—"}`}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label="Brand theo dõi" value={String(summary.total_brands_tracked ?? "—")} />
          <Stat label="Ad active" value={String(summary.total_ads_active ?? "—")} />
          <Stat label="Ad mới" value={String(summary.total_new_ads ?? "—")} />
          <Stat label="Nội dung nhân rộng" value={String(summary.scaled_ads_count ?? "—")} />
          <Stat label="Chất lượng dữ liệu" value={`${dq.score}/100`} accent={dq.level === "good"} />
        </div>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">{humanizeText(String(summary.executive_summary || ""))}</p>
      </Card>

      {/* 2. Data Quality Warnings */}
      <Card icon={dq.level === "good" ? ShieldCheck : AlertTriangle} title="Cảnh báo chất lượng dữ liệu">
        {dq.level === "good" && dq.failedPages === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <ShieldCheck className="w-4 h-4" /> Dữ liệu tuần này tốt ({dq.score}/100), không có cảnh báo đáng kể.
          </div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            <Warn show={dq.score < 60} level="low" text={`Điểm chất lượng dữ liệu thấp (${dq.score}/100) — đọc kết luận thận trọng.`} />
            <Warn show={dq.failedPages > 0} level="warn" text={`${dq.failedPages} page crawl thất bại — KHÔNG kết luận đối thủ tắt ad ở các page này.`} />
            <Warn show={dq.score >= 60 && dq.score < 80} level="warn" text={`Chất lượng dữ liệu trung bình (${dq.score}/100).`} />
            <Warn show={dq.score >= 80 && dq.failedPages > 0} level="warn" text="Có page crawl lỗi nhưng tổng thể vẫn ổn." />
          </ul>
        )}
      </Card>

      {/* 3. Top Competitor Moves */}
      <Card icon={Swords} title="Động thái đối thủ nổi bật">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 font-mono uppercase tracking-wider">
              <tr className="text-left border-b border-slate-100"><th className="py-2 pr-3">Thương hiệu</th><th className="pr-3">Ad active</th><th className="pr-3">Ad mới</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              {byActive.slice(0, 8).map((b, i) => {
                const n = byNew.find((x) => x.key === b.key)?.count ?? 0;
                return (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-bold text-slate-800">{b.key}</td>
                    <td className="pr-3 text-slate-600 font-mono">{b.count}</td>
                    <td className="pr-3 font-mono font-bold text-emerald-600">{n > 0 ? `+${n}` : "0"}</td>
                    <td className="text-slate-500">{n >= 10 ? "Đang scale mạnh" : n >= 4 ? "Tăng tốc" : "Ổn định"}</td>
                  </tr>
                );
              })}
              {!byActive.length && <tr><td colSpan={4} className="py-3 text-slate-400">Chưa có dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4-6. Top hooks / offers / formats */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card icon={Zap} title="Top Hooks"><TopTable raw={summary.top_hooks} kind="hook" /></Card>
        <Card icon={Tag} title="Top Offers"><TopTable raw={summary.top_offers} kind="offer" /></Card>
        <Card icon={LayoutGrid} title="Top Creative Formats"><TopTable raw={summary.top_creative_formats} kind="format" /></Card>
      </div>

      {/* 7. Weekly Action Plan */}
      <Card icon={ClipboardList} title="Kế hoạch hành động tuần">
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="all">Tất cả priority</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="all">Tất cả status</option><option value="new">new</option><option value="reviewed">reviewed</option><option value="in_progress">in_progress</option><option value="done">done</option><option value="ignored">ignored</option>
          </select>
          <span className="text-xs text-slate-400 self-center ml-auto">{filteredActions.length} / {actions.length} action</span>
        </div>
        <div className="space-y-2">
          {filteredActions.map((a) => (
            <div key={a.action_id} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${PRIO_COLOR[String(a.priority)] || PRIO_COLOR.low}`}>{a.priority}</span>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">{a.insight_type}</span>
                {a.related_brand && <span className="text-[10px] text-slate-500">· {a.related_brand}</span>}
                <select
                  value={String(a.status)}
                  onChange={(e) => setActionStatus(a, e.target.value)}
                  className={`ml-auto text-[10px] font-bold rounded border px-1.5 py-0.5 ${STATUS_COLOR[String(a.status)] || STATUS_COLOR.new}`}
                >
                  {["new", "reviewed", "in_progress", "done", "ignored"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <p className="text-xs font-bold text-slate-800">{humanizeText(String(a.insight || ""))}</p>
              {a.evidence && <p className="text-[11px] text-slate-500 mt-0.5">{humanizeText(String(a.evidence))}</p>}
              <p className="text-[11px] text-cyan-700 mt-1">→ {humanizeText(String(a.suggested_action || ""))}</p>
            </div>
          ))}
          {!filteredActions.length && <p className="text-xs text-slate-400">Không có action khớp bộ lọc.</p>}
        </div>
      </Card>

      {/* 8. Swipe File Candidates */}
      <Card icon={Bookmark} title="Đề xuất Swipe File" desc="Ad đáng học theo — lưu vào Swipe File rồi điều chỉnh theo tông SERYN.">
        <div className="grid md:grid-cols-2 gap-3">
          {swipe.map((s) => (
            <div key={s.swipe_id} className="border border-slate-200 rounded-xl p-3 flex gap-3">
              {s.thumbnail_url || s.media_url ? (
                <img src={s.thumbnail_url || s.media_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              ) : <div className="w-16 h-16 rounded-lg bg-slate-100 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{s.brand_name}</p>
                <p className="text-[11px] text-slate-600 line-clamp-1">{s.hook || "(no hook)"}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{humanizeText(String(s.why_save || ""))}</p>
                <p className="text-[10px] text-cyan-700 mt-0.5 line-clamp-2">{humanizeText(String(s.how_to_adapt || ""))}</p>
                {s.ad_url && <a href={s.ad_url} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-600 hover:underline inline-flex items-center gap-0.5 mt-0.5">xem ad <ExternalLink className="w-2.5 h-2.5" /></a>}
              </div>
            </div>
          ))}
          {!swipe.length && <p className="text-xs text-slate-400">Chưa có ad đáng lưu tuần này.</p>}
        </div>
      </Card>
    </div>
  );
}

function Warn({ show, level, text }: { show: boolean; level: "warn" | "low"; text: string }) {
  if (!show) return null;
  return (
    <li className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${level === "low" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> <span>{text}</span>
    </li>
  );
}

function Header({ onCopy, copied, hasData }: { onCopy: () => void; copied: boolean; hasData: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Báo cáo tuần</h2>
        <p className="text-sm text-slate-500">Báo cáo &amp; kế hoạch hành động tuần cho team marketing — tự sinh mỗi thứ Hai.</p>
      </div>
      {hasData && (
        <button onClick={onCopy} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm shadow-cyan-600/20 transition shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Đã copy" : "Copy report (MD)"}
        </button>
      )}
    </div>
  );
}
