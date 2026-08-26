"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Gauge from "@/components/Gauge";
import KeyRatesRow from "@/components/KeyRatesRow";
import PillarGrid from "@/components/PillarGrid";
import CompareGrid from "@/components/CompareGrid";
import Heatmap from "@/components/Heatmap";
import Sparkline from "@/components/Sparkline";
import WorldMap from "@/components/WorldMap";
import SubscribeForm from "@/components/SubscribeForm";
import Flag from "@/components/Flag";
import { narrativeDrivers, PILLAR_NAMES, TOTAL_PILLARS, type RawIndicators } from "@/lib/scoring";
import { FALLBACK_MARKETS, scoreMarket, type MarketData } from "@/lib/markets";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { RawIndicatorRow } from "@/lib/useLiveHistory";
import { sourcesForMarket } from "@/lib/sources";

// A market whose last successful write is older than this is treated as
// currently broken, not "a bit behind" -- daily refresh cadence means
// anything past a couple of missed days is a real problem, not normal
// publication lag (that's a different, already-accepted thing: annual
// sources like World Bank GDP figures naturally carry old observation
// dates while still refreshing successfully every day).
const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

function narrativeFor(market: MarketData): string {
  const { pillars, coveragePillars, coverage } = scoreMarket(market);
  const drivers = narrativeDrivers(pillars);
  if (coverage < 0.7 || !drivers) {
    return `${market.name} currently has only ${coveragePillars} of ${TOTAL_PILLARS} structural pillars populated (${(coverage * 100).toFixed(1)}% coverage), below the 70% publication threshold. Rather than compute a score from incomplete data, MMAI shows N/A.`;
  }
  const bestVal = pillars[drivers.best]!;
  const worstVal = pillars[drivers.worst]!;
  return `${market.name}'s strongest pillar right now is ${PILLAR_NAMES[drivers.best]} (${bestVal.toFixed(1)}), while ${PILLAR_NAMES[drivers.worst]} (${worstVal.toFixed(1)}) is doing the most to hold the composite back.`;
}

// Rule-based, not AI-generated -- every sentence below is a direct,
// deterministic read of the same three numbers shown in KeyRatesRow, so
// it updates the moment live data changes, with nothing to hallucinate.
// The 2% and 2.5% thresholds match the exact baselines lib/scoring.ts's
// own formulas already use (priceStabilityScore, monetaryConditionsScore)
// -- but real central banks don't all target a flat 2% (the RBA's own
// site states its target as 2-3%, for example), so the copy below
// explicitly attributes "2%" to MMAI's own formula, never to "central
// banks" generally, to stay accurate for every market.
//
// Only inflation and the policy rate BOTH sitting at least INTERPRETIVE_GAP
// points past target/neutral, in the same direction, gets an interpretive
// sentence -- and even then, it describes the general textbook mechanism
// rather than asserting this specific market's rate was set because of
// today's inflation reading (the function only ever sees a snapshot, never
// whether a rate is rising or falling, so it can't actually know that).
// Every other combination -- near target, a small deviation, or the two
// numbers moving in opposite directions (as with Japan's above-target
// inflation alongside a still near-zero policy rate) -- falls back to a
// plain, neutral statement of the three numbers with no interpretive claim.
function rateNarrativeFor(raw: RawIndicators): string | null {
  const { inflation, policyRate, unemployment } = raw;
  if (inflation == null || policyRate == null || unemployment == null) return null;

  const INFLATION_TARGET = 2;
  const RATE_NEUTRAL = 2.5;
  const INTERPRETIVE_GAP = 0.8;

  const inflGap = inflation - INFLATION_TARGET;
  const rateGap = policyRate - RATE_NEUTRAL;

  const bothAbove = inflGap > INTERPRETIVE_GAP && rateGap > INTERPRETIVE_GAP;
  const bothBelow = inflGap < -INTERPRETIVE_GAP && rateGap < -INTERPRETIVE_GAP;

  const inflStr = inflation.toFixed(1);
  const rateStr = policyRate.toFixed(2);
  const unempStr = unemployment.toFixed(1);

  if (bothAbove) {
    return `Inflation is at ${inflStr}%, above the 2% target MMAI's Price Stability formula uses. The policy rate is at ${rateStr}% and unemployment is at ${unempStr}%. Central banks generally raise rates to cool inflation, and that same move tends to slow hiring — though each bank sets its rate for its own reasons and against its own target, so these numbers alone don't tell you which way it's currently moving.`;
  }
  if (bothBelow) {
    return `Inflation is at ${inflStr}%, below the 2% target MMAI's Price Stability formula uses. The policy rate is at ${rateStr}% and unemployment is at ${unempStr}%. Central banks generally cut rates to support hiring and growth, though each bank sets its rate for its own reasons and against its own target, so these numbers alone don't tell you which way it's currently moving.`;
  }
  return `Inflation is at ${inflStr}%, the policy rate is at ${rateStr}%, and unemployment is at ${unempStr}%. These are the same three numbers central banks generally weigh when setting policy — trying to keep prices near target without pushing unemployment too high.`;
}

