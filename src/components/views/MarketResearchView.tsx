import React, { useMemo } from "react";
import { TrendingUp, Globe, Gauge, Lightbulb, FileSearch, AlertTriangle, Info } from "lucide-react";
import type { SpyDashboardData, MarketSizeEstimate } from "../../types";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (v: unknown) => `${Math.round(num(v) * 100)}%`;
function money(v: unknown, currency = "USD"): string {
  const n = num(v);
  if (!n) return "—";
  const sym = currency === "USD" ? "$" : "";
  if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${sym}${(n / 1e3).toFixed(0)}K`;
  return `${sym}${n}`;
}

const DIR_COLOR: Record<string, string> = {
  up: "text-emerald-600 bg-emerald-50 border-emerald-200",
  emerging: "text-cyan-600 bg-cyan-50 border-cyan-200",
  stable: "text-slate-600 bg-slate-50 border-slate-200",
  down: "text-rose-600 bg-rose-50 border-rose-200",
  unclear: "text-amber-600 bg-amber-50 border-amber-200",
};

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className="w-4.5 h-4.5 text-cyan-600" />
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
      </div>
      {desc && <p className="text-xs text-slate-500 mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Band({ label, low, mid, high, currency }: { label: string; low: unknown; mid: unknown; high: unknown; currency?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-lg font-extrabold text-slate-900">{money(mid, currency)}</p>
      <p className="text-xs text-slate-500">{money(low, currency)} – {money(high, currency)}</p>
    </div>
  );
}

export default function MarketResearchView({ data }: { data: SpyDashboardData }) {
  const runs = data.marketResearchRuns ?? [];
  const sources = data.marketSources ?? [];
  const trends = data.trendSignals ?? [];
  const activity = data.competitorMarketActivity ?? [];
  const sizes = data.marketSizeEstimates ?? [];
  const briefs = data.serynOpportunityBriefs ?? [];

  const latestRun = runs[runs.length - 1];
  const size: MarketSizeEstimate | undefined = sizes[sizes.length - 1];
  const topTrends = useMemo(() => [...trends].sort((a, b) => num(b.strength_score) - num(a.strength_score)).slice(0, 8), [trends]);
  const topActivity = useMemo(() => [...activity].sort((a, b) => num(b.digital_share_of_voice_score) - num(a.digital_share_of_voice_score)).slice(0, 8), [activity]);

  const hasData = runs.length || sources.length || trends.length;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <FileSearch className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Market Research has not been run yet.</p>
          <p className="text-xs text-slate-500 mt-1">Run the manual GitHub workflow <code className="font-mono text-cyan-700">Market Research Manual</code> to generate insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {/* A. Market Overview */}
      <Section icon={Globe} title="A. Market Overview" desc={latestRun ? `${latestRun.market} · ${latestRun.geo} · ${latestRun.service_category} — run ${latestRun.status} @ ${latestRun.finished_at || latestRun.started_at}` : undefined}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Sources" value={String(sources.length)} />
          <Stat label="Trend signals" value={String(trends.length)} />
          <Stat label="Opportunity briefs" value={String(briefs.length)} />
          <Stat label="Market size conf." value={size ? pct(size.confidence_score) : "—"} />
        </div>
      </Section>

      {/* B. Trend Radar */}
      <Section icon={TrendingUp} title="B. Trend Radar">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 font-mono uppercase tracking-wider">
              <tr className="text-left border-b border-slate-100">
                <th className="py-2 pr-3">Topic</th><th className="pr-3">Direction</th>
                <th className="pr-3">Strength</th><th className="pr-3">Conf.</th><th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {topTrends.map((t, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-bold text-slate-800">{t.topic}</td>
                  <td className="pr-3"><span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${DIR_COLOR[String(t.direction)] || DIR_COLOR.stable}`}>{String(t.direction || "stable")}</span></td>
                  <td className="pr-3 text-slate-600">{pct(t.strength_score)}</td>
                  <td className="pr-3 text-slate-600">{pct(t.confidence_score)}</td>
                  <td className="text-slate-500 max-w-xs truncate">{t.evidence || t.trend_signal}</td>
                </tr>
              ))}
              {!topTrends.length && <tr><td colSpan={5} className="py-3 text-slate-400">Chưa có trend signal.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* C. Market Size Estimates */}
      <Section icon={Gauge} title="C. Market Size Estimates">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Directional estimate, not audited market-size data.
        </div>
        {size ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Band label="TAM" low={size.tam_low} mid={size.tam_mid} high={size.tam_high} currency={String(size.currency)} />
              <Band label="SAM" low={size.sam_low} mid={size.sam_mid} high={size.sam_high} currency={String(size.currency)} />
              <Band label="SOM" low={size.som_low} mid={size.som_mid} high={size.som_high} currency={String(size.currency)} />
            </div>
            <dl className="mt-3 grid md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div><dt className="inline font-bold text-slate-600">Method: </dt><dd className="inline text-slate-500">{size.method}</dd></div>
              <div><dt className="inline font-bold text-slate-600">Confidence: </dt><dd className="inline text-slate-500">{pct(size.confidence_score)}</dd></div>
              <div className="md:col-span-2"><dt className="inline font-bold text-slate-600">Assumptions: </dt><dd className="inline text-slate-500">{size.assumptions}</dd></div>
              <div className="md:col-span-2"><dt className="inline font-bold text-slate-600">Missing data: </dt><dd className="inline text-slate-500">{size.missing_data}</dd></div>
            </dl>
          </>
        ) : <p className="text-xs text-slate-400">Chưa có market size estimate.</p>}
      </Section>

      {/* D. Competitor Digital Share of Voice */}
      <Section icon={Globe} title="D. Competitor Digital Share of Voice" desc="Không phải market share — chỉ là tín hiệu hiện diện digital (ads + web mentions).">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 font-mono uppercase tracking-wider">
              <tr className="text-left border-b border-slate-100">
                <th className="py-2 pr-3">Brand</th><th className="pr-3">Active ads</th><th className="pr-3">Web mentions</th>
                <th className="pr-3">Offers</th><th className="pr-3">Top offer</th><th>SoV</th>
              </tr>
            </thead>
            <tbody>
              {topActivity.map((a, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-bold text-slate-800">{a.brand}</td>
                  <td className="pr-3 text-slate-600">{String(a.active_ads_count ?? "—")}</td>
                  <td className="pr-3 text-slate-600">{String(a.web_mentions_count ?? "—")}</td>
                  <td className="pr-3 text-slate-600">{String(a.offer_count ?? "—")}</td>
                  <td className="pr-3 text-slate-500 max-w-[10rem] truncate">{a.top_offer}</td>
                  <td className="text-slate-600 font-bold">{pct(a.digital_share_of_voice_score)}</td>
                </tr>
              ))}
              {!topActivity.length && <tr><td colSpan={6} className="py-3 text-slate-400">Chưa có competitor activity.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* E. Source Explorer */}
      <Section icon={FileSearch} title="E. Source Explorer">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sources.slice(0, 40).map((s, i) => (
            <div key={i} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <a href={String(s.source_url)} target="_blank" rel="noreferrer" className="text-xs font-bold text-cyan-700 hover:underline truncate">{s.title || s.source_url}</a>
                <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">{s.source_type}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{s.summary}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {String(s.detected_services || "").split("|").filter(Boolean).slice(0, 4).map((x, j) => (
                  <span key={j} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">{x}</span>
                ))}
                <span className="text-[10px] text-slate-400 ml-auto">rel {pct(s.relevance_score)} · cred {pct(s.credibility_score)}</span>
              </div>
            </div>
          ))}
          {!sources.length && <p className="text-xs text-slate-400">Chưa có source.</p>}
        </div>
      </Section>

      {/* F. SERYN Opportunity Briefs */}
      <Section icon={Lightbulb} title="F. SERYN Opportunity Briefs">
        <div className="grid md:grid-cols-2 gap-3">
          {briefs.slice(0, 8).map((b, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-cyan-600 font-bold">{b.opportunity_type}</span>
                <span className="text-[10px] font-bold text-slate-500">{b.priority}</span>
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1">{b.insight}</p>
              <p className="text-[11px] text-slate-500 mt-1"><b>Action:</b> {b.recommended_seryn_action} · <b>Hook:</b> {b.suggested_hook}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{b.suggested_content_angle}</p>
            </div>
          ))}
          {!briefs.length && <p className="text-xs text-slate-400">Chưa có opportunity brief.</p>}
        </div>
      </Section>

      {/* G. Assumptions & Confidence */}
      <Section icon={Info} title="G. Assumptions & Confidence">
        <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
          <li><b>Nguồn thật:</b> {sources.length} web sources từ Exa (relevance/credibility scored).</li>
          <li><b>Suy luận:</b> trend direction, digital share of voice, market size — đều là directional, rule-based.</li>
          <li><b>Market size:</b> {size ? `method=${size.method}, confidence=${pct(size.confidence_score)}, missing=${size.missing_data}` : "chưa có"}.</li>
          <li>Confidence thấp khi thiếu detected_market_numbers / detected_prices. Không trình bày như audited data.</li>
        </ul>
      </Section>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-900">Market Research</h2>
      <p className="text-sm text-slate-500">Exa-powered market & trend intelligence — manual/on-demand. Dashboard chỉ đọc Google Sheets.</p>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
