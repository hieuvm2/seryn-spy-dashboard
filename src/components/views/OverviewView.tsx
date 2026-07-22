import React from "react";
import { motion } from "motion/react";
import { Flame, Layers, TrendingUp, TrendingDown, Building2, Activity, Star, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { normalizeNumber, countChips, viLabel, stripAdsDisclaimer } from "../../utils/spyData";
import { useDirectCompetitors, isDirectCompetitor } from "../../utils/directCompetitors";
import { latestWeek, dataQualityReport } from "../../utils/weeklyIntel";
import { composeExecSummary } from "../../utils/reportData";
import { latestCrawlRun, incrementalSummary } from "../../utils/incremental";
import { isOwnBrand } from "../../utils/ownBrand";
import { SerynBenchmarkCompact } from "../SerynBenchmark";

function SectionTitle({ tag, title, desc }: { tag: string; title: string; desc?: string }) {
  return (
    <div className="hm-accent-bar pl-4 flex flex-col gap-1.5">
      <span className="hm-eyebrow">{tag}</span>
      <h2 className="hm-page-title text-2xl">{title}</h2>
      {desc && <p className="text-[15px] text-slate-600 font-medium">{desc}</p>}
    </div>
  );
}

/** tone: "up" = tăng (xanh, mũi tên lên) · "down" = giảm (đỏ, mũi tên xuống).
    Voice hallmark: bỏ ô icon vuông; icon nhỏ mono cạnh nhãn, số lớn canh cột. */
function Kpi({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: any; accent?: string; tone?: "up" | "down" }) {
  const toneCls = tone === "up" ? "text-emerald-600" : tone === "down" ? "text-rose-600" : "text-slate-900";
  const Arrow = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : null;
  return (
    <div className="hm-panel p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 shrink-0 text-cyan-600" strokeWidth={2.5} />
        <p className="hm-eyebrow truncate">{label}</p>
      </div>
      <p className={`text-[2rem] font-extrabold leading-none tabular-nums flex items-center gap-1 ${toneCls}`}>
        {Arrow && <Arrow className="w-6 h-6 shrink-0" strokeWidth={3} />}{value}
      </p>
    </div>
  );
}

function ChipList({ items }: { items: { label: string; n: number }[] }) {
  if (!items.length) return <span className="text-sm text-slate-400 font-semibold">chưa rõ</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 10).map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-sm font-bold">
          {viLabel(it.label)}
          <b className="text-cyan-700 font-mono text-base">{it.n}</b>
        </span>
      ))}
    </div>
  );
}

