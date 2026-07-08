import React from "react";
import { Globe, Upload, Trash2, FlaskConical, FileSpreadsheet, Cloud, CloudOff, RefreshCw, Menu, FileDown, ShieldCheck, Eye, LogOut } from "lucide-react";
import type { DataSourceType } from "../types";
import { SOURCE_LABELS } from "../utils/spyData";
import type { AuthUser } from "../utils/auth";

interface TopHeaderProps {
  dataSource: DataSourceType;
  market?: string;
  weekDate?: string;
  isOnlineLoading?: boolean;
  /** Chỉ admin có — viewer không truyền (ẩn nút). */
  onImportClick?: () => void;
  /** Chỉ admin có — viewer không truyền (ẩn nút). */
  onClear?: () => void;
  /** Mở bản xem trước báo cáo PDF (gửi team). */
  onExportClick?: () => void;
  /** Mở sidebar drawer trên mobile. */
  onMenuClick?: () => void;
  /** User đang đăng nhập (null = chế độ demo không auth). */
  user?: AuthUser | null;
  onSignOut?: () => void;
}

const SOURCE_STYLE: Record<DataSourceType, { cls: string; Icon: any }> = {
  demo: { cls: "bg-amber-50 border-amber-200 text-amber-700", Icon: FlaskConical },
  "local-csv": { cls: "bg-emerald-50 border-emerald-200 text-emerald-700", Icon: FileSpreadsheet },
  "online-sheet": { cls: "bg-indigo-50 border-indigo-200 text-indigo-700", Icon: Cloud },
  "online-supabase": { cls: "bg-emerald-50 border-emerald-200 text-emerald-700", Icon: Cloud },
  "offline-cache": { cls: "bg-slate-100 border-slate-300 text-slate-600", Icon: CloudOff },
};

export default function TopHeader({ dataSource, market = "Vietnam", weekDate, isOnlineLoading = false, onImportClick, onClear, onExportClick, onMenuClick, user, onSignOut }: TopHeaderProps) {
  const src = SOURCE_STYLE[dataSource] || SOURCE_STYLE.demo;
  const SrcIcon = src.Icon;
  const isAdmin = user?.role === "admin";
  return (
    <header className="sticky top-0 z-20 w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 text-slate-800">
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* Hamburger — chỉ mobile/tablet */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 -ml-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 transition shrink-0"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="hidden sm:block text-[11px] font-semibold text-slate-400 font-mono tracking-wide">PHÂN TÍCH QUẢNG CÁO CẠNH TRANH</span>
          <p className="text-[15px] font-extrabold text-slate-900 truncate leading-tight">
            Quảng cáo đối thủ
            {weekDate ? <span className="text-slate-400 font-bold"> · tuần {weekDate}</span> : null}
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block" />

        <span
          className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-extrabold uppercase tracking-wider whitespace-nowrap ${src.cls}`}
          title="Nguồn dữ liệu đang hiển thị"
        >
          <SrcIcon className="w-3.5 h-3.5" />
          {SOURCE_LABELS[dataSource]}
        </span>

        {isOnlineLoading && (
          <span
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold"
            title="Đang đồng bộ dữ liệu từ Google Sheets"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Đang đồng bộ…
          </span>
        )}

        <span className="hidden lg:inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-bold whitespace-nowrap">
          <Globe className="w-3.5 h-3.5 text-cyan-600" />
          {market}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {onExportClick && (
          <button
            onClick={onExportClick}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-2.5 sm:px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-900 shadow-sm transition cursor-pointer"
            title="Xuất báo cáo PDF để gửi team"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xuất PDF</span>
          </button>
        )}
        {onClear && (
          <button
            onClick={onClear}
            className="flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-600 px-2.5 sm:px-3.5 py-2 rounded-xl text-sm font-bold border border-rose-200 transition cursor-pointer"
            title="Xóa dữ liệu đã lưu, về dữ liệu mẫu"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xóa dữ liệu</span>
          </button>
        )}
        {onImportClick && (
          <button
            onClick={onImportClick}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 sm:px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-cyan-600/20 hover:shadow-md hover:shadow-cyan-600/25 transition cursor-pointer"
            title="Nhập dữ liệu"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nhập dữ liệu</span>
          </button>
        )}

        {/* User đang đăng nhập + role + đăng xuất */}
        {user && (
          <div className="flex items-center gap-2 pl-2 sm:pl-2.5 ml-0.5 border-l border-slate-200">
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
                isAdmin ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
              title={user.email}
            >
              {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {isAdmin ? "Quản trị" : "Chỉ xem"}
            </span>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.email} title={user.email} className="w-8 h-8 rounded-full border border-slate-200 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[11px] font-extrabold text-cyan-700" title={user.email}>
                {user.email.slice(0, 2).toUpperCase()}
              </span>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition cursor-pointer"
                title={`Đăng xuất (${user.email})`}
                aria-label="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
