"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ScoreDisplay from "@/components/ScoreDisplay";
import MarketSnapshotStrip from "@/components/MarketSnapshotStrip";
import KeyRatesRow from "@/components/KeyRatesRow";
import DimensionAxis from "@/components/DimensionAxis";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import WorldMap from "@/components/WorldMap";
import GulfCard from "@/components/GulfCard";
import WeeklyFeed from "@/components/WeeklyFeed";
import SubscribeForm from "@/components/SubscribeForm";
import Flag from "@/components/Flag";
import StructuredData from "@/components/StructuredData";
import LiveBar from "@/components/LiveBar";
import MarketTicker from "@/components/MarketTicker";
import NewsBand from "@/components/NewsBand";
import LivePressCard from "@/components/LivePressCard";
import CountryGlyph from "@/components/CountryGlyph";
import { type RawIndicators, inflationTargetFor, colorForScore } from "@/lib/indicators";
import {
  DIMENSION_NAMES, dimensionDrivers, maskedDimension, percentileBandLabel,
  UNCERTAINTY_NOTE, CONVENTION_NOTE, REFERENCE_COUNT, REFERENCE_SPAN } from "@/lib/composite";
import { FALLBACK_MARKETS, scoreMarketV2, type MarketData, MARKET_COUNT_WORD_CAP } from "@/lib/markets";
import { latestCompleteObservation, fallbackNote, type ObservationPick } from "@/lib/latestComplete";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { RawIndicatorRow } from "@/lib/useLiveHistory";
import { scoredInstitutionCount } from "@/lib/sources";
import { useGulfIndicators } from "@/lib/useGulfIndicators";
import { STALE_THRESHOLD_MS } from "@/lib/constants";
import { useQuery, setQuery } from "@/lib/urlState";
import ShareButton from "@/components/ShareButton";
import Term from "@/components/Term";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

function narrativeFor(market: MarketData): string {
  const { percentile, dimensionPercentiles, missing } = scoreMarketV2(market);
  if (percentile == null || dimensionPercentiles == null) {
    const names = missing.join(", ");
    return `${market.name} has no score right now: ${names} is missing. MMAI withholds the composite rather than reweighting around a gap, because a country scored on four indicators is not comparable with one scored on five.`;
  }
  const drivers = dimensionDrivers(dimensionPercentiles);
  if (!drivers) return `${market.name} sits at ${percentile.toFixed(1)} — ${percentileBandLabel(percentile).toLowerCase()} of the last 26 years, with its three dimensions evenly matched.`;
  const best = dimensionPercentiles[drivers.best];
  const worst = dimensionPercentiles[drivers.worst];
  return `${market.name}'s strongest dimension is ${DIMENSION_NAMES[drivers.best]}, above ${best.toFixed(0)}% of the historical record, while ${DIMENSION_NAMES[drivers.worst]} sits above only ${worst.toFixed(0)}%. The headline averages the three equally.`;
}