export default function OverviewView({ data, onSelectBrand }: { data: SpyDashboardData; onSelectBrand?: (brand: string) => void }) {
  const direct = useDirectCompetitors();
  // Loại SERYN (own brand) khỏi thống kê ĐỐI THỦ (SERYN có block benchmark riêng).
  const snap = data.brandWeeklySnapshot.filter((b) => !isOwnBrand(b.brand_name, data.ownBrandPages ?? []));
  const totalBrands = snap.length;
  const activeBrands = snap.filter((b) => normalizeNumber(b.total_active_ads) > 0).length;
  const totalAds = snap.reduce((a, b) => a + normalizeNumber(b.total_active_ads), 0);
  const totalScaled = data.scaledContentAnalysis.length;
  const newAds = snap.reduce((a, b) => a + normalizeNumber(b.new_ads_count), 0);
  const stoppedAds = snap.reduce((a, b) => a + normalizeNumber(b.stopped_ads_count), 0);

  const topServices = countChips(snap, "services_running");
  const topFormats = countChips(snap, "main_content_formats");
  const topAngles = countChips(snap, "main_angles");

  // Đối thủ THAY ĐỔI ads nhiều nhất tuần này = tổng (ad mới + ad dừng).
  const topChanged = snap
    .map((b) => ({
      brand: b.brand_name,
      added: normalizeNumber(b.new_ads_count),
      stopped: normalizeNumber(b.stopped_ads_count),
    }))
    .map((x) => ({ ...x, total: x.added + x.stopped }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const summary = latestWeek(data.weeklySummary ?? []);
  const dq = dataQualityReport(summary);
  const crawl = latestCrawlRun(data);
  const inc = incrementalSummary(data);
  const failedPages = normalizeNumber(crawl?.failed_pages ?? summary?.total_crawl_failed_pages);
  const successPages = normalizeNumber(crawl?.success_pages);
  const actions = (data.actionPlan ?? []).filter((a) => !summary?.week_start || a.week_start === summary.week_start).slice(0, 6);
  const execSummary = stripAdsDisclaimer(composeExecSummary(data));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle tag="TỔNG QUAN SPY ADS" title="Tổng quan Spy Ads" desc="Tình hình quảng cáo đối thủ và các thay đổi đáng chú ý trong tuần." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Tổng đối thủ" value={totalBrands} icon={Building2} />
        <Kpi label="Đang chạy quảng cáo" value={`${activeBrands} / ${totalBrands}`} icon={Activity} accent="bg-emerald-50 text-emerald-600" />
        <Kpi label="Tổng QC đang chạy" value={totalAds.toLocaleString("vi-VN")} icon={Layers} accent="bg-indigo-50 text-indigo-600" />
        <Kpi label="Nội dung nhân rộng" value={totalScaled} icon={Flame} accent="bg-rose-50 text-rose-600" />
        <Kpi label="QC mới tuần này" value={`+${newAds.toLocaleString("vi-VN")}`} icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" tone="up" />
        <Kpi label="QC đã dừng" value={`−${stoppedAds.toLocaleString("vi-VN")}`} icon={TrendingDown} accent="bg-rose-50 text-rose-600" tone="down" />
      </div>

      {/* SERYN vs Đối thủ (ngắn) — chi tiết ở tab SERYN */}
      <SerynBenchmarkCompact data={data} onOpen={() => { window.location.hash = "seryn"; }} />

      {/* Báo cáo tuần (gộp từ Weekly Intelligence) */}
      <div className="hm-panel p-6">
        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider mb-2">Báo cáo tuần</h3>
        <p className="text-[15px] text-slate-800 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4">{execSummary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="hm-panel p-6 space-y-5">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider mb-3">Top dịch vụ đang chạy</h3>
            <ChipList items={topServices} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider mb-3">Top định dạng nội dung</h3>
            <ChipList items={topFormats} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider mb-3">Top góc tiếp cận</h3>
            <ChipList items={topAngles} />
          </div>
        </div>

        <div className="hm-panel p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider">Đối thủ thay đổi ads nhiều nhất</h3>
            <Flame className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium mb-4">Theo tổng số quảng cáo mới + dừng trong tuần</p>
          <div className="space-y-3">
            {topChanged.length ? (
              topChanged.slice(0, 6).map((r, i) => (
                <div key={r.brand} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-slate-100 font-mono text-xs font-bold text-slate-600 flex items-center justify-center border border-slate-200 shrink-0">{i + 1}</span>
                  {isDirectCompetitor(r.brand, direct) && <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />}
                  <span className="font-bold text-[15px] text-slate-800 flex-1 truncate">{r.brand}</span>
                  <span className="inline-flex items-center gap-0.5 text-sm font-extrabold text-emerald-600 tabular-nums shrink-0"><TrendingUp className="w-4 h-4" strokeWidth={2.75} />+{r.added}</span>
                  <span className="inline-flex items-center gap-0.5 text-sm font-extrabold text-rose-600 tabular-nums shrink-0"><TrendingDown className="w-4 h-4" strokeWidth={2.75} />−{r.stopped}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 font-semibold">Chưa có thay đổi quảng cáo tuần này.</p>
            )}
          </div>
          <p className="mt-5 text-xs text-slate-500 font-medium border-t border-slate-100 pt-3 leading-relaxed">
            Xếp theo số quảng cáo <b className="text-emerald-600">mới</b> + <b className="text-rose-600">dừng</b> trong tuần — mức độ đối thủ xoay/đổi creative. Không có dữ liệu ngân sách/chuyển đổi.
          </p>
        </div>
      </div>

    </motion.div>
  );
}
