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
  Sparkles,
  X,
} from "lucide-react";
import type { ViewId } from "../types";

interface SidebarProps {
  activeSection: ViewId;
  setActiveSection: (sec: ViewId) => void;
  /** Mở drawer trên mobile. Trên desktop sidebar luôn hiện. */
  mobileOpen?: boolean;
  /** Đóng drawer (mobile). */
  onClose?: () => void;
  /** false = viewer (chỉ xem) — chỉ thấy 3 tab đầu (Tổng quan / Đối thủ / Báo cáo). */
  canEdit?: boolean;
}

/** Tab viewer được thấy. Admin: tất cả. */
const VIEWER_VIEW_IDS: ViewId[] = ["overview", "brands", "seryn", "reports"];

type MenuItem = { id: ViewId; label: string; icon: any };
type MenuGroup = { title: string; items: MenuItem[] };

/** Danh mục gom nhóm theo luồng làm việc: Tổng quan → Phân tích → Nghiên cứu → Sáng tạo → Cấu hình. */
const menuGroups: MenuGroup[] = [
  {
    title: "Spy Ads đối thủ",
    items: [
      { id: "overview", label: "Tổng quan thị trường trẻ hóa", icon: LayoutDashboard },
      { id: "brands", label: "Theo dõi đối thủ", icon: FileSpreadsheet },
      { id: "reports", label: "Phân tích báo cáo", icon: FileText },
      { id: "competitor-discovery", label: "Phát hiện đối thủ", icon: Search },
    ],
  },
  {
    title: "Thương hiệu của mình",
    items: [
      { id: "seryn", label: "SERYN", icon: Sparkles },
    ],
  },
  {
    title: "Cấu hình & dữ liệu",
    items: [
      { id: "competitor-setup", label: "Cấu hình đối thủ", icon: Users },
      { id: "data-import", label: "Dữ liệu", icon: Upload },
    ],
  },
];

export default function Sidebar({ activeSection, setActiveSection, mobileOpen = false, onClose, canEdit = true }: SidebarProps) {
  // Viewer (chỉ xem): chỉ thấy 3 tab đầu.
  const groups = canEdit
    ? menuGroups
    : menuGroups
        .map((g) => ({ ...g, items: g.items.filter((it) => VIEWER_VIEW_IDS.includes(it.id)) }))
        .filter((g) => g.items.length > 0);

  const handleNav = (id: ViewId) => {
    setActiveSection(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
    onClose?.(); // đóng drawer sau khi chọn (mobile)
  };

  return (
    <>
      {/* Backdrop (chỉ mobile, khi drawer mở) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 max-w-[85vw] bg-white border-r border-slate-200 text-slate-800 flex flex-col fixed top-0 bottom-0 left-0 z-40 shadow-sm transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
        <img src="/seryn-mark.png" alt="SERYN" className="w-9 h-9 object-contain shrink-0" />
        <div className="min-w-0">
          <h1 className="font-brand text-2xl font-bold tracking-[0.18em] text-slate-900 leading-none">SERYN</h1>
          <p className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-bold mt-1">Competitor Intelligence</p>
        </div>
        {/* Nút đóng drawer (mobile) */}
        <button
          onClick={onClose}
          className="ml-auto lg:hidden w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 transition shrink-0"
          aria-label="Đóng menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav (grouped) */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {groups.map((group) => (
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
                    <span className="leading-tight text-left">{item.label}</span>
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
    </>
  );
}
