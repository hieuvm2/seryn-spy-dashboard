import React, { useState } from "react";
import { 
  X, 
  Tag, 
  SearchCode, 
  Lightbulb, 
  Workflow, 
  Briefcase,
  AlertOctagon,
  Megaphone,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getMockAdsForBrand, MockAdItem } from "../mockAds";

// Safe separated sub-component to handle local expanded status hook for every ad
function AdCard({ ad }: { ad: MockAdItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const showArrow = ad.adText.length > 150;
  const textToDisplay = isExpanded ? ad.adText : (ad.adText.slice(0, 150) + (showArrow ? "..." : ""));

  return (
    <div className="bg-slate-50/50 hover:bg-slate-100/50 transition duration-150 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      {/* Ad Meta Info Bar */}
      <div className="px-3 py-2 bg-white border-b border-slate-200/80 flex items-center justify-between text-[10px] font-mono font-bold">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-extrabold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            ĐActive (Đang chạy)
          </span>
        </div>
        <span className="text-slate-400 font-medium">
          {ad.startDate}
        </span>
      </div>

      {/* Ad Page Header Info */}
      <div className="p-3 bg-white flex items-center gap-2.5">
        <img 
          src={ad.pageAvatar} 
          alt={ad.pageName}
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-full border border-slate-200 object-cover shrink-0" 
        />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-xs text-slate-900 truncate flex items-center gap-1.5">
            <span>{ad.pageName}</span>
            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
          </p>
          <p className="text-[9px] text-slate-400 font-mono mt-0.5">Sponsor • Thư viện ADS Meta</p>
        </div>
      </div>

      {/* Ad copy/text */}
      <div className="px-3 pb-3 text-xs leading-relaxed text-slate-700 font-medium bg-white whitespace-pre-line">
        <p className="transition-all duration-150">
          {textToDisplay}
        </p>
        {showArrow && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1.5 text-xs text-cyan-600 hover:text-cyan-800 transition flex items-center gap-1 font-bold cursor-pointer hover:underline"
          >
            {isExpanded ? (
              <>
                <span>Thu nhỏ</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Xem thêm</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Ad creative visual */}
      {ad.mediaUrl && (
        <div className="relative group overflow-hidden bg-black/5 aspect-video flex items-center justify-center border-y border-slate-100">
          <img 
            src={ad.mediaUrl} 
            alt="Ad Visual Preview" 
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
          />
          {ad.mediaType === "video" && (
            <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center">
              <span className="w-10 h-10 rounded-full bg-cyan-600/95 text-white flex items-center justify-center shadow-lg transform group-hover:scale-105 transition duration-150">
                <span className="ml-[3px] select-none text-xs font-bold">▶</span>
              </span>
            </div>
          )}
          <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs text-[8px] uppercase tracking-wider text-white font-bold font-mono rounded select-none">
            {ad.mediaType === "video" ? "Video" : "Hình ảnh"}
          </span>
        </div>
      )}

      {/* Ad Action Box / CTA Banner */}
      <div className="p-3 bg-slate-100/80 flex items-center justify-between gap-2.5 border-t border-slate-200">
        <div className="min-w-0 pr-1 text-left">
          <p className="text-[8px] text-slate-400 font-mono uppercase tracking-wider font-extrabold truncate">Facebook Link Meta</p>
          <p className="text-xs font-extrabold text-slate-800 truncate leading-snug mt-0.5">
            {ad.mediaTitle}
          </p>
          <p className="text-[9px] text-slate-500 font-mono truncate mt-0.5">
            {ad.mediaDesc}
          </p>
        </div>
        <button type="button" className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-extrabold shrink-0 shadow-4xs cursor-pointer transition">
          {ad.ctaText}
        </button>
      </div>
    </div>
  );
}

interface EntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entity: {
    id: string;
    name: string;
    category?: string;
    status?: string;
    metrics: Record<string, string | number>;
    tags?: string[];
    summary?: string;
    observedInsights?: string[];
    inferredInsights?: string[];
    recommendations?: string[];
  } | null;
}

export default function EntityDrawer({ isOpen, onClose, entity }: EntityDrawerProps) {
  if (!isOpen || !entity) return null;

  const brandAds = getMockAdsForBrand(entity.name, entity.id);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity duration-300" 
        onClick={onClose} 
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[480px] bg-white border-l border-slate-205 shadow-2xl z-50 flex flex-col text-slate-800 transition-transform transform duration-300 ease-out">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white text-cyan-705 text-cyan-700 text-xs font-mono px-3 py-1 rounded border border-cyan-200 uppercase font-extrabold shadow-3xs">
                {entity.category || "General Focused"}
              </span>
              <span className={`text-xs uppercase font-mono tracking-wider px-3 py-1 rounded-md font-extrabold border ${
                String(entity.status).toLowerCase().includes("active")
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-650 border-slate-200"
              }`}>
                {entity.status || "Not Checked"}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{entity.name}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-3xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary description section */}
          {entity.summary && (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <p className="text-sm text-slate-705 text-slate-700 leading-relaxed font-sans font-medium">{entity.summary}</p>
            </div>
          )}

          {/* Metrics Record list */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono font-bold">
              <Briefcase className="w-3.5 h-3.5 text-cyan-600" />
              Chỉ số ghi nhận (Metrics)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(entity.metrics).map(([key, value]) => (
                <div key={key} className="bg-slate-50/70 border border-slate-200 p-3.5 rounded-xl font-mono text-xs shadow-4xs">
                  <p className="text-slate-500 text-xs truncate mb-1" title={key}>{key}</p>
                  <p className="text-slate-900 font-extrabold text-base truncate">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {entity.tags && entity.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-550 uppercase tracking-widest mb-2 flex items-center gap-1.5 font-mono font-bold">
                <Tag className="w-3.5 h-3.5 text-cyan-600" />
                Gắn nhãn (Segmentation)
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {entity.tags.map((tag) => (
                  <span key={tag} className="bg-slate-50 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-md font-bold shadow-4xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observed Insights Section (Dữ liệu thật trong file) */}
          {entity.observedInsights && entity.observedInsights.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono font-bold">
                <SearchCode className="w-3.5 h-3.5 text-emerald-600" />
                Thực tế quan sát (Observed)
              </h4>
              <ul className="space-y-2">
                {entity.observedInsights.map((insight, idx) => (
                  <li key={idx} className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 text-sm leading-relaxed text-slate-700 relative pl-4.5 font-medium">
                    <span className="absolute left-2.5 top-4.5 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Inferred Strategic Insights Section (Suy luận hợp lý) */}
          {entity.inferredInsights && entity.inferredInsights.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono font-bold">
                <Workflow className="w-3.5 h-3.5 text-indigo-600" />
                Suy luận chiến thuật (Inferred)
              </h4>
              <ul className="space-y-2">
                {entity.inferredInsights.map((insight, idx) => (
                  <li key={idx} className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 text-sm leading-relaxed text-slate-705 text-slate-700 relative pl-4.5 font-medium">
                    <span className="absolute left-2.5 top-4.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations Specific Actions */}
          {entity.recommendations && entity.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono font-bold">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                Khuyến nghị cho SERYN
              </h4>
              <ul className="space-y-2">
                {entity.recommendations.map((rec, idx) => (
                  <li key={idx} className="bg-amber-50/40 border border-amber-100 rounded-xl p-3.5 text-sm leading-relaxed text-slate-705 text-slate-700 relative pl-4.5 font-medium">
                    <span className="absolute left-2.5 top-4.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ads Tiêu biểu Gần đây Segment */}
          <div className="space-y-4 pt-5 border-t border-slate-100">
            <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-cyan-600" />
                Ads tiêu biểu gần đây
              </span>
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2.5 py-0.5 rounded-full border border-cyan-100 uppercase tracking-wide">
                {brandAds.length} active ads
              </span>
            </h4>

            {brandAds.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 text-center rounded-xl font-medium text-xs text-slate-500">
                Không có mẫu quảng cáo hoạt động nổi tiếng nào gần đây.
              </div>
            ) : (
              <div className="space-y-4">
                {brandAds.map((ad) => (
                  <div key={ad.id}>
                    <AdCard ad={ad} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500 font-mono font-bold">
          <span>ID Thực thể: {entity.id} • Dữ liệu chuẩn hóa 2026</span>
        </div>
      </div>
    </>
  );
}
