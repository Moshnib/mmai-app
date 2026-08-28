"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScoreDisplay from "@/components/ScoreDisplay";
import MarketSnapshotStrip from "@/components/MarketSnapshotStrip";
import KeyRatesRow from "@/components/KeyRatesRow";
import PillarGrid from "@/components/PillarGrid";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import WorldMap from "@/components/WorldMap";
import GulfCard from "@/components/GulfCard";
import WeeklyFeed from "@/components/WeeklyFeed";
import SubscribeForm from "@/components/SubscribeForm";
import Flag from "@/components/Flag";
import CountryGlyph from "@/components/CountryGlyph";
import { narrativeDrivers, bandFor, PILLAR_NAMES, TOTAL_PILLARS, type RawIndicators } from "@/lib/scoring";
import { FALLBACK_MARKETS, scoreMarket, type MarketData } from "@/lib/markets";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { RawIndicatorRow } from "@/lib/useLiveHistory";
import { sourcesForMarket } from "@/lib/sources";
import { useGulfIndicators } from "@/lib/useGulfIndicators";
import { STALE_THRESHOLD_MS } from "@/lib/constants";

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
  const router = useRouter();
  const [markets, setMarkets] = useState<MarketData[]>(FALLBACK_MARKETS);
  const [current, setCurrent] = useState("US");
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { countries: gulfCountries, loaded: gulfLoaded } = useGulfIndicators();

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
      <div className="hero">
        <div className="wrap">
          {/* Only the intro block is centred (design reference); the
              score panel below keeps its left-aligned reading order. */}
          <div className="hero-centered">
          <p className="eyebrow">
            MOSHNIB MARKET ANALYSIS INDEX · {dataSource === "live" ? "LIVE DATA" : "DEMO DATA — CONNECT SUPABASE FOR LIVE VALUES"}
          </p>
          {dataSource === "live" && lastUpdated && (
            <p style={{ fontSize: 11.5, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", margin: "4px 0 0" }}>
              Last updated {formatUpdatedAt(lastUpdated)} (oldest of the {markets.length} markets) · scheduled to refresh daily at 06:00 UTC
            </p>
          )}
          {/* One plain sentence for a visitor who has never heard of MMAI
              before landing here -- the headline right below is a hook,
              not an explanation, and assumes the reader already knows
              what "macro environment" means to them personally. This
              line answers "what even is this" before asking the
              headline's more evocative question. */}
          <p style={{ fontSize: 14, color: "var(--ink-soft)", maxWidth: "62ch", margin: "10px auto 0", lineHeight: 1.6 }}>
            MMAI reads public government data — inflation, jobs, interest rates — and turns it into one plain-language
            score per country, updated daily. Not investment advice, just the honest picture.
          </p>
          <h1 className="headline">
            Is today&apos;s macro environment <span className="hl-cyan">supportive</span> — or{" "}
            <span className="hl-violet">working against you?</span>
          </h1>
          <p className="sub">One composite score. Five economic pillars. Verified market signals.</p>

          <div className="tabs">
            {markets.map((m) => (
              <button
                key={m.code}
                className={`tab${m.code === current ? " active" : ""}`}
                onClick={() => setCurrent(m.code)}
                aria-pressed={m.code === current}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Flag code={m.code} size={18} /> {m.name}
              </button>
            ))}
          </div>
          </div>

          {/* One card: context strip, score beside its trend chart, then
              the three headline indicators -- matching the design
              reference, rather than four separate floating panels. */}
          <div className="snapshot-card">
          <MarketSnapshotStrip
            marketName={market.name}
            composite={composite}
            raw={market.raw}
            verifiedAt={lastUpdated ? formatUpdatedAt(lastUpdated) : null}
          />

          <div className="score-panel">
            <div style={{ width: "100%", maxWidth: 260 }}>
              <p className="meta-label" style={{ margin: "0 0 4px" }}>MMAI Composite Score</p>
              <p style={{ fontSize: 12, color: "var(--slate)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Composite view of the current macro backdrop
              </p>
              <ScoreDisplay score={composite} />
            </div>
            <div className="score-right">
              <h2>{market.name}</h2>
              <p className="score-narrative">{narrativeFor(market)}</p>
              <ScoreTrendChart marketCode={current} currentScore={composite} />
              <div className="meta-row" style={{ marginTop: 14 }}>
                <span>Coverage: <b>{((coveragePillars / TOTAL_PILLARS) * 100).toFixed(1)}%</b></span>
                <span>Pillars active: <b>{coveragePillars} of {TOTAL_PILLARS}</b></span>
                {/* Source COUNT, not the licence-review date -- that date is
                    maintenance metadata (see lib/sources.ts) and reads as
                    staleness here. Data freshness is the line above the
                    headline and in the footer. */}
                <span>Sources: <b>{sourcesForMarket(market.name).length}</b> · <Link href="/sources" style={{ color: "var(--gold-deep)" }}>view all</Link></span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <Link
                  href="/learn#topic-mmai"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700,
                    color: "var(--gold)", textDecoration: "none", padding: "7px 14px",
                    border: "1px solid rgba(34,211,238,0.35)", borderRadius: 999, background: "rgba(34,211,238,0.08)",
                  }}
                >
                  Σ How is this score calculated? →
                </Link>
                {/* A light nudge toward the real subscribe form at the
                    bottom of the page, not a second copy of it -- most
                    visitors never scroll that far (it's the last of six
                    sections), so this catches them right where they're
                    already looking at a score, without duplicating the
                    email-capture form and its state. */}
                <a
                  href="#subscribe"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700,
                    color: "var(--gold-deep)", textDecoration: "none", padding: "7px 14px",
                    border: "1px solid rgba(139,92,246,0.35)", borderRadius: 999, background: "rgba(139,92,246,0.08)",
                  }}
                >
                  🔔 Notify me when {market.name}&apos;s status changes →
                </a>
              </div>
            </div>
          </div>

          <KeyRatesRow raw={market.raw} />
          </div>

          {rateNarrative && <p className="score-narrative" style={{ maxWidth: "68ch", marginTop: 18 }}>{rateNarrative}</p>}
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">WHAT DRIVES THE SCORE</p>
            <h2>Five pillars, weighted and shown in full</h2>
            <p>Every ring below is a real 0–100 pillar score computed from the raw indicator behind it. Click one to see its history.</p>
          </div>
          <PillarGrid pillars={pillars} market={current} />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">COMPARE MARKETS</p>
            <h2>How every market scores right now</h2>
            <p>Click a market to open its full history on the Data Over Time page.</p>
          </div>

          {/* Primary cross-market read: name, score, status, nothing
              else (brief §4). The map below is kept as a secondary
              navigation aid rather than the dominant element. */}
          <div className="compare-strip">
            {markets.map((m) => {
              const { composite: mScore } = scoreMarket(m);
              const mBand = bandFor(mScore);
              return (
                <Link key={m.code} href={`/trends?market=${m.code}`} className="compare-chip">
                  <span className="cc-name">{m.name}</span>
                  <span className="cc-glyph">
                    <CountryGlyph code={m.code} color={mBand.color} size={96} />
                  </span>
                  <span className="cc-score" style={{ color: mBand.color }}>
                    {mScore === null ? "—" : mScore.toFixed(1)}
                  </span>
                  <span className="cc-band">{mBand.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="world-map-wrap" style={{ marginTop: 24, marginBottom: 24 }}>
            <WorldMap markets={markets} current={current} onSelect={(code) => router.push(`/trends?market=${code}`)} />
          </div>
          {/* Text fallback for the map's mobile-hidden state (illegible
              at phone width) -- Heatmap used to be the mobile-friendly
              alternative for "see the other markets"; now that it's
              gone, hiding the map with nothing in its place would leave
              phones with no way to explore markets other than the
              currently-selected one at all. Hidden above 860px via
              .map-mobile-links so it doesn't duplicate the map on desktop. */}
          <div className="map-mobile-links">
            {markets.filter((m) => m.code !== current).map((m) => (
              <Link key={m.code} href={`/trends?market=${m.code}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)", textDecoration: "none", fontSize: 13 }}>
                <Flag code={m.code} size={16} /> {m.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Signals sits BEFORE Gulf Watch, per the brief's page
          flow (§8): situation -> drivers -> comparison -> what changed
          -> Gulf context. */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">WEEKLY SIGNALS</p>
            <h2>What changed this week</h2>
            <p>Movement for each market since roughly a week ago — the raw numbers, no interpretation.</p>
          </div>
          <WeeklyFeed />
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">GULF WATCH</p>
            <h2>The six GCC economies</h2>
            <p>Verified indicators only — no composite score for these countries yet. Tap a country for its full data.</p>
          </div>
          <div className="gulf-strip" style={{ opacity: gulfLoaded ? 1 : 0.5, transition: "opacity 0.3s ease", marginBottom: 16 }}>
            {gulfCountries.map((c) => (
              <GulfCard key={c.code} country={c} compact />
            ))}
          </div>
          <Link href="/gulf-watch" style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, fontWeight: 700, color: "var(--gold-deep)", textDecoration: "none" }}>
            See history and comparison →
          </Link>
        </div>
      </div>

      {/* Closing call-to-action (brief §8, item 7). Points at the two
          things that actually answer "where does this come from" --
          methodology and sources -- rather than a marketing link. */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2>Turn macro data into clear signals.</h2>
              <p>Every number traced to a named source, with its real reporting period. Not investment advice.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/learn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 999,
                  background: "linear-gradient(135deg, var(--gold-deep), #6D28D9)", color: "#fff",
                  fontWeight: 700, fontSize: 13.5, textDecoration: "none",
                }}
              >
                How MMAI is calculated →
              </Link>
              <Link
                href="/sources"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 999,
                  border: "1px solid var(--hair)", color: "var(--ink-soft)",
                  fontWeight: 700, fontSize: 13.5, textDecoration: "none",
                }}
              >
                Sources
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }} id="subscribe">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <SubscribeForm />
        </div>
      </div>
    </>
  );
}
