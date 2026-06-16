import React, { useMemo } from "react";
import { LayoutGrid, Filter, BarChart3, GitCompare, Lightbulb, Info } from "lucide-react";
import type { SpyDashboardData, AdLevelAnalysis, BrandWeeklySnapshot, WeeklyChangeInsight } from "../../types";

const SC = "skin_rejuvenation";
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (v: unknown) => `${Math.round(num(v) * 100)}%`;

const FORMAT_CHANGE_TYPES = new Set([
  "format_mix_changed", "video_usage_increased", "image_usage_increased",
]);
const FUNNEL_CHANGE_TYPES = new Set([
  "objective_mix_changed", "messenger_usage_increased", "landing_page_usage_increased",
  "skin_rejuvenation_offer_shift",
]);

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className="w-4.5 h-4.5 text-cyan-600" />
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
      </div>
      {desc && <p className="text-xs text-slate-500 mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const w = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-slate-600 font-semibold">{label}</span>
      <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="w-16 text-right text-slate-500 tabular-nums">{value} · {w}%</span>
    </div>
  );
}

export default function AdFormatFunnelView({ data }: { data: SpyDashboardData }) {
  const ads = useMemo<AdLevelAnalysis[]>(
    () => (data.adLevelAnalysis ?? []).filter((a) => a.service_category === SC),
    [data.adLevelAnalysis],
  );
  const snaps = useMemo<BrandWeeklySnapshot[]>(
    () => (data.brandWeeklySnapshot ?? []).filter((s) => num(s.skin_rejuvenation_ads_count) > 0),
    [data.brandWeeklySnapshot],
  );
  const insights = useMemo<WeeklyChangeInsight[]>(
    () => (data.weeklyChangeInsights ?? []).filter((i) => FORMAT_CHANGE_TYPES.has(String(i.change_type)) || FUNNEL_CHANGE_TYPES.has(String(i.change_type))),
    [data.weeklyChangeInsights],
  );

  const n = ads.length;
  const fmt = (f: string) => ads.filter((a) => a.ad_format === f).length;
  const obj = (o: string) => ads.filter((a) => a.inferred_objective === o).length;

  if (!n && !snaps.length) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <LayoutGrid className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Chưa có dữ liệu ad trẻ hóa da để phân tích format/funnel.</p>
          <p className="text-xs text-slate-500 mt-1">Chạy weekly spy sync để tạo Ad Level Analysis (có ad_format & inferred_objective).</p>
        </div>
      </div>
    );
  }

  // Brand comparison từ Brand Weekly Snapshot (đã tính sẵn rate trẻ hóa da).
  const brandRows = [...snaps].sort((a, b) => num(b.skin_rejuvenation_ads_count) - num(a.skin_rejuvenation_ads_count));

  // Pattern: format -> objective (đếm cặp).
  const pattern = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of ads) {
      const k = `${a.ad_format || "unknown"} → ${a.inferred_objective || "unknown"}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [ads]);

  const topVideoBrand = pickTop(brandRows, "skin_rejuvenation_video_rate");
  const topMsgBrand = pickTop(brandRows, "skin_rejuvenation_messenger_rate");
  const topLpcBrand = pickTop(brandRows, "skin_rejuvenation_landing_page_conversion_rate");

  return (
    <div className="space-y-6">
      <Header />

      <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Tất cả số liệu lọc theo service_category = skin_rejuvenation. inferred_objective là suy luận từ public data (không phải campaign objective chính thức).
      </div>

      {/* A. Format Mix */}
      <Section icon={LayoutGrid} title="A. Skin Rejuvenation Format Mix" desc={`${n} ad trẻ hóa da`}>
        <div className="space-y-2">
          <Bar label="Image" value={fmt("image")} total={n} color="bg-cyan-500" />
          <Bar label="Video" value={fmt("video")} total={n} color="bg-emerald-500" />
          <Bar label="Carousel" value={fmt("carousel")} total={n} color="bg-violet-500" />
          <Bar label="Collection" value={fmt("collection")} total={n} color="bg-amber-500" />
          <Bar label="Text only" value={fmt("text_only")} total={n} color="bg-slate-400" />
          <Bar label="Unknown" value={fmt("unknown")} total={n} color="bg-slate-300" />
        </div>
      </Section>

      {/* B. Funnel Mix */}
      <Section icon={Filter} title="B. Skin Rejuvenation Funnel Mix (inferred objective)" desc={`${n} ad trẻ hóa da`}>
        <div className="space-y-2">
          <Bar label="Messenger" value={obj("messenger")} total={n} color="bg-blue-500" />
          <Bar label="Landing/Conv." value={obj("landing_page_conversion")} total={n} color="bg-emerald-500" />
          <Bar label="Lead form" value={obj("lead_form")} total={n} color="bg-teal-500" />
          <Bar label="Phone call" value={obj("phone_call")} total={n} color="bg-amber-500" />
          <Bar label="Website traffic" value={obj("website_traffic")} total={n} color="bg-cyan-400" />
          <Bar label="Unknown" value={obj("unknown")} total={n} color="bg-slate-300" />
        </div>
      </Section>

      {/* C. Brand Comparison */}
      <Section icon={GitCompare} title="C. Brand Comparison (trẻ hóa da)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 font-mono uppercase tracking-wider">
              <tr className="text-left border-b border-slate-100">
                <th className="py-2 pr-3">Brand</th><th className="pr-3">Ads</th><th className="pr-3">Image</th>
                <th className="pr-3">Video</th><th className="pr-3">Carousel</th><th className="pr-3">Messenger</th>
                <th className="pr-3">Landing</th><th className="pr-3">Top format</th><th>Top objective</th>
              </tr>
            </thead>
            <tbody>
              {brandRows.map((s, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-bold text-slate-800">{s.brand_name}</td>
                  <td className="pr-3 text-slate-600">{String(s.skin_rejuvenation_ads_count ?? 0)}</td>
                  <td className="pr-3 text-slate-600">{pct(s.skin_rejuvenation_image_rate)}</td>
                  <td className="pr-3 text-slate-600">{pct(s.skin_rejuvenation_video_rate)}</td>
                  <td className="pr-3 text-slate-600">{pct(s.skin_rejuvenation_carousel_rate)}</td>
                  <td className="pr-3 text-slate-600">{pct(s.skin_rejuvenation_messenger_rate)}</td>
                  <td className="pr-3 text-slate-600">{pct(s.skin_rejuvenation_landing_page_conversion_rate)}</td>
                  <td className="pr-3 text-slate-500">{s.skin_rejuvenation_top_format || "—"}</td>
                  <td className="text-slate-500">{s.skin_rejuvenation_top_inferred_objective || "—"}</td>
                </tr>
              ))}
              {!brandRows.length && <tr><td colSpan={9} className="py-3 text-slate-400">Chưa có snapshot trẻ hóa da.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* D. Format x Objective Pattern */}
      <Section icon={BarChart3} title="D. Format × Objective Pattern">
        <div className="grid md:grid-cols-2 gap-2">
          {pattern.map(([k, c], i) => (
            <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 text-xs">
              <span className="font-semibold text-slate-700">{k}</span>
              <span className="text-slate-500 tabular-nums">{c} ad</span>
            </div>
          ))}
          {!pattern.length && <p className="text-xs text-slate-400">Chưa có ad để dựng pattern.</p>}
        </div>
        {insights.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">Thay đổi tuần (format/funnel)</p>
            <div className="space-y-1.5">
              {insights.slice(0, 8).map((it, i) => (
                <div key={i} className="text-xs border border-slate-100 rounded-lg px-3 py-2">
                  <span className="font-bold text-slate-700">{it.brand}</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono">{it.change_type}</span>
                  <span className="ml-2 text-slate-500">{it.summary}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* E. Recommendations for SERYN */}
      <Section icon={Lightbulb} title="E. Recommendations for SERYN">
        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
          <li>Đối thủ trẻ hóa da đang chạy <b>{fmt("video") >= fmt("image") ? "video" : "ảnh"}</b> nhiều hơn (video {fmt("video")} vs image {fmt("image")}).</li>
          <li>Funnel chủ đạo: <b>{obj("messenger") >= obj("landing_page_conversion") ? "Messenger" : "Landing page/Conversion"}</b> (messenger {obj("messenger")} vs landing {obj("landing_page_conversion")}).</li>
          <li>Nổi bật ở video: <b>{topVideoBrand?.brand_name || "—"}</b> ({pct(topVideoBrand?.skin_rejuvenation_video_rate)}).</li>
          <li>Nổi bật ở Messenger: <b>{topMsgBrand?.brand_name || "—"}</b> ({pct(topMsgBrand?.skin_rejuvenation_messenger_rate)}).</li>
          <li>Nổi bật ở Landing/Conversion: <b>{topLpcBrand?.brand_name || "—"}</b> ({pct(topLpcBrand?.skin_rejuvenation_landing_page_conversion_rate)}).</li>
          <li>SERYN nên test trước: format <b>{fmt("video") >= fmt("image") ? "video bác sĩ giải thích" : "ảnh editorial cao cấp"}</b>; funnel <b>{obj("landing_page_conversion") >= obj("messenger") ? "landing page đánh giá nền tảng sinh học" : "Messenger tư vấn chuyên môn"}</b> — giữ tông calm, premium, không FOMO.</li>
        </ul>
      </Section>
    </div>
  );
}

function pickTop(rows: BrandWeeklySnapshot[], key: keyof BrandWeeklySnapshot): BrandWeeklySnapshot | undefined {
  return [...rows].sort((a, b) => num(b[key]) - num(a[key]))[0];
}

function Header() {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-900">Ad Format & Funnel (trẻ hóa da)</h2>
      <p className="text-sm text-slate-500">Phân tích format ảnh/video/carousel & funnel Messenger/landing cho ad trẻ hóa da. Đọc từ Ad Level Analysis + Brand Weekly Snapshot + Weekly Change Insights.</p>
    </div>
  );
}
