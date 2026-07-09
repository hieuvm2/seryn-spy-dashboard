import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Search, Flame, ChevronRight, Star } from "lucide-react";
import type { SpyDashboardData } from "../../types";
import { normalizeNumber, splitChips, orUnknown, viLabel, isMissing } from "../../utils/spyData";
import { useDirectCompetitors, isDirectCompetitor } from "../../utils/directCompetitors";
import { buildAdContentIntelligenceForBrand, ANGLE_VI } from "../../utils/adContentIntelligence";
import { isOwnBrand } from "../../utils/ownBrand";
import { buildSerynSnapshot } from "../../utils/serynBenchmark";
import { SerynSnapshotCard, SerynVsCompetitorSection } from "../SerynBenchmark";

const SCALE_SHORT: Record<string, string> = {
  "Weak Signal": "Tín hiệu yếu", "Repeated Content": "Content lặp lại",
  "Long-running Content": "Chạy dài ngày", "Strong Content Pattern": "Pattern mạnh",
};
const OBJ_SHORT: Record<string, string> = {
  messenger: "Messenger", lead_form: "Lead form", landing_page_conversion: "Landing page",
  phone_call: "Gọi điện", awareness: "Nhận biết", unknown: "Chưa rõ",
};

type BrandFilter = "all" | "direct" | "scaled" | "ads-up" | "new-offer" | "new-service" | "new-angle";
const BRAND_FILTERS: { id: BrandFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "direct", label: "Đối thủ trực tiếp" },
  { id: "scaled", label: "Có nội dung nhân rộng" },
  { id: "ads-up", label: "Tăng quảng cáo" },
  { id: "new-offer", label: "Có ưu đãi mới" },
  { id: "new-service", label: "Có dịch vụ mới" },
  { id: "new-angle", label: "Có góc mới" },
];

function Chips({ value, max = 4 }: { value?: string; max?: number }) {
  const items = splitChips(value);
  if (!items.length) return <span className="text-xs text-slate-400">chưa rõ</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, max).map((it, i) => (
        <span key={`${it}-${i}`} className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(it)}</span>
      ))}
      {items.length > max && <span className="text-[11px] text-slate-400 font-semibold">+{items.length - max}</span>}
    </div>
  );
}

