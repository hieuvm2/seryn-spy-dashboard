import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import BrandDetailDrawer from "./components/BrandDetailDrawer";
import OverviewView from "./components/views/OverviewView";
import BrandsView from "./components/views/BrandsView";
import ScaledContentView from "./components/views/ScaledContentView";
import HookIntelligenceView from "./components/views/HookIntelligenceView";
import VisualIntelligenceView from "./components/views/VisualIntelligenceView";
import WeeklyChangesView from "./components/views/WeeklyChangesView";
import SerynRecommendationsView from "./components/views/SerynRecommendationsView";
import CompetitorSetupView from "./components/views/CompetitorSetupView";
import WeeklyIntelligenceView from "./components/views/WeeklyIntelligenceView";
import MarketResearchView from "./components/views/MarketResearchView";
import CompetitorDiscoveryView from "./components/views/CompetitorDiscoveryView";
import AdFormatFunnelView from "./components/views/AdFormatFunnelView";
import DataImportView from "./components/views/DataImportView";

import { sampleSpyDashboardData } from "./sampleData";
import type { SpyDashboardData, ViewId, DataSourceType } from "./types";
import {
  loadSpyDataFromLocalStorage,
  saveSpyDataToLocalStorage,
  clearSpyDataLocalStorage,
  saveWeekToHistory,
  loadSourceType,
  saveSourceType,
  clearSourceType,
} from "./utils/spyData";
import { fetchOnlineSpyData, getOnlineApiUrl, isOnlineConfigured } from "./utils/onlineData";

const VALID_VIEWS: ViewId[] = [
  "overview",
  "brands",
  "scaled-content",
  "top-hooks",
  "visual-intelligence",
  "weekly-changes",
  "seryn-recommendations",
  "weekly-intelligence",
  "competitor-setup",
  "market-research",
  "competitor-discovery",
  "ad-format-funnel",
  "data-import",
];

