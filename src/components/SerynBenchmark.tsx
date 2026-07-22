import React, { useState } from "react";
import { Sparkles, ArrowRight, ArrowUpRight, ArrowDownRight, ExternalLink, X } from "lucide-react";
import type { SpyDashboardData, AdLevelAnalysis } from "../types";
import { viLabel, isMeaningful } from "../utils/spyData";
import { isOwnRow } from "../utils/ownBrand";
import { adLibraryAdUrl, adLibraryPhraseSearchUrl, searchPhraseOf } from "../utils/serynAlerts";
import {
  buildSerynSnapshot, buildSerynVsCompetitorComparison,
  volumePositionNote, type SerynRecommendedTest,
} from "../utils/serynBenchmark";

/* ============================================================
   SERYN benchmark — component dùng chung (Overview + tab SERYN).
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
      {items.map((it, i) => <span key={`${it}-${i}`} className={`px-2.5 py-1 rounded-md text-[13px] font-semibold border ${cls}`}>{viLabel(it)}</span>)}
    </div>
  );
}

/** Snapshot ngắn của SERYN + nút mở profile. Dùng ở đầu tab SERYN. */
export function SerynSnapshotCard({ data, onOpen }: { data: SpyDashboardData; onOpen: () => void }) {
  const s = buildSerynSnapshot(data);
  const topFmt = Object.entries(s.formatMix).sort((a, b) => b[1] - a[1])[0];
  const topFunnel = Object.entries(s.funnelMix).sort((a, b) => b[1] - a[1])[0];
  // Dịch vụ được chọn -> hiện danh sách QC đang chạy dịch vụ đó ngay dưới card.
  const [svc, setSvc] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 bg-white border border-cyan-200 px-2 py-0.5 rounded-full"><Sparkles className="w-3 h-3" /> Thương hiệu của mình</span>
          <h3 className="text-lg font-extrabold text-slate-900">Tổng quan nhanh {s.ownBrandName}</h3>
        </div>
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 rounded-lg transition">
          Xem phân tích SERYN <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {!s.hasData ? (
        <p className="text-sm text-slate-600 mt-3">Chưa có dữ liệu ads công khai của SERYN. Thêm page vào tab <span className="font-mono">Own Brand Pages</span> rồi crawl để bật benchmark.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <Metric label="Ads đang chạy" value={s.activeAds} />
            <Metric label="Ads mới" value={`+${s.newAds}`} tone="up" />
            <Metric label="Định dạng chính" value={topFmt ? `${viLabel(topFmt[0])} ${topFmt[1]}%` : "—"} />
            <Metric label="Mục tiêu chính" value={topFunnel ? `${viLabel(topFunnel[0])} ${topFunnel[1]}%` : "—"} />
            <div className="col-span-2">
              <p className="text-[11px] uppercase font-mono tracking-wide text-slate-500 font-bold mb-1.5">Dịch vụ <span className="normal-case font-sans text-slate-400">(bấm để xem QC)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {s.topServices.slice(0, 4).map((sv, i) => (
                  <button
                    key={`${sv}-${i}`}
                    onClick={() => setSvc((cur) => (cur === sv ? null : sv))}
                    title="Bấm để xem các quảng cáo đang chạy dịch vụ này"
                    className={`px-2.5 py-1 rounded-md text-[13px] font-semibold border transition cursor-pointer ${svc === sv ? "bg-cyan-600 text-white border-cyan-600 shadow-sm" : "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100"}`}
                  >
                    {viLabel(sv)}
                  </button>
                ))}
                {!s.topServices.length && <span className="text-xs text-slate-400 italic">—</span>}
              </div>
            </div>
            <div className="col-span-2"><p className="text-[11px] uppercase font-mono tracking-wide text-slate-500 font-bold mb-1.5">Angle nội dung</p><Chips items={s.topContentAngles.slice(0, 4)} /></div>
          </div>
          {svc && <ServiceAdsPanel data={data} service={svc} onClose={() => setSvc(null)} />}
        </>
      )}
    </div>
  );
}

const numOf = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const AD_FMT_VI: Record<string, string> = { image: "Ảnh", video: "Video", carousel: "Carousel" };

