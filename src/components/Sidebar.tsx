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
  Image as ImageIcon,
  Users,
  Globe,
  Search,
  ClipboardList,
  LayoutGrid,
} from "lucide-react";
import type { ViewId } from "../types";

interface SidebarProps {
  activeSection: ViewId;
  setActiveSection: (sec: ViewId) => void;
}

type MenuItem = { id: ViewId; label: string; icon: any };
type MenuGroup = { title: string; items: MenuItem[] };

/** Danh mục gom nhóm theo luồng làm việc: Tổng quan → Phân tích → Nghiên cứu → Sáng tạo → Cấu hình. */
const menuGroups: MenuGroup[] = [
  {
    title: "Tổng quan",
    items: [
      { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
      { id: "weekly-intelligence", label: "Weekly Intelligence", icon: ClipboardList },
    ],
  },
  {
    title: "Phân tích đối thủ",
    items: [
      { id: "brands", label: "Đối thủ", icon: FileSpreadsheet },
      { id: "scaled-content", label: "Nội dung nhân rộng", icon: Flame },
      { id: "top-hooks", label: "Phân tích Hook", icon: Zap },
      { id: "visual-intelligence", label: "Visual Intelligence", icon: ImageIcon },
      { id: "ad-format-funnel", label: "Format & Funnel", icon: LayoutGrid },
      { id: "weekly-changes", label: "Thay đổi tuần", icon: Layers },
    ],
  },
  {
    title: "Nghiên cứu & mở rộng",
    items: [
      { id: "market-research", label: "Nghiên cứu thị trường", icon: Globe },
      { id: "competitor-discovery", label: "Phát hiện đối thủ", icon: Search },
    ],
  },
  {
    title: "Sáng tạo cho SERYN",
    items: [
      { id: "seryn-recommendations", label: "Gợi ý cho SERYN", icon: Lightbulb },
      { id: "swipe-file", label: "Swipe File", icon: Bookmark },
      { id: "creative-briefs", label: "Creative Briefs", icon: FileText },
    ],
  },
  {
    title: "Cấu hình & dữ liệu",
    items: [
      { id: "competitor-setup", label: "Competitor Setup", icon: Users },
      { id: "data-import", label: "Nhập dữ liệu", icon: Upload },
    ],
  },
];

export default function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const handleNav = (id: ViewId) => {
    setActiveSection(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 text-slate-800 flex flex-col fixed top-0 bottom-0 left-0 z-30 shadow-sm">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white shrink-0 shadow-lg shadow-cyan-600/20">
          <Database className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
            SERYN <span className="text-cyan-600">INSIGHTS</span>
          </h1>
          <p className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-bold">Competitor Intelligence</p>
        </div>
      </div>

      {/* Nav (grouped) */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all group relative ${
                      isActive
                        ? "bg-cyan-50 text-cyan-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    {/* active accent bar */}
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-cyan-600" />}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-cyan-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3.5 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-mono text-xs font-bold text-cyan-700">BI</div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-800 truncate">SERYN Insights</p>
            <p className="text-[11px] font-mono text-slate-400 font-semibold">Thị trường Việt Nam</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
