import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import BrandDetailDrawer from "./components/BrandDetailDrawer";
import OverviewView from "./components/views/OverviewView";
import BrandsView from "./components/views/BrandsView";
import ScaledContentView from "./components/views/ScaledContentView";
import WeeklyChangesView from "./components/views/WeeklyChangesView";
import SerynRecommendationsView from "./components/views/SerynRecommendationsView";
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

const VALID_VIEWS: ViewId[] = [
  "overview",
  "brands",
  "scaled-content",
  "weekly-changes",
  "seryn-recommendations",
  "data-import",
];

export default function App() {
  const stored = loadSpyDataFromLocalStorage();
  const [spyData, setSpyData] = useState<SpyDashboardData>(stored ?? sampleSpyDashboardData);
  const [dataSource, setDataSource] = useState<DataSourceType>(stored ? (loadSourceType() ?? "local-csv") : "demo");
  const [activeSection, setActiveSection] = useState<ViewId>("overview");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

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
      <Sidebar activeSection={activeSection} setActiveSection={goView} weekDate={weekDate} />

      <div className="flex-1 pl-64 flex flex-col min-h-screen">
        <TopHeader
          dataSource={dataSource}
          market="Vietnam"
          weekDate={weekDate}
          onImportClick={() => goView("data-import")}
          onClear={handleClear}
        />

        <main className="p-8 flex-1 max-w-7xl w-full mx-auto pb-24">
          {activeSection === "overview" && <OverviewView data={spyData} />}
          {activeSection === "brands" && <BrandsView data={spyData} onSelectBrand={setSelectedBrand} />}
          {activeSection === "scaled-content" && <ScaledContentView data={spyData} />}
          {activeSection === "weekly-changes" && <WeeklyChangesView data={spyData} />}
          {activeSection === "seryn-recommendations" && <SerynRecommendationsView data={spyData} />}
          {activeSection === "data-import" && (
            <DataImportView
              data={spyData}
              dataSource={dataSource}
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
