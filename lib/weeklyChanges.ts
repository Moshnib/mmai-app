"use client";

import { getPublicSupabaseClient } from "@/lib/supabase";
import { type RawIndicators } from "@/lib/indicators";
import { INDICATOR_FIELD, computeMmai } from "@/lib/composite";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { REFRESH_OVERDUE_MS } from "@/lib/constants";

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
// PER MARKET, not one global date. A single shared floor was the wrong
// shape: swapping four markets' unemployment source on 2026-08-29 reset
// the comparison window for ALL six, including the US and Euro Area
// whose sources did not change at all. That silently discarded seven
// days of perfectly comparable data and left the feed with nothing to
// show -- reported by the site owner as "started Aug 29, no earlier
// data, no update we can have now", which was a fair complaint about a
// real design flaw rather than about the waiting period.
//
// A market's floor moves only when THAT market's sources change.
const FLOOR = (iso: string) => new Date(iso).getTime();
export const COMPARABILITY_FLOOR_BY_MARKET: Record<string, number> = {
  // Unemployment moved off the World Bank's ILO-modelled ANNUAL estimate
  // onto monthly national sources on 2026-08-29 (Canada -> Statistics
  // Canada, UK -> ONS, Australia -> ABS, Japan -> OECD). The values
  // genuinely differ -- Canada 6.907 -> 6.4, UK 4.746 -> 4.9,
  // Australia 4.09 -> 4.46 -- so a pre-swap row compared with a
  // post-swap one would report a source change as an economic move.
  CA: FLOOR("2026-08-29T06:00:00Z"),
  UK: FLOOR("2026-08-29T06:00:00Z"),
  AU: FLOOR("2026-08-29T06:00:00Z"),
  JP: FLOOR("2026-08-29T06:00:00Z"),
  // Untouched by that swap. Their floor is still the earlier EIA/BEA/BOJ
  // changeover, so their history remains comparable and usable today.
  US: FLOOR("2026-08-22T06:00:00Z"),
  EA: FLOOR("2026-08-22T06:00:00Z"),
};

/** Fallback for any market not listed above. */
export const COMPARABILITY_FLOOR = FLOOR("2026-08-29T06:00:00Z");

export function floorFor(market: string): number {
  return COMPARABILITY_FLOOR_BY_MARKET[market] ?? COMPARABILITY_FLOOR;
}

/** The query has to reach back far enough for the EARLIEST market's
 *  floor; each market's own floor is then applied when its buckets are
 *  built, so one market's swap never truncates another's history. */
const EARLIEST_FLOOR = Math.min(COMPARABILITY_FLOOR, ...Object.values(COMPARABILITY_FLOOR_BY_MARKET));

// Maintenance trigger: when a source changes for a market, move THAT
// market's entry here -- never all of them. That market alone will
// correctly show "not enough history yet" for a few days, which is the
// intended honest behaviour.

// THE COMPARISON IS EVENT-DRIVEN, NOT CALENDAR-DRIVEN.
//
// This used to compare "this week" against "a week ago", with a bucket
// having to be 6-10 days older than the one before it. That window was
// arbitrary against how the data actually arrives. Measured over 30 days
// of live rows: something moved on 27 of 92 market-days, and on 7 of the
// last 16 days NOTHING changed in ANY market. Inflation and unemployment
// are monthly, GDP and debt quarterly, policy rates only when a committee
// sits -- so the releases are bursty, and any fixed window is either
// empty or lumps unrelated events together.
//
// So the older bucket is now simply THE MOST RECENT READING THAT WAS
// DIFFERENT. The feed updates the day something lands, never shows an
// empty week, and every item can state the date it actually changed
// rather than being filed under "this week".
//
// The upper bound survives as a sanity limit: a difference against a row
// from months ago is not news, it is a stalled market, and isStale
// already reports that.
const MAX_LOOKBACK_DAYS = 45;

// Query window: bounded, not "last 60 days" -- an unbounded window is
// unbounded in row count too, and the real write cadence is bursty
// (confirmed live: 30-53 rows written on a single busy day), so an
// open-ended window eventually approaches Supabase's 1000-row default
// response cap and silently truncates the oldest rows -- exactly the
// ones the comparison needs. The event search looks further back than a
// week-over-week one did -- a quarterly figure can genuinely sit still
// for a month -- so the row budget rises with it. Measured live at 30-53
// rows on a busy day across all markets, 45 days needs roughly 700 in the
// worst case, which stays clear of Supabase's 1000-row default cap.
const QUERY_WINDOW_DAYS = 12;
const QUERY_ROW_LIMIT = 800;

