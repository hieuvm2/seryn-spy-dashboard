import React, { useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert, ShieldCheck, FlaskConical, ExternalLink, AlertTriangle, Search } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { viLabel } from "../../utils/spyData";
import { buildSerynSnapshot, getSerynRecommendedTests } from "../../utils/serynBenchmark";
import { buildSerynAlerts, findOwnAdsByPhrase, serynAdLibraryUrl, type SerynContentAlert } from "../../utils/serynAlerts";
import { SerynSnapshotCard, TestRow } from "../SerynBenchmark";

const SEV_VI: Record<string, string> = { High: "Cảnh báo cao", Medium: "Cần review" };
const SEV_TONE: Record<string, string> = {
  High: "bg-rose-50 text-rose-700 border-rose-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
};

function SectionTitle({ tag, title, desc }: { tag: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
      <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">{tag}</span>
      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      {desc && <p className="text-sm text-slate-600 font-medium">{desc}</p>}
    </div>
  );
}

/* ---------- Panel: các QC của SERYN chứa cụm từ vi phạm được chọn ---------- */
function PhraseAdsPanel({ data, phrase }: { data: SpyDashboardData; phrase: string }) {
  const { ads, matchedFragment, approximate } = findOwnAdsByPhrase(data, phrase);
  return (
    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50/40 p-2.5">
      <p className="text-[11px] font-extrabold text-slate-700 mb-1.5">
        Quảng cáo SERYN chứa “{phrase}”
        <span className="ml-1.5 font-mono text-[10px] text-rose-700 bg-white border border-rose-200 px-1.5 py-0.5 rounded">{ads.length} QC</span>
      </p>
      {approximate && ads.length > 0 && (
        <p className="text-[10px] text-slate-500 mb-1.5 italic">Không có QC chứa nguyên cụm — hiển thị QC chứa phần khớp gần nhất: “{matchedFragment}”.</p>
      )}
      {!ads.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">
            Không tìm thấy QC nào của SERYN chứa cụm này trong dữ liệu ad-level (cụm trong báo cáo có thể là diễn giải). Xem trực tiếp các QC đang chạy của SERYN:
          </p>
          <a
            href={serynAdLibraryUrl(data, phrase)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-2.5 py-1 rounded-lg transition"
          >
            Mở Thư viện QC Facebook của SERYN <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {ads.map((ad, i) => (
              <div key={`${ad.adId || i}`} className="rounded-md border border-slate-100 bg-white px-2.5 py-1.5">
                <p className="text-[12px] font-semibold text-slate-800 leading-snug">{ad.text || "(không có tiêu đề)"}</p>
                {ad.snippet && ad.snippet !== ad.text && (
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{ad.snippet}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-semibold">
                  {ad.adFormat && <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50">{ad.adFormat}</span>}
                  {ad.daysActive > 0 && <span>{ad.daysActive} ngày</span>}
                  {ad.offer && <span className="text-amber-700">{ad.offer}</span>}
                  {ad.cta && <span>CTA: {viLabel(ad.cta)}</span>}
                  {ad.pageName && <span className="text-slate-400">{ad.pageName}</span>}
                  {ad.url && (
                    <a href={ad.url} target="_blank" rel="noreferrer" className="ml-auto text-cyan-700 hover:underline inline-flex items-center gap-0.5 font-bold">Mở QC <ExternalLink className="w-3 h-3" /></a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <a
            href={serynAdLibraryUrl(data, phrase)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-700 hover:underline mt-1.5"
          >
            Xem toàn bộ QC của SERYN trên Thư viện QC Facebook <ExternalLink className="w-3 h-3" />
          </a>
        </>
      )}
    </div>
  );
}

/* ---------- Cảnh báo: liệt kê rõ content SERYN nào bị cảnh báo & vì sao ---------- */
function AlertCard({ a, data }: { a: SerynContentAlert; data: SpyDashboardData }) {
  // Cụm từ đang được chọn -> hiện các QC chứa cụm đó ngay dưới.
  const [phrase, setPhrase] = useState<string | null>(null);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border ${SEV_TONE[a.severity]}`}>
          <AlertTriangle className="w-3 h-3" />{SEV_VI[a.severity]}
        </span>
        {a.label && <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{a.label}</span>}
        {(a.adsCount ?? 0) > 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700">{a.adsCount} QC</span>}
        {a.adUrl && (
          <a href={a.adUrl} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-bold text-cyan-700 hover:underline inline-flex items-center gap-0.5">
            Mở QC <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Nội dung bị cảnh báo — nguyên văn */}
      <blockquote className="text-[13px] font-semibold text-slate-800 leading-snug border-l-2 border-rose-300 bg-rose-50/40 rounded-r-lg pl-3 pr-2 py-2">
        {a.message}
      </blockquote>

      {a.reasons && a.reasons.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Vì sao bị cảnh báo</p>
          <ul className="list-disc pl-4 space-y-0.5 text-[12px] text-slate-700">
            {a.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {a.flaggedPhrases.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Cụm từ vi phạm phát hiện <span className="normal-case font-sans text-slate-400">(bấm để xem QC chứa cụm)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {a.flaggedPhrases.map((p, i) => (
              <button
                key={i}
                onClick={() => setPhrase((cur) => (cur === p ? null : p))}
                title="Bấm để xem các quảng cáo SERYN chứa cụm này"
                className={`text-[11px] font-bold px-2 py-0.5 rounded border transition cursor-pointer inline-flex items-center gap-1 ${phrase === p ? "bg-rose-600 text-white border-rose-600 shadow-sm" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"}`}
              >
                <Search className="w-2.5 h-2.5" />“{p}”
              </button>
            ))}
          </div>
          {phrase && <PhraseAdsPanel data={data} phrase={phrase} />}
        </div>
      )}

      {(a.safeRewrite || a.complianceWarning) && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {a.safeRewrite && <p className="text-[12px] text-slate-700"><b className="text-slate-500">Đề xuất sửa an toàn:</b> {a.safeRewrite}</p>}
          {a.complianceWarning && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{a.complianceWarning}</p>}
        </div>
      )}
    </div>
  );
}

export default function SerynView({
  data,
  onSelectBrand,
}: {
  data: SpyDashboardData;
  onSelectBrand: (brand: string) => void;
}) {
  const serynName = buildSerynSnapshot(data).ownBrandName;
  const alertsResult = buildSerynAlerts(data);
  const tests = getSerynRecommendedTests(data);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle
        tag="SERYN"
        title="Thương hiệu SERYN"
        desc="Tổng quan ads của SERYN, cảnh báo content rủi ro và đề xuất hành động — tách riêng khỏi phần đối thủ."
      />

      {/* Snapshot nhanh + nút mở hồ sơ phân tích đầy đủ */}
      <SerynSnapshotCard data={data} onOpen={() => onSelectBrand(serynName)} />

      {/* CẢNH BÁO — liệt kê rõ content SERYN nào bị cảnh báo (đồng nhất tab Báo cáo) */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 border-l-2 border-rose-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-rose-600 font-bold">CẢNH BÁO</span>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" /> Content SERYN cần chú ý
          </h3>
        </div>

        {!alertsResult.hasData ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            Chưa có báo cáo tuần hay content chi tiết của SERYN để đánh giá cảnh báo. Thêm page vào tab <span className="font-mono">Own Brand Pages</span> và crawl.
          </div>
        ) : alertsResult.alerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Không phát hiện content nào của SERYN vi phạm claim / rủi ro trong tuần này.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-3">
            {alertsResult.alerts.map((a, i) => <div key={i}><AlertCard a={a} data={data} /></div>)}
          </div>
        )}
      </div>

      {/* ĐỀ XUẤT — từ phần phân tích SERYN vs đối thủ (nên test gì, kèm bằng chứng) */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">ĐỀ XUẤT</span>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-500" /> SERYN nên làm gì tiếp theo
          </h3>
        </div>
        {tests.length ? (
          <div className="grid lg:grid-cols-2 gap-3">
            {tests.map((t, i) => <div key={i}><TestRow t={t} /></div>)}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa đủ dữ liệu để đề xuất — cần thêm dữ liệu SERYN + đối thủ.</p>
        )}
      </div>
    </motion.div>
  );
}
