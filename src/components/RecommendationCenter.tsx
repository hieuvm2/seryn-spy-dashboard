import React from "react";
import { 
  Lightbulb, 
  ChevronRight, 
  Target, 
  BarChart2, 
  Activity,
  UserCheck
} from "lucide-react";

interface Recommendation {
  title: string;
  reason: string;
  action: string;
  priority: "high" | "medium" | "low";
  expectedImpact?: string;
  kpiToTrack?: string;
  id?: string;
}

interface RecommendationCenterProps {
  recommendations: Recommendation[];
}

export default function RecommendationCenter({ recommendations }: RecommendationCenterProps) {
  
  const getPrioLabel = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return { text: "CRITICAL ACTION", style: "bg-rose-100 border-rose-200 text-rose-800" };
      case "medium":
        return { text: "RECOMMENDED", style: "bg-amber-100 border-amber-200 text-amber-800" };
      case "low":
      default:
        return { text: "DEVELOPMENT", style: "bg-slate-100 text-slate-700 border-slate-205" };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">Kênh Khuyến Nghị Chiến Lược cho SERYN</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5 font-semibold">Kế hoạch hành động cụ thể kèm KPI đối chiếu dựa trên chẩn đoán đối thủ</p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs font-semibold">
          “No recommendations found in the uploaded file.”
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, i) => {
            const prio = getPrioLabel(rec.priority);
            return (
              <div 
                key={rec.id || `rec-${i}`}
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-slate-350 transition duration-300"
              >
                {/* Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded text-xs uppercase tracking-wider font-mono font-bold border ${prio.style}`}>
                    {prio.text}
                  </span>
                  {rec.kpiToTrack && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white px-3 py-1 rounded border border-slate-200 font-medium">
                      <Target className="w-4 h-4 text-cyan-600" />
                      <span>Track: {rec.kpiToTrack}</span>
                    </span>
                  )}
                </div>

                {/* Primary Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Strategic Action */}
                  <div className="md:col-span-7 space-y-2.5">
                    <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 leading-tight">
                      <ChevronRight className="w-4.5 h-4.5 text-cyan-600 shrink-0" />
                      {rec.title}
                    </h4>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg">
                      <p className="text-xs uppercase font-mono text-slate-400 mb-1 font-bold">Hành động khuyến nghị (Action Plan):</p>
                      <p className="text-sm text-slate-800 font-bold leading-relaxed">{rec.action}</p>
                    </div>
                  </div>

                  {/* Impact Summary and Logic */}
                  <div className="md:col-span-5 flex flex-col justify-between gap-3 border-l border-slate-200 pl-4.5">
                    <div>
                      <p className="text-xs uppercase font-mono text-slate-500 flex items-center gap-1.5 mb-1.5 font-bold">
                        <Activity className="w-3.5 h-3.5 text-cyan-600" />
                        Lý do đề xuất (Strategic Base):
                      </p>
                      <p className="text-sm text-slate-650 leading-relaxed italic font-medium">{rec.reason}</p>
                    </div>

                    {rec.expectedImpact && (
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-xs uppercase font-mono text-emerald-700 flex items-center gap-1.5 font-extrabold">
                          <BarChart2 className="w-4.5 h-4.5 text-emerald-600" />
                          Kỳ vọng đạt được (Expected Impact):
                        </p>
                        <p className="text-sm text-slate-800 mt-1.5 font-bold">{rec.expectedImpact}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
