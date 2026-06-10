import React, { useState, useEffect } from "react";
import { 
  Layers, 
  ArrowUp, 
  ArrowDown, 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  Sparkles,
  HelpCircle,
  Eye,
  History,
  Info
} from "lucide-react";
import { ComparisonDiff } from "../utils/diff";

interface ComparisonPanelProps {
  isBaseline: boolean;
  comparisonHistoryList?: Array<{
    id: string;
    timestamp: string;
    prevTitle: string;
    nextTitle: string;
    diff: ComparisonDiff;
  }>;
}

export default function ComparisonPanel({ isBaseline, comparisonHistoryList = [] }: ComparisonPanelProps) {
  const [selectedCompareId, setSelectedCompareId] = useState<string>("");

  // Automatically select the newest dynamic scan when it gets added to the history list
  useEffect(() => {
    if (comparisonHistoryList && comparisonHistoryList.length > 0) {
      setSelectedCompareId(comparisonHistoryList[0].id);
    } else {
      setSelectedCompareId("");
    }
  }, [comparisonHistoryList]);

  // Clean empty diff structure
  const emptyDiff: ComparisonDiff = {
    increased: [],
    decreased: [],
    newItems: [],
    removedItems: [],
    strategicChanges: [],
    hasChanges: false
  };

  // Resolve the active diff block to display
  let activeDiff: ComparisonDiff = emptyDiff;
  let activeMeta = {
    type: "none",
    title: "Chưa có dữ liệu so sánh",
    desc: "Vui lòng chạy Quét Live đối thủ ở mục 'Danh sách đối thủ' hoặc tải lên tệp tin mới để bắt đầu đối chiếu."
  };

  if (selectedCompareId && selectedCompareId !== "") {
    const historical = comparisonHistoryList.find(item => item.id === selectedCompareId);
    if (historical) {
      activeDiff = historical.diff;
      activeMeta = {
        type: "dynamic",
        title: `Quét trực tuyến: Kết quả phân tích lúc ${historical.timestamp}`,
        desc: `Báo cáo so khớp tự động giữa Baseline và dữ liệu sau Quét đối thủ.`
      };
    }
  }

  const hasAnyRecords = comparisonHistoryList.length > 0;
  const showEmptyState = !hasAnyRecords;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">So Sánh Thay Đổi (Comparison Tracker)</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5 font-semibold">Theo dõi dịch chuyển ngân sách và xu hướng thông điệp liên tuần</p>
          </div>
        </div>

        {/* History Selectors & Toggles */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {hasAnyRecords && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCompareId}
                onChange={(e) => setSelectedCompareId(e.target.value)}
                className="bg-transparent border-none text-xs font-bold font-sans text-cyan-800 outline-none cursor-pointer focus:ring-0"
              >
                <optgroup label="Dữ liệu Quét trực tuyến thực tế">
                  {comparisonHistoryList.map(item => (
                    <option key={item.id} value={item.id}>
                      🕒 {item.timestamp} ({item.diff.increased.length + item.diff.newItems.length + item.diff.removedItems.length} đổi thay)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>
      </div>

      {showEmptyState ? (
        // Standard baseline empty state requested by the user
        <div className="p-10 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center flex flex-col items-center justify-center">
          <HelpCircle className="w-8 h-8 text-indigo-400 mb-3 animate-bounce" />
          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-1.5"> Sẵn sàng theo dõi biến động </h4>
          <p className="text-sm text-slate-650 max-w-sm mx-auto leading-relaxed font-semibold">
            Chưa phát hiện bản quét đối sánh nào. Bấm nút quét đối thủ hoặc tải file báo cáo tuần mới lên để xem so sánh.
          </p>
          <div className="mt-5 max-w-sm text-xs text-slate-600 bg-white p-4 rounded-lg border border-slate-200 text-left font-mono space-y-1.5 shadow-xs">
            <p className="font-extrabold text-slate-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              Tính năng so sánh tự động:
            </p>
            <p>• Tải báo cáo tuần kế tiếp lên để đối chiếu.</p>
            <p>• Nhấn quét live đối thủ để lưu phiên bản hiện tại & so khớp chéo.</p>
            <p>• Chỉ ra tức thì mức tăng/giảm số ads, thương hiệu mới, quảng cáo dừng chạy.</p>
          </div>
        </div>
      ) : (
        // WoW or Dynamic comparison state
        <div className="space-y-6">
          {/* Info Banner */}
          <div className={`border rounded-xl p-4 flex items-center justify-between shadow-xs ${
            activeMeta.type === "dynamic" 
              ? "bg-emerald-50/60 border-emerald-100" 
              : "bg-cyan-50 border-cyan-100"
          }`}>
            <div className="flex gap-2">
              <TrendingUp className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${
                activeMeta.type === "dynamic" ? "text-emerald-600" : "text-cyan-600"
              }`} />
              <div>
                <p className="text-sm font-extrabold text-slate-900">{activeMeta.title}</p>
                <p className="text-xs text-slate-600 font-mono font-medium">{activeMeta.desc}</p>
              </div>
            </div>
            {activeMeta.type === "dynamic" && (
              <span className="text-[10px] bg-emerald-100 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-mono font-extrabold">LIVE SCAN</span>
            )}
          </div>

          {!activeDiff.hasChanges ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Không có biến động đáng kể nào được phát hiện! 👍</p>
              <p className="text-xs text-slate-500 mt-1">Lượng Ads Active và thông tin các đối thủ vừa quét hoàn toàn khớp với phiên bản trước.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Increases */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                  Chỉ số tăng (What increased)
                </h4>
                <div className="space-y-2">
                  {activeDiff.increased.length === 0 ? (
                    <p className="text-xs text-slate-450 text-slate-405 font-medium italic p-2 text-center">Không ghi nhận tăng</p>
                  ) : (
                    activeDiff.increased.map((inc, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-white p-3 rounded border border-slate-200/60">
                        <div>
                          <p className="font-extrabold text-slate-800 text-xs">{inc.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{inc.metric}</p>
                        </div>
                        <span className="text-[10.5px] font-extrabold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">
                          {inc.change} ad (từ {inc.from} → {inc.to})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Decreases */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <ArrowDown className="w-3.5 h-3.5 text-rose-500" />
                  Chỉ số giảm (What decreased)
                </h4>
                <div className="space-y-2">
                  {activeDiff.decreased.length === 0 ? (
                    <p className="text-xs text-slate-450 text-slate-405 font-medium italic p-2 text-center">Không ghi nhận giảm</p>
                  ) : (
                    activeDiff.decreased.map((dec, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-white p-3 rounded border border-slate-200/60">
                        <div>
                          <p className="font-extrabold text-slate-800 text-xs">{dec.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{dec.metric}</p>
                        </div>
                        <span className="text-[10.5px] font-extrabold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-150">
                          {dec.change} ad (từ {dec.from} → {dec.to})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* New Brands / Items */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-550" />
                  Mẫu quảng cáo mới (New items)
                </h4>
                <div className="space-y-2">
                  {activeDiff.newItems.length === 0 ? (
                    <p className="text-xs text-slate-450 text-slate-405 font-medium italic p-2 text-center">Không ghi nhận thêm mới</p>
                  ) : (
                    activeDiff.newItems.map((item, index) => (
                      <div key={index} className="text-xs bg-white p-3.5 rounded border border-slate-200 space-y-1">
                        <p className="font-extrabold text-slate-800">{item.name}</p>
                        <p className="text-slate-600 leading-relaxed font-sans font-medium">{item.details}</p>
                        <p className="text-[9px] text-slate-400 font-mono">Phát hiện: {item.date}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Removed Items */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
                  Quảng cáo dừng chạy (Removed items)
                </h4>
                <div className="space-y-2">
                  {activeDiff.removedItems.length === 0 ? (
                    <p className="text-xs text-slate-455 text-slate-405 font-medium italic p-2 text-center">Không ghi nhận dừng chạy</p>
                  ) : (
                    activeDiff.removedItems.map((item, index) => (
                      <div key={index} className="text-xs bg-white p-3.5 rounded border border-slate-200 text-left">
                        <p className="font-extrabold text-slate-800">{item.name}</p>
                        <p className="text-slate-600 mt-1 leading-relaxed font-sans font-medium">{item.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Strategic Shifts */}
          {activeDiff.strategicChanges.length > 0 && (
            <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Chuyển dịch thông điệp chiến lược (Strategic changes)
              </h4>
              <div className="space-y-2">
                {activeDiff.strategicChanges.map((item, index) => (
                  <div key={index} className="text-xs bg-white p-4.5 rounded border border-slate-200/90 space-y-1">
                    <p className="font-extrabold text-cyan-700 font-mono text-[10px] uppercase tracking-wide">{item.category}</p>
                    <p className="text-slate-700 leading-relaxed font-sans font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
