import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Layers, Activity, FileText, GitCompareArrows, Sparkles,
  Image as ImageIcon, Filter, Globe, ShieldAlert, ExternalLink, Star,
} from "lucide-react";
import type { SpyDashboardData } from "../types";
import { splitChips, orUnknown, viLabel, isMissing, isMeaningful, humanizeText } from "../utils/spyData";
import { getBrandProfile, getBrandBestAds, type BrandBestAd } from "../utils/brandIntelligence";
import { isDirectCompetitor } from "../utils/directCompetitors";
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
function Rate({ label, v }: { label: string; v: unknown }) {
  const w = Math.round(num(v) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-slate-600 font-semibold">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${w}%` }} /></div>
      <span className="w-10 text-right text-slate-500 tabular-nums">{w}%</span>
    </div>
  );
}
const ar = (v: unknown) => Array.isArray(v) ? v : [];

export default function BrandDetailDrawer({
  brandName, data, open, onClose,
}: { brandName: string | null; data: SpyDashboardData; open: boolean; onClose: () => void }) {

  const p = brandName ? getBrandProfile(brandName, data) : null;
  const content = brandName ? buildAdContentIntelligenceForBrand(brandName, data) : [];
  const bestAds = brandName ? getBrandBestAds(brandName, data, 6) : [];
  const snap = p?.snapshot;
  const disc = p?.discovery;
  const skinN = num(snap?.skin_rejuvenation_ads_count);

  return (
    <AnimatePresence>
      {open && brandName && p && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-5xl bg-[#F8FAFC] z-50 shadow-2xl flex flex-col"
          >
            {/* Sticky header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 shrink-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">HỒ SƠ ĐỐI THỦ</p>
                <h3 className="text-lg font-extrabold text-slate-900 truncate flex items-center gap-2">
                  {brandName}
                  {isDirectCompetitor(brandName) && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0"><Star className="w-3 h-3 fill-amber-400 text-amber-500" /> Trực tiếp</span>}
                </h3>
                {snap && <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-2xl line-clamp-2">{humanizeText(orUnknown(snap.content_strategy_summary))}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                  {!!snap?.page_ids && <span>page_id: <span className="font-mono">{String(snap.page_ids)}</span></span>}
                  {!!disc?.website_url && <a href={String(disc.website_url)} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">website ↗</a>}
                  {!!(disc?.facebook_url || snap?.page_urls) && <a href={String(disc?.facebook_url || snap?.page_urls)} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">fanpage ↗</a>}
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
                  {/* 1. Ads overview */}
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

                  {/* 4. Phân tích content quảng cáo (section chính, full width) */}
                  <Section icon={FileText} title="Phân tích content quảng cáo" accent full>
                    <p className="text-[10px] text-slate-400 mb-3 italic">Đây là tín hiệu từ dữ liệu ads (số content lặp + thời gian chạy…), không phải dữ liệu hiệu quả chuyển đổi (CPA/ROAS).</p>
                    {content.length ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {content.slice(0, 8).map((c) => <div key={c.id}><ContentCard c={c} /></div>)}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa đủ dữ liệu để dựng content pattern cho brand này.</p>}
                  </Section>

                  {/* 5. Visual */}
                  <Section icon={ImageIcon} title="Hình ảnh / Creative">
                    {p.visual ? (
                      <div className="space-y-1.5">
                        <Rate label="Trước/Sau" v={p.visual.before_after_rate} />
                        <Rate label="Bác sĩ" v={p.visual.doctor_rate} />
                        <Rate label="UGC" v={p.visual.ugc_rate} />
                        <Rate label="Banner ưu đãi" v={p.visual.offer_banner_rate} />
                        <Rate label="Rủi ro cao" v={p.visual.high_risk_rate} />
                        {!!p.visual.dominant_visual_angle && <p className="text-[11px] text-slate-500 mt-2">Góc visual chủ đạo: <b>{viLabel(String(p.visual.dominant_visual_angle))}</b></p>}
                        {!!p.visual.top_visual_formats && <p className="text-[11px] text-slate-500">Định dạng: {splitChips(p.visual.top_visual_formats).map(viLabel).join(", ")}</p>}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có dữ liệu visual cho brand này.</p>}
                  </Section>

                  {/* 6. Format & funnel */}
                  <Section icon={Filter} title="Định dạng & phễu (trẻ hóa da)">
                    {skinN > 0 ? (
                      <div className="space-y-1.5">
                        <Rate label="Ảnh" v={snap?.skin_rejuvenation_image_rate} />
                        <Rate label="Video" v={snap?.skin_rejuvenation_video_rate} />
                        <Rate label="Carousel" v={snap?.skin_rejuvenation_carousel_rate} />
                        <Rate label="Messenger" v={snap?.skin_rejuvenation_messenger_rate} />
                        <Rate label="Trang đích" v={snap?.skin_rejuvenation_landing_page_conversion_rate} />
                        <p className="text-[11px] text-slate-500 mt-2">Chủ đạo: <b>{viLabel(String(snap?.skin_rejuvenation_top_format || ""))}</b> → <b>{viLabel(String(snap?.skin_rejuvenation_top_inferred_objective || ""))}</b></p>
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có dữ liệu format/funnel trẻ hóa da.</p>}
                  </Section>

                  {/* 8. Weekly change */}
                  <Section icon={GitCompareArrows} title="Thay đổi tuần">
                    {p.change ? (
                      <div className="space-y-2">
                        <Field label="Thay đổi QC" value={orUnknown(p.change.active_ads_change)} />
                        <Field label="Loại thay đổi" value={viLabel(p.change.strategic_change_type)} />
                        {splitChips(p.change.new_services_detected).length > 0 && <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Dịch vụ mới</p><Chips value={p.change.new_services_detected} tone="emerald" /></div>}
                        {splitChips(p.change.new_offers_detected).length > 0 && <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Ưu đãi mới</p><Chips value={p.change.new_offers_detected} tone="emerald" /></div>}
                        {splitChips(p.change.new_content_angles).length > 0 && <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Góc mới</p><Chips value={p.change.new_content_angles} tone="emerald" /></div>}
                        {!!p.change.change_summary && <p className="text-xs text-slate-600 pt-1"><b>Tóm tắt:</b> {humanizeText(orUnknown(p.change.change_summary))}</p>}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có thay đổi ghi nhận.</p>}
                  </Section>

                  {/* 9. Market signals */}
                  <Section icon={Globe} title="Tín hiệu thị trường liên quan">
                    {p.marketSignals.length ? (
                      <ul className="space-y-1.5">
                        {p.marketSignals.map((m, i) => (
                          <li key={i} className="text-[11px] text-slate-600">
                            {m.source_url
                              ? <a href={String(m.source_url)} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline font-semibold">{m.source_title || m.topic || m.source_url}</a>
                              : <span className="font-semibold">{m.topic || m.summary}</span>}
                            {!!m.summary && <span className="text-slate-500"> — {String(m.summary).slice(0, 100)}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-slate-400">Chưa có tín hiệu thị trường gắn brand này.</p>}
                  </Section>

                  {/* 10. SERYN recommendations (full) */}
                  <Section icon={Sparkles} title="Gợi ý hành động cho SERYN" accent full>
                    {snap?.seryn_opportunity && <p className="text-sm text-slate-700 leading-relaxed mb-3">{humanizeText(orUnknown(snap.seryn_opportunity))}</p>}
                    {p.recommendations.length ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {p.recommendations.slice(0, 6).map((r, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                            {!!r.suggested_hook && <p className="font-bold text-slate-800 italic">“{humanizeText(String(r.suggested_hook))}”</p>}
                            {!!r.suggested_content_angle && <p className="text-slate-600"><b>Góc:</b> {humanizeText(String(r.suggested_content_angle))}</p>}
                            {!!r.suggested_offer_angle && <p className="text-slate-600"><b>Offer:</b> {humanizeText(String(r.suggested_offer_angle))}</p>}
                            {!!r.main_message && <p className="text-slate-600">{humanizeText(String(r.main_message))}</p>}
                            {!!r.claim_safe_version && <p className="text-emerald-700"><b>Bản an toàn:</b> {String(r.claim_safe_version)}</p>}
                            {!!r.cta && <p className="text-cyan-700 font-semibold">CTA: {String(r.cta)}</p>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có gợi ý nội dung gắn brand này — xem tổng hợp ở Tổng quan.</p>}
                  </Section>

                  {/* 11. Best ads (full) — quảng cáo tốt nhất + thumbnail */}
                  <Section icon={Layers} title="Quảng cáo tốt nhất" accent full>
                    <p className="text-[10px] text-slate-400 mb-3 italic">Xếp hạng theo tín hiệu scale + số ngày chạy + đang active — không phải dữ liệu hiệu quả thật (CPA/ROAS).</p>
                    {bestAds.length ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bestAds.map((b, i) => <div key={b.ad.ad_id || i}><BestAdCard b={b} /></div>)}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có ad-level cho brand này.</p>}
                  </Section>

                  {/* 12. Risk note (full) */}
                  <Section icon={ShieldAlert} title="Ghi chú rủi ro" full>
                    <p className="text-xs text-slate-600">
                      {num(p.visual?.high_risk_rate) >= 0.3 || num(p.visual?.before_after_rate) >= 0.4
                        ? "Brand này dùng nhiều before/after hoặc creative rủi ro claim — KHÔNG copy nguyên xi; SERYN chỉ tham khảo cấu trúc và phản ứng (counter positioning), giữ câu chữ an toàn."
                        : "Tham khảo cấu trúc / góc tiếp cận của brand này, không sao chép nguyên văn. Mọi nội dung SERYN giữ tông điềm tĩnh, 'kết quả tùy cơ địa'."}
                    </p>
                  </Section>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-slate-800 leading-snug">{c.contentSummary}</p>
        <span className="shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-lg bg-slate-800 text-white" title="Tín hiệu từ dữ liệu ads, không phải CPA/ROAS">{c.contentScore}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className={`font-bold px-2 py-0.5 rounded border ${SCALE_TONE[c.scaleSignal]}`}>{SCALE_VI[c.scaleSignal]}</span>
        <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{ANGLE_VI[c.contentAngle] || c.contentAngle}</span>
        <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{FMT_VI[c.adFormat]}</span>
        <span className="font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-600">{OBJ_VI[c.inferredObjective]}</span>
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
          <KV k="Pain" v={ps.customerPain} /><KV k="Desire" v={ps.customerDesire} />
          <KV k="Niềm tin" v={ps.beliefTrigger} /><KV k="Gỡ phản đối" v={ps.objectionHandled} />
          <KV k="Cảm xúc" v={ps.emotionalTrigger} /><KV k="Nhận thức" v={ps.awarenessStage} />
          <p className="text-[11px] text-slate-600 mt-1">{ps.whyItMayWork}</p>
          <p className={`text-[11px] mt-1 ${num(c.riskLevel === "High" ? 1 : 0) ? "text-rose-700 font-semibold" : "text-slate-500"}`}>{ps.riskNote}</p>
        </div>
      )}
      {tab === "seryn" && (
        <div className="space-y-1">
          <p className="text-[11px]"><span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">{ACTION_VI[r.recommendedAction] || r.recommendedAction}</span> <b className="text-slate-700">{r.suggestedAngle}</b></p>
          <KV k="Counter" v={r.counterPositioning} />
          <KV k="Short copy" v={r.shortAdCopy} />
          <KV k="Premium" v={r.premiumRewrite} />
          <KV k="An toàn" v={r.safeRewrite} />
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
              {c.exampleAdUrls.slice(0, 5).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-600 hover:underline inline-flex items-center gap-0.5">ad {i + 1} <ExternalLink className="w-3 h-3" /></a>)}
            </div>
          )}
          {!c.exampleAdUrls.length && c.exampleAdIds.length > 0 && <p className="text-[11px] text-slate-400">ads: {c.exampleAdIds.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Best ad card (Quảng cáo tốt nhất + thumbnail) ---------- */
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

function BestAdCard({ b }: { b: BrandBestAd }) {
  const a = b.ad;
  const fmt = String(a.ad_format || a.media_type || "");
  const hook = a.hook_raw_text || a.hook_text || a.headline || a.primary_text;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="relative">
        <AdThumb url={b.thumbnailUrl} format={fmt} />
        {b.isScaled && <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Nhân rộng</span>}
      </div>
      <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
        <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-3">{hook && isMeaningful(String(hook)) ? humanizeText(String(hook)) : "—"}</p>
        <div className="flex flex-wrap gap-1 text-[9px] font-semibold">
          {isMeaningful(fmt) && <span className="px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">{viLabel(fmt)}</span>}
          {b.daysActive > 0 && <span className="px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">{b.daysActive} ngày</span>}
          {isMeaningful(a.service_or_product) && <span className="px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">{viLabel(String(a.service_or_product))}</span>}
        </div>
        {isMeaningful(a.offer_detected) && <p className="text-[10px] text-emerald-700"><b>Ưu đãi:</b> {String(a.offer_detected)}</p>}
        <div className="mt-auto pt-1">
          {a.ad_snapshot_url ? <a href={String(a.ad_snapshot_url)} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-cyan-600 hover:text-cyan-500 inline-flex items-center gap-0.5">Mở quảng cáo <ExternalLink className="w-3 h-3" /></a> : <span className="text-[10px] text-slate-300">không có link</span>}
        </div>
      </div>
    </div>
  );
}
