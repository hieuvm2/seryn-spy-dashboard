import React from "react";
import {
  Sparkles, TrendingUp, Target, Layers, Filter, ShieldAlert, FlaskConical, ArrowRight,
} from "lucide-react";
import type { SpyDashboardData } from "../types";
import { viLabel } from "../utils/labelsVi";
import {
  buildSerynSnapshot, buildCompetitorBenchmark, buildSerynVsCompetitorComparison,
  volumePositionNote, type SerynRecommendedTest,
} from "../utils/serynBenchmark";

/* ============================================================
   SERYN vs Đối thủ — component dùng chung (Overview + Đối thủ).
   Tín hiệu ads công khai, KHÔNG CPA/ROAS. Wording trung tính.
   ============================================================ */

const PRIO_TONE: Record<string, string> = {
  High: "bg-rose-50 text-rose-700 border-rose-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

function Chips({ items, tone = "cyan" }: { items: string[]; tone?: "cyan" | "slate" | "amber" }) {
  if (!items.length) return <span className="text-xs text-slate-400 italic">—</span>;
  const cls = tone === "amber" ? "bg-amber-50 text-amber-700 border-amber-100"
    : tone === "slate" ? "bg-slate-50 text-slate-600 border-slate-200"
    : "bg-cyan-50 text-cyan-700 border-cyan-100";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => <span key={`${it}-${i}`} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cls}`}>{viLabel(it)}</span>)}
    </div>
  );
}

/** Snapshot ngắn của SERYN + nút mở profile. Dùng ở đầu tab Đối thủ. */
export function SerynSnapshotCard({ data, onOpen }: { data: SpyDashboardData; onOpen: () => void }) {
  const s = buildSerynSnapshot(data);
  const topFmt = Object.entries(s.formatMix).sort((a, b) => b[1] - a[1])[0];
  const topFunnel = Object.entries(s.funnelMix).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 bg-white border border-cyan-200 px-2 py-0.5 rounded-full"><Sparkles className="w-3 h-3" /> Own Brand</span>
          <h3 className="text-base font-extrabold text-slate-900">{s.ownBrandName} Snapshot</h3>
        </div>
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 rounded-lg transition">
          Xem phân tích SERYN <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {!s.hasData ? (
        <p className="text-xs text-slate-500 mt-3">Chưa có dữ liệu ads công khai của SERYN. Thêm page vào tab <span className="font-mono">Own Brand Pages</span> rồi crawl để bật benchmark.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <Metric label="Ads active" value={s.activeAds} />
          <Metric label="Ads mới" value={`+${s.newAds}`} tone="emerald" />
          <Metric label="Format chính" value={topFmt ? `${viLabel(topFmt[0])} ${topFmt[1]}%` : "—"} />
          <Metric label="Objective chính" value={topFunnel ? `${viLabel(topFunnel[0])} ${topFunnel[1]}%` : "—"} />
          <div className="col-span-2"><p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Dịch vụ</p><Chips items={s.topServices.slice(0, 4)} /></div>
          <div className="col-span-2"><p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Content angle</p><Chips items={s.topContentAngles.slice(0, 4)} /></div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "emerald" }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 px-3 py-2">
      <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${tone === "emerald" ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

/** Block benchmark ngắn cho Overview. */
export function SerynBenchmarkCompact({ data, onOpen }: { data: SpyDashboardData; onOpen?: () => void }) {
  const cmp = buildSerynVsCompetitorComparison(data);
  const test = cmp.recommendedTests[0];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-600" /> SERYN vs Đối thủ</h3>
        {onOpen && <button onClick={onOpen} className="text-[11px] font-bold text-cyan-700 hover:underline">Chi tiết ở tab Đối thủ →</button>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric label="SERYN ads" value={cmp.serynActiveAds} />
        <Metric label="TB đối thủ" value={cmp.competitorAvgActiveAds} />
        <Metric label="Đối thủ mạnh nhất" value={cmp.topCompetitorActiveAds} />
      </div>
      <div className="mt-3 space-y-1.5 text-[12px] text-slate-600">
        <p><b className="text-slate-500">Volume:</b> {volumePositionNote(cmp)}</p>
        <p><b className="text-slate-500">Angle gap:</b> {cmp.missingContentAngles.slice(0, 3).map(viLabel).join(", ") || "không khác biệt lớn"}</p>
        <p><b className="text-slate-500">Format gap:</b> {cmp.formatGapNote}</p>
        {test && <p className="text-cyan-700"><b>Test tuần này:</b> {test.recommendation}</p>}
      </div>
      <p className="mt-3 text-[11px] text-slate-400 italic">Tín hiệu ads công khai, không phải ROAS/CPA. Số liệu tham khảo.</p>
    </div>
  );
}

/** Section so sánh đầy đủ — dùng trong tab Đối thủ. */
export function SerynVsCompetitorSection({ data }: { data: SpyDashboardData }) {
  const cmp = buildSerynVsCompetitorComparison(data);
  const s = buildSerynSnapshot(data), c = buildCompetitorBenchmark(data);
  const fmt = (m: Record<string, number>) => Object.entries(m).map(([k, v]) => `${viLabel(k)} ${v}%`).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">SO SÁNH</span>
        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">SERYN vs Đối thủ</h3>
        <p className="text-sm text-slate-600 font-medium">So sánh tín hiệu ads công khai của SERYN với thị trường. Không dùng CPA/ROAS/spend.</p>
      </div>

      {!cmp.serynHasData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Chưa có dữ liệu ads công khai của SERYN. Thêm page SERYN vào tab <span className="font-mono">Own Brand Pages</span> và crawl để có benchmark đầy đủ. (Vẫn hiển thị dữ liệu đối thủ bên dưới.)
        </div>
      )}

      {/* 1. Volume */}
      <Card icon={TrendingUp} title="1 · Volume ads">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="SERYN" value={cmp.serynActiveAds} />
          <Metric label="TB đối thủ" value={cmp.competitorAvgActiveAds} />
          <Metric label="Đối thủ cao nhất" value={cmp.topCompetitorActiveAds} />
          <Metric label="Gap" value={cmp.serynActiveAds - cmp.competitorAvgActiveAds} />
        </div>
        <p className="text-[12px] text-slate-600 mt-2">{volumePositionNote(cmp)} Đối thủ cao nhất: <b>{cmp.topCompetitorName}</b>.</p>
      </Card>

      {/* 2 · Content angles */}
      <Card icon={Target} title="2 · Content angle">
        <TwoCol
          left={{ title: "SERYN đang dùng", items: cmp.serynTopContentAngles }}
          right={{ title: "Đối thủ lặp lại nhiều", items: cmp.competitorTopContentAngles }}
        />
        <GapRow label="Angle SERYN chưa dùng" items={cmp.missingContentAngles} tone="amber" />
      </Card>

      {/* 3 · Services */}
      <Card icon={Layers} title="3 · Dịch vụ">
        <TwoCol
          left={{ title: "SERYN", items: cmp.serynTopServices }}
          right={{ title: "Đối thủ", items: cmp.competitorTopServices }}
        />
        <GapRow label="Đối thủ push nhưng SERYN chưa" items={cmp.missingServiceOpportunities} tone="amber" />
      </Card>

      {/* 4 · Offers */}
      <Card icon={Layers} title="4 · Offer">
        <TwoCol
          left={{ title: "SERYN", items: cmp.serynTopOffers }}
          right={{ title: "Đối thủ", items: cmp.competitorTopOffers }}
        />
        <p className="text-[12px] text-slate-600 mt-2">{cmp.offerGapNote}</p>
      </Card>

      {/* 5 · Format */}
      <Card icon={Filter} title="5 · Định dạng (image/video/carousel)">
        <p className="text-[12px] text-slate-600"><b className="text-slate-500">SERYN:</b> {fmt(cmp.serynFormatMix)}</p>
        <p className="text-[12px] text-slate-600"><b className="text-slate-500">Đối thủ:</b> {fmt(cmp.competitorFormatMix)}</p>
        <p className="text-[12px] text-cyan-700 mt-1">{cmp.formatGapNote}</p>
      </Card>

      {/* 6 · Funnel */}
      <Card icon={Filter} title="6 · Funnel / Objective">
        <p className="text-[12px] text-slate-600"><b className="text-slate-500">SERYN:</b> {fmt(cmp.serynFunnelMix)}</p>
        <p className="text-[12px] text-slate-600"><b className="text-slate-500">Đối thủ:</b> {fmt(cmp.competitorFunnelMix)}</p>
        <p className="text-[12px] text-cyan-700 mt-1">{cmp.funnelGapNote}</p>
      </Card>

      {/* 7 · Visual + risk */}
      <Card icon={ShieldAlert} title="7 · Visual & rủi ro claim">
        <p className="text-[12px] text-slate-600">{cmp.visualGapNote}</p>
        <p className="text-[12px] text-amber-700 mt-1">{cmp.riskGapNote}</p>
        <p className="text-[11px] text-slate-400 mt-1">Bác sĩ đối thủ {c.visualRates.doctor}% · UGC {c.visualRates.ugc}% · offer banner {c.visualRates.offer_banner}% · rủi ro {c.visualRates.risk}%. (SERYN: bác sĩ {s.visualRates.doctor}%.)</p>
      </Card>

      {/* 8 · Recommended tests */}
      <Card icon={FlaskConical} title="8 · Nên test gì tuần tới">
        {cmp.recommendedTests.length ? (
          <div className="space-y-2.5">
            {cmp.recommendedTests.map((t, i) => <div key={i}><TestRow t={t} /></div>)}
          </div>
        ) : <p className="text-xs text-slate-400 italic">Chưa đủ dữ liệu để đề xuất test — thêm dữ liệu SERYN + đối thủ.</p>}
      </Card>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3"><Icon className="w-4 h-4 text-cyan-500" />{title}</h4>
      {children}
    </div>
  );
}
function TwoCol({ left, right }: { left: { title: string; items: string[] }; right: { title: string; items: string[] } }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div><p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1.5">{left.title}</p><Chips items={left.items} /></div>
      <div><p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1.5">{right.title}</p><Chips items={right.items} tone="slate" /></div>
    </div>
  );
}
function GapRow({ label, items, tone }: { label: string; items: string[]; tone?: "amber" }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1.5">{label}</p>
      <Chips items={items} tone={tone} />
    </div>
  );
}
function TestRow({ t }: { t: SerynRecommendedTest }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PRIO_TONE[t.priority]}`}>{t.priority}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-cyan-700">{t.testType}</span>
      </div>
      <p className="text-[13px] font-semibold text-slate-800">{t.recommendation}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{t.reason}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Bằng chứng: {t.evidence}</p>
      {t.riskNote && <p className="text-[11px] text-amber-700 mt-0.5">⚠ {t.riskNote}</p>}
    </div>
  );
}
