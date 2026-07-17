import React from "react";
import { motion } from "motion/react";
import { Flame, Layers, TrendingUp, TrendingDown, Building2, Activity, Star, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { normalizeNumber, countChips, scaleMeta, viLabel } from "../../utils/spyData";
import { useDirectCompetitors, isDirectCompetitor } from "../../utils/directCompetitors";
import { latestWeek, dataQualityReport } from "../../utils/weeklyIntel";
import { composeExecSummary } from "../../utils/reportData";
import { latestCrawlRun, incrementalSummary } from "../../utils/incremental";
import { isOwnBrand } from "../../utils/ownBrand";
import { SerynBenchmarkCompact } from "../SerynBenchmark";

function SectionTitle({ tag, title, desc }: { tag: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-4 border-cyan-500 pl-4">
      <span className="text-[11px] uppercase font-mono tracking-widest text-cyan-600 font-bold">{tag}</span>
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      {desc && <p className="text-[15px] text-slate-600 font-medium">{desc}</p>}
    </div>
  );
}

/** tone: "up" = tăng (xanh, mũi tên lên) · "down" = giảm (đỏ, mũi tên xuống). */
function Kpi({ label, value, icon: Icon, accent, tone }: { label: string; value: React.ReactNode; icon: any; accent?: string; tone?: "up" | "down" }) {
  const toneCls = tone === "up" ? "text-emerald-600" : tone === "down" ? "text-rose-600" : "text-slate-900";
  const Arrow = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : null;
  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm flex items-center gap-4 ${tone === "up" ? "border-emerald-200" : tone === "down" ? "border-rose-200" : "border-slate-200"}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent || "bg-cyan-50 text-cyan-600"}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase font-mono tracking-wider text-slate-500 font-bold truncate">{label}</p>
        <p className={`text-3xl font-extrabold leading-tight flex items-center gap-0.5 ${toneCls}`}>
          {Arrow && <Arrow className="w-6 h-6 shrink-0" strokeWidth={3} />}{value}
        </p>
      </div>
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
  const execSummary = composeExecSummary(data);

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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider mb-2">Báo cáo tuần</h3>
        <p className="text-[15px] text-slate-800 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4">{execSummary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
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

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider">Đối thủ nhân rộng mạnh nhất</h3>
            <Flame className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium mb-4">Theo cấp nhân rộng cao + số cụm</p>
          <div className="space-y-3">
            {topScaling.length ? (
              topScaling.slice(0, 6).map((r, i) => {
                const meta = scaleMeta(r.maxLvl);
                return (
                  <div key={r.brand} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-slate-100 font-mono text-xs font-bold text-slate-600 flex items-center justify-center border border-slate-200 shrink-0">{i + 1}</span>
                    {isDirectCompetitor(r.brand, direct) && <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />}
                    <span className="font-bold text-[15px] text-slate-800 flex-1 truncate">{r.brand}</span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded">{meta.label}</span>
                    <span className="text-sm font-mono font-semibold text-slate-600 shrink-0">{r.clusters} cụm</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400 font-semibold">Chưa có nội dung nhân rộng.</p>
            )}
          </div>
          <p className="mt-5 text-xs text-slate-500 font-medium border-t border-slate-100 pt-3 leading-relaxed">
            Lưu ý: “khả năng đang nhân rộng dựa trên thời lượng chạy + lặp lại — chưa xác nhận hiệu quả/lợi nhuận”. Không có dữ liệu ngân sách/chuyển đổi.
          </p>
        </div>
      </div>

    </motion.div>
  );
}
