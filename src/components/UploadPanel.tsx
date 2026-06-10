import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileUp, 
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock
} from "lucide-react";
import { parseUploadedFile, normalizeToDashboardData } from "../utils/parser";
import { DashboardData } from "../types";

interface UploadPanelProps {
  onDataParsed: (data: DashboardData) => void;
  onParseError: (errStr: string) => void;
}

export default function UploadPanel({ onDataParsed, onParseError }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag listeners
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleContainerClick = () => {
    fileInputRef.current?.click();
  };

  // Parsing router core
  const processFile = async (file: File) => {
    setIsParsing(true);
    setErrorLocal(null);
    try {
      const rawData = await parseUploadedFile(file);
      const normalized = normalizeToDashboardData(rawData);
      onDataParsed(normalized);
    } catch (err: any) {
      const msg = err?.message || "Lỗi không xác định khi giải nén tệp tin.";
      setErrorLocal(msg);
      onParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  // Dynamic Template Injectors for easy testing
  const injectSampleMarkdown = () => {
    const md = `# Báo cáo Chiến dịch Marketing Hè Mỹ Phẩm 
**week_date: 2026-06-15 | Market: USA | Source: Google Campaign API**

---

## 1. Executive Summary
- Chiến dịch kéo dài 4 tuần đã thu hút hơn 25,000 lượt tham chiếu độc lập.
- Nguồn chuyển đổi lớn nhất đến từ tệp người trẻ genZ tại Los Angeles.

---

## 2. Market Ads Overview
| Thương hiệu | Dịch vụ chính | Ads Active | Trạng thái | Điểm số chuyển đổi |
|---|---|---|---|---|
| GlowSerum USA | facial_skincare | 90 | Active (Cao) | 8.5 |
| Brightening Co | organic_mask | 45 | Active (Mạnh) | 7.9 |
| SunProtect Glow | sunblock_uv | 12 | Inactive (0 Ads) | 4.2 |

---

## 3. Brand Insights
- GlowSerum USA đạt được lượng viral tự nhiên lớn trên TikTok.
- Brightening Co có mức rào cản giá tương đối cao.
`;
    const blob = new Blob([md], { type: "text/markdown" });
    const file = new File([blob], "summerskin_report.md", { type: "text/markdown" });
    processFile(file);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-150 flex items-center justify-center text-cyan-600">
          <FileUp className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">Tải lên file Báo Cáo Phân Tích (Live Parser)</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5 font-semibold">Tự động cấu trúc hóa, vẽ biểu đồ, chuẩn hóa JSON, sinh KPIs chỉ trong 1s</p>
        </div>
      </div>

      {/* Drag container */}
      <div 
        onClick={handleContainerClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging 
            ? "border-cyan-505 border-cyan-500 bg-cyan-50/50 shadow-xs" 
            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/40"
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange}
          accept=".md,.csv,.xlsx,.xls,.json,.txt"
          className="hidden" 
        />

        {isParsing ? (
          <div className="space-y-3">
            <RefreshCw className="w-10 h-10 text-cyan-600 mx-auto animate-spin" />
            <p className="text-sm font-extrabold text-slate-900">Đang đọc cấu trúc dữ liệu tệp tin...</p>
            <p className="text-xs text-slate-500 font-mono font-semibold">Giải mã định dạng, phân loại chỉ số số học & trích xuất observed insights</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-500 shadow-xs">
              <Upload className="w-6 h-6 text-cyan-600" />
            </div>
            
            <div>
              <p className="text-sm font-extrabold text-slate-800">Click để chọn hoặc kéo sản phẩm báo cáo vào đây</p>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Hỗ trợ định dạng kéo dài: <span className="font-extrabold text-cyan-600 bg-cyan-50 rounded px-1 border border-cyan-100">Markdown (.md)</span>, <span className="font-extrabold text-cyan-600 bg-cyan-50 rounded px-1 border border-cyan-100">CSV (.csv)</span>, <span className="font-extrabold text-cyan-600 bg-cyan-50 rounded px-1 border border-cyan-100">Excel (.xlsx)</span>, <span className="font-extrabold text-cyan-600 bg-cyan-50 rounded px-1 border border-cyan-100">JSON (.json)</span>, <span className="font-extrabold text-cyan-600 bg-cyan-50 rounded px-1 border border-cyan-100">Text (.txt)</span>.
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-white px-3 py-1.5 rounded border border-slate-200 mx-auto shadow-2xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-cyan-600" />
              <span>Phục chế tự động - Đảm bảo không crash nếu thiếu cột trống</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Panel */}
      {errorLocal && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-extrabold text-rose-800">Không thể parse report</p>
            <p className="text-xs font-mono text-rose-700 leading-relaxed mt-0.5 font-semibold">{errorLocal}</p>
          </div>
        </div>
      )}

      {/* Quick Test Zone */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-widest font-mono flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-505 text-indigo-600" />
            Bảng thử nghiệm nhanh (Quick play)
          </span>
          <span className="text-[10px] font-mono text-slate-500 font-bold">Phục vụ kiểm định lập trình viên</span>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed font-semibold">
          Nếu chưa có sẵn file report trên máy tính cá nhân, hãy bấm nút bên dưới để tạo ngẫu nhiên một file Markdown chiến dịch bán hàng mẫu đạt chuẩn quốc tế:
        </p>
        <button
          onClick={injectSampleMarkdown}
          className="w-full md:w-auto flex items-center justify-center gap-2 text-xs font-extrabold text-cyan-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl py-2.5 px-4 cursor-pointer shadow-2xs transition duration-300"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
          <span>Nạp Báo cáo mẫu Markdown Hè USA</span>
        </button>
      </div>
    </div>
  );
}