// Rule-based, not AI-generated -- every sentence below is a direct,
// deterministic read of the same three numbers shown in KeyRatesRow, so
// it updates the moment live data changes, with nothing to hallucinate.
// The inflation threshold is each central bank's OWN published target,
// read from INFLATION_TARGET rather than typed, so this sentence cannot
// drift from the engine -- real banks don't all target a flat 2% (the
// RBA's own site states 2-3%). The copy attributes the target to MMAI's
// scoring, never to "central banks" generally, to stay accurate for
// every market.
//
// It used to attribute it to "MMAI's Price Stability formula". That
// pillar stopped existing when the three dimensions replaced it, and the
// sentence went on naming it on the live homepage -- found by reading the
// deployed page rather than the source, which is the only place it looked
// wrong.
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
function rateNarrativeFor(raw: RawIndicators, marketCode: string): string | null {
  const { inflation, policyRate, unemployment } = raw;
  if (inflation == null || policyRate == null || unemployment == null) return null;

  // The market's OWN target, not a flat 2 for everyone -- Australia's is
  // 2.5. Hardcoding it here told Australian readers their inflation was
  // measured against a benchmark MMAI does not use for them.
  const INFLATION_TARGET = inflationTargetFor(marketCode);
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
    return `Inflation is at ${inflStr}%, above the ${INFLATION_TARGET}% target MMAI scores inflation against. The policy rate is at ${rateStr}% and unemployment is at ${unempStr}%. Central banks generally raise rates to cool inflation, and that same move tends to slow hiring — though each bank sets its rate for its own reasons and against its own target, so these numbers alone don't tell you which way it's currently moving.`;
  }
  if (bothBelow) {
    return `Inflation is at ${inflStr}%, below the ${INFLATION_TARGET}% target MMAI scores inflation against. The policy rate is at ${rateStr}% and unemployment is at ${unempStr}%. Central banks generally cut rates to support hiring and growth, though each bank sets its rate for its own reasons and against its own target, so these numbers alone don't tell you which way it's currently moving.`;
  }
  return `Inflation is at ${inflStr}%, the policy rate is at ${rateStr}%, and unemployment is at ${unempStr}%. These are the same three numbers central banks generally weigh when setting policy — trying to keep prices near target without pushing unemployment too high.`;
}