// Nothing below cancels a hung request on its own: a Supabase call that
// never settles (unreachable host, DNS stall, captive portal) left the
// feed on "Loading…" indefinitely, with no path out. Measured locally
// with the database unreachable: 7.2 seconds of skeleton rows before the
// underlying fetch finally failed, and an outright stall would have sat
// there forever. This bounds that wait.
const QUERY_TIMEOUT_MS = 8000;
const TIMED_OUT = Symbol("weekly-changes-timeout");

export interface WeeklyBucket {
  fetchedAt: string;
  raw: RawIndicators;
  composite: number | null;
}

export interface WeeklyMarketResult {
  marketCode: string;
  marketName: string;
  // True only when the market's most recent write of ANY kind (partial,
  // pre-floor, whatever) is older than REFRESH_OVERDUE_MS (30h) -- a genuine
  // "stopped refreshing" signal. Deliberately computed before the
  // floor/population filters below: a market writing full rows on
  // schedule is refreshing correctly even in the days right after
  // COMPARABILITY_FLOOR moves, when it may have zero comparable buckets.
  // Conflating the two used to make "not currently refreshing" a false
  // claim about a healthy pipeline -- see buckets.length < 2 for that case.
  isStale: boolean;
  buckets: WeeklyBucket[]; // newest first, comparable rows only (see fetchAllWeeklyChanges)
  /** The newest fully-populated reading, IGNORING the comparability
   *  floor. A current value is always valid -- it is only a COMPARISON
   *  across a source swap that is meaningless. Gating both on the same
   *  floor left four markets showing nothing at all for a week after
   *  their unemployment source changed, when their live numbers were
   *  sitting right there. So this drives the display, and `buckets`
   *  drives the delta. */
  latest: WeeklyBucket | null;
  /** When there is no second bucket, the date of the OLDEST reading
   *  inside the lookback that still read identically -- so the feed can
   *  say "unchanged since 12 August" instead of leaving the row blank.
   *
   *  A row with nothing to report is still a fact about the data, and
   *  the feed was printing "no weekly comparison yet", which tells the
   *  reader only that the software has nothing, not that the economy has
   *  been still. Null when the newest reading is the only one in range. */
  steadySince: string | null;
  /** When MMAI first stored the current figures, if they differ from an
   *  earlier reading inside the lookback. See buildBuckets. */
  changedAt: string | null;
}

export interface RawIndicatorRow {
  market: string;
  inflation: number | null;
  gdp_growth: number | null;
  unemployment: number | null;
  policy_rate: number | null;
  brent_yoy: number | null;
  debt_pct_gdp: number | null;
  fetched_at: string;
}

function isFullyPopulated(row: RawIndicatorRow): boolean {
  // THE FIVE SCORED INDICATORS, and exactly those.
  //
  // This asked the wrong question for nine days and broke the whole feed
  // with it. It was written for the five-pillar engine and never updated
  // when the three dimensions replaced it, so it required brent_yoy --
  // which stopped being scored on 1 September -- and did NOT require
  // debt_pct_gdp, which started being scored at the same time.
  //
  // The consequence was not a missing row, it was a wrong sentence. Rows
  // written before government debt existed have debt_pct_gdp null. They
  // passed this gate, so they became comparison buckets; scoredDiffers
  // correctly saw null vs 111 and called it a change; then computeMmai
  // withheld the score for the older row, so the delta could not be
  // computed, and every market fell through to "first reading -- nothing
  // to compare yet". Six markets, every day, since 2 September.
  //
  // A row with any scored indicator missing has no score under v2, so it
  // can never be one half of a comparison.
  return (
    row.inflation != null &&
    row.gdp_growth != null &&
    row.unemployment != null &&
    row.policy_rate != null &&
    row.debt_pct_gdp != null
  );
}

function toRawIndicators(row: RawIndicatorRow): RawIndicators {
  return {
    inflation: row.inflation,
    gdpGrowth: row.gdp_growth,
    unemployment: row.unemployment,
    policyRate: row.policy_rate,
    brentYoY: row.brent_yoy,
    debtPctGdp: row.debt_pct_gdp,
  };
}

/** How many decimals each field is PUBLISHED to, taken from the same
 *  record the pages render from so the two cannot drift apart. */
const PUBLISHED_DP: Record<keyof typeof FIELD_OF, number> = {
  inflation: INDICATOR_FIELD.infGap.decimals,
  gdp_growth: INDICATOR_FIELD.gdp.decimals,
  unemployment: INDICATOR_FIELD.une.decimals,
  policy_rate: INDICATOR_FIELD.rate.decimals,
  debt_pct_gdp: INDICATOR_FIELD.debt.decimals,
};

