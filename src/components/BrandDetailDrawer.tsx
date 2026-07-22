import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Activity, FileText,
  Image as ImageIcon, Filter, ExternalLink, Star,
} from "lucide-react";
import type { SpyDashboardData } from "../types";
import { splitChips, orUnknown, viLabel, isMissing, isMeaningful, humanizeText } from "../utils/spyData";
import { getBrandProfile } from "../utils/brandIntelligence";
import { isDirectCompetitor } from "../utils/directCompetitors";
import { isOwnBrand } from "../utils/ownBrand";
import { buildSerynVsCompetitorComparison, buildSerynSnapshot } from "../utils/serynBenchmark";
import { Sparkles } from "lucide-react";
import {
  buildAdContentIntelligenceForBrand, ANGLE_VI,
  type AdContentIntelligence,
} from "../utils/adContentIntelligence";

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const pct = (v: unknown) => `${Math.round(num(v) * 100)}%`;

const CACA: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  avoid: "bg-slate-100 text-slate-600 border-slate-200",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
};

function Section({ icon: Icon, title, accent, full, children }: { icon: any; title: string; accent?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-4 border ${accent ? "border-cyan-200 bg-cyan-50/30" : "border-slate-200 bg-white"} ${full ? "lg:col-span-2" : ""}`}>
      <h4 className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-extrabold text-slate-600 mb-3">
        <Icon className={`w-3.5 h-3.5 ${accent ? "text-cyan-600" : "text-slate-400"}`} />{title}
      </h4>
      {children}
    </div>
  );
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-500 font-semibold uppercase shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-bold text-right">{value}</span>
    </div>
  );
}
function Chips({ value, tone = "slate" }: { value?: string; tone?: "slate" | "emerald" }) {
  const items = splitChips(value).filter(isMeaningful);
  if (!items.length) return <span className="text-xs text-slate-400">N/A</span>;
  const cls = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => <span key={`${it}-${i}`} className={`border px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{viLabel(it)}</span>)}
    </div>
  );
}
/** Chuẩn hóa list rate (0–1, có thể chồng lấn) thành % cộng đúng 100 (largest-remainder). */
function normalizeTo100(values: number[]): number[] {
  const total = values.reduce((s, x) => s + x, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((s, x) => s + x, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (left > 0) { out[i] += 1; left -= 1; } });
  return out;
}
/** Nhóm thanh tỉ lệ — các % đã chuẩn hóa để tổng = 100%. */
function RateGroup({ items }: { items: { label: string; v: unknown }[] }) {
  const pcts = normalizeTo100(items.map((it) => num(it.v)));
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 text-slate-600 font-semibold">{it.label}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${pcts[i]}%` }} /></div>
          <span className="w-10 text-right text-slate-500 tabular-nums">{pcts[i]}%</span>
        </div>
      ))}
    </div>
  );
}
const ar = (v: unknown) => Array.isArray(v) ? v : [];