export default function OverviewPage() {
  const [markets, setMarkets] = useState<MarketData[]>(FALLBACK_MARKETS);
  const [current, setCurrent] = useState("US");
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    async function loadLiveData() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return; // not configured yet — stay on fallback
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("raw_indicators")
          .select("market, inflation, gdp_growth, unemployment, policy_rate, brent_yoy, observation_date, fetched_at")
          .order("observation_date", { ascending: false })
          .order("fetched_at", { ascending: false }) // tiebreak same-day reruns -- deterministic "latest", not arbitrary
          .limit(200); // 7 markets x daily refreshes; see lib/useLiveHistory.ts for the same limit and why
        if (error || !data || data.length === 0) return;

        const latestByMarket = new Map<string, RawIndicatorRow & { fetched_at: string }>();
        for (const row of data as Array<RawIndicatorRow & { fetched_at: string }>) {
          if (!latestByMarket.has(row.market)) latestByMarket.set(row.market, row);
        }
        // Oldest of the *displayed* markets' latest fetches, not the newest --
        // if one market's refresh stalled, "last updated" should say so rather
        // than claim everything is as fresh as the one market that ran.
        //
        // Scoped to FALLBACK_MARKETS on purpose: raw_indicators still holds
        // rows for retired markets (UAE, removed) and paused ones (Norway),
        // which by definition stop refreshing. Including them made this show
        // the date a removed market last ran, not the real freshness of what's
        // actually on the page.
        const shownCodes = new Set(FALLBACK_MARKETS.map((m) => m.code));
        const oldestOfLatestFetches = Array.from(latestByMarket.values())
          .filter((r) => shownCodes.has(r.market))
          .map((r) => r.fetched_at)
          .sort()
          .at(0);
        if (oldestOfLatestFetches) setLastUpdated(oldestOfLatestFetches);

        const now = Date.now();
        const live: MarketData[] = FALLBACK_MARKETS.map((m) => {
          const row = latestByMarket.get(m.code);
          const isStale = !row || now - new Date(row.fetched_at).getTime() > STALE_THRESHOLD_MS;
          if (isStale) {
            // No row, or the row is too old to trust: show this market
            // honestly as N/A (via the existing coverage-threshold path)
            // rather than silently falling back to hardcoded demo numbers
            // displayed under the "LIVE DATA" banner every other market
            // earns by actually being live.
            return { ...m, raw: { inflation: null, gdpGrowth: null, unemployment: null, policyRate: null, brentYoY: null } };
          }
          return {
            ...m,
            raw: {
              inflation: row.inflation,
              gdpGrowth: row.gdp_growth,
              unemployment: row.unemployment,
              policyRate: row.policy_rate,
              brentYoY: row.brent_yoy,
            },
          };
        });
        setMarkets(live);
        setDataSource("live");
      } catch {
        // Supabase not reachable / not configured — silently stay on fallback.
      }
    }
    loadLiveData();
  }, []);

  const market = markets.find((m) => m.code === current)!;
  const { pillars, composite, coveragePillars } = scoreMarket(market);
  const rateNarrative = rateNarrativeFor(market.raw);

  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <button className="navlink active">Overview</button>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <Link href="/gulf-watch" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Gulf Watch</Link>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn More</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
            <Link href="/contact" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Contact</Link>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">
            MOSHNIB MARKET ANALYSIS INDEX · {dataSource === "live" ? "LIVE DATA" : "DEMO DATA — CONNECT SUPABASE FOR LIVE VALUES"}
          </p>
          {dataSource === "live" && lastUpdated && (
            <p style={{ fontSize: 11.5, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", margin: "4px 0 0" }}>
              Last updated {formatUpdatedAt(lastUpdated)} (oldest of the {markets.length} markets) · scheduled to refresh daily at 06:00 UTC
            </p>
          )}
          <h1 className="headline">Is today&apos;s macro environment supportive, or working against you?</h1>
          <p className="sub">One transparent number, built entirely from licensed public data — with every formula, weight, and source open for anyone to check.</p>

          <div className="tabs">
            {markets.map((m) => (
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

          <div className="score-panel">
            <Gauge score={composite} />
            <div className="score-right">
              <h2>{market.name}</h2>
              <p className="score-narrative">{narrativeFor(market)}</p>
              <div className="meta-row" style={{ marginBottom: 16 }}>
                <span>Coverage: <b>{((coveragePillars / TOTAL_PILLARS) * 100).toFixed(1)}%</b></span>
                <span>Pillars active: <b>{coveragePillars} of {TOTAL_PILLARS}</b></span>
                {/* Source COUNT, not the licence-review date -- that date is
                    maintenance metadata (see lib/sources.ts) and reads as
                    staleness here. Data freshness is the line above the
                    headline and in the footer. */}
                <span>Sources: <b>{sourcesForMarket(market.name).length}</b> · <Link href="/sources" style={{ color: "var(--gold-deep)" }}>view all</Link></span>
              </div>
              <Sparkline marketCode={current} currentScore={composite} />
              <Link
                href="/learn#topic-mmai"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
                  fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700,
                  color: "var(--gold)", textDecoration: "none", padding: "7px 14px",
                  border: "1px solid rgba(34,211,238,0.35)", borderRadius: 999, background: "rgba(34,211,238,0.08)",
                }}
              >
                Σ How is this score calculated? →
              </Link>
            </div>
          </div>

          <KeyRatesRow raw={market.raw} />
          {rateNarrative && <p className="score-narrative" style={{ maxWidth: "68ch" }}>{rateNarrative}</p>}
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">THE COMPOSITE, OPENED UP</p>
            <h2>Five pillars, weighted and shown in full</h2>
            <p>Every ring below is a real 0–100 pillar score computed from the raw indicator behind it — visit the Learn page for what each one means.</p>
          </div>
          <PillarGrid pillars={pillars} market={current} />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">CROSS-MARKET VIEW</p>
            <h2>How the {markets.length} markets compare today</h2>
          </div>
          <CompareGrid markets={markets} current={current} onSelect={setCurrent} />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">EVERY MARKET, EVERY PILLAR, AT A GLANCE</p>
            <h2>The MMAI Heat Map</h2>
            <p>Click a country on the map or a row below to jump straight to that market.</p>
          </div>
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <WorldMap markets={markets} current={current} onSelect={setCurrent} />
          </div>
          <Heatmap markets={markets} />
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <SubscribeForm />
        </div>
      </div>
    </>
  );
}
