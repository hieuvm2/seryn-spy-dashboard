import { DashboardData } from "../types";

export interface ComparisonDiff {
  increased: Array<{ name: string; metric: string; from: number; to: number; change: string }>;
  decreased: Array<{ name: string; metric: string; from: number; to: number; change: string }>;
  newItems: Array<{ name: string; details: string; date: string }>;
  removedItems: Array<{ name: string; details: string }>;
  strategicChanges: Array<{ category: string; text: string }>;
  hasChanges: boolean;
}

export function generateComparisonDiff(prev: DashboardData, next: DashboardData): ComparisonDiff {
  const increased: ComparisonDiff["increased"] = [];
  const decreased: ComparisonDiff["decreased"] = [];
  const newItems: ComparisonDiff["newItems"] = [];
  const removedItems: ComparisonDiff["removedItems"] = [];
  const strategicChanges: ComparisonDiff["strategicChanges"] = [];

  const getNumValue = (v: any): number => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const cleanStr = String(v).replace(/[^0-9]/g, "");
    const parsed = parseInt(cleanStr, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper to find metric matching common keys
  const getAdsLimitMetric = (metrics: Record<string, string | number>): number => {
    const keys = ["Lượng Ads Active", "Ads Active", "Lượng Ads", "Total Ads", "Số lượng Ads"];
    for (const k of keys) {
      if (metrics[k] !== undefined) {
        return getNumValue(metrics[k]);
      }
    }
    // fall back to first key containing "ads"
    for (const [k, v] of Object.entries(metrics)) {
      if (k.toLowerCase().includes("ads")) {
        return getNumValue(v);
      }
    }
    return 0;
  };

  // Map entities
  const prevMap = new Map();
  prev.entities.forEach(e => {
    if (e && e.name) prevMap.set(e.name.toLowerCase(), e);
  });

  const nextMap = new Map();
  next.entities.forEach(e => {
    if (e && e.name) nextMap.set(e.name.toLowerCase(), e);
  });

  // 1. Check next entities for additions and modifications
  next.entities.forEach(nextEnt => {
    if (!nextEnt || !nextEnt.name) return;
    
    const prevEnt = prevMap.get(nextEnt.name.toLowerCase());
    const nextAds = getAdsLimitMetric(nextEnt.metrics);

    if (!prevEnt) {
      // Completely new brand or reactivated brand
      if (nextAds > 0) {
        newItems.push({
          name: nextEnt.name,
          details: `Phát hiện đối thủ mới hoặc kích hoạt lại chiến dịch quảng cáo với ${nextAds} ads hoạt động. Evergreen format: ${nextEnt.metrics["Evergreen Format"] || nextEnt.category || "Chưa xác định"}.`,
          date: new Date().toLocaleDateString("vi-VN")
        });
      }
    } else {
      // Exists in both! Compare ads value
      const prevAds = getAdsLimitMetric(prevEnt.metrics);
      if (nextAds !== prevAds) {
        if (nextAds > prevAds) {
          increased.push({
            name: nextEnt.name,
            metric: "Lượng Ads Active",
            from: prevAds,
            to: nextAds,
            change: `+${nextAds - prevAds}`
          });
        } else if (nextAds < prevAds) {
          decreased.push({
            name: nextEnt.name,
            metric: "Lượng Ads Active",
            from: prevAds,
            to: nextAds,
            change: `${nextAds - prevAds}`
          });
        }
      }

      // Check summary or observed insights for strategic differences
      if (nextEnt.summary !== prevEnt.summary && nextEnt.summary) {
        strategicChanges.push({
          category: nextEnt.name,
          text: `Cập nhật định vị truyền thông: ${nextEnt.summary}`
        });
      } else if (nextEnt.status !== prevEnt.status && nextEnt.status) {
        strategicChanges.push({
          category: nextEnt.name,
          text: `Trạng thái hoạt động thay đổi từ "${prevEnt.status}" thành "${nextEnt.status}".`
        });
      }
    }
  });

  // 2. Check previous entities for removals
  prev.entities.forEach(prevEnt => {
    if (!prevEnt || !prevEnt.name) return;
    
    const nextEnt = nextMap.get(prevEnt.name.toLowerCase());
    const prevAds = getAdsLimitMetric(prevEnt.metrics);

    if (prevAds > 0) {
      if (!nextEnt || getAdsLimitMetric(nextEnt.metrics) === 0) {
        removedItems.push({
          name: prevEnt.name,
          details: `Tạm dừng toàn bộ chiến dịch quảng cáo kỹ thuật số (trước mắt hạ toàn bộ ${prevAds} bài Ads hoặc chuyển đổi ngân sách ngoại tuyến).`
        });
      }
    }
  });

  // 3. Fallback mock strategic updates if there are changes but strategicChanges is empty
  const hasChanges = increased.length > 0 || decreased.length > 0 || newItems.length > 0 || removedItems.length > 0 || strategicChanges.length > 0;

  if (hasChanges && strategicChanges.length === 0) {
    if (increased.length > 0) {
      const topInc = increased[0];
      strategicChanges.push({
        category: topInc.name,
        text: `Tăng cường độ phủ của thông điệp, bứt tốc ngân sách thúc đẩy tin nhắn với thêm ${topInc.change} bài ads live mới.`
      });
    }
    if (newItems.length > 0) {
      const topNew = newItems[0];
      strategicChanges.push({
        category: topNew.name,
        text: `Chính thức kích hoạt tài nguyên số, đẩy liên tiếp ads phễu nâng cơ nhằm chia thị phần tệp khách trung tuổi.`
      });
    }
  }

  return {
    increased,
    decreased,
    newItems,
    removedItems,
    strategicChanges,
    hasChanges
  };
}
