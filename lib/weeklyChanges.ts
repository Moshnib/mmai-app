"use client";

import { getPublicSupabaseClient } from "@/lib/supabase";
import { computePillarScores, computeComposite, type RawIndicators } from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { STALE_THRESHOLD_MS } from "@/lib/constants";

// ============================================================
// Week-over-week change data, built directly on raw_indicators.
//
// A first-draft "just compare rows ~6 days apart" design was checked
// against the live table before this was written and would have
// PUBLISHED FABRICATED CHANGES, not just shown a coverage gap. Every
// gate below exists because of a specific, confirmed-live failure mode
// -- see the comments at each one. Do not relax any of them without
// re-checking against live data first.
// ============================================================

// Rows before this timestamp aren't comparable to rows after it: this is
// when the last live-source swap landed for several markets (EIA/BEA/BOJ/
// World Bank coming online, replacing manual-fallback or FRED/OECD
// placeholder values). Comparing across this line reports things like
// "Brent moved -5% to +18%" or "Japan's inflation jumped 3.6pp" -- a
// fetcher change, not an economic one. Confirmed live: every row at/after
// this timestamp has a live, source-stable note and live Brent for all
// six markets; nothing before it does.
//
// Maintenance trigger: bump this to the new swap's timestamp the next time
// a data source changes for any market. Until it's bumped, every market
// will correctly show "not enough history yet" for a few days after the
// swap -- that's the intended, honest behavior, not a bug to route around.
export const COMPARABILITY_FLOOR = new Date("2026-08-22T06:00:00Z").getTime();

// Bucket window: an older bucket must be at least MIN days and at most
// MAX days older than the bucket before it. The lower bound is what
// makes a bucket "a week old" rather than "yesterday, roughly a week
// old". The upper bound is what stops a stalled market's very old rows
// from being labeled "last week" just because they're the next-oldest
// thing sitting in the table -- confirmed live that retired/paused
// markets (AE, NO) still have rows in raw_indicators indefinitely.
export const BUCKET_MIN_GAP_DAYS = 6;
const BUCKET_MAX_GAP_DAYS = 10;

// Query window: bounded, not "last 60 days" -- an unbounded window is
// unbounded in row count too, and the real write cadence is bursty
// (confirmed live: 30-53 rows written on a single busy day), so an
// open-ended window eventually approaches Supabase's 1000-row default
// response cap and silently truncates the oldest rows -- exactly the
// ones a "last week" comparison needs. 12 days comfortably covers
// weeksBack up to ~2 with real headroom.
const QUERY_WINDOW_DAYS = 12;
const QUERY_ROW_LIMIT = 200;

export interface WeeklyBucket {
  fetchedAt: string;
  raw: RawIndicators;
  composite: number | null;
}

export interface WeeklyMarketResult {
  marketCode: string;
  marketName: string;
  // True only when the market's most recent write of ANY kind (partial,
  // pre-floor, whatever) is older than the 72h threshold -- a genuine
  // "stopped refreshing" signal. Deliberately computed before the
  // floor/population filters below: a market writing full rows on
  // schedule is refreshing correctly even in the days right after
  // COMPARABILITY_FLOOR moves, when it may have zero comparable buckets.
  // Conflating the two used to make "not currently refreshing" a false
  // claim about a healthy pipeline -- see buckets.length < 2 for that case.
  isStale: boolean;
  buckets: WeeklyBucket[]; // newest first, comparable rows only (see fetchAllWeeklyChanges)
}

interface RawIndicatorRow {
  market: string;
  inflation: number | null;
  gdp_growth: number | null;
  unemployment: number | null;
  policy_rate: number | null;
  brent_yoy: number | null;
  fetched_at: string;
}

function isFullyPopulated(row: RawIndicatorRow): boolean {
  // A row with any null indicator has a different pillar coverage than a
  // full row -- computeComposite reweights across whatever's populated,
  // so a 4-pillar composite and a 5-pillar composite from the same
  // market aren't the same measurement. Comparing them reports a fake
  // delta with zero real change behind it (confirmed live: a real
  // gdp_growth-null row exists for the US, tagged "PARTIAL this run" by
  // the refresh route itself). Only fully-populated rows are usable here.
  return (
    row.inflation != null &&
    row.gdp_growth != null &&
    row.unemployment != null &&
    row.policy_rate != null &&
    row.brent_yoy != null
  );
}

function toRawIndicators(row: RawIndicatorRow): RawIndicators {
  return {
    inflation: row.inflation,
    gdpGrowth: row.gdp_growth,
    unemployment: row.unemployment,
    policyRate: row.policy_rate,
    brentYoY: row.brent_yoy,
  };
}

