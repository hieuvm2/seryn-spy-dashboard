import React, { useEffect, useMemo, useState } from "react";
import { Check, X, Copy, AlertTriangle, ExternalLink, Search, Info } from "lucide-react";
import type { SpyDashboardData, CompetitorDiscoveryCandidate, CompetitorDiscoveryRun } from "../../types";
import {
  applyOverrides, approveCandidate, rejectCandidate, markDuplicate, setPageId,
  computeReadyForSpy, isNumericPageId, discoveryWriteConfigured,
} from "../../utils/competitorDiscovery";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (v: unknown) => `${Math.round(num(v) * 100)}%`;

const STATUS_COLOR: Record<string, string> = {
  new: "bg-slate-100 text-slate-600",
  needs_review: "bg-amber-50 text-amber-700 border border-amber-200",
  needs_page_id: "bg-orange-50 text-orange-700 border border-orange-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-rose-50 text-rose-600 border border-rose-200",
  duplicate: "bg-slate-100 text-slate-500",
  imported_to_competitors: "bg-cyan-50 text-cyan-700 border border-cyan-200",
};

const STATUSES = ["all", "new", "needs_review", "needs_page_id", "approved", "rejected", "duplicate", "imported_to_competitors"];

export default function CompetitorDiscoveryView({ data }: { data: SpyDashboardData }) {
  const runs = data.competitorDiscoveryRuns ?? [];
  const raw = data.competitorDiscovery ?? [];
  const [items, setItems] = useState<CompetitorDiscoveryCandidate[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { setItems(applyOverrides(raw)); }, [raw]);

  const latestRun = runs[runs.length - 1];

  const counts = useMemo(() => {
    const by = (s: string) => items.filter((c) => String(c.status).toLowerCase() === s).length;
    return {
      found: items.length, needs_review: by("needs_review"), needs_page_id: by("needs_page_id"),
      approved: by("approved"), duplicate: by("duplicate"), imported: by("imported_to_competitors"),
      ready: items.filter((c) => String(c.ready_for_spy).toLowerCase() === "true").length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (status !== "all" && String(c.status).toLowerCase() !== status) return false;
      if (readyOnly && String(c.ready_for_spy).toLowerCase() !== "true") return false;
      if (q) { const t = `${c.brand_name} ${c.website_url} ${c.facebook_url} ${c.detected_services}`.toLowerCase(); if (!t.includes(q.toLowerCase())) return false; }
      return true;
    }).sort((a, b) => num(b.overall_confidence_score) - num(a.overall_confidence_score));
  }, [items, status, q, readyOnly]);

  function act(fn: () => Promise<{ message: string }>): void {
    void (async () => {
      const r = await fn();
      setToast(r.message);
      setItems(applyOverrides(raw)); // re-merge overrides
      setTimeout(() => setToast(""), 3500);
    })();
  }

  if (!runs.length && !raw.length) {
    return (
      <div className="space-y-6">
        <Header writeOn={discoveryWriteConfigured()} />
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Chạy workflow <code className="font-mono text-cyan-700">Competitor Discovery Manual</code> để tìm đối thủ mới từ Exa.</p>
        </div>
      </div>
    );
  }

  const health = buildHealth(latestRun, counts);

  return (
    <div className="space-y-6">
      <Header writeOn={discoveryWriteConfigured()} />

      {health.length > 0 && (
        <div className="space-y-1.5">
          {health.map((it, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${it.level === "warn" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-sky-50 border-sky-200 text-sky-800"}`}>
              {it.level === "warn" ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Info className="w-3.5 h-3.5 shrink-0" />}
              <span>{it.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* A. Discovery Summary */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <Stat label="Tìm thấy" value={counts.found} />
        <Stat label="Sẵn sàng spy" value={counts.ready} accent />
        <Stat label="Thiếu page_id" value={counts.needs_page_id} />
        <Stat label="Cần review" value={counts.needs_review} />
        <Stat label="Đã duyệt" value={counts.approved} />
        <Stat label="Trùng lặp" value={counts.duplicate} />
        <Stat label="Đã import" value={counts.imported} />
      </div>
      {latestRun && <p className="text-xs text-slate-500">Run gần nhất: <b>{latestRun.discovery_run_id}</b> ({latestRun.status}) @ {latestRun.finished_at || latestRun.started_at}</p>}

      {/* C. Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo brand / domain / dịch vụ..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-xs flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={readyOnly} onChange={(e) => setReadyOnly(e.target.checked)} /> ready_for_spy
        </label>
        {toast && <span className="text-xs text-cyan-700 font-bold ml-auto">{toast}</span>}
      </div>

      {/* B. Candidate Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-400 font-mono uppercase tracking-wider">
              <tr className="text-left">
                <th className="py-2.5 px-3">Đối thủ</th><th className="px-2">Liên kết</th><th className="px-2">page_id</th>
                <th className="px-2">Dịch vụ</th><th className="px-2">Tin cậy</th><th className="px-2">Trạng thái</th><th className="px-2">Spy</th><th className="px-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <Row key={String(c.discovery_id)} c={c} onAct={act} />
              ))}
              {!filtered.length && <tr><td colSpan={8} className="py-4 text-center text-slate-400">Không có đối thủ nào khớp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* E. Warnings + import hướng dẫn */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
        <p className="flex items-center gap-1.5 font-bold"><AlertTriangle className="w-3.5 h-3.5" /> Lưu ý khi import</p>
        <p>• Đối thủ không có <code>page_id</code> dạng số sẽ ở trạng thái <b>needs_page_id</b> — ScrapeCreators chưa thể spy ads tin cậy.</p>
        <p>• Vanity Facebook URL (facebook.com/brand) KHÔNG phải page_id. Đừng bịa page_id.</p>
        <p>• Sau khi <b>duyệt</b> (page_id dạng số, độ tin cậy ≥ 0.65), chạy <code className="font-mono">npm run competitors:import</code> để đưa vào tab <b>Competitors</b>. Lần weekly spy kế tiếp ScrapeCreators sẽ crawl.</p>
      </div>
    </div>
  );
}

const Row: React.FC<{ c: CompetitorDiscoveryCandidate; onAct: (fn: () => Promise<{ message: string }>) => void }> = ({ c, onAct }) => {
  const [editing, setEditing] = useState(false);
  const [pid, setPid] = useState(String(c.facebook_page_id || ""));
  const ready = computeReadyForSpy(c);
  const st = String(c.status).toLowerCase();
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60 align-top">
      <td className="py-2.5 px-3">
        <p className="font-bold text-slate-800">{c.brand_name}</p>
        {c.duplicate_of && <p className="text-[10px] text-slate-400">trùng với {c.duplicate_of}</p>}
        <p className="text-[10px] text-slate-400 max-w-[14rem] truncate">{c.evidence_summary}</p>
      </td>
      <td className="px-2">
        <div className="flex flex-col gap-0.5">
          {c.website_url && <a href={String(c.website_url)} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline flex items-center gap-0.5">web <ExternalLink className="w-3 h-3" /></a>}
          {c.facebook_url && <a href={String(c.facebook_url)} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline flex items-center gap-0.5">fb <ExternalLink className="w-3 h-3" /></a>}
        </div>
      </td>
      <td className="px-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input value={pid} onChange={(e) => setPid(e.target.value)} className="w-24 border border-slate-200 rounded px-1 py-0.5 text-[11px]" placeholder="page_id (số)" />
            <button className="text-emerald-600" onClick={() => { onAct(() => setPageId(c, pid)); setEditing(false); }}><Check className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button className="text-left" onClick={() => setEditing(true)}>
            {isNumericPageId(c.facebook_page_id)
              ? <span className="font-mono text-slate-700">{c.facebook_page_id}</span>
              : <span className="text-orange-600 font-bold">+ page_id</span>}
          </button>
        )}
      </td>
      <td className="px-2 text-slate-500 max-w-[10rem]">
        <div className="flex flex-wrap gap-0.5">
          {String(c.detected_services || "").split("|").filter(Boolean).slice(0, 3).map((s, i) => <span key={i} className="px-1 bg-slate-100 rounded text-[10px]">{s}</span>)}
        </div>
      </td>
      <td className="px-2 font-bold text-slate-700">{pct(c.overall_confidence_score)}</td>
      <td className="px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_COLOR[st] || "bg-slate-100 text-slate-600"}`}>{c.status}</span></td>
      <td className="px-2">{ready ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}</td>
      <td className="px-2">
        <div className="flex items-center justify-end gap-1">
          <button title="Duyệt" className="p-1 rounded hover:bg-emerald-50 text-emerald-600" onClick={() => onAct(() => approveCandidate(c))}><Check className="w-3.5 h-3.5" /></button>
          <button title="Từ chối" className="p-1 rounded hover:bg-rose-50 text-rose-500" onClick={() => onAct(() => rejectCandidate(c))}><X className="w-3.5 h-3.5" /></button>
          <button title="Đánh dấu trùng" className="p-1 rounded hover:bg-slate-100 text-slate-500" onClick={() => onAct(() => markDuplicate(c))}><Copy className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );
};

function Header({ writeOn }: { writeOn: boolean }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-900">Phát hiện đối thủ</h2>
      <p className="text-sm text-slate-500">
        Đối thủ mới do Exa phát hiện — xem &amp; duyệt trước khi import vào tab Competitors.
        {writeOn ? " Thao tác đồng bộ lên Google Sheets." : " Chưa cấu hình ghi — thao tác lưu nháp local."}
      </p>
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className={`text-lg font-extrabold ${accent ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

type Counts = { found: number; needs_review: number; needs_page_id: number; approved: number; duplicate: number; imported: number; ready: number };
type HealthItem = { level: "warn" | "info"; text: string };
function buildHealth(run: CompetitorDiscoveryRun | undefined, c: Counts): HealthItem[] {
  const out: HealthItem[] = [];
  if (run && String(run.status) === "failed") out.push({ level: "warn", text: "Run gần nhất THẤT BẠI — kiểm tra log GitHub Actions (EXA_API_KEY / queries lỗi)." });
  else if (run && String(run.status) === "partial") out.push({ level: "warn", text: `Run gần nhất chạy một phần (partial): ${run.error_summary || "một số query Exa lỗi"}.` });
  if (c.found > 0 && c.needs_page_id > 0) out.push({ level: "warn", text: `${c.needs_page_id} đối thủ thiếu page_id — bổ sung page_id (dạng số) rồi duyệt thì mới spy ads được.` });
  if (c.approved > 0 && c.imported === 0) out.push({ level: "warn", text: `${c.approved} đối thủ đã duyệt nhưng chưa import — chạy "npm run competitors:import" để đưa vào Competitors.` });
  if (c.found > 0 && c.ready === 0) out.push({ level: "info", text: "Chưa có đối thủ nào sẵn sàng spy (cần page_id dạng số + đã duyệt + độ tin cậy ≥ 0.65)." });
  if (c.duplicate > 0) out.push({ level: "info", text: `${c.duplicate} đối thủ trùng với danh sách hiện có — đã tự loại khỏi import.` });
  return out;
}
