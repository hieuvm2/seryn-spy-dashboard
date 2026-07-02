import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Upload, Database, Trash2, Download, CheckCircle2, FileSpreadsheet, RefreshCw, Activity, History, AlertTriangle, Cloud, Sparkles } from "lucide-react";
import type { SpyDashboardData, SpyTableName, DataSourceType } from "../../types";
import { ownPageCrawlStats } from "../../utils/ownBrand";
import { buildSerynSnapshot } from "../../utils/serynBenchmark";
import {
  parseCSV,
  detectTable,
  mergeImportedTable,
  TABLE_LABELS,
  SOURCE_LABELS,
  checkDataHealth,
  getHistoryWeeks,
  loadWeeklyHistory,
} from "../../utils/spyData";

const TABLE_ORDER: SpyTableName[] = [
  "brandWeeklySnapshot",
  "adLevelAnalysis",
  "scaledContentAnalysis",
  "weeklyStrategyChange",
  "serynContentRecommendations",
];

export default function DataImportView({
  data,
  dataSource,
  onlineConfigured,
  onlineStatus,
  isOnlineLoading,
  onRefreshOnline,
  onDataChange,
  onLoadSample,
  onClear,
}: {
  data: SpyDashboardData;
  dataSource: DataSourceType;
  onlineConfigured: boolean;
  onlineStatus: string;
  isOnlineLoading: boolean;
  onRefreshOnline: () => Promise<{ ok: boolean; msg: string }>;
  onDataChange: (next: SpyDashboardData, source?: DataSourceType) => void;
  onLoadSample: () => void;
  onClear: () => void;
}) {
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [weeks, setWeeks] = useState<string[]>([]);

  // Refresh Online Data (Google Sheets) — App.tsx sở hữu fetch + state.
  const refreshOnline = async () => {
    const r = await onRefreshOnline();
    setStatus({ msg: r.msg, ok: r.ok });
  };

  // Refresh saved-week list whenever data changes (after import/sample load).
  useEffect(() => { setWeeks(getHistoryWeeks()); }, [data]);

  const health = checkDataHealth(data);

  const loadWeek = (wk: string) => {
    const hist = loadWeeklyHistory();
    const snap = hist[wk];
    if (snap) {
      onDataChange(snap, "local-csv");
      setStatus({ msg: `Đã tải lại dữ liệu tuần ${wk}.`, ok: true });
    } else {
      setStatus({ msg: `Không tìm thấy snapshot tuần ${wk}.`, ok: false });
    }
  };

  const handleFile = (file: File, forced?: SpyTableName) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result));
        if (!rows.length) {
          setStatus({ msg: `File ${file.name} không có dòng dữ liệu hợp lệ.`, ok: false });
          return;
        }
        const table = forced || detectTable(rows);
        if (!table) {
          setStatus({ msg: `Không nhận diện được loại CSV (header không khớp 5 bảng).`, ok: false });
          return;
        }
        onDataChange(mergeImportedTable(data, table, rows), "local-csv");
        setStatus({ msg: `Đã nạp ${rows.length} dòng vào “${TABLE_LABELS[table]}” từ ${file.name}.`, ok: true });
      } catch (e: any) {
        setStatus({ msg: `Lỗi đọc CSV: ${e?.message || e}`, ok: false });
      }
    };
    reader.onerror = () => setStatus({ msg: "Không đọc được file.", ok: false });
    reader.readAsText(file, "utf-8");
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "seryn_spy_dashboard_data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus({ msg: "Đã export JSON hiện tại.", ok: true });
  };

  const counts: Record<SpyTableName, number> = {
    brandWeeklySnapshot: data.brandWeeklySnapshot.length,
    adLevelAnalysis: data.adLevelAnalysis.length,
    scaledContentAnalysis: data.scaledContentAnalysis.length,
    weeklyStrategyChange: data.weeklyStrategyChange.length,
    serynContentRecommendations: data.serynContentRecommendations.length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">NHẬP DỮ LIỆU</span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Nạp dữ liệu phân tích quảng cáo</h2>
          <p className="text-sm text-slate-600 font-medium">Nhập từng bảng (tự nhận diện theo dòng tiêu đề). Dữ liệu lưu trong trình duyệt — tuần sau dùng để so sánh.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-semibold">Nguồn hiện tại:</span>
          <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-slate-50 border-slate-200 text-slate-700">{SOURCE_LABELS[dataSource]}</span>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border ${status.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
          {status.ok && <CheckCircle2 className="w-4 h-4" />}
          {status.msg}
        </div>
      )}

      {/* Online Data Source: Google Sheets */}
      <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Cloud className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-extrabold text-slate-800">Nguồn dữ liệu online — Google Sheets</h3>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-indigo-50 border-indigo-200 text-indigo-700">TRỰC TUYẾN</span>
        </div>
        <p className="text-xs text-slate-500 font-medium mb-4">
          Lấy dữ liệu trực tiếp từ Google Sheets qua Google Apps Script Web App. Cấu hình URL bằng biến môi trường <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">VITE_GOOGLE_SHEETS_API_URL</code> trong Vercel → Settings → Environment Variables (xem docs/ONLINE_DATA.md). <b>Không nhúng service account / private key vào trình duyệt.</b> Mọi người mở cùng link đều xem chung một bộ dữ liệu. Nếu API lỗi → tự giữ dữ liệu localStorage / mẫu.
        </p>

        {/* Trạng thái cấu hình & nguồn hiện tại */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold mb-1">API URL</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-2 py-0.5 rounded border ${onlineConfigured ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {onlineConfigured ? "Configured" : "Not configured"}
            </span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold mb-1">Nguồn hiện tại</p>
            <span className="text-xs font-extrabold text-slate-700">{SOURCE_LABELS[dataSource]}</span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold mb-1">Lần đồng bộ gần nhất</p>
            <span className="text-xs font-semibold text-slate-600 break-words">{onlineStatus || "—"}</span>
          </div>
        </div>

        <button
          onClick={refreshOnline}
          disabled={isOnlineLoading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isOnlineLoading ? "animate-spin" : ""}`} /> {isOnlineLoading ? "Đang nạp…" : "Refresh Online Data"}
        </button>
        {!onlineConfigured && (
          <p className="text-[11px] text-amber-600 font-semibold mt-3">⚠️ Chưa cấu hình <code className="bg-slate-100 px-1 rounded">VITE_GOOGLE_SHEETS_API_URL</code>. Bấm Refresh sẽ báo <b>Missing VITE_GOOGLE_SHEETS_API_URL</b>. Thêm biến này trên Vercel rồi redeploy để bật chế độ ONLINE SHEET DATA.</p>
        )}
      </div>

      {/* Own Brand (SERYN) status */}
      <OwnBrandStatus data={data} />

      <div className="flex flex-wrap gap-3">
        <button onClick={onLoadSample} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 transition cursor-pointer">
          <Database className="w-4 h-4 text-cyan-600" /> Nạp dữ liệu mẫu
        </button>
        <button onClick={() => { onClear(); setStatus({ msg: "Đã xóa dữ liệu đã lưu (về dữ liệu mẫu).", ok: true }); }} className="flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl text-sm font-bold border border-rose-200 transition cursor-pointer">
          <Trash2 className="w-4 h-4" /> Xóa dữ liệu
        </button>
        <button onClick={exportJSON} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 transition cursor-pointer">
          <Download className="w-4 h-4 text-indigo-600" /> Xuất JSON
        </button>
      </div>

      {/* Data Health Check */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-extrabold text-slate-800">Kiểm tra sức khỏe dữ liệu</h3>
        </div>
        <div className="space-y-2">
          {health.map((h) => (
            <div key={h.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/40">
              <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${h.loaded && !h.missingCols.length ? "bg-emerald-500" : h.loaded ? "bg-amber-500" : "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 text-sm">{h.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">{h.loaded ? `${h.rows} dòng` : "—"}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${h.loaded ? (h.missingCols.length ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200") : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {h.loaded ? (h.missingCols.length ? "thiếu cột" : "đủ") : "chưa nạp"}
                    </span>
                  </span>
                </div>
                {h.loaded && h.missingCols.length > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Thiếu cột bắt buộc: <span className="font-mono">{h.missingCols.join(", ")}</span></span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Snapshot History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-extrabold text-slate-800">Lịch sử tuần đã lưu</h3>
        </div>
        <p className="text-xs text-slate-500 font-medium mb-4">
          Mỗi lần nạp dữ liệu mới được lưu theo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">week_date</code> vào <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">seryn_spy_weekly_history_v1</code>. Chọn một tuần để tải lại.
        </p>
        {weeks.length ? (
          <div className="flex flex-col gap-2">
            {weeks.map((wk) => {
              const isCurrent = wk === data.brandWeeklySnapshot[0]?.week_date;
              return (
                <div key={wk} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
                  <span className="font-mono font-bold text-slate-700 text-sm">
                    {wk}
                    {isCurrent && <span className="ml-2 text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded">đang xem</span>}
                  </span>
                  <button
                    onClick={() => loadWeek(wk)}
                    disabled={isCurrent}
                    className="flex items-center gap-1.5 bg-white hover:bg-cyan-50 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-cyan-200 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Tải tuần này
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-semibold">Chưa có tuần nào được lưu.</p>
        )}
      </div>

      <p className="text-[11px] uppercase font-mono tracking-wider text-slate-400 font-bold pt-1">Hoặc nhập thủ công từng bảng</p>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
        {TABLE_ORDER.map((t, idx) => (
          <div key={t} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 font-mono text-xs font-bold shrink-0">{idx + 1}</div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate flex items-center gap-2"><FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600" />{TABLE_LABELS[t]}</p>
                <p className="text-[11px] text-slate-400 font-mono">{counts[t]} dòng đang nạp</p>
              </div>
            </div>
            <label className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5" /> Nhập CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, t);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 font-mono">Khóa lưu trong trình duyệt: <span className="text-slate-600 font-bold">seryn_spy_dashboard_data_v2</span></p>
    </motion.div>
  );
}

/** Trạng thái Own Brand Pages + SERYN crawl (Phần 9). Không crash khi thiếu tab. */
function OwnBrandStatus({ data }: { data: SpyDashboardData }) {
  const stats = ownPageCrawlStats(data);
  const s = buildSerynSnapshot(data);
  const hasTab = (data.ownBrandPages ?? []).length > 0;
  return (
    <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-extrabold text-slate-800">Own Brand — SERYN</h3>
        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">OWN</span>
      </div>
      {!hasTab && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 mb-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          Chưa tìm thấy tab <code className="bg-white/60 px-1 rounded">Own Brand Pages</code>. Hãy tạo tab này trong Google Sheets để thêm page SERYN (crawl + benchmark).
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { l: "Own Brand Pages", v: stats.total },
          { l: "SERYN ads", v: s.activeAds },
          { l: "Crawl bật", v: stats.crawlable },
          { l: "Thiếu page_id", v: stats.missingId, warn: stats.missingId > 0 },
          { l: "Crawl tắt", v: stats.disabled },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold mb-1">{k.l}</p>
            <p className={`text-xl font-extrabold ${k.warn ? "text-amber-600" : "text-slate-800"}`}>{k.v}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        {s.hasData ? "SERYN có dữ liệu ads công khai — benchmark đã bật." : "Chưa có dữ liệu ads SERYN — thêm page có page_id numeric + crawl để bật benchmark."} Tín hiệu ads công khai, không phải ROAS/CPA.
      </p>
    </div>
  );
}