function buildBuckets(rowsDesc: RawIndicatorRow[], weeksBack: number): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = [];
  let cursorTime: number | null = null;

  for (const row of rowsDesc) {
    if (buckets.length >= weeksBack) break;
    const rowTime = new Date(row.fetched_at).getTime();

    if (cursorTime === null) {
      // First (newest) bucket -- no gap requirement.
      buckets.push({ fetchedAt: row.fetched_at, raw: toRawIndicators(row), composite: computeComposite(computePillarScores(toRawIndicators(row))).composite });
      cursorTime = rowTime;
      continue;
    }

    const gapDays = (cursorTime - rowTime) / (1000 * 60 * 60 * 24);
    if (gapDays < BUCKET_MIN_GAP_DAYS) continue; // too close to the previous bucket -- keep looking further back
    if (gapDays > BUCKET_MAX_GAP_DAYS) break; // gap too large -- a stalled market's old row, not "last week"

    buckets.push({ fetchedAt: row.fetched_at, raw: toRawIndicators(row), composite: computeComposite(computePillarScores(toRawIndicators(row))).composite });
    cursorTime = rowTime;
  }

  return buckets;
}

/** Fetches weekly-bucketed history for every FALLBACK_MARKETS market in
 *  one query (not one round-trip per market), applying every gate above.
 *  `weeksBack=2` is "this week vs last week" (the homepage feed);
 *  a future Trends-page weekly table would call this with a larger
 *  weeksBack instead of a second implementation. */
export async function fetchAllWeeklyChanges(weeksBack: number): Promise<WeeklyMarketResult[]> {
  const marketNames = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
  const marketCodes = FALLBACK_MARKETS.map((m) => m.code);

  const empty: WeeklyMarketResult[] = FALLBACK_MARKETS.map((m) => ({ marketCode: m.code, marketName: m.name, isStale: true, buckets: [] }));

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return empty;
    const supabase = getPublicSupabaseClient();

    const windowStart = new Date(Date.now() - QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Two separate queries, not one filtered client-side, because
    // "is this market still refreshing" and "does it have comparable
    // history" need different row sets -- see the isStale comment above.
    // Filtering scope/floor/population server-side also means the
    // QUERY_ROW_LIMIT budget for the second query is spent entirely on
    // rows that can actually become a bucket, not burned on retired
    // markets, partial rows, or pre-floor rows that would just be
    // discarded client-side (confirmed live: single days write 30-53
    // rows across all markets, so a slow stretch inside the 12-day
    // window can otherwise approach the cap and silently drop the
    // oldest -- exactly the "prior" buckets a comparison needs).
    const [freshnessRes, comparableRes] = await Promise.all([
      supabase
        .from("raw_indicators")
        .select("market, fetched_at")
        .in("market", marketCodes)
        .gte("fetched_at", windowStart)
        .order("fetched_at", { ascending: false })
        .limit(60),
      supabase
        .from("raw_indicators")
        .select("market, inflation, gdp_growth, unemployment, policy_rate, brent_yoy, fetched_at")
        .in("market", marketCodes)
        .gte("fetched_at", new Date(COMPARABILITY_FLOOR).toISOString())
        .not("inflation", "is", null)
        .not("gdp_growth", "is", null)
        .not("unemployment", "is", null)
        .not("policy_rate", "is", null)
        .not("brent_yoy", "is", null)
        .order("fetched_at", { ascending: false })
        .limit(QUERY_ROW_LIMIT),
    ]);
    if (freshnessRes.error || !freshnessRes.data || comparableRes.error || !comparableRes.data) return empty;

    const freshnessRows = freshnessRes.data as Array<{ market: string; fetched_at: string }>;
    const comparableRows = comparableRes.data as RawIndicatorRow[];

    return FALLBACK_MARKETS.map((m) => {
      const newestAny = freshnessRows.find((r) => r.market === m.code); // already fetched_at-desc from the query
      const isStale = !newestAny || Date.now() - new Date(newestAny.fetched_at).getTime() > STALE_THRESHOLD_MS;

      // isFullyPopulated is redundant with the query's .not(...) chain above
      // in the normal case -- kept as a client-side safety net (cheap, and
      // this is the one function in the app most worth double-checking)
      // rather than trusting a single enforcement point for "never show a
      // fake delta from mismatched pillar coverage."
      const marketComparableRows = comparableRows.filter((r) => r.market === m.code).filter(isFullyPopulated); // already fetched_at-desc
      const buckets = buildBuckets(marketComparableRows, weeksBack);
      return { marketCode: m.code, marketName: marketNames[m.code], isStale, buckets };
    });
  } catch {
    return empty;
  }
}
