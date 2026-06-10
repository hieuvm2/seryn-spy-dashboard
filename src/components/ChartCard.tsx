import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { Activity } from "lucide-react";

interface ChartCardProps {
  id: string;
  title: string;
  type: "bar" | "line" | "pie" | "donut" | "area" | "heatmap" | "table";
  data: any[];
  xKey?: string;
  yKey?: string;
  categoryKey?: string;
  description?: string;
  key?: any;
}

export default function ChartCard({
  id,
  title,
  type,
  data,
  xKey = "name",
  yKey = "value",
  categoryKey,
  description
}: ChartCardProps) {
  
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <Activity className="w-8 h-8 text-slate-405 mb-2 animate-pulse" />
        <p className="text-slate-600 text-sm font-bold">Không tìm thấy dữ liệu vẽ biểu đồ</p>
        {description && <p className="text-slate-500 text-xs mt-1 text-center max-w-sm">{description}</p>}
      </div>
    );
  }

  // Common colors
  const COLORS = ["#06b6d4", "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 border border-slate-200 p-3.5 rounded-xl shadow-sm text-slate-800 font-mono text-xs">
          <p className="text-slate-900 font-bold mb-1">{payload[0].name}</p>
          <p className="text-cyan-600 font-semibold flex items-center gap-1.5">
            Giá trị: <span className="text-slate-900 text-sm font-extrabold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey={xKey} 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} radius={[4, 4, 0, 0]} fill="#06b6d4">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2.5} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={yKey} stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "donut":
        const radiusConfig = type === "donut" ? { innerRadius: 60, outerRadius: 90 } : { outerRadius: 90 };
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="48%"
                labelLine={false}
                {...radiusConfig}
                fill="#8884d8"
                dataKey={yKey}
                nameKey={xKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle" 
                iconSize={8}
                formatter={(value) => <span className="text-slate-600 text-xs font-bold">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <p className="text-xs text-slate-500">Định dạng biểu đồ không hỗ trợ</p>;
    }
  };

  return (
    <div id={id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-350 transition duration-300">
      <div className="mb-4">
        <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">{title}</h4>
        {description && (
          <p className="text-xs text-slate-500 mt-1 font-medium">{description}</p>
        )}
      </div>
      <div>{renderChart()}</div>
    </div>
  );
}