export default function OverviewPage() {
  const [markets, setMarkets] = useState<MarketData[]>(FALLBACK_MARKETS);
  // Which observation each market's score came from, so the page can say
  // "scored on 3 September data" when today's row was incomplete rather
  // than either blanking the country or quietly showing an older figure.
  const [observationPicks, setObservationPicks] = useState<
    Record<string, ObservationPick<RawIndicatorRow & { fetched_at: string }>>
  >({});
  // NOTHING IS SELECTED UNTIL THE VISITOR SELECTS IT. The page used to
  // open on the United States, which is an odd thing for an index that
  // covers six markets to assert, and it meant a first-time reader met a
  // country's score before being told what the score was.
  //
  // AND IT LIVES IN THE ADDRESS (?market=JP), so a link opens on the same
  // market and Back returns to the one before. See lib/urlState.ts.
  const query = useQuery();
  const marketParam = query.get("market");
  const current = marketParam && FALLBACK_MARKETS.some((m) => m.code === marketParam) ? marketParam : null;
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { countries: gulfCountries, loaded: gulfLoaded } = useGulfIndicators();

  // The detail appears BELOW the chooser, so the first selection has to
  // take the reader to it -- otherwise clicking a country on the map
  // appears to do nothing. Only on the first choice: once the detail is
  // on screen, switching markets should swap the numbers under the
  // reader's eyes, not yank the page around.
  const detailRef = useRef<HTMLDivElement>(null);
  const hasScrolledToDetail = useRef(false);
  // Set by a reader's choice, spent by the effect below. Back and a
  // shared link do not set it.
  const choseMarket = useRef(false);

  function selectMarket(code: string) {
    // The market already showing: the address does not change, so the
    // effect below never runs -- and a flag set here would sit waiting to
    // make the next Back scroll. Tapping the gold-bordered card is still a
    // request to see it, so go there directly.
    if (code === current) {
      const el = detailRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (!(top >= 56 && top < window.innerHeight * 0.66)) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    choseMarket.current = true;
    setQuery({ market: code }, "push");
  }

  // The first market on screen -- chosen here, or arriving in a shared
  // link -- brings the detail into view. After that, switching (and Back)
  // swaps the numbers in place. setTimeout, not requestAnimationFrame: rAF
  // never fires in a tab that is not painting, and the flag is spent inside
  // the callback so StrictMode's double effect cannot use it up.
  //
  // AND ANY LATER CHOICE MADE OUT OF SIGHT OF IT. "Only the first time"
  // assumed the reader was still looking at the detail when they switched.
  // On a phone the country cards, the map and the ticker sit a long way
  // from it: tap Canada on the cards and the detail swapped to Canada
  // several screens up, while the reader saw nothing but a gold border
  // (reported 19 September, with a screenshot). So a choice now scrolls
  // whenever the detail's top is not on screen, and still swaps in place
  // when it is.
  useEffect(() => {
    if (!current) return;
    const chose = choseMarket.current;
    if (hasScrolledToDetail.current && !chose) return;
    const id = setTimeout(() => {
      choseMarket.current = false;
      const el = detailRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // "On screen" means its top is somewhere a reader is already looking:
      // below the sticky bar and above the lower third of the screen.
      const inView = top >= 56 && top < window.innerHeight * 0.66;
      if (hasScrolledToDetail.current && inView) return;
      hasScrolledToDetail.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(id);
  }, [current]);

  useEffect(() => {
    async function loadLiveData() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return; // not configured yet — stay on fallback
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("raw_indicators")
          .select("market, inflation, gdp_growth, unemployment, policy_rate, brent_yoy, debt_pct_gdp, observation_date, fetched_at, inflation_observation_date, gdp_observation_date, unemployment_observation_date, policy_rate_observation_date, debt_observation_period")
          .order("observation_date", { ascending: false })
          .order("fetched_at", { ascending: false }) // tiebreak same-day reruns -- deterministic "latest", not arbitrary
          .limit(200); // 7 markets x daily refreshes; see lib/useLiveHistory.ts for the same limit and why
        if (error || !data || data.length === 0) return;

        type Row = RawIndicatorRow & { fetched_at: string };
        // Every row per market, newest first — the composite is scored on
        // the most recent COMPLETE observation, so one row is not enough.
        const rowsByMarket = new Map<string, Row[]>();
        for (const row of data as Row[]) {
          const list = rowsByMarket.get(row.market);
          if (list) list.push(row);
          else rowsByMarket.set(row.market, [row]);
        }
        const latestByMarket = new Map<string, Row>();
        for (const [code, list] of rowsByMarket) latestByMarket.set(code, list[0]);
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
        const picks: Record<string, ObservationPick<Row>> = {};
        const live: MarketData[] = FALLBACK_MARKETS.map((m) => {
          const all = rowsByMarket.get(m.code) ?? [];
          // Score the most recent complete observation rather than the
          // newest row. A single failed fetch should not blank a country,
          // and interpolating one would be inventing data -- so this uses a
          // real earlier observation and shows its date.
          const pick = latestCompleteObservation(
            all,
            ["inflation", "gdp_growth", "unemployment", "policy_rate", "debt_pct_gdp"],
            (r) => r.observation_date
          );
          picks[m.code] = pick;
          const row = pick.row ?? latestByMarket.get(m.code);
          const isStale = !row || now - new Date(row.fetched_at).getTime() > STALE_THRESHOLD_MS;
          if (isStale) {
            // No row, or the row is too old to trust: show this market
            // honestly as N/A (via the existing coverage-threshold path)
            // rather than silently falling back to hardcoded demo numbers
            // displayed under the "LIVE DATA" banner every other market
            // earns by actually being live.
            return { ...m, raw: { inflation: null, gdpGrowth: null, unemployment: null, policyRate: null, brentYoY: null, debtPctGdp: null } };
          }
          return {
            ...m,
            raw: {
              inflation: row.inflation,
              gdpGrowth: row.gdp_growth,
              unemployment: row.unemployment,
              policyRate: row.policy_rate,
              brentYoY: row.brent_yoy,
              debtPctGdp: row.debt_pct_gdp,
            },
            // Audit M-6: show a reader how old each figure actually is.
            observationDates: {
              inflation: row.inflation_observation_date ?? null,
              gdpGrowth: row.gdp_observation_date ?? null,
              unemployment: row.unemployment_observation_date ?? null,
              policyRate: row.policy_rate_observation_date ?? null,
            },
          };
        });
        setObservationPicks(picks);
        setMarkets(live);
        setDataSource("live");
      } catch {
        // Supabase not reachable / not configured — silently stay on fallback.
      }
    }
    loadLiveData();
  }, []);

  const pick = current ? observationPicks[current] ?? null : null;
  const observationNote = pick ? fallbackNote(pick, (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })) : null;

  // null until a market is chosen. Everything downstream is guarded on it
  // rather than defaulted, so "nothing chosen" cannot quietly become
  // "the United States" again.
  const market = markets.find((m) => m.code === current) ?? null;
  const scored = market ? scoreMarketV2(market) : null;
  const percentile = scored?.percentile ?? null;
  const dimensions = scored?.dimensions ?? null;
  const dimensionPercentiles = scored?.dimensionPercentiles ?? null;
  const composite = percentile;
  // Averaging three dimensions is fully compensatory, so a collapse in one
  // can be offset without limit by the other two. Publishing all three
  // makes that visible, which is most of the fix -- but a reader who takes
  // in only the headline still deserves to be told. Japan is the live case.
  const masked = maskedDimension(dimensionPercentiles, percentile);
  const rateNarrative = market ? rateNarrativeFor(market.raw, market.code) : null;

  return (
    <>
      {/* THE INDEX AS A DATASET, DESCRIBED ONCE, HERE.
          The root layout carries the publisher and the site; this is the
          dataset itself, and it belongs on the homepage alone because
          there is ONE index. Emitted from the layout it would attach to
          all eleven pages and claim eleven datasets exist. Server-
          rendered into the initial HTML despite this being a client
          component, so a crawler that runs no JavaScript still sees it. */}
      <StructuredData dataset />
      {/* Every market, passing along the top, whether or not the reader
          has chosen one yet. The page had nothing on it that moved. */}
      <MarketTicker markets={markets} current={current} onSelect={selectMarket} />
      <div className="hero">
        <div className="wrap">
          {/* The intro block, left-aligned like everything beneath it. */}
          <div className="hero-centered">
          <p className="eyebrow">MOSHNIB MACRO ANALYSIS INDEX · MEASURING THE PULSE OF THE ECONOMY</p>
          {/* The page opens on something that is running: a breathing dot,
              the market count, and a refresh time that ticks over while
              the reader is on the page. The old line said "LIVE DATA" in
              the eyebrow, in the same grey as everything else, which is a
              claim rather than a sign of life. */}
          <LiveBar
            live={dataSource === "live"}
            facts={[`${MARKET_COUNT_WORD_CAP.toLowerCase()} markets · rechecked four times a day`]}
            stamp={lastUpdated}
            staleLabel="LAST KNOWN FIGURES — LIVE DATA UNREACHABLE"
          />
          {/* ORDER: hook, then explanation, then the choice.
              It used to run the other way about -- a refresh timestamp,
              then an explanation, then the headline the explanation was
              explaining. A reader met "Last updated 06:27 UTC" before
              being told what was updated, and read what MMAI does before
              being given a reason to care.

              The timestamp is gone rather than moved: the snapshot card
              below already carries "Verified <time>" beside the score it
              belongs to, so this was a second copy of it in the one place
              it could not mean anything yet. */}
          <h1 className="headline">
            Is today&apos;s macro environment <span className="hl">supportive</span> — or working against you?
          </h1>
          {/* One plain answer to "what even is this", for a visitor who
              has never heard of MMAI. It also absorbs the old strapline
              ("One composite score. Three economic dimensions. Verified
              market signals.") -- three fragments that promised what this
              says outright, and said "verified" without saying of what. */}
          <p className="sub" style={{ maxWidth: "64ch", margin: "0 0 28px" }}>
            MMAI reads the economic figures governments publish about themselves — inflation, jobs, growth, debt
            and interest rates — and turns them into one score per country, rechecked every day and republished
            whenever a source moves. That score is a <Term k="rank">rank</Term> against {REFERENCE_COUNT} <Term k="market-year">market-years</Term>, built from <Term k="dimensions">three dimensions</Term>
            you can open up and check. It is not investment advice.
          </p>

          {/* Says what the row is for. With nothing preselected, six
              unlit buttons need a sentence or a reader has to guess
              whether they are navigation, filters, or decoration. */}
          <p className="meta-label" style={{ margin: "0 0 10px" }}>
            {current ? "Showing" : "Choose a market"}
          </p>
          <div className="market-picker">
            {markets.map((m) => (
              <button
                key={m.code}
                className={`market-chip${m.code === current ? " active" : ""}`}
                onClick={() => selectMarket(m.code)}
                aria-pressed={m.code === current}
              >
                <Flag code={m.code} size={22} /> {m.name}
              </button>
            ))}
          </div>
          </div>

          {/* NOTHING BELOW EXISTS UNTIL A MARKET IS CHOSEN.
              The chooser -- the compare strip and the map -- sits further
              down the page, so while nothing is selected these sections
              are simply absent and the chooser rises to meet the reader.
              No reordering and no empty state to design: the page asks a
              question, then answers the one they pick. */}
          {market && (
            <>
          <div className="snapshot-card" ref={detailRef}>
          <div className="share-row"><ShareButton title={`MMAI — ${market.name}`} /></div>
          <MarketSnapshotStrip
            marketName={market.name}
            raw={market.raw}
            verifiedAt={lastUpdated ? formatUpdatedAt(lastUpdated) : null}
          />

          <div className="score-panel">
            <div style={{ width: "100%", maxWidth: 260 }}>
              <p className="meta-label" style={{ margin: "0 0 4px" }}>MMAI Composite Score</p>
              <p style={{ fontSize: 12, color: "var(--slate)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Rank against {REFERENCE_COUNT} market-years, {REFERENCE_SPAN} — not a mark out of 100
              </p>
              <ScoreDisplay score={composite} />
            </div>
            <div className="score-right">
              <h2>{market.name}</h2>
              <p className="score-narrative">{narrativeFor(market)}</p>
              {masked && (
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: "10px 0 0",
                    padding: "11px 14px",
                    borderLeft: `3px solid ${colorForScore(masked.percentile)}`,
                    background: "var(--glass)",
                    borderRadius: "0 4px 4px 0",
                    color: "var(--ink-soft)",
                  }}
                >
                  <b>Read this score with care.</b> {DIMENSION_NAMES[masked.key]} sits at{" "}
                  <b>{masked.percentile.toFixed(1)}</b> — {masked.gap.toFixed(0)} points below the headline.
                  MMAI averages its three dimensions equally, so strength elsewhere is offsetting a
                  collapse here. The headline alone does not tell you this; the three rings below do.
                </p>
              )}
              {observationNote && (
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: '10px 0 0',
                    padding: '10px 13px',
                    borderLeft: '3px solid var(--hair-strong)',
                    background: 'var(--glass)',
                    borderRadius: '0 4px 4px 0',
                    color: 'var(--ink-soft)',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  {observationNote}
                </p>
              )}
              <ScoreTrendChart marketCode={market.code} currentScore={composite} />
              <div className="meta-row" style={{ marginTop: 14 }}>
                <span><Term k="band">Band</Term>: <b>{percentileBandLabel(composite)}</b></span>
                <span>Ranked against: <b>{REFERENCE_COUNT} market-years, {REFERENCE_SPAN}</b></span>
                {/* Source COUNT, not the licence-review date -- that date is
                    maintenance metadata (see lib/sources.ts) and reads as
                    staleness here. Data freshness is the line above the
                    headline and in the footer. */}
                <span>Sources: <b>{scoredInstitutionCount(market.name)}</b> · <Link href="/sources" style={{ color: "var(--accent-2)" }}>view all</Link></span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <Link className="tap btn-quiet"
                  href="/learn#topic-mmai"
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
                  className="btn-quiet"
                >
                  🔔 Join the alert list for {market.name} →
                </a>
              </div>
            </div>
          </div>

          <KeyRatesRow raw={market.raw} market={market.code} />
          </div>

          {rateNarrative && <p className="score-narrative" style={{ maxWidth: "68ch", marginTop: 18 }}>{rateNarrative}</p>}
            </>
          )}
        </div>
      </div>

      {market && (
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">WHAT DRIVES THE SCORE</p>
            <h2>What is holding {market.name} up, and what is dragging</h2>
            <p>
              All three sit on one axis, so they can be read against each other rather than one at a
              time. Each is a rank against the same {REFERENCE_COUNT} market-years — 80 means better than 80% of the
              record, not a mark out of 100 — and the centre line is the historical average.
            </p>
          </div>
          {/* ONE AXIS, NOT THREE. The heading above asks what is holding a
              country up and what is dragging — a question about the three
              dimensions RELATIVE TO EACH OTHER. Three cards side by side,
              each centring its own average, is the one arrangement that
              cannot answer it: every dimension looked measured on its own
              terms, and comparing them meant comparing bars across two card
              borders. Japan reads 100 / 15 / 9 and composites to 50.7, a
              number that is meaningless without the spread behind it. On one
              axis the spread is the picture. The arithmetic still lives on
              the Trends page; a front page should make the shape understood,
              not make someone do the sum. */}
          <DimensionAxis
            standardised={dimensions}
            percentiles={dimensionPercentiles}
            market={market.code}
          />

          <p style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.6, marginTop: 16, maxWidth: "72ch" }}>
            {CONVENTION_NOTE}
          </p>
          <p style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.6, marginTop: 8, maxWidth: "72ch" }}>
            {UNCERTAINTY_NOTE}
          </p>
        </div>
      </div>
      )}

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">COMPARE MARKETS</p>
            <h2>How every market scores right now</h2>
            <p>
              Pick a market to see its full picture, without leaving this page. Every score is a rank against the
              same {REFERENCE_COUNT} market-years, so they are directly comparable.
            </p>
          </div>

          {/* Primary cross-market read: name, score, status, nothing
              else (brief §4). The map below is kept as a secondary
              navigation aid rather than the dominant element. */}
          <div className="compare-strip">
            {markets.map((m) => {
              const { percentile: mScore } = scoreMarketV2(m);
              const mBand = { color: colorForScore(mScore), label: percentileBandLabel(mScore) };
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => selectMarket(m.code)}
                  aria-pressed={m.code === current}
                  className={`compare-chip${m.code === current ? " on" : ""}`}
                >
                  <span className="cc-name">{m.name}</span>
                  <span className="cc-glyph">
                    {/* The shape identifies the country; it does not repeat the score.
                        Nine shapes in nine ramp colours read as a paint chart
                        above the numbers that actually carry the colour. */}
                    <CountryGlyph code={m.code} color={m.code === current ? "var(--accent)" : "var(--glyph)"} size={124} />
                  </span>
                  <span className="cc-score" style={{ color: mBand.color }}>
                    {mScore === null ? "—" : mScore.toFixed(1)}
                  </span>
                  <span className="cc-band">{mBand.label}</span>
                </button>
              );
            })}
          </div>

          <div className="world-map-wrap" style={{ marginTop: 24, marginBottom: 24 }}>
            {/* Selects in place. It used to router.push() to the Trends
                page, so clicking a country on the map left the homepage
                entirely -- which is the opposite of what a map on an
                overview is for. */}
            <WorldMap markets={markets} current={current ?? ""} onSelect={selectMarket} />
          </div>
          {/* Text fallback for the map's mobile-hidden state (illegible
              at phone width) -- Heatmap used to be the mobile-friendly
              alternative for "see the other markets"; now that it's
              gone, hiding the map with nothing in its place would leave
              phones with no way to explore markets other than the
              currently-selected one at all. Hidden above 900px via
              .map-mobile-links so it doesn't duplicate the map on desktop. */}
          <div className="map-mobile-links">
            {markets.filter((m) => m.code !== current).map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => selectMarket(m.code)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)", background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13, cursor: "pointer" }}
              >
                <Flag code={m.code} size={16} /> {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

{/* THE CALENDAR, BEFORE THE FEED OF WHAT ALREADY MOVED.
          "The next UK inflation figure lands tomorrow" is the one thing
          on this page a reader can act on, and it belongs above the
          record of what has already happened. Every line comes straight
          from one of nine institutions' own feeds (lib/newsSources.ts),
          and the band refreshes itself. */}
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">ON THE CALENDAR</p>
            <h2>What lands next, and what was just decided</h2>
            <p>
              Straight from the institutions that publish it: rate decisions and statements from the Federal
              Reserve, the European Central Bank, the Bank of Canada and the Reserve Bank of Australia, and
              release dates and new figures from the statistics offices of the UK, the US, Canada and Norway.
              Nobody&apos;s headlines, and nothing here is an opinion.
            </p>
          </div>
          <LivePressCard />
          <NewsBand />
        </div>
      </div>

      {/* Weekly Signals sits BEFORE Gulf Watch, per the brief's page
          flow (§8): situation -> drivers -> comparison -> what changed
          -> Gulf context. */}
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">LATEST SIGNALS</p>
            <h2>What changed, and when</h2>
            <p>
              Every market&apos;s most recent move — what changed, and the day it changed. Where nothing has moved,
              how long the current figures have stood.
            </p>
          </div>
          <WeeklyFeed />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">GULF WATCH</p>
            <h2>The Gulf, tracked the same way — and not scored</h2>
            <p>Verified indicators only — no composite score for these countries yet. Tap a country for its full data.</p>
          </div>
          <div className="gulf-strip" style={{ opacity: gulfLoaded ? 1 : 0.5, transition: "opacity 0.3s ease", marginBottom: 16 }}>
            {gulfCountries.map((c) => (
              <GulfCard key={c.code} country={c} compact />
            ))}
          </div>
          <Link href="/gulf-watch" className="tap" style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, fontWeight: 700, color: "var(--accent-2)", textDecoration: "none" }}>
            See history and comparison →
          </Link>
        </div>
      </div>

      {/* Closing call-to-action (brief §8, item 7). Points at the two
          things that actually answer "where does this come from" --
          methodology and sources -- rather than a marketing link. */}
      <div className="section">
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2>See the conditions before you read the headlines.</h2>
              {/* The count has to survive the scroll that reaches it. This
                  band sits directly below the Gulf cards, so a reader has
                  just passed six more economies when it says "six". Both
                  numbers are now stated, along with the fact that only one
                  set is scored -- which is the site's own position, not a
                  shortfall to be glossed over. */}
              {/* "Checked daily", not "updated daily". Both were written
                  here and only one is true. The sources are re-read every
                  day, three times; the FIGURES change when their publisher
                  changes them, which for a current account is once a year.
                  This band sits directly beneath Gulf cards reading "as of
                  2024", so "updated daily" was making a claim the numbers
                  a centimetre above it visibly contradicted.
                  It is also the same confusion that cost this project nine
                  months on the Euro Area: measuring when we last ASKED and
                  reporting it as when the data last MOVED. */}
              <p>{MARKET_COUNT_WORD_CAP} economies scored on five official figures each, and six Gulf economies tracked without a score — sources checked daily, every figure carrying its own reporting date and traced to the institution that published it. Not investment advice.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/learn"
                className="tap btn-primary"
              >
                How MMAI is calculated →
              </Link>
              <Link
                href="/sources"
                className="tap btn-secondary"
              >
                Sources
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="subscribe">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <SubscribeForm />
        </div>
      </div>
    </>
  );
}
