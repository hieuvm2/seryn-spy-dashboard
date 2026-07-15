import React from "react";
import { motion } from "motion/react";
import { ShieldAlert, ShieldCheck, FlaskConical, ExternalLink, AlertTriangle } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { buildSerynSnapshot, getSerynRecommendedTests } from "../../utils/serynBenchmark";
import { buildSerynAlerts, type SerynContentAlert } from "../../utils/serynAlerts";
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

/* ---------- Cảnh báo: liệt kê rõ content SERYN nào bị cảnh báo & vì sao ---------- */
function AlertCard({ a }: { a: SerynContentAlert }) {
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
          <p className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold mb-1">Cụm từ vi phạm phát hiện</p>
          <div className="flex flex-wrap gap-1.5">
            {a.flaggedPhrases.map((p, i) => (
              <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700">“{p}”</span>
            ))}
          </div>
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
            {alertsResult.alerts.map((a, i) => <div key={i}><AlertCard a={a} /></div>)}
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