export default function App() {
  const stored = loadSpyDataFromLocalStorage();
  const [spyData, setSpyData] = useState<SpyDashboardData>(stored ?? sampleSpyDashboardData);
  const [dataSource, setDataSource] = useState<DataSourceType>(stored ? (loadSourceType() ?? "local-csv") : "demo");
  const [activeSection, setActiveSection] = useState<ViewId>("overview");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // ONLINE SHEET DATA — trạng thái đồng bộ Google Sheets.
  const onlineConfigured = isOnlineConfigured();
  const [onlineStatus, setOnlineStatus] = useState<string>("");
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);

  // Khi khởi động: nếu có VITE_GOOGLE_SHEETS_API_URL -> tự fetch online.
  // Lỗi -> fallback localStorage (OFFLINE CACHE) -> sample. Không crash app.
  useEffect(() => {
    const apiUrl = getOnlineApiUrl();
    if (!apiUrl) return; // không có env -> giữ localStorage/sample như cũ
    let cancelled = false;
    (async () => {
      setIsOnlineLoading(true);
      setOnlineStatus("Syncing Google Sheets...");
      try {
        const next = await fetchOnlineSpyData(apiUrl);
        if (cancelled) return;
        setSpyData(next);
        saveSpyDataToLocalStorage(next);
        saveWeekToHistory(next);
        setDataSource("online-sheet");
        saveSourceType("online-sheet");
        setOnlineStatus(`Đã đồng bộ Google Sheets · ${new Date().toLocaleTimeString("vi-VN")}`);
      } catch (e: any) {
        if (cancelled) return;
        const cache = loadSpyDataFromLocalStorage();
        if (cache) {
          setSpyData(cache);
          setDataSource("offline-cache");
        }
        setOnlineStatus(`Không kết nối được Google Sheets (${e?.message || e}). Đang dùng dữ liệu ${cache ? "offline đã lưu" : "mẫu"}.`);
      } finally {
        if (!cancelled) setIsOnlineLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nút "Refresh Online Data" trong DataImportView.
  const handleRefreshOnline = async () => {
    const apiUrl = getOnlineApiUrl();
    if (!apiUrl) {
      const msg = "Missing VITE_GOOGLE_SHEETS_API_URL";
      setOnlineStatus(msg);
      return { ok: false, msg };
    }
    setIsOnlineLoading(true);
    setOnlineStatus("Syncing Google Sheets...");
    try {
      const next = await fetchOnlineSpyData(apiUrl);
      setSpyData(next);
      saveSpyDataToLocalStorage(next);
      saveWeekToHistory(next);
      setDataSource("online-sheet");
      saveSourceType("online-sheet");
      const msg = "Đã cập nhật dữ liệu từ Google Sheets";
      setOnlineStatus(`${msg} · ${new Date().toLocaleTimeString("vi-VN")}`);
      return { ok: true, msg };
    } catch (e: any) {
      const msg = `Không nạp được Google Sheets: ${e?.message || e}`;
      setOnlineStatus(msg);
      return { ok: false, msg };
    } finally {
      setIsOnlineLoading(false);
    }
  };

  // URL hash sync (open valid view from hash; default overview)
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.substring(1) as ViewId;
      setActiveSection(VALID_VIEWS.includes(hash) ? hash : "overview");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const goView = (id: ViewId) => {
    setActiveSection(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDataChange = (next: SpyDashboardData, source: DataSourceType = "local-csv") => {
    setSpyData(next);
    saveSpyDataToLocalStorage(next);
    saveWeekToHistory(next); // lưu lịch sử theo week_date
    setDataSource(source);
    saveSourceType(source);
  };

  const handleLoadSample = () => {
    clearSpyDataLocalStorage();
    clearSourceType();
    setSpyData(sampleSpyDashboardData);
    saveWeekToHistory(sampleSpyDashboardData);
    setDataSource("demo");
  };

  const handleClear = () => {
    clearSpyDataLocalStorage();
    clearSourceType();
    setSpyData(sampleSpyDashboardData);
    setDataSource("demo");
  };

  const weekDate = spyData.brandWeeklySnapshot[0]?.week_date;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex font-sans selection:bg-cyan-100 selection:text-cyan-900">
      <Sidebar activeSection={activeSection} setActiveSection={goView} />

      <div className="flex-1 pl-64 flex flex-col min-h-screen">
        <TopHeader
          dataSource={dataSource}
          market="Vietnam"
          weekDate={weekDate}
          isOnlineLoading={isOnlineLoading}
          onImportClick={() => goView("data-import")}
          onClear={handleClear}
        />

        <main className="p-8 flex-1 max-w-7xl w-full mx-auto pb-24">
          {activeSection === "overview" && <OverviewView data={spyData} />}
          {activeSection === "brands" && <BrandsView data={spyData} onSelectBrand={setSelectedBrand} />}
          {activeSection === "scaled-content" && <ScaledContentView data={spyData} />}
          {activeSection === "top-hooks" && <HookIntelligenceView data={spyData} />}
          {activeSection === "visual-intelligence" && <VisualIntelligenceView data={spyData} />}
          {activeSection === "weekly-changes" && <WeeklyChangesView data={spyData} />}
          {activeSection === "seryn-recommendations" && <SerynRecommendationsView data={spyData} />}
          {activeSection === "weekly-intelligence" && <WeeklyIntelligenceView data={spyData} />}
          {activeSection === "competitor-setup" && <CompetitorSetupView />}
          {activeSection === "market-research" && <MarketResearchView data={spyData} />}
          {activeSection === "competitor-discovery" && <CompetitorDiscoveryView data={spyData} />}
          {activeSection === "ad-format-funnel" && <AdFormatFunnelView data={spyData} />}
          {activeSection === "data-import" && (
            <DataImportView
              data={spyData}
              dataSource={dataSource}
              onlineConfigured={onlineConfigured}
              onlineStatus={onlineStatus}
              isOnlineLoading={isOnlineLoading}
              onRefreshOnline={handleRefreshOnline}
              onDataChange={handleDataChange}
              onLoadSample={handleLoadSample}
              onClear={handleClear}
            />
          )}
        </main>
      </div>

      <BrandDetailDrawer
        brandName={selectedBrand}
        data={spyData}
        open={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
      />
    </div>
  );
}
