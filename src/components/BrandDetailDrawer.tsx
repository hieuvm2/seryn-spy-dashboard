import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Flame, Layers, Activity, Tag, FileText, GitCompareArrows, Sparkles,
  Zap, Image as ImageIcon, Filter, Globe, ShieldAlert, ClipboardCopy, ExternalLink, CheckCircle2, Star,
} from "lucide-react";
import type { SpyDashboardData } from "../types";
import { splitChips, orUnknown, viLabel, isMissing, isMeaningful, humanizeText } from "../utils/spyData";
import { getBrandProfile } from "../utils/brandIntelligence";
import { isDirectCompetitor } from "../utils/directCompetitors";
import { analyzeScaledRow } from "../utils/serynAnalysis";

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const pct = (v: unknown) => `${Math.round(num(v) * 100)}%`;

const CACA: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  avoid: "bg-slate-100 text-slate-600 border-slate-200",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
};

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    try { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); return true; }
    catch { return false; }
  }
}

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
      {items.map((it) => <span key={it} className={`border px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{viLabel(it)}</span>)}
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
function CopyBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return <button onClick={onClick} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500"><ClipboardCopy className="w-3 h-3" /> {label || "Copy"}</button>;
}
const ar = (v: unknown) => Array.isArray(v) ? v : [];

export default function BrandDetailDrawer({
  brandName, data, open, onClose,
}: { brandName: string | null; data: SpyDashboardData; open: boolean; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const flash = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2000); };
  const doCopy = async (t: string, m = "Đã copy.") => flash((await copyText(t)) ? m : "Không copy được.");

  const p = brandName ? getBrandProfile(brandName, data) : null;
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

            {note && <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-lg"><CheckCircle2 className="w-4 h-4" /> {note}</div>}

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

                  {/* 2. Services & offers */}
                  <Section icon={Layers} title="Dịch vụ & ưu đãi">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Dịch vụ đang chạy</p>
                    <Chips value={snap?.services_running || disc?.detected_services} />
                    <p className="text-[11px] text-slate-400 font-semibold uppercase mt-3 mb-1">Giá ghi nhận</p>
                    <Chips value={snap?.prices_detected || disc?.detected_prices} />
                    <p className="text-[11px] text-slate-400 font-semibold uppercase mt-3 mb-1">Ưu đãi</p>
                    <Chips value={snap?.offers_detected || disc?.detected_offers} />
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

                  {/* 4. Hook clusters */}
                  <Section icon={Zap} title="Hook nổi bật">
                    {p.hookClusters.length ? (
                      <div className="space-y-2">
                        {p.hookClusters.slice(0, 5).map((c) => (
                          <div key={c.hook_cluster_id} className="border border-slate-100 rounded-lg p-2.5">
                            <p className="text-xs font-bold text-slate-700">{viLabel(c.hook_category)} · {viLabel(c.hook_formula)}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 italic line-clamp-2">{c.example_hooks}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có cụm hook gắn brand này.</p>}
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

                  {/* 7. Scaled content (full width) */}
                  <Section icon={Flame} title="Nội dung đang lặp lại / nhân rộng" accent full>
                    {p.scaled.length ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {p.scaled.map((c) => {
                          const ai = analyzeScaledRow(c);
                          const caca = String(c.seryn_should_copy_adapt_counter_avoid || "").toLowerCase();
                          return (
                            <div key={c.content_cluster_id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-700">{viLabel(c.content_format)} · {viLabel(c.service_or_product)}</span>
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">{num(c.number_of_similar_ads) >= 3 ? "Nhiều ads tương tự" : num(c.longest_days_active) >= 30 ? "Chạy dài ngày" : "Cần theo dõi"}</span>
                              </div>
                              <p className="text-sm text-slate-700 italic">“{orUnknown(c.representative_hook)}”</p>
                              <p className="text-[11px] text-slate-500">{ai.why}</p>
                              {caca && caca !== "unknown" && (
                                <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${CACA[caca] || CACA.monitor}`}>{viLabel(caca)}</span>
                                  <span className="text-[11px] text-cyan-700">{ai.reframe}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có tín hiệu lặp lại rõ ràng.</p>}
                    <p className="text-[10px] text-slate-400 mt-2 italic">Đây là tín hiệu lặp lại từ ads (số lượng + thời gian chạy), chưa xác nhận hiệu quả chuyển đổi.</p>
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
                        {p.recommendations.slice(0, 6).map((r, i) => {
                          const full = [r.suggested_hook, r.suggested_content_angle, r.suggested_offer_angle, r.main_message, r.cta].filter(Boolean).join("\n");
                          return (
                            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                              {!!r.suggested_hook && <p className="font-bold text-slate-800 italic">“{humanizeText(String(r.suggested_hook))}”</p>}
                              {!!r.suggested_content_angle && <p className="text-slate-600"><b>Góc:</b> {humanizeText(String(r.suggested_content_angle))}</p>}
                              {!!r.suggested_offer_angle && <p className="text-slate-600"><b>Offer:</b> {humanizeText(String(r.suggested_offer_angle))}</p>}
                              {!!r.main_message && <p className="text-slate-600">{humanizeText(String(r.main_message))}</p>}
                              {!!r.claim_safe_version && <p className="text-emerald-700"><b>Bản an toàn:</b> {String(r.claim_safe_version)}</p>}
                              {!!r.cta && <p className="text-cyan-700 font-semibold">CTA: {String(r.cta)}</p>}
                              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                                {!!r.suggested_hook && <CopyBtn label="Copy hook" onClick={() => doCopy(String(r.suggested_hook), "Đã copy hook.")} />}
                                {!!r.suggested_content_angle && <CopyBtn label="Copy góc" onClick={() => doCopy(String(r.suggested_content_angle), "Đã copy góc.")} />}
                                {!!r.claim_safe_version && <CopyBtn label="Copy bản an toàn" onClick={() => doCopy(String(r.claim_safe_version), "Đã copy.")} />}
                                <CopyBtn label="Copy brief" onClick={() => doCopy(full, "Đã copy brief.")} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-slate-400">Chưa có gợi ý nội dung gắn brand này — xem tổng hợp ở Tổng quan.</p>}
                  </Section>

                  {/* 11. Ads examples (full) */}
                  <Section icon={Layers} title="Ví dụ quảng cáo" full>
                    {p.ads.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-slate-400 font-mono uppercase tracking-wider">
                            <tr className="text-left border-b border-slate-100"><th className="py-1.5 pr-2">Hook</th><th className="pr-2">Định dạng</th><th className="pr-2">Ưu đãi</th><th className="pr-2">Ngày</th><th>Ad</th></tr>
                          </thead>
                          <tbody>
                            {p.ads.slice(0, 10).map((a, i) => (
                              <tr key={a.ad_id || i} className="border-b border-slate-50">
                                <td className="py-1.5 pr-2 text-slate-700 max-w-[16rem] truncate">{orUnknown(a.hook_raw_text || a.hook_text || a.headline)}</td>
                                <td className="pr-2 text-slate-500">{viLabel(String(a.ad_format || a.media_type || ""))}</td>
                                <td className="pr-2 text-slate-500">{isMeaningful(a.offer_detected) ? String(a.offer_detected) : "—"}</td>
                                <td className="pr-2 text-slate-500">{orUnknown(a.days_active)}</td>
                                <td>{a.ad_snapshot_url ? <a href={String(a.ad_snapshot_url)} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline inline-flex items-center gap-0.5">mở <ExternalLink className="w-3 h-3" /></a> : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
