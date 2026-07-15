import React from "react";
import { motion } from "motion/react";
import { ShieldAlert, ShieldCheck, FlaskConical, ExternalLink, AlertTriangle } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { viLabel } from "../../utils/spyData";
import { buildSerynSnapshot, getSerynRecommendedTests } from "../../utils/serynBenchmark";
import { buildSerynAlerts, type SerynContentAlert } from "../../utils/serynAlerts";
import { ANGLE_VI } from "../../utils/adContentIntelligence";
import { SerynSnapshotCard, TestRow } from "../SerynBenchmark";

const SEV_VI: Record<string, string> = { High: "Cảnh báo cao", Medium: "Cần review" };
const SEV_TONE: Record<string, string> = {
  High: "bg-rose-50 text-rose-700 border-rose-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
};
const FMT_VI: Record<string, string> = { image: "Ảnh", video: "Video", carousel: "Carousel", unknown: "Chưa rõ" };

function SectionTitle({ tag, title, desc }: { tag: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
      <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">{tag}</span>
      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      {desc && <p className="text-sm text-slate-600 font-medium">{desc}</p>}
    </div>
  );
}

/* ---------- Cảnh báo: liệt kê rõ content SERYN nào bị cảnh báo & vì sao ---------- */
function AlertCard({ a }: { a: SerynContentAlert }) {
  const c = a.content;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border ${SEV_TONE[a.severity]}`}>
          <AlertTriangle className="w-3 h-3" />{SEV_VI[a.severity]}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{ANGLE_VI[c.contentAngle] || viLabel(c.contentAngle)}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{FMT_VI[c.adFormat]}</span>
        {c.adsCount > 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700">{c.adsCount} QC</span>}
        {c.activeDays > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{c.activeDays} ngày</span>}
        {c.exampleAdUrls[0] && (
          <a href={c.exampleAdUrls[0]} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-bold text-cyan-700 hover:underline inline-flex items-center gap-0.5">
            Mở QC <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Content bị cảnh báo — trích nguyên văn */}
      <blockquote className="text-[13px] font-semibold text-slate-800 leading-snug border-l-2 border-rose-300 bg-rose-50/40 rounded-r-lg pl-3 pr-2 py-2">
        “{c.contentText || c.contentSummary}”
      </blockquote>

      <div>
        <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Vì sao bị cảnh báo</p>
        <ul className="list-disc pl-4 space-y-0.5 text-[12px] text-slate-700">
          {a.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      {a.flaggedPhrases.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Cụm từ vi phạm phát hiện</p>
          <div className="flex flex-wrap gap-1.5">
            {a.flaggedPhrases.map((p, i) => (
              <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700">“{p}”</span>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 space-y-1">
        <p className="text-[12px] text-slate-700"><b className="text-slate-500">Đề xuất sửa an toàn:</b> {a.safeRewrite}</p>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{a.complianceWarning}</p>
      </div>
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

      {/* CẢNH BÁO — từ phần phân tích content, liệt kê rõ content nào bị cảnh báo */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 border-l-2 border-rose-500 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-widest text-rose-600 font-bold">CẢNH BÁO</span>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" /> Content SERYN cần chú ý
          </h3>
          <p className="text-sm text-slate-600 font-medium">
            Lấy từ phần phân tích content quảng cáo: claim mạnh, giảm giá sâu, cụm từ vi phạm chuẩn an toàn.
            {alertsResult.hasData && ` Đang cảnh báo ${alertsResult.alerts.length}/${alertsResult.totalContents} content đã phân tích.`}
          </p>
        </div>

        {!alertsResult.hasData ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            Chưa có dữ liệu content chi tiết (ad-level) của SERYN để phân tích cảnh báo. Thêm page vào tab <span className="font-mono">Own Brand Pages</span> và crawl để bật phân tích từng content.
          </div>
        ) : alertsResult.alerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Không phát hiện content nào của SERYN vi phạm claim / rủi ro trong {alertsResult.totalContents} content đã phân tích tuần này.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-3">
            {alertsResult.alerts.map((a, i) => <div key={`${a.content.id}-${i}`}><AlertCard a={a} /></div>)}
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
          <p className="text-sm text-slate-600 font-medium">Lấy từ phần phân tích so sánh SERYN vs đối thủ — mỗi đề xuất kèm lý do và bằng chứng.</p>
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
