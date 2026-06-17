import React from "react";
import { motion } from "motion/react";
import { Flame, Layers, TrendingUp, TrendingDown, Building2, Activity } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { normalizeNumber, countChips, scaleMeta, viLabel, humanizeText } from "../../utils/spyData";
import { latestWeek, dataQualityReport } from "../../utils/weeklyIntel";
import { latestCrawlRun, incrementalSummary } from "../../utils/incremental";

function SectionTitle({ tag, title, desc }: { tag: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
      <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">{tag}</span>
      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      {desc && <p className="text-sm text-slate-600 font-medium">{desc}</p>}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: React.ReactNode; icon: any; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent || "bg-cyan-50 text-cyan-600"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase font-mono tracking-wider text-slate-500 font-bold truncate">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function ChipList({ items }: { items: { label: string; n: number }[] }) {
  if (!items.length) return <span className="text-xs text-slate-400 font-semibold">unknown</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 10).map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold">
          {viLabel(it.label)}
          <b className="text-cyan-600 font-mono">{it.n}</b>
        </span>
      ))}
    </div>
  );
}

export default function OverviewView({ data, onSelectBrand }: { data: SpyDashboardData; onSelectBrand?: (brand: string) => void }) {
  const snap = data.brandWeeklySnapshot;
  const totalBrands = snap.length;
  const activeBrands = snap.filter((b) => normalizeNumber(b.total_active_ads) > 0).length;
  const totalAds = snap.reduce((a, b) => a + normalizeNumber(b.total_active_ads), 0);
  const totalScaled = data.scaledContentAnalysis.length;
  const newAds = snap.reduce((a, b) => a + normalizeNumber(b.new_ads_count), 0);
  const stoppedAds = snap.reduce((a, b) => a + normalizeNumber(b.stopped_ads_count), 0);

  const topServices = countChips(snap, "services_running");
  const topFormats = countChips(snap, "main_content_formats");
  const topAngles = countChips(snap, "main_angles");

  const scalingMap: Record<string, { brand: string; clusters: number; maxLvl: number }> = {};
  data.scaledContentAnalysis.forEach((s) => {
    const b = s.brand_name;
    if (!scalingMap[b]) scalingMap[b] = { brand: b, clusters: 0, maxLvl: 0 };
    scalingMap[b].clusters++;
    scalingMap[b].maxLvl = Math.max(scalingMap[b].maxLvl, normalizeNumber(s.scale_level));
  });
  const topScaling = Object.values(scalingMap).sort((a, b) => b.maxLvl - a.maxLvl || b.clusters - a.clusters);

  const summary = latestWeek(data.weeklySummary ?? []);
  const dq = dataQualityReport(summary);
  const crawl = latestCrawlRun(data);
  const inc = incrementalSummary(data);
  const failedPages = normalizeNumber(crawl?.failed_pages ?? summary?.total_crawl_failed_pages);
  const successPages = normalizeNumber(crawl?.success_pages);
  const actions = (data.actionPlan ?? []).filter((a) => !summary?.week_start || a.week_start === summary.week_start).slice(0, 6);
  const execSummary = humanizeText(String(
    summary?.executive_summary ||
    `Đang theo dõi ${totalBrands} đối thủ với ${totalAds.toLocaleString("vi-VN")} quảng cáo đang chạy (${newAds} mới, ${stoppedAds} đã dừng tuần này). ${totalScaled} cụm nội dung đang được nhân rộng — tín hiệu từ dữ liệu ads, chưa xác nhận hiệu quả chuyển đổi.`,
  ));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle tag="TỔNG QUAN SPY ADS" title="Tổng quan Spy Ads" desc="Tình hình quảng cáo đối thủ và các thay đổi đáng chú ý trong tuần." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Tổng đối thủ" value={totalBrands} icon={Building2} />
        <Kpi label="Đang chạy quảng cáo" value={`${activeBrands} / ${totalBrands}`} icon={Activity} accent="bg-emerald-50 text-emerald-600" />
        <Kpi label="Tổng QC đang chạy" value={totalAds.toLocaleString("vi-VN")} icon={Layers} accent="bg-indigo-50 text-indigo-600" />
        <Kpi label="Nội dung nhân rộng" value={totalScaled} icon={Flame} accent="bg-rose-50 text-rose-600" />
        <Kpi label="QC mới tuần này" value={newAds} icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" />
        <Kpi label="QC đã dừng" value={stoppedAds} icon={TrendingDown} accent="bg-amber-50 text-amber-600" />
        <Kpi label="Page crawl OK / lỗi" value={`${successPages || "—"} / ${failedPages}`} icon={Activity} accent={failedPages > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"} />
        {summary && <Kpi label="Chất lượng dữ liệu" value={`${dq.score}/100`} icon={Building2} accent={dq.level === "good" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"} />}
      </div>

      {/* Báo cáo tuần (gộp từ Weekly Intelligence) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">Báo cáo tuần</h3>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">{execSummary}</p>
        <p className="text-[11px] text-slate-400 mt-2 italic">Tín hiệu từ dữ liệu ads (số lượng + thời gian chạy), không phải kết quả ROAS/CPA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Top dịch vụ đang chạy</h3>
            <ChipList items={topServices} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Top định dạng nội dung</h3>
            <ChipList items={topFormats} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Top góc tiếp cận</h3>
            <ChipList items={topAngles} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Đối thủ nhân rộng mạnh nhất</h3>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xs text-slate-500 font-medium mb-4">Theo cấp nhân rộng cao + số cụm</p>
          <div className="space-y-3">
            {topScaling.length ? (
              topScaling.slice(0, 6).map((r, i) => {
                const meta = scaleMeta(r.maxLvl);
                return (
                  <div key={r.brand} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-600 flex items-center justify-center border border-slate-200">{i + 1}</span>
                    <span className="font-bold text-slate-800 flex-1 truncate">{r.brand}</span>
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">{meta.label}</span>
                    <span className="text-xs font-mono text-slate-500">{r.clusters} cụm</span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 font-semibold">Chưa có content scale.</p>
            )}
          </div>
          <p className="mt-5 text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-3 leading-relaxed">
            Lưu ý: “khả năng đang nhân rộng dựa trên thời lượng chạy + lặp lại — chưa xác nhận hiệu quả/lợi nhuận”. Không có dữ liệu ngân sách/chuyển đổi.
          </p>
        </div>
      </div>

      {/* Kế hoạch hành động + Tình trạng dữ liệu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Kế hoạch hành động</h3>
          <div className="space-y-2">
            {actions.length ? actions.map((a) => (
              <div key={a.action_id} className="border border-slate-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500">{String(a.priority || "")}</span>
                  {a.related_brand && <button onClick={() => onSelectBrand?.(String(a.related_brand))} className="text-[10px] font-bold text-cyan-700 hover:underline">{a.related_brand} ↗</button>}
                </div>
                <p className="text-xs font-bold text-slate-800">{humanizeText(String(a.insight || ""))}</p>
                {a.suggested_action && <p className="text-[11px] text-cyan-700 mt-0.5">→ {humanizeText(String(a.suggested_action))}</p>}
              </div>
            )) : <p className="text-xs text-slate-400">Chưa có action tuần này.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Tình trạng dữ liệu</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500 font-semibold uppercase text-[11px]">Lần crawl gần nhất</span><span className="text-slate-800 font-bold">{crawl?.finished_at || crawl?.started_at || "—"}</span></div>
            <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500 font-semibold uppercase text-[11px]">Page lỗi</span><span className={`font-bold ${failedPages > 0 ? "text-amber-600" : "text-emerald-600"}`}>{failedPages}</span></div>
            <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500 font-semibold uppercase text-[11px]">Carried forward</span><span className="text-slate-800 font-bold">{inc.carried}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500 font-semibold uppercase text-[11px]">Trạng thái crawl</span><span className="text-slate-800 font-bold">{crawl?.status || "—"}</span></div>
          </div>
          {failedPages > 0 && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">{failedPages} page crawl lỗi — KHÔNG kết luận đối thủ tắt ads ở các page này.</p>}
        </div>
      </div>
    </motion.div>
  );
}