/** The columns scoredDiffers compares, and nothing else. */
const FIELD_OF = {
  inflation: 1, gdp_growth: 1, unemployment: 1, policy_rate: 1, debt_pct_gdp: 1,
} as const;

/** A reading as a reader sees it. Comparing raw values makes the feed
 *  sensitive below its own display precision. */
function asPublished(v: number | null | undefined, dp: number): number | null {
  return v == null ? null : Number(v.toFixed(dp));
}

/** The five scored fields, COMPARED AT THE PRECISION THEY ARE PUBLISHED
 *  TO. brent_yoy is deliberately absent: it is still fetched and still
 *  shown in the feed, but it stopped being scored on 1 September, so a
 *  change in it is not a change in anything the index reports.
 *
 *  This used to compare raw values with !==, which made the feed
 *  sensitive to movements it could not then display. Japan's policy rate
 *  went 0.977 to 0.978 and back on 7 September 2026 -- a thousandth of a
 *  point, from the Bank of Japan's own rounding -- and the card
 *  announced "moved September 7, 2026" above the line
 *  "Policy rate 0.98% -> 0.98%" and a score change of 0.0. It reported a
 *  change and then showed nothing changing, which reads as a broken page
 *  rather than a quiet week.
 *
 *  A change nobody can see is not a change. The comparison now rounds to
 *  the decimals each field is published to, so the feed says exactly
 *  what the numbers on the page say. */
export function scoredDiffers(a: RawIndicatorRow, b: RawIndicatorRow): boolean {
  return (Object.keys(FIELD_OF) as (keyof typeof FIELD_OF)[]).some((f) => {
    const dp = PUBLISHED_DP[f];
    return asPublished(a[f], dp) !== asPublished(b[f], dp);
  });
}

/** Newest reading, and the most recent one before it that read
 *  differently. Two buckets or one -- one means nothing has moved inside
 *  the lookback, which the feed states plainly rather than hiding.
 *
 *  `changedAt` is WHEN MMAI FIRST SAW THE CURRENT FIGURES: the oldest row
 *  that still reads like the newest, before the first row that does not.
 *  It is what "updated on" and the ticker's age and order are about.
 *
 *  Both used to read the wrong row. The feed printed the date of the
 *  OLDER reading -- the last day the previous figure stood -- so every
 *  change was dated a day early, and three days early after the 16–19
 *  September outage: the US rate rise first stored on the 19th read
 *  "last moved September 16". The ticker dated every change by the
 *  NEWEST reading, which is always this morning, so its 14-day gate
 *  never fired.
 *
 *  First-seen, not the source's own observation date: monthly figures
 *  carry a REFERENCE month (2026-08-01 for August inflation), not the day
 *  they were published, so the page says "updated in MMAI", which is
 *  what this is. */
