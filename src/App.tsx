import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import BrandDetailDrawer from "./components/BrandDetailDrawer";
import WeeklyReportModal from "./components/WeeklyReportModal";
import OverviewView from "./components/views/OverviewView";
import BrandsView from "./components/views/BrandsView";
import SerynView from "./components/views/SerynView";
import ReportsView from "./components/views/ReportsView";
import CompetitorSetupView from "./components/views/CompetitorSetupView";
import CompetitorDiscoveryView from "./components/views/CompetitorDiscoveryView";
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
import { fetchSupabaseSpyData, isSupabaseConfigured } from "./utils/supabaseData";
import { signOut, type AuthUser } from "./utils/auth";
import { syncDirectCompetitorsOnline } from "./utils/directCompetitors";

/** Nguồn online: ưu tiên Supabase; fallback Google Sheets (Apps Script). */
const USE_SUPABASE = isSupabaseConfigured();
const ONLINE_SOURCE: DataSourceType = USE_SUPABASE ? "online-supabase" : "online-sheet";
const ONLINE_NAME = USE_SUPABASE ? "Supabase" : "Google Sheets";
function onlineAvailable(): boolean {
  return USE_SUPABASE || !!getOnlineApiUrl();
}
async function fetchOnline(): Promise<SpyDashboardData> {
  return USE_SUPABASE ? fetchSupabaseSpyData() : fetchOnlineSpyData(getOnlineApiUrl());
}

const VALID_VIEWS: ViewId[] = [
  "overview",
  "brands",
  "seryn",
  "reports",
  "competitor-discovery",
  "competitor-setup",
  "data-import",
];

/** Viewer (chỉ xem) được vào các tab xem dữ liệu. Admin: tất cả. */
export const VIEWER_VIEWS: ViewId[] = ["overview", "brands", "seryn", "reports"];

/** Hash cũ -> view mới (tránh app trắng màn hình khi mở bookmark cũ). */
const VIEW_REDIRECTS: Partial<Record<string, ViewId>> = {
  "weekly-intelligence": "overview",
  "scaled-content": "brands",
  "top-hooks": "brands",
  "visual-intelligence": "brands",
  "ad-format-funnel": "brands",
  "weekly-changes": "brands",
  "market-research": "brands",
  "seryn-recommendations": "brands",
};

interface AppProps {
  /** User đã đăng nhập (null = chế độ demo không auth, khi chưa cấu hình Supabase). */
  auth: AuthUser | null;
}

