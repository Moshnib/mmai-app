"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import Flag from "@/components/Flag";
import { PILLAR_DESC, PILLAR_ICONS } from "@/components/PillarGrid";
import { RAW_DECIMALS } from "@/components/KeyRatesRow";
import { MONTHLY_HISTORY, type MonthlyPoint } from "@/lib/monthlyHistory";
import { useLiveHistory } from "@/lib/useLiveHistory";
import { PILLAR_NAMES, formatWeightPct, RAW_FIELD, computePillarScores, computeComposite, bandFor, type PillarKey } from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { sourcesForMarket, sourceForPillar } from "@/lib/sources";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

// Module scope, not per-render: derived purely from a module constant,
// so rebuilding it each render would invalidate the memos below it.
const MARKET_NAMES: Record<string, string> = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));

// Below this, a "move" is rounding noise rather than a change worth
// naming -- both bullets print to one decimal, so anything under 0.05
// would render as "+0.0 points".
const MOVE_EPSILON = 0.05;

// The three headline rates shown together in section 5. Keyed by pillar
// (not by raw field name) so each value can be printed at its own
// precision, and so a renamed RawIndicators key is a compile error here
// rather than a blank cell -- the same reasoning as KeyRatesRow.
// Colours match KeyRatesRow exactly, from the Ember-to-Ice palette in
// lib/scoring.ts, so these three read as the same three things sitewide.
const RATE_PILLARS: Array<{ pillar: PillarKey; color: string }> = [
  { pillar: "PS", color: "#E14B4B" },
  { pillar: "MC", color: "#8B5CF6" },
  { pillar: "LM", color: "#22D3EE" },
];

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
  // Always a pillar selected, never null: the page's shape is now
  // "five cards driving one chart" (brief §26), so an empty selection
  // would leave two sections rendering nothing at all.
  const [focusPillar, setFocusPillar] = useState<PillarKey>(initialPillar ?? "PS");
  const pillarSectionRef = useRef<HTMLDivElement>(null);
  const arrivedWithPillar = useRef(initialPillar !== null);

  // Only scroll when the reader ARRIVED on a pillar link from another
  // page. Clicking a card here needs no scroll -- its chart is directly
  // underneath -- and scrolling on every click would yank the cards out
  // from under the cursor.
  //
  // Deferred so the scroll runs after the browser has laid the page out
  // rather than during React's commit phase.
  //
  // setTimeout, NOT requestAnimationFrame -- the same lesson already
  // recorded in ScoreDisplay: rAF is tied to the paint/compositing
  // cycle, so in any context that isn't actively painting (a background
  // tab, an embedded preview) the callback simply never runs. Measured
  // here: the effect fired but the rAF callback had still not run after
  // four seconds, leaving the page at scrollY 0.
  //
  // The one-shot flag is also spent INSIDE the callback, never before
  // scheduling it. StrictMode mounts effects twice in development, so
  // spending it up front would let run 1 clear the flag and have its
  // timer cleared by the cleanup, leaving run 2 with nothing to do.
  useEffect(() => {
    if (!arrivedWithPillar.current) return;
    const id = setTimeout(() => {
      if (!arrivedWithPillar.current) return;
      arrivedWithPillar.current = false;
      // Smooth only when the reader hasn't asked for reduced motion.
      // A smooth scroll is an animation, so it also depends on the
      // compositor -- in a context that isn't painting it silently
      // never advances, where an instant scroll still lands.
      const reduceMotion =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      pillarSectionRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(id);
  }, []);

  const marketNames = MARKET_NAMES;
  const { history: liveHistory } = useLiveHistory();
  // Memoised because `?? []` builds a fresh array on every render, which
  // would otherwise invalidate every useMemo below it each time.
  const history = useMemo(() => liveHistory[current] ?? [], [liveHistory, current]);
  const latestPoint = history[history.length - 1];
  const hasTrend = history.length > 1;

  // Every color below is computed from the CURRENT score of what it
  // represents — no fixed per-pillar or per-market identity colors.
  // Two pillars/markets scoring the same land on the same color.
  const compositeCurrentScore = useMemo(() => {
    if (!latestPoint) return null;
    const { composite } = computeComposite(computePillarScores(latestPoint.indicators, current));
    return composite;
  }, [latestPoint, current]);

  const pillarCurrentScores: Record<PillarKey, number | null> = useMemo(() => {
    if (!latestPoint) return { PS: null, GM: null, LM: null, MC: null, EC: null };
    return computePillarScores(latestPoint.indicators, current);
  }, [latestPoint, current]);

  const compositeSeries: Series[] = useMemo(() => [{
    key: "composite",
    name: marketNames[current],
    color: bandFor(compositeCurrentScore).color,
    data: history.map((h) => {
      const pillars = computePillarScores(h.indicators, current);
      const { composite } = computeComposite(pillars);
      return { year: h.year, value: composite };
    }),
  }], [current, history, marketNames, compositeCurrentScore]);

  // "What changed?" — the header panel. Every line is arithmetic on the
  // series already on screen (latest point vs the one before it), not a
  // new judgement about the market.
  const changes = useMemo(() => {
    if (history.length < 2) return null;
    const prev = history[history.length - 2];
    const prevPillars = computePillarScores(prev.indicators, current);
    const compPrev = computeComposite(prevPillars).composite;
    const compNow = compositeCurrentScore;

    const moves = ORDER
      .map((key) => {
        const a = prevPillars[key];
        const b = pillarCurrentScores[key];
        return a == null || b == null ? null : { key, delta: b - a };
      })
      .filter((m): m is { key: PillarKey; delta: number } => m !== null)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const missing = ORDER.filter((k) => pillarCurrentScores[k] == null);

    const largest = moves[0] ?? null;
    const smallest = moves.length > 1 ? moves[moves.length - 1] : null;

    // Two guards, both about not stating something false:
    //  - if nothing actually moved, there is no "biggest move" to name;
    //  - if the largest and smallest moves are the same size, the pair
    //    is meaningless (with two pillars at +5 and -5, whichever came
    //    first in ORDER would arbitrarily win each label).
    const moved = largest != null && Math.abs(largest.delta) >= MOVE_EPSILON;
    const separated = smallest != null && Math.abs(largest!.delta) - Math.abs(smallest.delta) >= MOVE_EPSILON;

    return {
      from: prev.year,
      to: latestPoint.year,
      composite: compNow != null && compPrev != null ? compNow - compPrev : null,
      biggest: moved ? largest : null,
      smallest: moved && separated ? smallest : null,
      missing,
    };
  }, [history, latestPoint, compositeCurrentScore, pillarCurrentScores, current]);

  const focusSeries: Series[] = useMemo(() => [{
    key: focusPillar,
    name: PILLAR_NAMES[focusPillar],
    color: bandFor(pillarCurrentScores[focusPillar]).color,
    data: history.map((h) => {
      const pillars = computePillarScores(h.indicators, current);
      return { year: h.year, value: pillars[focusPillar] };
    }),
  }], [focusPillar, history, pillarCurrentScores, current]);

  // MONTHLY where the sources publish monthly, annual only as a
  // fallback. Inflation, unemployment and the policy rate all have a
  // real monthly back-series (lib/monthlyHistory.ts); GDP growth and
  // Brent do not, so those two still fall back to the annual points.
  // This is why the chart stopped being one dot per year.
  const monthly = MONTHLY_HISTORY[current] ?? [];
  const monthlyField: Partial<Record<PillarKey, keyof MonthlyPoint>> = {
    PS: "inflation",
    LM: "unemployment",
    MC: "policyRate",
  };

  const rawDetailSeries: Series[] = useMemo(() => {
    const field = RAW_FIELD[focusPillar];
    const mField = monthlyField[focusPillar];
    const color = bandFor(pillarCurrentScores[focusPillar]).color;

    if (mField) {
      // Points with no published value are DROPPED, not zeroed -- Japan
      // has no monthly inflation at all and Australia's starts in 2025,
      // and a zero would draw a cliff that never happened.
      const pts = monthly
        .map((m) => ({ year: m.period, value: m[mField] as number | null }))
        .filter((p) => p.value != null);
      if (pts.length > 1) {
        return [{ key: field.key, name: `${field.label} (${marketNames[current]})`, color, data: pts }];
      }
    }

    return [{
      key: field.key,
      name: `${field.label} (${marketNames[current]})`,
      color,
      data: history.map((h) => ({ year: h.year, value: h.indicators[field.key] as number | null })),
    }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPillar, history, current, marketNames, pillarCurrentScores, monthly]);

  const rawIsMonthly = (() => {
    const f = monthlyField[focusPillar];
    return !!f && monthly.filter((m) => m[f] != null).length > 1;
  })();

  // Fixed colors here, not score-based — these are raw rates, not 0-100
  // scores, so there's no "band" to color by. Picked from the same
  // Ember-to-Ice palette used everywhere else in the app (lib/scoring.ts),
  // so nothing new is introduced and green is still never used.
  const rateComparisonSeries: Series[] = useMemo(
    () =>
      RATE_PILLARS.map(({ pillar, color }) => ({
        key: RAW_FIELD[pillar].key,
        name: RAW_FIELD[pillar].label,
        color,
        data: history.map((h) => ({ year: h.year, value: (h.indicators[RAW_FIELD[pillar].key] as number | null) ?? null })),
      })),
    [history]
  );

  const focusBand = bandFor(pillarCurrentScores[focusPillar]);
  const rawNow = latestPoint ? (latestPoint.indicators[RAW_FIELD[focusPillar].key] as number | null) : null;
  const focusSource = sourceForPillar(marketNames[current], focusPillar);

  const notEnough = (
    <p style={{ color: "var(--slate)", fontSize: 13.5, padding: "40px 0", textAlign: "center" }}>
      Not enough history yet to chart a trend for {marketNames[current]} — that needs at least two points.
    </p>
  );

  const sectionLabel = (n: number, text: string) => (
    <div className="chart-card-label">
      <span style={{ color: "var(--slate)" }}>{n}</span>
      <span>{text}</span>
    </div>
  );

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <div className="page-head-row">
            <div>
              <p className="eyebrow">DATA OVER TIME</p>
              <h1 className="headline" style={{ maxWidth: "20ch" }}>
                How the score — and everything behind it — has moved
              </h1>
              <p className="sub" style={{ marginLeft: 0 }}>
                Start with the composite, then open any one of the five pillars to see its own trend and the raw
                indicator underneath it.
              </p>
              {/* Inside the left column, beside the panel -- matching
                  the design reference. Full-width below the header (as
                  this was) left the panel floating with 150px of dead
                  space under it, which is what made its position read
                  as wrong. These two columns now fill each other out. */}
              <div className="tabs tabs-inline" style={{ marginTop: 20 }}>
                {FALLBACK_MARKETS.map((m) => (
                  <button
                    key={m.code}
                    className={`tab${m.code === current ? " active" : ""}`}
                    onClick={() => setCurrent(m.code)}
                    aria-pressed={m.code === current}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                  >
                    <Flag code={m.code} size={17} /> {m.name}
                  </button>
                ))}
              </div>

            </div>

            {/* Stretches to the full header height so it ends flush
                with the market tabs beside it (as the design reference
                shows) instead of stopping short and leaving a void.
                The "latest data" line is pinned to its bottom, which
                fills that height with something real rather than
                padding. */}
            <div className="insight-card insight-card-tall">
              {/* The period lives in the heading, not in one bullet:
                  the composite bullet is suppressed whenever coverage
                  falls under the publication gate, and without it the
                  bullets below would name moves with no period at all. */}
              <h3 style={{ justifyContent: "space-between" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--gold-deep)" }}>◆</span> What changed?
                </span>
                {changes && (
                  <span className="meta-label" style={{ fontWeight: 500 }}>
                    {changes.from} → {changes.to}
                  </span>
                )}
              </h3>
              {changes ? (
                <ul>
                  {changes.composite != null && (
                    <li>
                      <i style={{ background: bandFor(compositeCurrentScore).color }} />
                      <span>
                        Composite score moved{" "}
                        <b style={{ color: "#fff" }}>
                          {changes.composite >= 0 ? "+" : ""}
                          {changes.composite.toFixed(1)}
                        </b>{" "}
                        over this period.
                      </span>
                    </li>
                  )}
                  {/* "this period" throughout, never "steadiest": these
                      are the largest and smallest moves between the last
                      two points only. A pillar can post the smallest
                      move here and still be the most volatile one on the
                      chart below -- calling it "steadiest" said the
                      opposite of what that chart shows. */}
                  {changes.biggest && (
                    <li>
                      <i style={{ background: bandFor(pillarCurrentScores[changes.biggest.key]).color }} />
                      <span>
                        Largest move this period: <b style={{ color: "#fff" }}>{PILLAR_NAMES[changes.biggest.key]}</b>,{" "}
                        {changes.biggest.delta >= 0 ? "+" : ""}
                        {changes.biggest.delta.toFixed(1)} points.
                      </span>
                    </li>
                  )}
                  {changes.smallest && (
                    <li>
                      <i style={{ background: bandFor(pillarCurrentScores[changes.smallest.key]).color }} />
                      <span>
                        Smallest move this period: <b style={{ color: "#fff" }}>{PILLAR_NAMES[changes.smallest.key]}</b>,{" "}
                        {changes.smallest.delta >= 0 ? "+" : ""}
                        {changes.smallest.delta.toFixed(1)} points.
                      </span>
                    </li>
                  )}
                  {changes.missing.length > 0 && (
                    <li>
                      <i style={{ background: "var(--slate)" }} />
                      <span>
                        No current reading for{" "}
                        <b style={{ color: "#fff" }}>{changes.missing.map((k) => PILLAR_NAMES[k]).join(", ")}</b> —
                        excluded rather than guessed.
                      </span>
                    </li>
                  )}
                </ul>
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--slate)", margin: 0, lineHeight: 1.5 }}>
                  {marketNames[current]} doesn&apos;t have two periods of history yet, so there is nothing to compare
                  against.
                </p>
              )}

              <p className="meta-label insight-card-foot">
                Latest data: {latestPoint?.year ?? "—"} · Annual · {sourcesForMarket(marketNames[current]).length} sources
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 1 — the composite */}
      <div className="section" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="chart-card">
            {sectionLabel(1, `MMAI composite score over time — ${marketNames[current]}`)}
            {hasTrend ? <TrendChart series={compositeSeries} height={320} yDomain={[0, 100]} /> : notEnough}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--hair)", fontSize: 10.5, color: "var(--slate)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span>
                Built from {sourcesForMarket(marketNames[current]).length} sources — each institution is listed on the{" "}
                <Link href="/sources" style={{ color: "var(--gold-deep)" }}>Sources</Link> page
              </span>
              <span>Most recent point: {latestPoint?.year ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2 — pillar selectors */}
      <div className="section" style={{ paddingTop: 0 }} ref={pillarSectionRef} id="pillars">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">2 — EXPLORE THE FIVE PILLARS</p>
            <h2>Pick a pillar to drive the two charts below</h2>
            <p>Each card shows what that pillar scores right now, out of 100, and what it measures.</p>
          </div>

          <div className="pillar-select-grid" style={{ marginTop: 22 }}>
            {ORDER.map((key) => {
              const val = pillarCurrentScores[key];
              const band = val == null ? { color: "var(--slate)" } : bandFor(val);
              const active = focusPillar === key;
              return (
                <button
                  key={key}
                  type="button"
                  className="pillar-select-card"
                  aria-pressed={active}
                  onClick={() => setFocusPillar(key)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <svg
                      viewBox="0 0 16 16" width={20} height={20} aria-hidden="true"
                      fill="none" stroke={band.color} strokeWidth={1.3}
                      strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", opacity: 0.95 }}
                    >
                      {PILLAR_ICONS[key]}
                    </svg>
                    {/* Labelled: a bare "25%" beside a "74/100" score
                        reads as a change or a share, not a weight. */}
                    <span className="meta-label">{formatWeightPct(key)} weight</span>
                  </div>
                  <div
                    className="psc-score"
                    style={{
                      color: band.color,
                      textShadow: val == null ? undefined : `0 0 14px ${band.color}55`,
                      filter: val == null ? undefined : "brightness(1.12) saturate(1.05)",
                    }}
                  >
                    {val == null ? "—" : val.toFixed(0)}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)", marginLeft: 4 }}>/100</span>
                  </div>
                  <div className="psc-name">{PILLAR_NAMES[key]}</div>
                  <div className="psc-desc">{PILLAR_DESC[key]}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3 — the selected pillar's own score history */}
      <div className="section" style={{ paddingTop: 26 }}>
        <div className="wrap">
          <div className="chart-card">
            {sectionLabel(3, `${PILLAR_NAMES[focusPillar]} over time — ${marketNames[current]}`)}
            {hasTrend ? <TrendChart series={focusSeries} height={300} yDomain={[0, 100]} showLegend={false} /> : notEnough}
          </div>
        </div>
      </div>

      {/* 4 — the raw indicator underneath that pillar */}
      <div className="section" style={{ paddingTop: 26 }}>
        <div className="wrap">
          <div className="chart-card">
            <div className="chart-card-label">
              <span style={{ color: "var(--slate)" }}>4</span>
              <span>Raw indicator behind {PILLAR_NAMES[focusPillar]}</span>
              {/* States the frequency outright. The same chart is monthly
                  for inflation/unemployment/policy rate and annual for
                  GDP and Brent, and a reader should not have to infer
                  which from the tick spacing. */}
              <span
                className="meta-label"
                style={{ marginLeft: "auto", border: "1px solid var(--hair)", borderRadius: 999, padding: "3px 9px" }}
              >
                {rawIsMonthly ? `Monthly · ${rawDetailSeries[0].data.length} points` : "Annual"}
              </span>
            </div>
            <div className="detail-split">
              <div>
                {hasTrend ? (
                  <TrendChart series={rawDetailSeries} height={280} showLegend={false} yLabel={RAW_FIELD[focusPillar].unit} />
                ) : (
                  <p style={{ color: "var(--slate)", fontSize: 13.5, padding: "40px 0", textAlign: "center" }}>
                    Not enough history yet for {marketNames[current]}.
                  </p>
                )}
              </div>

              <div style={{ border: "1px solid var(--hair)", borderRadius: 14, padding: "16px 18px", background: "rgba(255,255,255,0.03)" }}>
                <div className="meta-label">Current reading</div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700,
                    color: focusBand.color, margin: "6px 0 2px", fontVariantNumeric: "tabular-nums",
                    filter: rawNow == null ? undefined : "brightness(1.12) saturate(1.05)",
                  }}
                >
                  {rawNow == null ? "—" : rawNow.toFixed(RAW_DECIMALS[focusPillar])}
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--slate)", marginLeft: 5 }}>
                    {RAW_FIELD[focusPillar].unit}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  {RAW_FIELD[focusPillar].label}
                </div>

                <div style={{ borderTop: "1px solid var(--hair)", marginTop: 14, paddingTop: 12, display: "grid", gap: 8, fontSize: 11.5, color: "var(--slate)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>Weight in score</span>
                    <b style={{ color: "#fff" }}>{formatWeightPct(focusPillar)}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>Period</span>
                    <b style={{ color: "#fff" }}>{latestPoint?.year ?? "—"}</b>
                  </div>
                  {focusSource && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span>Source</span>
                        <b style={{ color: "#fff", textAlign: "right" }}>{focusSource.institution}</b>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        {/* Design tokens, not hardcoded colors -- the previous
                            literals here (rgba(47,111,98) / #8FD9C4) were a
                            leftover green from the old palette, the one place
                            green survived in the UI. */}
                        <span
                          style={{
                            padding: "2px 8px", borderRadius: 999, fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
                            background: focusSource.status === "live" ? "var(--teal-bg)" : "var(--gold-bg)",
                            color: focusSource.status === "live" ? "var(--teal)" : "var(--gold-deep)",
                          }}
                        >
                          {focusSource.status === "live" ? "LIVE" : "MANUAL"}
                        </span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>Verified {focusSource.lastVerified}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 — the three headline rates together */}
      <div className="section" style={{ paddingTop: 26 }}>
        <div className="wrap">
          <div className="chart-card">
            {sectionLabel(5, "How key macro forces move together")}
            <div className="detail-split">
              <div>
                {hasTrend ? <TrendChart series={rateComparisonSeries} height={320} yLabel="%" showDots={false} /> : notEnough}
              </div>
              <div style={{ border: "1px solid var(--hair)", borderRadius: 14, padding: "16px 18px", background: "rgba(255,255,255,0.03)" }}>
                <div className="meta-label">Why these three</div>
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "8px 0 0" }}>
                  A central bank raises its policy rate specifically to cool inflation — and that same rate hike
                  typically slows hiring, nudging unemployment up. This is where that relationship shows up in{" "}
                  {marketNames[current]}&apos;s own numbers.
                </p>
                <p style={{ fontSize: 11.5, color: "var(--slate)", lineHeight: 1.6, margin: "12px 0 0" }}>
                  Each rate also moves for reasons of its own, so not every wiggle lines up.
                </p>
                <div style={{ borderTop: "1px solid var(--hair)", marginTop: 14, paddingTop: 12, display: "grid", gap: 8, fontSize: 11.5 }}>
                  {RATE_PILLARS.map(({ pillar, color }) => {
                    // Deliberately the value at the LATEST period, not
                    // the latest non-null one. Falling back to an older
                    // reading would print a 2025 number in a list the
                    // reader takes as current, directly beside section
                    // 4's "Period: 2026".
                    const v = latestPoint ? (latestPoint.indicators[RAW_FIELD[pillar].key] as number | null) : null;
                    return (
                      <div key={pillar} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--slate)" }}>
                          <i style={{ width: 8, height: 8, borderRadius: "50%", background: color, flex: "none" }} />
                          {RAW_FIELD[pillar].label}
                        </span>
                        <b style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                          {v == null ? "—" : `${v.toFixed(RAW_DECIMALS[pillar])}%`}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
