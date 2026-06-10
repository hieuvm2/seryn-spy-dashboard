import React from "react";
import { Globe, Upload, Trash2, FlaskConical, FolderOpen, FileSpreadsheet, Cloud } from "lucide-react";
import type { DataSourceType } from "../types";
import { SOURCE_LABELS } from "../utils/spyData";

interface TopHeaderProps {
  dataSource: DataSourceType;
  market?: string;
  weekDate?: string;
  onImportClick: () => void;
  onClear: () => void;
}

const SOURCE_STYLE: Record<DataSourceType, { cls: string; Icon: any }> = {
  demo: { cls: "bg-amber-50 border-amber-200 text-amber-700", Icon: FlaskConical },
  "local-csv": { cls: "bg-emerald-50 border-emerald-200 text-emerald-700", Icon: FileSpreadsheet },
  "local-folder": { cls: "bg-cyan-50 border-cyan-200 text-cyan-700", Icon: FolderOpen },
  "online-sheet": { cls: "bg-indigo-50 border-indigo-200 text-indigo-700", Icon: Cloud },
};

export default function TopHeader({ dataSource, market = "Vietnam", weekDate, onImportClick, onClear }: TopHeaderProps) {
  const src = SOURCE_STYLE[dataSource] || SOURCE_STYLE.demo;
  const SrcIcon = src.Icon;
  return (
    <header className="sticky top-0 z-20 w-full h-16 bg-white/85 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between text-slate-800">
      <div className="flex items-center gap-4 max-w-[62%] truncate">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 font-mono">SERYN — Tình báo quảng cáo đối thủ theo tuần</span>
          <p className="text-base font-extrabold text-slate-900 truncate">
            Theo dõi quảng cáo đối thủ {weekDate ? <span className="text-slate-400 font-bold">· tuần {weekDate}</span> : null}
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block" />

        <span
          className={`hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-extrabold uppercase tracking-widest ${src.cls}`}
          title="Nguồn dữ liệu đang hiển thị"
        >
          <SrcIcon className="w-3.5 h-3.5" />
          {SOURCE_LABELS[dataSource]}
        </span>

        <span className="hidden lg:inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 px-2.5 py-1 rounded border border-slate-200 text-xs font-bold">
          <Globe className="w-3.5 h-3.5 text-cyan-600" />
          {market}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onClear}
          className="flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-600 px-3.5 py-2 rounded-xl text-sm font-bold border border-rose-200 transition cursor-pointer"
          title="Xóa dữ liệu đã lưu, về dữ liệu mẫu"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Xóa dữ liệu</span>
        </button>
        <button
          onClick={onImportClick}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:shadow transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Nhập dữ liệu</span>
        </button>
      </div>
    </header>
  );
}