export default function App({ auth }: AppProps) {
  // Quyền chỉnh sửa (nhập/xóa dữ liệu): admin — hoặc chế độ demo không auth.
  const canEdit = !auth || auth.role === "admin";
  const stored = loadSpyDataFromLocalStorage();
  const [spyData, setSpyData] = useState<SpyDashboardData>(stored ?? sampleSpyDashboardData);
  const [dataSource, setDataSource] = useState<DataSourceType>(stored ? (loadSourceType() ?? "local-csv") : "demo");
  const [activeSection, setActiveSection] = useState<ViewId>("overview");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer sidebar trên mobile
  const [reportOpen, setReportOpen] = useState(false); // bản xem trước báo cáo PDF

  // ONLINE DATA — ưu tiên Supabase (fallback Google Sheets).
  const onlineConfigured = USE_SUPABASE || isOnlineConfigured();
  const [onlineStatus, setOnlineStatus] = useState<string>("");
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);

  // Khi khởi động: tải lựa chọn "đối thủ trực tiếp" của admin từ Supabase
  // -> mọi người xem thấy cùng danh sách.
  useEffect(() => { void syncDirectCompetitorsOnline(); }, []);

  // Khi khởi động: nếu có nguồn online -> tự fetch (Supabase ưu tiên).
  // Lỗi -> fallback localStorage (OFFLINE CACHE) -> sample. Không crash app.
  useEffect(() => {
    if (!onlineAvailable()) return; // không có env -> giữ localStorage/sample như cũ
    let cancelled = false;
    (async () => {
      setIsOnlineLoading(true);
      setOnlineStatus(`Đang đồng bộ ${ONLINE_NAME}...`);
      try {
        const next = await fetchOnline();
        if (cancelled) return;
        setSpyData(next);
        saveSpyDataToLocalStorage(next);
        saveWeekToHistory(next);
        setDataSource(ONLINE_SOURCE);
        saveSourceType(ONLINE_SOURCE);
        setOnlineStatus(`Đã đồng bộ ${ONLINE_NAME} · ${new Date().toLocaleTimeString("vi-VN")}`);
      } catch (e: any) {
        if (cancelled) return;
        const cache = loadSpyDataFromLocalStorage();
        if (cache) {
          setSpyData(cache);
          setDataSource("offline-cache");
        }
        setOnlineStatus(`Không kết nối được ${ONLINE_NAME} (${e?.message || e}). Đang dùng dữ liệu ${cache ? "offline đã lưu" : "mẫu"}.`);
      } finally {
        if (!cancelled) setIsOnlineLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nút "Refresh Online Data" trong DataImportView.
  const handleRefreshOnline = async () => {
    if (!onlineAvailable()) {
      const msg = "Chưa cấu hình nguồn online (VITE_SUPABASE_URL hoặc VITE_GOOGLE_SHEETS_API_URL).";
      setOnlineStatus(msg);
      return { ok: false, msg };
    }
    setIsOnlineLoading(true);
    setOnlineStatus(`Đang đồng bộ ${ONLINE_NAME}...`);
    try {
      const next = await fetchOnline();
      setSpyData(next);
      saveSpyDataToLocalStorage(next);
      saveWeekToHistory(next);
      setDataSource(ONLINE_SOURCE);
      saveSourceType(ONLINE_SOURCE);
      const msg = `Đã cập nhật dữ liệu từ ${ONLINE_NAME}`;
      setOnlineStatus(`${msg} · ${new Date().toLocaleTimeString("vi-VN")}`);
      return { ok: true, msg };
    } catch (e: any) {
      const msg = `Không nạp được ${ONLINE_NAME}: ${e?.message || e}`;
      setOnlineStatus(msg);
      return { ok: false, msg };
    } finally {
      setIsOnlineLoading(false);
    }
  };

  // URL hash sync (open valid view from hash; default overview)
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.substring(1);
      const redirect = VIEW_REDIRECTS[hash];
      if (redirect) { window.location.hash = redirect; return; }
      // Viewer chỉ được vào 3 tab đầu (Tổng quan / Đối thủ / Báo cáo).
      const allowed = canEdit
        ? VALID_VIEWS.includes(hash as ViewId)
        : VIEWER_VIEWS.includes(hash as ViewId);
      setActiveSection(allowed ? (hash as ViewId) : "overview");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const goView = (id: ViewId) => {
    setActiveSection(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSidebarOpen(false); // đóng drawer sau khi điều hướng (mobile)
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
    <div className="min-h-screen bg-[#F5F0E8] text-slate-800 flex font-sans selection:bg-cyan-100 selection:text-cyan-900">
      <Sidebar
        activeSection={activeSection}
        setActiveSection={goView}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        canEdit={canEdit}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <TopHeader
          dataSource={dataSource}
          market="Vietnam"
          weekDate={weekDate}
          isOnlineLoading={isOnlineLoading}
          onImportClick={canEdit ? () => goView("data-import") : undefined}
          onClear={canEdit ? handleClear : undefined}
          onExportClick={() => setReportOpen(true)}
          onMenuClick={() => setSidebarOpen(true)}
          user={auth}
          onSignOut={auth ? () => signOut() : undefined}
        />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto pb-24">
          {activeSection === "overview" && <OverviewView data={spyData} onSelectBrand={setSelectedBrand} />}
          {activeSection === "brands" && <BrandsView data={spyData} onSelectBrand={setSelectedBrand} />}
          {activeSection === "seryn" && <SerynView data={spyData} onSelectBrand={setSelectedBrand} />}
          {activeSection === "reports" && <ReportsView data={spyData} />}
          {activeSection === "competitor-setup" && canEdit && <CompetitorSetupView data={spyData} />}
          {activeSection === "competitor-discovery" && canEdit && <CompetitorDiscoveryView data={spyData} />}
          {activeSection === "data-import" && canEdit && (
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

      <WeeklyReportModal
        open={reportOpen}
        data={spyData}
        dataSource={dataSource}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
