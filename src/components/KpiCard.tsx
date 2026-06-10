import React from "react";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  AlertCircle
} from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: string | number;
  status?: "positive" | "negative" | "neutral" | "warning";
  description?: string;
  id?: string;
  key?: any;
}

export default function KpiCard({ label, value, change, status = "neutral", description, id }: KpiCardProps) {
  // Determine gradient color mapping based on status
  const statusConfig = {
    positive: {
      text: "text-emerald-600",
      barColor: "bg-emerald-500",
      barWidth: "w-3/4",
      icon: ArrowUpRight,
      badge: "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100"
    },
    negative: {
      text: "text-rose-600",
      barColor: "bg-rose-500",
      barWidth: "w-1/4",
      icon: ArrowDownRight,
      badge: "text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100"
    },
    warning: {
      text: "text-amber-600",
      barColor: "bg-amber-500",
      barWidth: "w-1/3",
      icon: AlertCircle,
      badge: "text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100"
    },
    neutral: {
      text: "text-cyan-600",
      barColor: "bg-cyan-500",
      barWidth: "w-2/3",
      icon: Minus,
      badge: "text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-100"
    }
  };

  const currentStatus = statusConfig[status] || statusConfig.neutral;
  const StatusIcon = currentStatus.icon;

  return (
    <div 
      id={id}
      className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:border-slate-350 hover:shadow-xs hover:translate-y-[-1px] group"
    >
      <div>
        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
          {label}
        </div>
        
        <div className="flex items-center gap-2 mb-1 justify-between">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
          {change && (
            <span className={`text-[11px] font-extrabold flex items-center gap-0.5 ${currentStatus.badge}`}>
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{change}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-2.5">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${currentStatus.barColor} ${currentStatus.barWidth} rounded-full`} />
        </div>
        {description && (
          <p className="mt-2.5 text-xs text-slate-550 font-mono leading-relaxed truncate group-hover:text-slate-700 transition-colors font-medium" title={description}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