export function buildBuckets(rowsDesc: RawIndicatorRow[]): {
  buckets: WeeklyBucket[];
  steadySince: string | null;
  changedAt: string | null;
} {
  if (rowsDesc.length === 0) return { buckets: [], steadySince: null, changedAt: null };
  const mk = (row: RawIndicatorRow): WeeklyBucket => ({
    fetchedAt: row.fetched_at,
    raw: toRawIndicators(row),
    composite: computeMmai(toRawIndicators(row), row.market).percentile,
  });

  const newest = rowsDesc[0];
  const newestTime = new Date(newest.fetched_at).getTime();

  // A row that cannot be scored cannot be half of a comparison, whatever
  // the filters above let through. This is the second line of defence for
  // the bug described in isFullyPopulated: the delta silently evaluated
  // to null and the feed reported "first reading" instead of admitting it
  // had a row it could not use.
  const scoreable = (row: RawIndicatorRow) =>
    computeMmai(toRawIndicators(row), row.market).percentile != null;

  // The oldest row seen so far that still read the same as now. Rows are
  // newest-first, so this walks backwards in time and the last one
  // assigned is the furthest back the current figures reach.
  let steadySince: string | null = null;

  for (const row of rowsDesc.slice(1)) {
    const ageDays = (newestTime - new Date(row.fetched_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > MAX_LOOKBACK_DAYS) break;
    // Rows are newest-first, so the first difference found IS the most
    // recent change. Anything between it and now read identically.
    if (!scoreable(row)) continue;
    if (scoredDiffers(newest, row)) {
      // The last row assigned to steadySince is the oldest one that still
      // read like now -- the first time MMAI saw these figures. None at
      // all means the newest row is itself the first.
      return { buckets: [mk(newest), mk(row)], steadySince: null, changedAt: steadySince ?? newest.fetched_at };
    }
    steadySince = row.fetched_at;
  }

  return { buckets: [mk(newest)], steadySince, changedAt: null };
}

// "Couldn't reach the database" and "every market has stopped
// refreshing" are completely different facts, and this used to return
// the same value for both -- every market flagged isStale, which the
// feed rendered as "Not currently refreshing — no recent data
// available." That is a claim about the refresh pipeline, published
// whenever the READER's browser couldn't open a connection, while the
// pipeline was very likely running perfectly. The caller now gets to
// tell the two apart and say which one actually happened.
export type WeeklyChangesResult =
  | { ok: true; markets: WeeklyMarketResult[] }
  | { ok: false; reason: "unconfigured" | "unavailable" };

/** Fetches weekly-bucketed history for every FALLBACK_MARKETS market in
 *  one query (not one round-trip per market), applying every gate above.
 *  Returns the newest reading per market and the most recent one that
 *  read differently, so the caller can say WHAT changed and WHEN rather
 *  than forcing every release into a fixed calendar window. */
export async function fetchAllWeeklyChanges(): Promise<WeeklyChangesResult> {
  const marketNames = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
  const marketCodes = FALLBACK_MARKETS.map((m) => m.code);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { ok: false, reason: "unconfigured" };
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
    // Raced against a timer rather than left open-ended. The abandoned
    // request is harmless -- it settles into nothing -- but the reader
    // gets a definite answer instead of an endless skeleton.
    const settled = await Promise.race([
      Promise.all([
      supabase
        .from("raw_indicators")
        .select("market, fetched_at")
        .in("market", marketCodes)
        .gte("fetched_at", windowStart)
        .order("fetched_at", { ascending: false })
        .limit(60),
      supabase
        .from("raw_indicators")
        .select("market, inflation, gdp_growth, unemployment, policy_rate, brent_yoy, debt_pct_gdp, fetched_at")
        .in("market", marketCodes)
        .gte("fetched_at", new Date(EARLIEST_FLOOR).toISOString())
        // Must match isFullyPopulated exactly -- the five SCORED
        // indicators. brent_yoy is deliberately NOT required: it stopped
        // being scored on 1 September, so demanding it would discard
        // perfectly comparable rows, and debt_pct_gdp is required because
        // it started being scored on the same day.
        .not("inflation", "is", null)
        .not("gdp_growth", "is", null)
        .not("unemployment", "is", null)
        .not("policy_rate", "is", null)
        .not("debt_pct_gdp", "is", null)
        .order("fetched_at", { ascending: false })
        .limit(QUERY_ROW_LIMIT),
      ]),
      new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), QUERY_TIMEOUT_MS)),
    ]);

    if (settled === TIMED_OUT) return { ok: false, reason: "unavailable" };
    const [freshnessRes, comparableRes] = settled;
    if (freshnessRes.error || !freshnessRes.data || comparableRes.error || !comparableRes.data) {
      return { ok: false, reason: "unavailable" };
    }

    const freshnessRows = freshnessRes.data as Array<{ market: string; fetched_at: string }>;
    const comparableRows = comparableRes.data as RawIndicatorRow[];

    const markets = FALLBACK_MARKETS.map((m) => {
      const newestAny = freshnessRows.find((r) => r.market === m.code); // already fetched_at-desc from the query
      const isStale = !newestAny || Date.now() - new Date(newestAny.fetched_at).getTime() > REFRESH_OVERDUE_MS;

      // isFullyPopulated is redundant with the query's .not(...) chain above
      // in the normal case -- kept as a client-side safety net (cheap, and
      // this is the one function in the app most worth double-checking)
      // rather than trusting a single enforcement point for "never show a
      // fake delta from mismatched pillar coverage."
      // Each market's OWN floor, applied here rather than in the query.
      // The query reaches back to the earliest floor of any market, so
      // this is what stops one market's source swap from truncating
      // another market's usable history.
      const marketFloor = floorFor(m.code);
      const marketRows = comparableRows.filter((r) => r.market === m.code).filter(isFullyPopulated); // already fetched_at-desc

      // Display value: newest reading, floor ignored. Always valid.
      const newest = marketRows[0];
      const latest: WeeklyBucket | null = newest
        ? {
            fetchedAt: newest.fetched_at,
            raw: toRawIndicators(newest),
            composite: computeMmai(toRawIndicators(newest), newest.market).percentile,
          }
        : null;

      // Comparison: floor applied, because a delta spanning a source
      // swap would report a fetcher change as an economic move.
      const { buckets, steadySince, changedAt } = buildBuckets(
        marketRows.filter((r) => new Date(r.fetched_at).getTime() >= marketFloor)
      );
      return { marketCode: m.code, marketName: marketNames[m.code], isStale, buckets, latest, steadySince, changedAt };
    });

    return { ok: true, markets };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
