import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Users, Plus, Search, CheckCircle2, AlertTriangle, Power, FlaskConical, Cloud, CloudOff, Trash2, Sparkles } from "lucide-react";
import type { Competitor, SpyDashboardData } from "../../types";
import { ownPageCrawlStats, isTruthyFlag } from "../../utils/ownBrand";
import {
  loadCompetitorsAsync,
  createCompetitor,
  updateCompetitor,
  toggleCompetitorActive,
  deleteCompetitor,
  validateCompetitor,
  statusFor,
  testCrawl,
  competitorWriteConfigured,
} from "../../utils/competitors";
import { useDirectCompetitors, toggleDirectCompetitor } from "../../utils/directCompetitors";
import { Star } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
  needs_page_id: "bg-amber-50 text-amber-700 border-amber-200",
  crawl_error: "bg-rose-50 text-rose-700 border-rose-200",
};

const emptyForm = { brand: "", page_url: "", page_id: "", category: "", active: true, notes: "" };

export default function CompetitorSetupView({ data }: { data: SpyDashboardData }) {
  const [list, setList] = useState<Competitor[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [note, setNote] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const writeOnline = competitorWriteConfigured();
  const direct = useDirectCompetitors();

  const flash = (msg: string, ok = true) => { setNote({ msg, ok }); window.setTimeout(() => setNote(null), 2800); };
  const reload = () => { loadCompetitorsAsync().then(({ items, warning }) => { setList(items); setWarning(warning || null); }); };
  useEffect(() => { reload(); }, []);

  const rows = useMemo(() => list.filter((c) =>
    (filter === "all" || (filter === "active" ? c.active : !c.active)) &&
    (!q.trim() || [c.brand, c.page_url, c.page_id, c.category, c.notes].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase())))
  ), [list, q, filter]);

  const kpi = useMemo(() => ({ total: list.length, active: list.filter((c) => c.active).length, needsId: list.filter((c) => statusFor(c) === "needs_page_id").length }), [list]);

  const onAdd = () => {
    const v = validateCompetitor(form, list);
    setErrors(v.errors); setWarns(v.warnings);
    if (!v.ok) return;
    const { synced } = createCompetitor(form);
    setForm({ ...emptyForm });
    setErrors([]); setWarns([]);
    reload();
    flash(synced ? "Đã thêm + đồng bộ Google Sheets." : "Đã thêm (local draft — chưa cấu hình sync).", synced);
  };

  const onPatch = (id: string, patch: Partial<Competitor>) => { updateCompetitor(id, patch); reload(); };
  const onToggle = (c: Competitor) => { toggleCompetitorActive(c.id, !c.active); reload(); flash(c.active ? "Đã tắt." : "Đã bật."); };
  const onCrawl = (c: Competitor) => { const r = testCrawl(c); flash(r.message, r.ok); };
  const onDelete = (c: Competitor) => {
    if (!window.confirm(`Xóa hẳn đối thủ "${c.brand}" khỏi watchlist?\nPipeline sẽ KHÔNG spy brand này nữa. (Nếu chỉ muốn tạm dừng, dùng nút On/Off.)`)) return;
    const { synced } = deleteCompetitor(c.id);
    reload();
    flash(synced ? `Đã xóa "${c.brand}" + đồng bộ Google Sheets.` : `Đã xóa "${c.brand}" (local).`, true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">CẤU HÌNH ĐỐI THỦ</span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Quản lý danh sách đối thủ</h2>
          <p className="text-sm text-slate-600 font-medium">Thêm/sửa/bật-tắt đối thủ ngay trong dashboard — pipeline hằng tuần đọc tab <code className="bg-slate-100 px-1 rounded">Competitors</code>.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${writeOnline ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          {writeOnline ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
          {writeOnline ? "Sync Google Sheets" : "Local draft only"}
        </span>
      </div>

      {warning && <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {warning}</div>}
      {!writeOnline && <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Local draft only — sync endpoint not configured. Cấu hình <code className="bg-white/60 px-1 rounded">VITE_GOOGLE_SHEETS_API_URL</code> + Apps Script (tab Competitors) để ghi online. Xem README.</div>}
      {note && <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border ${note.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>{note.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {note.msg}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Tổng đối thủ", value: kpi.total, tone: "text-slate-900" }, { label: "Đang active", value: kpi.active, tone: "text-emerald-600" }, { label: "Thiếu page_id", value: kpi.needsId, tone: "text-amber-600" }].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"><p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p><p className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</p></div>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-white border border-cyan-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-cyan-600" /> Thêm đối thủ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand name *" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (vd: hospital, spa)" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="Facebook Page URL" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={form.page_id} onChange={(e) => setForm({ ...form, page_id: e.target.value })} placeholder="Page ID (số, nhiều id dùng |)" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="px-3 py-2 rounded-lg border border-slate-200 text-sm md:col-span-2" />
        </div>
        {errors.length > 0 && <ul className="mt-2 text-xs text-rose-600 font-semibold list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {warns.length > 0 && <ul className="mt-2 text-xs text-amber-600 font-semibold list-disc pl-5">{warns.map((w) => <li key={w}>{w}</li>)}</ul>}
        <div className="flex items-center gap-3 mt-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <button onClick={onAdd} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition cursor-pointer"><Plus className="w-4 h-4" /> Thêm</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm brand, page…" className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium w-56 focus:outline-none focus:ring-2 focus:ring-cyan-100" />
        </div>
        {(["all", "active", "inactive"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${filter === f ? "bg-cyan-600 text-white border-cyan-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{f === "all" ? "Tất cả" : f === "active" ? "Active" : "Inactive"}</button>
        ))}
      </div>

      {/* List */}
      {!rows.length ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">Chưa có đối thủ nào khớp.</p>
          <p className="text-xs text-slate-400 font-medium">Thêm đối thủ ở form trên, hoặc cấu hình Google Sheets để đồng bộ tab Competitors.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          {rows.map((c) => {
            const st = statusFor(c);
            const isEdit = editing === c.id;
            return (
              <div key={c.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  {isEdit ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input defaultValue={c.brand} onBlur={(e) => onPatch(c.id, { brand: e.target.value })} className="px-2 py-1 rounded border border-slate-200 text-sm" />
                      <input defaultValue={c.category || ""} onBlur={(e) => onPatch(c.id, { category: e.target.value })} placeholder="category" className="px-2 py-1 rounded border border-slate-200 text-sm" />
                      <input defaultValue={c.page_url || ""} onBlur={(e) => onPatch(c.id, { page_url: e.target.value })} placeholder="page_url" className="px-2 py-1 rounded border border-slate-200 text-sm" />
                      <input defaultValue={c.page_id || ""} onBlur={(e) => onPatch(c.id, { page_id: e.target.value })} placeholder="page_id" className="px-2 py-1 rounded border border-slate-200 text-sm" />
                      <input defaultValue={c.notes || ""} onBlur={(e) => onPatch(c.id, { notes: e.target.value })} placeholder="notes" className="px-2 py-1 rounded border border-slate-200 text-sm sm:col-span-2" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-800">{c.brand}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_TONE[st] || STATUS_TONE.inactive}`}>{st}</span>
                        {c.category && <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{c.category}</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{c.page_id || "no page_id"}{c.page_url ? ` · ${c.page_url}` : ""}</p>
                      {c.notes && <p className="text-[11px] text-slate-500 truncate">{c.notes}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleDirectCompetitor(c.brand)}
                    title="Đối thủ trực tiếp — ưu tiên hiển thị ở các tab khác"
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${direct.has(c.brand) ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                  >
                    <Star className={`w-3.5 h-3.5 ${direct.has(c.brand) ? "fill-amber-400 text-amber-500" : ""}`} /> Trực tiếp
                  </button>
                  <button onClick={() => onCrawl(c)} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 transition cursor-pointer" title="Test crawl"><FlaskConical className="w-3.5 h-3.5" /> Test</button>
                  <button onClick={() => onToggle(c)} className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${c.active ? "text-emerald-600 border-emerald-100 hover:bg-emerald-50" : "text-slate-500 border-slate-200 hover:bg-slate-50"}`}><Power className="w-3.5 h-3.5" /> {c.active ? "On" : "Off"}</button>
                  <button onClick={() => setEditing(isEdit ? null : c.id)} className="text-xs font-bold text-slate-600 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer">{isEdit ? "Xong" : "Sửa"}</button>
                  <button onClick={() => onDelete(c)} title="Xóa hẳn khỏi watchlist" className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Page của SERYN (own brand) — read-only ===== */}
      <SerynPagesSection data={data} />
    </motion.div>
  );
}

/** Danh sách page SERYN (tab Own Brand Pages). Read-only + hướng dẫn thêm. */
function SerynPagesSection({ data }: { data: SpyDashboardData }) {
  const pages = data.ownBrandPages ?? [];
  const stats = ownPageCrawlStats(data);
  return (
    <div className="space-y-3 pt-4 border-t border-slate-200">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 border-l-2 border-emerald-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-600 font-bold flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> OWN BRAND — SERYN</span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Page của SERYN</h2>
          <p className="text-sm text-slate-600 font-medium">Danh sách page SERYN được crawl chung pipeline để benchmark. Đọc từ tab <code className="bg-slate-100 px-1 rounded">Own Brand Pages</code> trên Google Sheets.</p>
        </div>
        <div className="flex gap-2 text-center">
          {[{ l: "Page", v: stats.total }, { l: "Crawl bật", v: stats.crawlable }, { l: "Thiếu page_id", v: stats.missingId }].map((k) => (
            <div key={k.l} className="bg-white border border-slate-200 rounded-xl px-3 py-2"><p className="text-[10px] uppercase font-bold text-slate-400">{k.l}</p><p className="text-lg font-extrabold text-slate-800">{k.v}</p></div>
          ))}
        </div>
      </div>

      {!pages.length ? (
        <div className="bg-white border border-dashed border-emerald-300 rounded-2xl p-8 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-emerald-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Chưa có page SERYN nào.</p>
          <p className="text-xs text-slate-500 font-medium max-w-xl mx-auto">Nếu muốn hệ thống so sánh SERYN với đối thủ, hãy thêm <b>page_id</b> của các page SERYN vào tab <code className="bg-slate-100 px-1 rounded">Own Brand Pages</code> (Google Sheets) với <code className="bg-slate-100 px-1 rounded">is_active=TRUE</code> và <code className="bg-slate-100 px-1 rounded">crawl_enabled=TRUE</code>.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          {pages.map((p, i) => {
            const on = isTruthyFlag(p.is_active) && isTruthyFlag(p.crawl_enabled) && String(p.page_id || "").trim();
            return (
              <div key={`${p.page_id}-${i}`} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-800">{p.page_name || "(no name)"}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{on ? "crawl on" : "crawl off"}</span>
                    {p.market && <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{p.market}</span>}
                    {p.service_focus && <span className="text-[10px] font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded">{p.service_focus}</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">page_id: {p.page_id || "—"}{p.page_url ? ` · ${p.page_url}` : ""}</p>
                  {p.notes && <p className="text-[11px] text-slate-500 truncate">{p.notes}</p>}
                </div>
                {p.page_id && <a href={`https://www.facebook.com/${p.page_id}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-cyan-700 hover:underline shrink-0">Mở page ↗</a>}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400">Chưa hỗ trợ thêm/sửa page SERYN trực tiếp trên dashboard — chỉnh trong tab <code className="bg-slate-100 px-1 rounded">Own Brand Pages</code> (Google Sheets) rồi Refresh.</p>
    </div>
  );
}