/** Danh sách QC của SERYN đang chạy 1 dịch vụ — mở khi bấm chip dịch vụ ở snapshot card. */
function ServiceAdsPanel({ data, service, onClose }: { data: SpyDashboardData; service: string; onClose: () => void }) {
  const key = String(service).toLowerCase().trim();
  const ads = (data.adLevelAnalysis ?? [])
    .filter((a) => isOwnRow(a, data))
    .filter((a) => String(a.service_or_product || "").toLowerCase().trim() === key)
    .sort((a, b) => numOf(b.days_active) - numOf(a.days_active));

  const adText = (a: AdLevelAnalysis) => String(a.hook_raw_text || a.hook_text || a.headline || "").trim();
  const adFmt = (a: AdLevelAnalysis) => {
    const f = String(a.ad_format || a.media_type || "").toLowerCase();
    const k = (["video", "carousel", "image"] as const).find((x) => f.includes(x));
    return k ? AD_FMT_VI[k] : "";
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-extrabold text-slate-800">
          Quảng cáo SERYN chạy dịch vụ “{viLabel(service)}”
          <span className="ml-1.5 font-mono text-[11px] text-cyan-700 bg-cyan-50 border border-cyan-100 px-1.5 py-0.5 rounded">{ads.length} QC</span>
        </p>
        <button onClick={onClose} aria-label="Đóng danh sách quảng cáo" className="w-6 h-6 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 transition shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>
      {!ads.length ? (
        <p className="text-xs text-slate-500">Chưa thấy quảng cáo chi tiết (ad-level) nào của SERYN cho dịch vụ này trong dữ liệu hiện có.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {ads.map((a, i) => {
            const full = String(a.primary_text || adText(a) || "").trim();
            return (
            <div key={`${a.ad_id || i}`} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              {!!adText(a) && <p className="text-[12px] font-bold text-slate-800 leading-snug">{adText(a)}</p>}
              <p className="text-[11px] text-slate-600 leading-snug mt-0.5 whitespace-pre-wrap line-clamp-3">{full || "(không có nội dung hiển thị)"}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-semibold">
                {adFmt(a) && <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white">{adFmt(a)}</span>}
                {numOf(a.days_active) > 0 && <span>{numOf(a.days_active)} ngày</span>}
                {isMeaningful(a.offer_detected) && <span className="text-amber-700">{String(a.offer_detected)}</span>}
                {isMeaningful(a.cta) && <span>CTA: {viLabel(String(a.cta))}</span>}
                {!!a.page_name && <span className="text-slate-400 truncate max-w-[140px]">{String(a.page_name)}</span>}
                {!!a.ad_id && <span className="font-mono text-slate-400">ID: {String(a.ad_id)}</span>}
                {(!!a.ad_id || !!adText(a)) && (
                  <a
                    href={a.ad_id ? adLibraryAdUrl(String(a.page_id || ""), String(a.ad_id)) : adLibraryPhraseSearchUrl(searchPhraseOf(adText(a)))}
                    target="_blank"
                    rel="noreferrer"
                    title="Mở trên Facebook Ad Library — chỉ được nếu Meta đã index (bài đã có lượt hiển thị)"
                    className="ml-auto text-cyan-700 hover:underline inline-flex items-center gap-0.5 font-bold"
                  >
                    Mở trên Facebook <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" | "emerald" }) {
  const up = tone === "up" || tone === "emerald";
  const down = tone === "down";
  const cls = up ? "text-emerald-600" : down ? "text-rose-600" : "text-slate-900";
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : null;
  return (
    <div className={`bg-white rounded-xl border px-3 py-2.5 ${up ? "border-emerald-200" : down ? "border-rose-200" : "border-slate-100"}`}>
      <p className="text-[11px] uppercase font-mono tracking-wide text-slate-500 font-bold">{label}</p>
      <p className={`text-2xl font-extrabold mt-0.5 leading-tight flex items-center gap-0.5 ${cls}`}>{Arrow && <Arrow className="w-5 h-5 shrink-0" strokeWidth={3} />}{value}</p>
    </div>
  );
}

/** Block benchmark ngắn cho Overview. */
export function SerynBenchmarkCompact({ data, onOpen }: { data: SpyDashboardData; onOpen?: () => void }) {
  const cmp = buildSerynVsCompetitorComparison(data);
  const test = cmp.recommendedTests[0];
  return (
    <div className="hm-panel p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-5 h-5 text-cyan-600" /> SERYN vs Đối thủ</h3>
        {onOpen && <button onClick={onOpen} className="text-xs font-bold text-cyan-700 hover:underline">Chi tiết ở tab SERYN →</button>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric label="Ads SERYN" value={cmp.serynActiveAds} />
        <Metric label="TB đối thủ" value={cmp.competitorAvgActiveAds} />
        <Metric label="Đối thủ mạnh nhất" value={cmp.topCompetitorActiveAds} />
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
        <p><b className="text-slate-900">Số lượng:</b> {volumePositionNote(cmp)}</p>
        <p><b className="text-slate-900">Angle còn thiếu:</b> {cmp.missingContentAngles.slice(0, 3).map(viLabel).join(", ") || "không khác biệt lớn"}</p>
        <p><b className="text-slate-900">Chênh lệch định dạng:</b> {cmp.formatGapNote}</p>
        {test && <p className="text-cyan-800 bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2"><b>Test tuần này:</b> {test.recommendation}</p>}
      </div>
    </div>
  );
}

export function TestRow({ t }: { t: SerynRecommendedTest }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${PRIO_TONE[t.priority]}`}>{viLabel(t.priority)}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-cyan-700">{viLabel(t.testType)}</span>
      </div>
      <p className="text-[15px] font-bold text-slate-900 leading-snug">{t.recommendation}</p>
      <p className="text-[13px] text-slate-600 mt-1">{t.reason}</p>
      <p className="text-[13px] text-slate-500 mt-0.5">Bằng chứng: {t.evidence}</p>
      {t.riskNote && <p className="text-[13px] font-semibold text-amber-700 mt-1">⚠ {t.riskNote}</p>}
    </div>
  );
}
