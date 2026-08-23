"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import Flag from "@/components/Flag";
import { useLiveHistory } from "@/lib/useLiveHistory";
import { PILLAR_NAMES, formatWeightPct, RAW_FIELD, computePillarScores, computeComposite, bandFor, type PillarKey } from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { sourcesForMarket, sourceForPillar } from "@/lib/sources";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

// The market/pillar from the URL arrive as props read on the SERVER (see
// app/trends/page.tsx). Previously this component called useSearchParams(),
// which forces Next to skip prerendering the enclosing Suspense boundary --
// and since that boundary wrapped the whole page, the server sent nothing but
// "Loading…". Every crawler that doesn't run JavaScript (LinkedIn, Slack,
// WhatsApp, X, Bing) saw an empty page.
export default function TrendsPageInner({
  initialMarket = "US",
  initialPillar = null,
}: {
  initialMarket?: string;
  initialPillar?: PillarKey | null;
}) {
  const [current, setCurrent] = useState(initialMarket);
  const [focusPillar, setFocusPillar] = useState<PillarKey | null>(initialPillar);
  const detailRef = useRef<HTMLDivElement>(null);

  // Scroll the expanded detail panel into view the moment a pillar is
  // clicked -- without this, the panel appears correctly but silently
  // further down the page, which reads as "the click did nothing."
  useEffect(() => {
    if (focusPillar && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusPillar]);

  const marketNames = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
  const { history: liveHistory } = useLiveHistory();
  const history = liveHistory[current] ?? [];
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

  // Fixed colors here, not score-based — these are raw rates, not 0-100
  // scores, so there's no "band" to color by. Picked from the same
  // Ember-to-Ice palette used everywhere else in the app (lib/scoring.ts),
  // so nothing new is introduced and green is still never used.
  const rateComparisonSeries: Series[] = useMemo(() => [
    { key: "inflation", name: RAW_FIELD.PS.label, color: "#E14B4B", data: history.map((h) => ({ year: h.year, value: h.indicators.inflation ?? null })) },
    { key: "policyRate", name: RAW_FIELD.MC.label, color: "#8B5CF6", data: history.map((h) => ({ year: h.year, value: h.indicators.policyRate ?? null })) },
    { key: "unemployment", name: RAW_FIELD.LM.label, color: "#22D3EE", data: history.map((h) => ({ year: h.year, value: h.indicators.unemployment ?? null })) },
  ], [history]);

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
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
            <Link href="/contact" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Contact</Link>
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
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Flag code={m.code} size={18} /> {m.name}
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
                Only a single data point exists for {marketNames[current]} so far — a trend needs at least two. This market&apos;s historical series hasn&apos;t been backfilled yet.
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
                  <span className="pillar-weight">{formatWeightPct(key)}</span>
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

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">HOW THEY MOVE TOGETHER</p>
            <h2>Policy rate, inflation, and unemployment — one decision, three angles</h2>
          </div>
          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", backdropFilter: "blur(14px)" }}>
            <p style={{ fontSize: 13.5, color: "var(--slate)", margin: "0 0 18px", maxWidth: "70ch" }}>
              A central bank raises its policy rate specifically to cool inflation — and that same rate hike typically slows hiring, nudging unemployment up. This is where that relationship shows up in {marketNames[current]}&apos;s own numbers — though each rate also moves for reasons of its own, so don&apos;t expect every wiggle to line up.
            </p>
            {history.length > 1 ? (
              <TrendChart series={rateComparisonSeries} height={320} yLabel="%" showDots={false} />
            ) : (
              <p style={{ color: "var(--slate)", fontSize: 13.5, padding: "40px 0", textAlign: "center" }}>
                Only a single data point exists for {marketNames[current]} so far — a trend needs at least two.
              </p>
            )}
          </div>
        </div>
      </div>

      {focusPillar && rawDetailSeries && (
        <div className="section" style={{ paddingTop: 0 }} ref={detailRef}>
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
                      {/* Design tokens, not hardcoded colors -- the previous
                          literals here (rgba(47,111,98) / #8FD9C4) were a
                          leftover green from the old palette, the one place
                          green survived in the UI. The Sources page badge
                          already used these tokens correctly. */}
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: src.status === "live" ? "var(--teal-bg)" : "var(--gold-bg)", color: src.status === "live" ? "var(--teal)" : "var(--gold-deep)", marginRight: 8 }}>
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
    </>
  );
}
