import React, { useState, useEffect } from "react";
import { Key, Save, Trash2, Eye, EyeOff, ShieldCheck, HelpCircle, CheckCircle2 } from "lucide-react";

export default function ApiConfigTab() {
  const [apiKey, setApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Load key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("seryn_scrapecreators_api_key") || "";
    setApiKey(savedKey);
  }, []);

  const handleSave = () => {
    try {
      const trimmedKey = apiKey.trim();
      localStorage.setItem("seryn_scrapecreators_api_key", trimmedKey);
      setApiKey(trimmedKey);
      setStatusMessage({
        text: trimmedKey 
          ? "Đã lưu API Key của ScrapeCreators thành công! Khi thực hiện 'Quét Ads', hệ thống sẽ áp dụng key này." 
          : "Đã xóa API Key thành công. Hệ thống sẽ sử dụng dữ liệu Sandbox nếu không còn Key nào.",
        type: "success"
      });
      // Clear alert after 4 seconds
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setStatusMessage({
        text: "Không thể lưu API Key vào trình duyệt cơ sở dữ liệu.",
        type: "error"
      });
    }
  };

  const handleClear = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa API Key đã cấu hình không?")) {
      localStorage.removeItem("seryn_scrapecreators_api_key");
      setApiKey("");
      setStatusMessage({
        text: "Đã xóa sạch API Key khỏi trình duyệt.",
        type: "info"
      });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-1.5 border-l-2 border-cyan-500 pl-4">
        <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">CẤU HÌNH HỆ THỐNG</span>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Cấu hình API Credentials</h2>
        <p className="text-sm text-slate-600 leading-relaxed font-medium">
          Thiết lập khóa truy cập ScrapeCreators nhằm dò quét các tin đăng quảng cáo Facebook Ads Library thời gian thực của đối thủ.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs max-w-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">ScrapeCreators API Key</h3>
            <p className="text-xs text-slate-500 font-medium">Khóa kích hoạt cào dữ liệu Meta Ads Library</p>
          </div>
        </div>

        {/* Status Message Notification banner */}
        {statusMessage && (
          <div className={`p-4 rounded-xl text-xs font-semibold border flex items-start gap-2.5 transition-all ${
            statusMessage.type === "success" 
              ? "bg-emerald-50 border-emerald-150 text-emerald-800"
              : statusMessage.type === "error"
              ? "bg-rose-50 border-rose-150 text-rose-800"
              : "bg-cyan-50 border-cyan-150 text-cyan-800"
          }`}>
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Form control */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            API Token
          </label>
          <div className="relative rounded-xl shadow-xs">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Nhập ScrapeCreators token tại đây (ví dụ: sc_sk_...)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:bg-white text-sm font-mono transition"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed flex items-center gap-1.5 mt-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Lưu ý: Token được lưu trực tiếp tại Cookie/LocalStorage trình duyệt của bạn, đảm bảo tính bảo mật tối đa.</span>
          </p>
        </div>

        {/* Action Group Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition shadow-xs focus:ring-2 focus:ring-cyan-500/30 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Cấu Hình</span>
            </button>
            {apiKey && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3.5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition hover:text-rose-600 hover:border-rose-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Key</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <ShieldCheck className={`w-4 h-4 ${apiKey ? "text-emerald-500" : "text-slate-300"}`} />
            <span>Trạng thái: {apiKey ? <span className="text-emerald-600 font-extrabold font-mono text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">ĐÃ THIẾT LẬP</span> : <span className="text-slate-500 font-bold">Chưa cấu hình</span>}</span>
          </div>
        </div>
      </div>

      {/* Extra helper panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 max-w-2xl space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">Tìm hiểu về ScrapeCreators API</h4>
        <div className="space-y-2 text-xs text-slate-600 leading-relaxed font-medium">
          <p>
            Hệ thống <strong>SERYN INTEL</strong> sử dụng dịch vụ trung gian <strong>ScrapeCreators API</strong> để gửi câu lệnh truy vấn thời gian thực tới kho lưu trữ công khai của Facebook (Meta Ads Library).
          </p>
          <p>
            Nếu không thiết lập API Key tại đây, hệ thống sẽ tự động kích hoạt tính năng <strong>Sandbox Mock Fallback</strong> giả lập dữ liệu cấu trúc mẫu đối với 13 thương hiệu để giúp bạn dễ dàng trải nghiệm bản demo của ứng dụng mà không gặp gián đoạn.
          </p>
          <p>
            Mọi cấu hình định vị, bóc tách nến tảng y khoa, phân tích chiến thuật marketing dồi dào sau đó sẽ được đảm nhận bởi mô hình trí tuệ nhân tạo <strong>Gemini AI (models/gemini-3.5-flash)</strong> được cấu hình bí mật tại Server của bạn.
          </p>
        </div>
      </div>
    </div>
  );
}
