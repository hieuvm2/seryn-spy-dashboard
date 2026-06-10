import React, { useState } from "react";
import { 
  Sparkles, 
  Search, 
  Workflow, 
  AlertTriangle, 
  Flame, 
  Lightbulb, 
  Layers,
  HelpCircle
} from "lucide-react";

interface Insight {
  title: string;
  type: "observed" | "inferred" | "warning" | "opportunity" | "recommendation";
  content: string;
  priority?: "high" | "medium" | "low";
  evidence?: string;
  id?: string;
}

interface InsightCenterProps {
  insights: Insight[];
}

export default function InsightCenter({ insights }: InsightCenterProps) {
  const [filterType, setFilterType] = useState<string>("all");

  const categories = [
    { id: "all", label: "Tất cả Insights", icon: Layers },
    { id: "observed", label: "Kiểm chứng (Observed)", icon: Search },
    { id: "inferred", label: "Suy luận (Inferred)", icon: Workflow },
    { id: "warning", label: "Cảnh báo (Warnings)", icon: AlertTriangle },
    { id: "opportunity", label: "Cơ hội (Opportunities)", icon: Flame },
    { id: "recommendation", label: "Khuyến nghị (Actionable)", icon: Lightbulb }
  ];

  const filteredInsights = filterType === "all" 
    ? insights 
    : insights.filter(ins => ins.type === filterType);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "observed":
        return {
          banner: "bg-emerald-50 border border-emerald-200 text-emerald-800",
          icon: Search,
          label: "Dữ liệu Thực nghiệm (Observed)"
        };
      case "inferred":
        return {
          banner: "bg-indigo-50 border border-indigo-200 text-indigo-800",
          icon: Workflow,
          label: "Suy luận Chiến lược (Inferred)"
        };
      case "warning":
        return {
          banner: "bg-rose-50 border border-rose-200 text-rose-800",
          icon: AlertTriangle,
          label: "Cảnh báo Nguy cơ (Warning)"
        };
      case "opportunity":
        return {
          banner: "bg-cyan-50 border border-cyan-200 text-cyan-800",
          icon: Flame,
          label: "Cơ hội Thị trường (Opportunity)"
        };
      case "recommendation":
      default:
        return {
          banner: "bg-amber-50 border border-amber-200 text-amber-800",
          icon: Lightbulb,
          label: "Đề xuất Giải pháp (Recommendation)"
        };
    }
  };

  const getPriorityStyle = (prio?: "high" | "medium" | "low") => {
    switch (prio) {
      case "high":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "low":
      default:
        return "bg-slate-100 text-slate-600 border-slate-250";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">Trung Tâm Tổng Hợp Insights</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5 font-semibold">Phân tích chéo dữ liệu kiểm nghiệm và đề xuất chiến lược cạnh tranh</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        {categories.map((cat) => {
          const CatIcon = cat.icon;
          const isSelected = filterType === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                isSelected 
                  ? "bg-cyan-50 border-cyan-200 text-cyan-700 font-extrabold" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic List */}
      {filteredInsights.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50">
          <HelpCircle className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs text-slate-500 font-semibold">Chưa có thông số cho nhóm lọc này trong báo cáo hiện tại.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInsights.map((ins, i) => {
            const config = getTypeStyle(ins.type);
            const BadgeIcon = config.icon;
            return (
              <div 
                key={ins.id || `ins-${i}`}
                className="bg-slate-50 border border-slate-200 p-5 rounded-xl hover:border-slate-300 hover:shadow-xs transition duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Tags Row */}
                  <div className="flex justify-between items-center mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${config.banner}`}>
                      <BadgeIcon className="w-3.5 h-3.5" />
                      <span>{config.label}</span>
                    </span>
                    {ins.priority && (
                      <span className={`text-[10px] uppercase font-mono tracking-wider font-extrabold px-2 py-0.5 rounded border ${getPriorityStyle(ins.priority)}`}>
                        {ins.priority} priority
                      </span>
                    )}
                  </div>

                  {/* Body Text */}
                  <h4 className="text-base font-extrabold text-slate-900 mb-2 leading-tight">
                    {ins.title}
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed font-sans font-medium mb-4">
                    {ins.content}
                  </p>
                </div>

                {/* Evidence footer */}
                {ins.evidence && (
                  <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-0.5">
                    <p className="text-xs uppercase font-mono text-slate-400 tracking-wider font-bold">Căn cứ số liệu (Evidence):</p>
                    <p className="text-xs font-mono text-cyan-700 font-bold leading-relaxed">{ins.evidence}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
