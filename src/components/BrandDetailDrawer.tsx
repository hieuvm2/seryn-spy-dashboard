import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Flame, Layers, Activity, Tag, FileText, GitCompareArrows, Sparkles } from "lucide-react";
import type { SpyDashboardData } from "../types";
import { normalizeNumber, splitChips, orUnknown, countChips, scaleMeta, viLabel, isMissing } from "../utils/spyData";

const CACA: Record<string, string> = {
  copy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  adapt: "bg-amber-50 text-amber-700 border-amber-200",
  counter: "bg-rose-50 text-rose-700 border-rose-200",
  avoid: "bg-slate-100 text-slate-600 border-slate-200",
  monitor: "bg-slate-100 text-slate-600 border-slate-200",
};

function Section({ icon: Icon, title, accent, children }: { icon: any; title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-4 border ${accent ? "border-cyan-200 bg-cyan-50/30" : "border-slate-200 bg-white"}`}>
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
  const items = splitChips(value);
  if (!items.length) return <span className="text-xs text-slate-400">chưa rõ</span>;
  const cls = tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className={`border px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{viLabel(it)}</span>
      ))}
    </div>
  );
}

export default function BrandDetailDrawer({
  brandName,
  data,
  open,
  onClose,
}: {
  brandName: string | null;
  data: SpyDashboardData;
  open: boolean;
  onClose: () => void;
}) {
  const snap = brandName ? data.brandWeeklySnapshot.find((b) => b.brand_name === brandName) : undefined;
  const change = brandName ? data.weeklyStrategyChange.find((c) => c.brand_name === brandName) : undefined;
  const clusters = brandName ? data.scaledContentAnalysis.filter((s) => s.brand_name === brandName) : [];
  const ads = brandName ? data.adLevelAnalysis.filter((a) => a.brand_name === brandName) : [];
  const serviceFreq = countChips(ads, "service_or_product");
  const offerFreq = countChips(ads, "offer_detected");

  return (
    <AnimatePresence>
      {open && brandName && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-[#F8FAFC] z-50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-200 shrink-0">
              <div>
                <p className="text-[10px] uppercase font-mono tracking-widest text-cyan-600 font-bold">HỒ SƠ ĐỐI THỦ</p>
                <h3 className="text-lg font-extrabold text-slate-900">{brandName}</h3>
                {snap && <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-md">{orUnknown(snap.content_strategy_summary)}</p>}
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!snap ? (
                <p className="text-sm text-slate-400 font-semibold">Không có dữ liệu — chưa tìm thấy tổng hợp cho đối thủ này.</p>
              ) : (
                <>
                  {/* 1. Ads volume */}
                  <Section icon={Activity} title="1 · Lượng quảng cáo">
                    <div className="grid grid-cols-2 gap-x-6">
                      <Field label="QC đang chạy" value={orUnknown(snap.total_active_ads)} />
                      <Field label="Đã thu thập" value={orUnknown(snap.total_ads_collected)} />
                      <Field label="Số trang chạy" value={orUnknown(snap.num_pages_running)} />
                      <Field label="Mới tuần này" value={orUnknown(snap.new_ads_count)} />
                      <Field label="Đã dừng" value={orUnknown(snap.stopped_ads_count)} />
                    </div>
                  </Section>

                  {/* 2. Scaled content (đưa lên gần đầu) */}
                  <Section icon={Flame} title="2 · Nội dung nhân rộng chính" accent>
                    {clusters.length ? (
                      <div className="space-y-3">
                        {clusters.map((c) => {
                          const m = scaleMeta(c.scale_level);
                          const caca = String(c.seryn_should_copy_adapt_counter_avoid || "").toLowerCase();
                          return (
                            <div key={c.content_cluster_id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-700">{viLabel(c.content_format)} · {viLabel(c.service_or_product)}</span>
                                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">C{normalizeNumber(c.scale_level)} · {m.label}</span>
                              </div>
                              <p className="text-sm text-slate-700 italic">“{orUnknown(c.representative_hook)}”</p>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{viLabel(c.content_angle)}</span>
                                {!isMissing(c.offer_detected) && <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">{orUnknown(c.offer_detected)}</span>}
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono">{orUnknown(c.number_of_similar_ads)} QC · dài nhất {orUnknown(c.longest_days_active)} ngày · TB {orUnknown(c.average_days_active)} ngày</p>
                              <p className="text-[11px] text-slate-500"><b>Vì sao:</b> {orUnknown(c.why_it_is_scaling)}</p>
                              <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
                                {caca && caca !== "unknown" && <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${CACA[caca] || CACA.monitor}`}>{viLabel(caca)}</span>}
                                <span className="text-[11px] text-cyan-700">{orUnknown(c.seryn_reframe)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold">Chưa có tín hiệu scale rõ ràng cho brand này.</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2 italic">khả năng đang nhân rộng dựa trên thời lượng chạy + lặp lại — chưa xác nhận hiệu quả/lợi nhuận.</p>
                  </Section>

                  {/* 3. Services */}
                  <Section icon={Layers} title="3 · Dịch vụ đang chạy">
                    <Chips value={snap.services_running} />
                    {!!serviceFreq.length && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {serviceFreq.map((s) => (
                          <span key={s.label} className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">
                            {viLabel(s.label)}<b className="text-cyan-600 font-mono">{s.n}</b>
                          </span>
                        ))}
                      </div>
                    )}
                  </Section>

                  {/* 4. Price / Offer */}
                  <Section icon={Tag} title="4 · Giá / Ưu đãi">
                    <Field label="Giá ghi nhận" value={<Chips value={snap.prices_detected} />} />
                    <div className="pt-2"><Chips value={snap.offers_detected} /></div>
                    {!!offerFreq.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {offerFreq.map((o) => (
                          <span key={o.label} className="bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded text-[11px] font-medium">{o.label} ·{o.n}</span>
                        ))}
                      </div>
                    )}
                  </Section>

                  {/* 5. Content formats */}
                  <Section icon={FileText} title="5 · Định dạng nội dung">
                    <div className="space-y-2.5">
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Định dạng</p><Chips value={snap.main_content_formats} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Câu mở (hook)</p><Chips value={snap.main_hooks} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Góc tiếp cận</p><Chips value={snap.main_angles} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Bằng chứng</p><Chips value={snap.main_proof_points} /></div>
                      <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Lời kêu gọi</p><Chips value={snap.main_ctas} /></div>
                    </div>
                  </Section>

                  {/* 6. Weekly change */}
                  <Section icon={GitCompareArrows} title="6 · Thay đổi chiến lược tuần">
                    {change ? (
                      <div className="space-y-2">
                        <Field label="Thay đổi QC" value={orUnknown(change.active_ads_change)} />
                        <Field label="Loại thay đổi" value={viLabel(change.strategic_change_type)} />
                        {splitChips(change.new_services_detected).length > 0 && <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Dịch vụ mới</p><Chips value={change.new_services_detected} tone="emerald" /></div>}
                        {splitChips(change.new_offers_detected).length > 0 && <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Ưu đãi mới</p><Chips value={change.new_offers_detected} tone="emerald" /></div>}
                        {splitChips(change.new_content_angles).length > 0 && <div><p className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Góc mới</p><Chips value={change.new_content_angles} tone="emerald" /></div>}
                        <p className="text-xs text-slate-600 pt-1"><b>Tóm tắt:</b> {orUnknown(change.change_summary)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold">chưa rõ</p>
                    )}
                  </Section>

                  {/* 7. SERYN implication */}
                  <Section icon={Sparkles} title="7 · Hàm ý cho SERYN" accent>
                    <p className="text-sm text-slate-700 leading-relaxed">{orUnknown(snap.seryn_opportunity)}</p>
                    {change?.seryn_implication && <p className="text-sm text-slate-700 leading-relaxed mt-2 pt-2 border-t border-cyan-100">{orUnknown(change.seryn_implication)}</p>}
                    {!!clusters.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {clusters.map((c) => {
                          const k = String(c.seryn_should_copy_adapt_counter_avoid || "").toLowerCase();
                          if (!k || k === "unknown") return null;
                          return <span key={c.content_cluster_id} className={`text-[11px] font-bold px-2 py-0.5 rounded border ${CACA[k] || CACA.monitor}`}>{viLabel(k)}</span>;
                        })}
                      </div>
                    )}
                  </Section>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
