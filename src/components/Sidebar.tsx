import React from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Flame,
  Layers,
  Lightbulb,
  Upload,
  Database,
  Zap,
  Bookmark,
  FileText,
} from "lucide-react";
import type { ViewId } from "../types";

interface SidebarProps {
  activeSection: ViewId;
  setActiveSection: (sec: ViewId) => void;
  weekDate?: string;
}

const menuItems: { id: ViewId; label: string; icon: any }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "brands", label: "Đối thủ", icon: FileSpreadsheet },
  { id: "scaled-content", label: "Nội dung nhân rộng", icon: Flame },
  { id: "top-hooks", label: "Top Hooks", icon: Zap },
  { id: "swipe-file", label: "Swipe File", icon: Bookmark },
  { id: "creative-briefs", label: "Creative Briefs", icon: FileText },
  { id: "weekly-changes", label: "Thay đổi tuần", icon: Layers },
  { id: "seryn-recommendations", label: "Gợi ý cho SERYN", icon: Lightbulb },
  { id: "data-import", label: "Nhập dữ liệu", icon: Upload },
];

export default function Sidebar({ activeSection, setActiveSection, weekDate }: SidebarProps) {
  const handleNav = (id: ViewId) => {
    setActiveSection(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 text-slate-800 flex flex-col fixed top-0 bottom-0 left-0 z-30 shadow-xs">
      {/* Brand */}
      <div className="p-6 border-b border-slate-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-cyan-600/15">
          <Database className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
            SERYN <span className="text-cyan-600">TÌNH BÁO</span>
          </h1>
          <p className="text-[10px] font-mono tracking-wider uppercase text-slate-500 font-bold">Bộ phân tích đối thủ</p>
        </div>
      </div>

      {weekDate && (
        <div className="p-4 mx-4 mt-4 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
          <p className="text-[11px] uppercase tracking-wider font-extrabold text-cyan-600 mb-1">TUẦN ĐANG XEM</p>
          <p className="text-sm font-extrabold text-slate-800 font-mono">{weekDate}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[11px] uppercase font-mono tracking-wider text-slate-400 font-bold">DANH MỤC</p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-bold transition-all group relative ${
                isActive
                  ? "bg-cyan-50/70 text-cyan-700 border border-cyan-100/60 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? "text-cyan-600" : "text-slate-400 group-hover:text-slate-600"}`} />
              <span>{item.label}</span>
              {isActive && <div className="absolute right-3.5 w-1.5 h-1.5 rounded-full bg-cyan-600 shadow-[0_0_6px_#0891b2]" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-mono text-xs font-bold text-slate-700">BI</div>
          <div>
            <p className="text-sm font-bold text-slate-800">SERYN Theo Dõi QC</p>
            <p className="text-xs font-mono text-slate-500 font-semibold">Thị trường Việt Nam</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
