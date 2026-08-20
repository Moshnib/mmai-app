"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import { HISTORY } from "@/lib/history";
import { PILLAR_NAMES, PILLAR_WEIGHTS, computePillarScores, computeComposite, bandFor, type PillarKey } from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { sourcesForMarket, sourceForPillar } from "@/lib/sources";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

const RAW_FIELD: Record<PillarKey, { key: "inflation" | "gdpGrowth" | "unemployment" | "policyRate" | "brentYoY"; label: string; unit: string }> = {
  PS: { key: "inflation", label: "Inflation (YoY)", unit: "%" },
  GM: { key: "gdpGrowth", label: "GDP Growth", unit: "%" },
  LM: { key: "unemployment", label: "Unemployment Rate", unit: "%" },
  MC: { key: "policyRate", label: "Policy Interest Rate", unit: "%" },
  EC: { key: "brentYoY", label: "Brent Crude, Year-over-Year Change", unit: "%" },
};

export default function TrendsPageInner() {
  const params = useSearchParams();
  const initialMarket = params.get("market") ?? "US";
  const initialPillar = params.get("pillar") as PillarKey | null;

  const [current, setCurrent] = useState(initialMarket);
  const [focusPillar, setFocusPillar] = useState<PillarKey | null>(initialPillar);

  const marketNames = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
  const history = HISTORY[current] ?? [];
  const latestPoint = history[history.length - 1];

  // Every color below is computed from the CURRENT score of what it
  // represents — no fixed per-pillar or per-market identity colors.
  // Two pillars/markets scoring the same land on the same color.
  const compositeCurrentScore = useMemo(() => {
    if (!latestPoint) return null;
    const { composite } = computeComposite(computePillarScores(latestPoint.indicators));
    return composite;
  }, [latestPoint]);

  const pillarCurrentScores: Record<PillarKey, number | null> = useMemo(() => {
    if (!latestPoint) return { PS: null, GM: null, LM: null, MC: null, EC: null };
    return computePillarScores(latestPoint.indicators);
  }, [latestPoint]);

  const compositeSeries: Series[] = useMemo(() => [{
    key: "composite",
    name: marketNames[current],
    color: bandFor(compositeCurrentScore).color,
    data: history.map((h) => {
      const pillars = computePillarScores(h.indicators);
      const { composite } = computeComposite(pillars);
      return { year: h.year, value: composite };
    }),
  }], [current, history, marketNames, compositeCurrentScore]);

  const pillarMiniSeries: Record<PillarKey, Series[]> = useMemo(() => {
    const out = {} as Record<PillarKey, Series[]>;
    ORDER.forEach((key) => {
      out[key] = [{
        key,
        name: PILLAR_NAMES[key],
        color: bandFor(pillarCurrentScores[key]).color,
        data: history.map((h) => {
          const pillars = computePillarScores(h.indicators);
          return { year: h.year, value: pillars[key] };
        }),
      }];
    });
    return out;
  }, [history, pillarCurrentScores]);

  const rawDetailSeries: Series[] | null = useMemo(() => {
    if (!focusPillar) return null;
    const field = RAW_FIELD[focusPillar];
    return [{
      key: field.key,
      name: `${field.label} (${marketNames[current]})`,
      color: bandFor(pillarCurrentScores[focusPillar]).color,
      data: history.map((h) => ({ year: h.year, value: h.indicators[field.key] as number | null })),
    }];
  }, [focusPillar, history, current, marketNames, pillarCurrentScores]);

  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <button className="navlink active">Data Over Time</button>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">DATA OVER TIME</p>
          <h1 className="headline" style={{ maxWidth: "22ch" }}>How the score — and everything behind it — has moved</h1>
          <p className="sub">The composite trend, then every pillar individually. Click any pillar chart below to see the exact raw indicator driving it.</p>

          <div className="tabs">
            {FALLBACK_MARKETS.map((m) => (
              <button
                key={m.code}
                className={`tab${m.code === current ? " active" : ""}`}
                onClick={() => setCurrent(m.code)}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", marginBottom: 8, backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 6 }}>
              COMPOSITE MMAI SCORE
            </div>
            {history.length > 1 ? (
              <TrendChart series={compositeSeries} height={300} yDomain={[0, 100]} />
            ) : (
              <p style={{ color: "var(--slate)", fontSize: 13.5, padding: "40px 0", textAlign: "center" }}>
                Only a single data point exists for {marketNames[current]} so far — a trend needs at least two. Check back after a few refresh cycles.
              </p>
            )}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--hair)", fontSize: 10.5, color: "var(--slate)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span>Composite of {sourcesForMarket(marketNames[current]).length} sources — see the <Link href="/sources" style={{ color: "var(--gold-deep)" }}>Sources</Link> page for each institution</span>
              <span>Most recent point: {history[history.length - 1]?.year ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">FIVE PILLARS, INDIVIDUALLY</p>
            <h2>Click any pillar to see its raw indicator below</h2>
          </div>
          <div className="pillar-grid">
            {ORDER.map((key) => (
              <div
                key={key}
                className="pillar-card"
                style={{ textAlign: "left", cursor: "pointer", border: focusPillar === key ? "1.5px solid var(--gold)" : undefined, boxShadow: focusPillar === key ? "0 0 20px -6px var(--gold)" : undefined }}
                onClick={() => setFocusPillar(key)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="pillar-name" style={{ margin: 0 }}>{PILLAR_NAMES[key]}</span>
                  <span className="pillar-weight">{(PILLAR_WEIGHTS[key] * 100).toFixed(1)}%</span>
                </div>
                {history.length > 1 ? (
                  <TrendChart series={pillarMiniSeries[key]} height={150} yDomain={[0, 100]} showLegend={false} />
                ) : (
                  <div style={{ padding: "30px 0", textAlign: "center", color: "#8A93A6", fontSize: 12 }}>Not enough history yet</div>
                )}
                <div style={{ marginTop: 8, fontSize: 10, fontFamily: "IBM Plex Mono, monospace", color: "var(--gold)", textAlign: "right" }}>
                  ⤢ tap to expand
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {focusPillar && rawDetailSeries && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "26px 30px", color: "#fff", backdropFilter: "blur(14px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "var(--gold)", letterSpacing: 1 }}>
                  RAW INDICATOR DETAIL
                </div>
                <button
                  onClick={() => setFocusPillar(null)}
                  style={{ background: "none", border: "none", color: "#AEB8CC", cursor: "pointer", fontSize: 12 }}
                >
                  ✕ Close
                </button>
              </div>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "0 0 16px" }}>
                {RAW_FIELD[focusPillar].label} — {marketNames[current]}
              </h3>
              {history.length > 1 ? (
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 16px" }}>
                  <TrendChart series={rawDetailSeries} height={260} showLegend={false} yLabel={RAW_FIELD[focusPillar].unit} />
                </div>
              ) : (
                <p style={{ color: "#AEB8CC", fontSize: 13.5 }}>Not enough history yet for {marketNames[current]}.</p>
              )}
              {(() => {
                const src = sourceForPillar(marketNames[current], focusPillar);
                if (!src) return null;
                return (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #2B3B5C", fontSize: 11, color: "#AEB8CC", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span>Source: <b style={{ color: "#fff" }}>{src.institution}</b></span>
                    <span style={{ fontFamily: "monospace" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: src.status === "live" ? "rgba(47,111,98,0.35)" : "rgba(198,161,91,0.25)", color: src.status === "live" ? "#8FD9C4" : "#E6CE96", marginRight: 8 }}>
                        {src.status === "live" ? "LIVE" : "MANUAL"}
                      </span>
                      Verified {src.lastVerified}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <footer>
        <div className="wrap">
          © 2026 MMAI — Moshnib Market Analysis Index. An analytical communication tool, not investment advice.
        </div>
      </footer>
    </>
  );
}