export default function BrandsView({
  data,
  onSelectBrand,
}: {
  data: SpyDashboardData;
  onSelectBrand: (brand: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<BrandFilter>("all");
  const direct = useDirectCompetitors();

  const changeByBrand = useMemo(() => {
    const m: Record<string, (typeof data.weeklyStrategyChange)[number]> = {};
    data.weeklyStrategyChange.forEach((c) => { m[c.brand_name] = c; });
    return m;
  }, [data]);

  // Tóm tắt content nổi bật theo brand (góc content + objective + tín hiệu).
  const contentByBrand = useMemo(() => {
    const m: Record<string, { angle: string; objective: string; signal: string; score: number }> = {};
    data.brandWeeklySnapshot.forEach((r) => {
      const top = buildAdContentIntelligenceForBrand(r.brand_name, data)[0];
      if (top) m[r.brand_name] = { angle: top.contentAngle, objective: top.inferredObjective, signal: top.scaleSignal, score: top.contentScore };
    });
    return m;
  }, [data]);

  // Loại SERYN (own brand) khỏi danh sách đối thủ.
  const competitorSnap = useMemo(
    () => data.brandWeeklySnapshot.filter((r) => !isOwnBrand(r.brand_name, data.ownBrandPages ?? [])),
    [data],
  );

  const rows = useMemo(() => {
    // Ưu tiên đối thủ trực tiếp lên đầu, rồi theo số QC đang chạy.
    let list = [...competitorSnap].sort((a, b) => {
      const da = isDirectCompetitor(a.brand_name, direct) ? 1 : 0;
      const db = isDirectCompetitor(b.brand_name, direct) ? 1 : 0;
      if (da !== db) return db - da;
      return normalizeNumber(b.total_active_ads) - normalizeNumber(a.total_active_ads);
    });
    list = list.filter((r) => {
      const ch = changeByBrand[r.brand_name];
      switch (filter) {
        case "direct": return isDirectCompetitor(r.brand_name, direct);
        case "scaled": return normalizeNumber(r.scaled_content_count) > 0;
        case "ads-up": return !!ch && normalizeNumber(ch.active_ads_change) > 0;
        case "new-offer": return !!ch && !isMissing(ch.new_offers_detected);
        case "new-service": return !!ch && !isMissing(ch.new_services_detected);
        case "new-angle": return !!ch && !isMissing(ch.new_content_angles);
        default: return true;
      }
    });
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(k)));
  }, [competitorSnap, q, filter, changeByBrand, direct]);

  const serynName = buildSerynSnapshot(data).ownBrandName;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">ĐỐI THỦ</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Thống kê quảng cáo theo từng đối thủ</h2>
        <p className="text-sm text-slate-600 font-medium">Nhấp vào một đối thủ để mở hồ sơ chi tiết (lượng quảng cáo · dịch vụ · nội dung · nhân rộng · phân tích content + ảnh quảng cáo).</p>
      </div>

      {/* SERYN Snapshot (own brand) — KHÔNG nằm trong bảng đối thủ */}
      <SerynSnapshotCard data={data} onOpen={() => onSelectBrand(serynName)} />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm đối thủ, dịch vụ, ưu đãi…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300"
          />
        </div>
        <span className="text-xs text-slate-500 font-semibold font-mono">{rows.length} / {competitorSnap.length} đối thủ</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {BRAND_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${filter === f.id ? "bg-cyan-600 text-white border-cyan-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-4 py-3">Đối thủ</th>
                <th className="px-4 py-3 text-right">QC</th>
                <th className="px-4 py-3">Góc content</th>
                <th className="px-4 py-3">Định dạng</th>
                <th className="px-4 py-3 text-right">Nhân rộng</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ads = normalizeNumber(r.total_active_ads);
                const scaled = normalizeNumber(r.scaled_content_count);
                const isDirect = isDirectCompetitor(r.brand_name, direct);
                return (
                  <tr
                    key={r.brand_name}
                    onClick={() => onSelectBrand(r.brand_name)}
                    className={`border-b border-slate-100 last:border-0 cursor-pointer transition group ${isDirect ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-cyan-50/40"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isDirect && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />}
                        <span className="font-extrabold text-slate-800 group-hover:text-cyan-700">{r.brand_name}</span>
                        {isDirect && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Trực tiếp</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium truncate max-w-[220px]">{orUnknown(r.weekly_change_summary)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-extrabold px-2 py-0.5 rounded text-[11px] ${ads > 0 ? "text-cyan-700 bg-cyan-50 border border-cyan-100" : "text-slate-400 bg-slate-50 border border-slate-200"}`}>{ads}</span>
                    </td>
                    <td className="px-4 py-3">
                      {contentByBrand[r.brand_name] ? (
                        <div className="space-y-1 max-w-[180px]">
                          <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{ANGLE_VI[contentByBrand[r.brand_name].angle] || viLabel(contentByBrand[r.brand_name].angle)}</span>
                          <div className="flex flex-wrap gap-1 text-[10px] text-slate-500 font-semibold">
                            <span>{OBJ_SHORT[contentByBrand[r.brand_name].objective] || "Chưa rõ"}</span>
                            <span className="text-slate-300">·</span>
                            <span>{SCALE_SHORT[contentByBrand[r.brand_name].signal]}</span>
                          </div>
                        </div>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3"><Chips value={r.main_content_formats} max={3} /></td>
                    <td className="px-4 py-3 text-right">
                      {scaled > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">
                          <Flame className="w-3 h-3" />{scaled}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-cyan-500 inline" /></td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm font-semibold">Không có đối thủ khớp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* So sánh SERYN vs Đối thủ */}
      <SerynVsCompetitorSection data={data} />
    </motion.div>
  );
}