/** Đếm tần suất giá trị (bỏ rỗng/unknown), trả top-n [{label, count}] giảm dần. */
function topCounts(values: (string | undefined)[], n: number): { label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v || !isMeaningful(v) || isMissing(v)) continue;
    const key = v.toLowerCase();
    const cur = map.get(key);
    if (cur) cur.count += 1; else map.set(key, { label: v, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

/** Link page: 1 page chính + các page phụ ẩn sau "Xem thêm" cho gọn header. */
function PageLinks({ pageIds }: { pageIds: string[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!pageIds.length) return null;
  const extra = pageIds.length - 1;
  const shown = showAll ? pageIds : pageIds.slice(0, 1);
  return (
    <>
      {shown.map((pid, i) => (
        <a key={`pid-${i}`} href={`https://www.facebook.com/${pid}`} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">
          {i === 0 ? "page chính" : "page phụ"}: <span className="font-mono">{pid}</span> ↗
        </a>
      ))}
      {extra > 0 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-slate-500 hover:text-slate-800 font-semibold underline decoration-dotted cursor-pointer"
        >
          {showAll ? "Thu gọn" : `Xem thêm ${extra} page phụ`}
        </button>
      )}
    </>
  );
}

export default function BrandDetailDrawer({
  brandName, data, open, onClose,
}: { brandName: string | null; data: SpyDashboardData; open: boolean; onClose: () => void }) {

  const isOwn = brandName ? isOwnBrand(brandName, data.ownBrandPages ?? []) : false;
  const p = brandName ? getBrandProfile(brandName, data) : null;
  const content = brandName ? buildAdContentIntelligenceForBrand(brandName, data, 10) : [];
  const snap = p?.snapshot;
  const disc = p?.discovery;
  const skinN = num(snap?.skin_rejuvenation_ads_count);

  // Báo cáo tổng quan riêng của brand: content đang scale, CTA chính, CTKM đang áp dụng.
  // Content đang scale: cluster nhân rộng (nhiều QC nhất) -> "định dạng · góc tiếp cận".
  const scalingContent = (p?.scaled ?? [])
    .map((s) => ({
      label: [viLabel(String(s.content_format || "")), viLabel(String(s.content_angle || ""))].filter((x) => x && isMeaningful(x)).join(" · "),
      count: num(s.number_of_similar_ads),
      days: num(s.longest_days_active),
    }))
    .filter((s) => s.label)
    .sort((a, b) => b.count - a.count || b.days - a.days)
    .slice(0, 4);
  // CTA chính: đếm tần suất CTA trên từng QC; fallback main_ctas của snapshot.
  const topCtas = topCounts((p?.ads ?? []).map((a) => a.cta), 3);
  const ctaFallback = splitChips(snap?.main_ctas).filter(isMeaningful);
  // CTKM đang áp dụng: offers_detected (snapshot) + offer_detected từng QC, khử trùng lặp.
  const offerChips = topCounts(
    [...splitChips(snap?.offers_detected), ...(p?.ads ?? []).map((a) => a.offer_detected)],
    6,
  );
  // Link page đối thủ: mỗi page_id mở thẳng fanpage; fanpage url lấy URL hợp lệ đầu tiên.
  const pageIds = splitChips(snap?.page_ids);
  const fanpageUrl = (String(disc?.facebook_url || "").trim() || splitChips(snap?.page_urls)[0] || "").trim();

  return (
    <AnimatePresence>
      {open && brandName && p && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-5xl bg-[#F5F0E8] z-50 shadow-2xl flex flex-col"
          >
            {/* Sticky header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 shrink-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-[10px] uppercase font-mono tracking-widest font-bold ${isOwn ? "text-emerald-600" : "text-cyan-600"}`}>{isOwn ? "HỒ SƠ SERYN" : "HỒ SƠ ĐỐI THỦ"}</p>
                <h3 className="text-lg font-extrabold text-slate-900 truncate flex items-center gap-2">
                  {brandName}
                  {isOwn
                    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0"><Sparkles className="w-3 h-3" /> Thương hiệu của mình</span>
                    : isDirectCompetitor(brandName) && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0"><Star className="w-3 h-3 fill-amber-400 text-amber-500" /> Trực tiếp</span>}
                </h3>
                {snap && <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-2xl line-clamp-2">{humanizeText(orUnknown(snap.content_strategy_summary))}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500 items-center">
                  <React.Fragment key={brandName}><PageLinks pageIds={pageIds} /></React.Fragment>
                  {!!disc?.website_url && <a href={String(disc.website_url)} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">website ↗</a>}
                  {!!fanpageUrl && <a href={fanpageUrl} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">fanpage ↗</a>}
                  {!!disc?.phone && <span>☎ {String(disc.phone)}</span>}
                  {!!disc?.address && <span className="truncate max-w-[16rem]">📍 {String(disc.address)}</span>}
                </div>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 transition shrink-0"><X className="w-4.5 h-4.5" /></button>
            </div>


            {/* Body — 2 cột desktop */}
            <div className="flex-1 overflow-y-auto p-5">
              {!snap && !p.ads.length ? (
                <p className="text-sm text-slate-400 font-semibold">Không có dữ liệu tổng hợp cho đối thủ này.</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                  {/* 1. Ads overview — báo cáo tổng quan riêng của brand */}
                  <Section icon={Activity} title="Tổng quan quảng cáo">
                    <div className="grid grid-cols-2 gap-x-6">
                      <Field label="QC đang chạy" value={orUnknown(snap?.total_active_ads)} />
                      <Field label="Đã thu thập" value={orUnknown(snap?.total_ads_collected)} />
                      <Field label="Số trang chạy" value={orUnknown(snap?.num_pages_running)} />
                      <Field label="Mới tuần này" value={orUnknown(snap?.new_ads_count)} />
                      <Field label="Đã dừng" value={orUnknown(snap?.stopped_ads_count)} />
                      <Field label="Nội dung nhân rộng" value={orUnknown(snap?.scaled_content_count)} />
                      {skinN > 0 && <Field label="QC trẻ hóa da" value={skinN} />}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                      <div>
                        <p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Content đang nhân rộng</p>
                        {scalingContent.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {scalingContent.map((s, i) => (
                              <span key={i} className="border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {s.label}{s.count > 1 ? ` · ${s.count} QC` : ""}{s.days > 0 ? ` · ${s.days} ngày` : ""}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-slate-400">Chưa phát hiện content nhân rộng.</span>}
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">CTA chính</p>
                        {topCtas.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {topCtas.map((c, i) => (
                              <span key={i} className="border border-cyan-200 bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {viLabel(c.label)}{c.count > 1 ? ` · ${c.count} QC` : ""}
                              </span>
                            ))}
                          </div>
                        ) : ctaFallback.length ? <Chips value={ctaFallback.join("|")} /> : <span className="text-xs text-slate-400">N/A</span>}
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">CTKM đang áp dụng</p>
                        {offerChips.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {offerChips.map((o, i) => (
                              <span key={i} className="border border-amber-200 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {viLabel(o.label)}{o.count > 1 ? ` · ${o.count} QC` : ""}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-slate-400">Không phát hiện CTKM đang chạy.</span>}
                      </div>
                    </div>
                  </Section>

                  {/* 3. Ad content */}
                  <Section icon={FileText} title="Nội dung quảng cáo">
                    <div className="space-y-2">
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Định dạng</p><Chips value={snap?.main_content_formats} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Câu mở (hook)</p><Chips value={snap?.main_hooks} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Góc tiếp cận</p><Chips value={snap?.main_angles} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Bằng chứng</p><Chips value={snap?.main_proof_points} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Lời kêu gọi</p><Chips value={snap?.main_ctas} /></div>
                    </div>
                  </Section>

                  {/* 4. Phân tích content quảng cáo (section chính, full width) — gồm
                       luôn các quảng cáo tốt nhất (số lượng QC nhiều nhất) + ảnh thumbnail. */}
                  <Section icon={FileText} title="Phân tích content quảng cáo" accent full>
                    <p className="text-[10px] text-slate-400 mb-3 italic">~10 quảng cáo có số lượng QC nhiều nhất của brand — kèm ảnh + bóc tách nội dung.</p>
                    {content.length ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {content.slice(0, 10).map((c) => <div key={c.id}><ContentCard c={c} /></div>)}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa đủ dữ liệu để dựng content pattern cho brand này.</p>}
                  </Section>

                  {/* 5. Visual */}
                  <Section icon={ImageIcon} title="Hình ảnh / Creative">
                    {p.visual ? (
                      <div className="space-y-1.5">
                        <RateGroup items={[
                          { label: "Trước/Sau", v: p.visual.before_after_rate },
                          { label: "Bác sĩ", v: p.visual.doctor_rate },
                          { label: "UGC", v: p.visual.ugc_rate },
                          { label: "Banner ưu đãi", v: p.visual.offer_banner_rate },
                        ]} />
                        {!!p.visual.dominant_visual_angle && <p className="text-[11px] text-slate-500 mt-2">Góc visual chủ đạo: <b>{viLabel(String(p.visual.dominant_visual_angle))}</b></p>}
                        {!!p.visual.top_visual_formats && <p className="text-[11px] text-slate-500">Định dạng: {splitChips(p.visual.top_visual_formats).map(viLabel).join(", ")}</p>}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có dữ liệu visual cho brand này.</p>}
                  </Section>

                  {/* 6. Format & funnel */}
                  <Section icon={Filter} title="Định dạng & phễu (trẻ hóa da)">
                    {skinN > 0 ? (
                      <div className="space-y-1.5">
                        <RateGroup items={[
                          { label: "Ảnh", v: snap?.skin_rejuvenation_image_rate },
                          { label: "Video", v: snap?.skin_rejuvenation_video_rate },
                          { label: "Carousel", v: snap?.skin_rejuvenation_carousel_rate },
                          { label: "Messenger", v: snap?.skin_rejuvenation_messenger_rate },
                        ]} />
                        <p className="text-[11px] text-slate-500 mt-2">Chủ đạo: <b>{viLabel(String(snap?.skin_rejuvenation_top_format || ""))}</b> → <b>{viLabel(String(snap?.skin_rejuvenation_top_inferred_objective || ""))}</b></p>
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có dữ liệu định dạng/phễu trẻ hóa da.</p>}
                  </Section>

                  {/* Own brand -> đánh giá nội dung SERYN */}
                  {isOwn && (
                    <Section icon={Sparkles} title="Đánh giá nội dung hiện tại của SERYN" accent full>
                      <SerynSelfEval data={data} />
                    </Section>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Đánh giá nội dung hiện tại của SERYN (own brand) ---------- */
function SerynSelfEval({ data }: { data: SpyDashboardData }) {
  const s = buildSerynSnapshot(data);
  const cmp = buildSerynVsCompetitorComparison(data);
  const Row = ({ q, children }: { q: string; children: React.ReactNode }) => (
    <div className="py-1.5 border-b border-slate-100 last:border-0">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{q}</p>
      <div className="text-[13px] text-slate-700 mt-0.5">{children}</div>
    </div>
  );
  if (!s.hasData) return <p className="text-xs text-slate-500">Chưa có dữ liệu ads công khai của SERYN. Thêm page vào tab <span className="font-mono">Own Brand Pages</span> và crawl để bật đánh giá.</p>;
  return (
    <div className="space-y-1">
      <Row q="SERYN đang tập trung vào angle nào?">{s.topContentAngles.map(viLabel).join(", ") || "—"}</Row>
      <Row q="SERYN đang thiếu angle nào so với thị trường?">{cmp.missingContentAngles.map(viLabel).join(", ") || "Không thiếu angle nổi bật nào."}</Row>
      <Row q="SERYN có đang lặp offer/content quá nhiều không?">{s.topOffers.length <= 1 ? "Ít offer lặp — đang giữ định vị không đua giá." : `Có ${s.topOffers.length} offer — kiểm tra tránh lặp/đua giá: ${s.topOffers.slice(0, 3).join(", ")}.`}</Row>
      <Row q="SERYN có format nào đang yếu không?">{cmp.formatGapNote}</Row>
      <Row q="SERYN có đang dùng claim rủi ro không?">{cmp.riskGapNote}</Row>
      <Row q="Nên test gì tiếp theo?">
        {cmp.recommendedTests.length ? (
          <ul className="list-disc pl-4 space-y-0.5">
            {cmp.recommendedTests.slice(0, 3).map((t, i) => <li key={i}><b>[{viLabel(t.priority)}]</b> {t.recommendation}</li>)}
          </ul>
        ) : "Chưa đủ dữ liệu để đề xuất test."}
      </Row>
    </div>
  );
}

/* ---------- Content pattern card (Phân tích content quảng cáo) ---------- */
const SCALE_VI: Record<string, string> = {
  "Weak Signal": "Tín hiệu yếu", "Repeated Content": "Content lặp lại",
  "Long-running Content": "Chạy dài ngày", "Strong Content Pattern": "Pattern nội dung mạnh",
};
const SCALE_TONE: Record<string, string> = {
  "Weak Signal": "bg-slate-100 text-slate-600 border-slate-200",
  "Repeated Content": "bg-sky-50 text-sky-700 border-sky-200",
  "Long-running Content": "bg-amber-50 text-amber-700 border-amber-200",
  "Strong Content Pattern": "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const ACTION_VI: Record<string, string> = { Adapt: "Điều chỉnh", Counter: "Phản đòn", Monitor: "Theo dõi", Avoid: "Tránh", "Test Safe Version": "Test bản an toàn" };
const OBJ_VI: Record<string, string> = { messenger: "Messenger", lead_form: "Lead form", landing_page_conversion: "Trang đích", phone_call: "Gọi điện", awareness: "Nhận biết", unknown: "Chưa rõ" };
const FMT_VI: Record<string, string> = { image: "Ảnh", video: "Video", carousel: "Carousel", unknown: "Chưa rõ" };

function ContentCard({ c }: { c: AdContentIntelligence }) {
  const [tab, setTab] = useState<"breakdown" | "psych" | "seryn" | "evidence">("breakdown");
  const b = c.contentBreakdown, ps = c.psychology, r = c.serynResponse;
  const TABS: { k: typeof tab; label: string }[] = [
    { k: "breakdown", label: "Bóc tách" }, { k: "psych", label: "Tâm lý" }, { k: "seryn", label: "SERYN" }, { k: "evidence", label: "Bằng chứng" },
  ];
  const KV = ({ k, v }: { k: string; v?: string }) => <p className="text-[11px] text-slate-600"><b className="text-slate-500">{k}:</b> {v && isMeaningful(v) ? v : "N/A"}</p>;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Thumbnail QC + overlay: số lượng QC, scale, content signal */}
      <div className="relative">
        <AdThumb url={c.thumbnailUrl} format={c.adFormat} />
        {c.adsCount > 1 && <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold uppercase tracking-wide text-rose-700 bg-rose-50/95 border border-rose-200 px-1.5 py-0.5 rounded">{c.adsCount} QC</span>}
        {c.exampleAdUrls[0] && <a href={c.exampleAdUrls[0]} target="_blank" rel="noreferrer" className="absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white bg-cyan-600/90 hover:bg-cyan-600 px-2 py-0.5 rounded inline-flex items-center gap-0.5">Mở QC <ExternalLink className="w-3 h-3" /></a>}
      </div>

      <div className="p-3 space-y-2">
      <p className="text-xs font-bold text-slate-800 leading-snug">{c.contentSummary}</p>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className={`font-bold px-2 py-0.5 rounded border ${SCALE_TONE[c.scaleSignal]}`}>{SCALE_VI[c.scaleSignal]}</span>
        <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{ANGLE_VI[c.contentAngle] || viLabel(c.contentAngle)}</span>
        <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{FMT_VI[c.adFormat]}</span>
        <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{OBJ_VI[c.inferredObjective]}</span>
        {c.activeDays > 0 && <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{c.activeDays} ngày</span>}
      </div>

      <div className="flex border-b border-slate-100 text-[11px]">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-2 py-1 font-bold border-b-2 transition ${tab === t.k ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "breakdown" && (
        <div className="space-y-0.5">
          <KV k="Mở đầu" v={b.openingLine} />
          <KV k="Thông điệp" v={b.mainMessage} />
          <KV k="Nỗi đau" v={c.painPoint} /><KV k="Mong muốn" v={c.desiredOutcome} />
          <KV k="Cơ chế" v={b.mechanism} /><KV k="Bằng chứng" v={b.proofElement} />
          <KV k="Ưu đãi" v={b.offerElement} /><KV k="CTA" v={b.ctaElement} />
          <p className="text-[11px] text-slate-500 mt-1">Cấu trúc: {b.contentStructure.join(" → ")}</p>
        </div>
      )}
      {tab === "psych" && (
        <div className="space-y-0.5">
          <KV k="Nỗi đau" v={ps.customerPain} /><KV k="Mong muốn" v={ps.customerDesire} />
          <KV k="Niềm tin" v={ps.beliefTrigger} /><KV k="Gỡ phản đối" v={ps.objectionHandled} />
          <KV k="Cảm xúc" v={ps.emotionalTrigger} /><KV k="Nhận thức" v={ps.awarenessStage} />
          <p className="text-[11px] text-slate-600 mt-1">{ps.whyItMayWork}</p>
          <p className={`text-[11px] mt-1 ${num(c.riskLevel === "High" ? 1 : 0) ? "text-rose-700 font-semibold" : "text-slate-500"}`}>{ps.riskNote}</p>
        </div>
      )}
      {tab === "seryn" && (
        <div className="space-y-1">
          <p className="text-[11px]"><span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">{ACTION_VI[r.recommendedAction] || viLabel(r.recommendedAction)}</span> <b className="text-slate-700">{r.suggestedAngle}</b></p>
          <KV k="Phản đòn" v={r.counterPositioning} />
          <KV k="Copy ngắn" v={r.shortAdCopy} />
          <KV k="Bản cao cấp" v={r.premiumRewrite} />
          <KV k="Bản an toàn" v={r.safeRewrite} />
          <KV k="Visual" v={r.visualDirection} />
          <KV k="CTA" v={r.recommendedCTA} />
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">{r.complianceWarning}</p>
        </div>
      )}
      {tab === "evidence" && (
        <div className="space-y-0.5">
          <KV k="Số content" v={String(c.adsCount)} /><KV k="Ngày chạy" v={c.activeDays ? String(c.activeDays) : ""} />
          <KV k="Dịch vụ" v={c.serviceCategory} /><KV k="Visual" v={c.visualAngle || c.visualFormat} />
          {c.exampleAdUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {c.exampleAdUrls.slice(0, 5).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-600 hover:underline inline-flex items-center gap-0.5">QC {i + 1} <ExternalLink className="w-3 h-3" /></a>)}
            </div>
          )}
          {!c.exampleAdUrls.length && c.exampleAdIds.length > 0 && <p className="text-[11px] text-slate-400">Mã QC: {c.exampleAdIds.join(", ")}</p>}
        </div>
      )}
      </div>
    </div>
  );
}

/* ---------- Ad thumbnail (dùng chung cho content card) ---------- */
function AdThumb({ url, format }: { url?: string; format?: string }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    return <img src={url} onError={() => setErr(true)} loading="lazy" alt="" className="w-full aspect-[4/3] object-cover bg-slate-100" />;
  }
  return (
    <div className="w-full aspect-[4/3] bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center gap-1 text-slate-300">
      <ImageIcon className="w-7 h-7" />
      <span className="text-[10px] font-semibold">{format && isMeaningful(format) ? viLabel(format) : "Không có ảnh"}</span>
    </div>
  );
}
