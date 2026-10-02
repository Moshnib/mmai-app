import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { type RawIndicators } from "@/lib/indicators";
import { computeMmai, percentileBandLabel, dimensionPercentiles, type DimensionKey } from "@/lib/composite";
import { checkPublishedDrift } from "@/lib/publishedDrift";

/** Which engine produces the `band` column that subscriber alerts compare.
 *  The cutover happened on 5 September 2026: v2.0 is the only engine, the
 *  five-pillar composite is retired, and this constant is kept solely so the
 *  suppression log can name the engine it is talking about. */
const ALERT_ENGINE = "v2.0";
import { fetchUsInflation, fetchUsUnemployment } from "@/lib/fetchers/bls";
import { fetchUsPolicyRate } from "@/lib/fetchers/nyfed";
import { fetchJapanPolicyRate } from "@/lib/fetchers/boj";
// fetchGdpGrowth is gone from this import, and that is a milestone worth
// recording: with Norway moved to Eurostat on 2026-09-12, NO SCORED
// MARKET READS GDP GROWTH FROM THE WORLD BANK ANY MORE. Every one now
// reads a quarterly year-over-year figure from its own statistics office
// or from Eurostat, so no market carries a number that is a year older
// than the ones printed beside it.
//
// fetchUnemployment stays, for one narrow purpose: Japan's fallback when
// the OECD dataflow fails. See the JP branch.
import { fetchUnemployment } from "@/lib/fetchers/worldbank";
import { fetchAustraliaInflation, fetchAustraliaUnemployment, fetchAustraliaGdpGrowthQuarterly } from "@/lib/fetchers/abs";
import { fetchJapanInflation, fetchJapanGdpGrowthQuarterly } from "@/lib/fetchers/estat";
import { fetchJapanUnemployment } from "@/lib/fetchers/oecd";
import { fetchAllBondYieldSeries, BOND_YIELD_SOURCE } from "@/lib/fetchers/bondYields";
import { fetchAustraliaPolicyRate } from "@/lib/fetchers/rba";
import { fetchEuroAreaGdpGrowthQuarterly, fetchEuroAreaUnemployment } from "@/lib/fetchers/eurostat";
// EA INFLATION MOVED FROM EUROSTAT TO THE ECB on 2026-09-02. Eurostat
// retired prc_hicp_manr on 2026-02-04 and MMAI published a nine-month-old
// figure until it was found. See lib/fetchers/ecb.ts.
import { fetchEuroAreaInflation, fetchEuroAreaPolicyRate } from "@/lib/fetchers/ecb";
import { fetchCanadaInflation, fetchCanadaUnemployment, fetchCanadaGdpGrowthQuarterly } from "@/lib/fetchers/statcan";
import { fetchCanadaPolicyRate } from "@/lib/fetchers/boc";
import { fetchUkInflation, fetchUkUnemployment, fetchUkGdpGrowthQuarterly } from "@/lib/fetchers/ons";
import { fetchUkPolicyRate } from "@/lib/fetchers/boe";
import { fetchNorwayInflation } from "@/lib/fetchers/ssb";
import { fetchSwedenInflation, fetchSwedenUnemployment, fetchSwedenGdpGrowthQuarterly } from "@/lib/fetchers/scb";
import { fetchBisPolicyRate, type BisPolicyRateArea } from "@/lib/fetchers/bis";
import { fetchNorwayUnemployment, fetchNorwayGdpGrowthQuarterly } from "@/lib/fetchers/norway";
import { fetchKoreaReadings } from "@/lib/fetchers/korea";
import {
  fetchObservatoryInflation,
  fetchObservatoryUnemployment,
  fetchObservatoryGdpGrowth,
  fetchObservatoryBondYield,
} from "@/lib/fetchers/observatory";
import { OBSERVATORY, setsOwnRate as observatorySetsOwnRate, needsObservatoryFetch, fillFromEarlier, type ObservatoryCountry, type ObservatoryRow } from "@/lib/observatory";
import { fetchUsGdpGrowthQuarterly, fetchUsPceInflation } from "@/lib/fetchers/bea";
import { fetchBrentYoY, fetchBrentDailySeries } from "@/lib/fetchers/eia";
import { fetchGovernmentDebt } from "@/lib/fetchers/bis";
import { sendBandCrossingEmail } from "@/lib/notify";
import { IS_VERCEL_DOMAIN, ALERT_FROM } from "@/lib/siteUrl";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { sourceForPillar, sourceNoteFor } from "@/lib/sources";
import { stalenessOf, quarterToDate, describeStale } from "@/lib/freshness";
// PillarKey and RAW_FIELD are the SOURCE taxonomy, not the retired scoring
// engine: lib/sources.ts keys every source by pillar code, and that mapping
// is still how a stale figure is traced back to the institution behind it.
import { RAW_FIELD, type PillarKey } from "@/lib/indicators";

const MARKET_NAMES: Record<string, string> = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));

// Vercel Hobby's default function timeout is 10s. This run already takes
// ~9s across 6 markets, with no headroom for a 7th or for any new source
// that's slower than the proven ones -- if it times out mid-loop, whichever
// markets haven't run yet (the run is sequential) simply get no data that
// day, silently, with no error surfaced anywhere. Raised explicitly rather
// than relying on the platform default.
export const maxDuration = 60;

/**
 * All 7 markets are now wired to live sources for every indicator,
 * including GDP growth (US) and Brent Crude (shared across every market).
 *
 * Brent is a single global input, not a per-market figure (Equation 5's
 * design), so it's fetched ONCE per refresh cycle in GET() below -- not
 * once per market -- and passed into fetchRawIndicators() as an argument.
 *
 * Each per-indicator fetch is wrapped in settle() so one source having a
 * bad day (rate-limited, temporarily down, schema change) doesn't blank
 * out the whole ROW -- the readings that did arrive are still stored, and
 * still shown.
 *
 * It does not save the SCORE. The retired five-pillar engine reweighted
 * around a missing pillar and published anyway above 70% coverage; v2
 * withholds instead, because a country scored on four indicators is not
 * comparable with one scored on five. So a null here means no score for
 * that market on that run, deliberately, and the site says so.
 *
 * UAE was removed 2026-08-19 (no verified policy-rate source, never
 * cleared the 70% coverage threshold). Market Momentum was removed the
 * same day (no licensed equity source) — its weight was redistributed
 * into the remaining five pillars. Both that redistribution and the
 * pillars themselves were retired with the five-pillar engine.
 */
// Set by fetchRawIndicators when Japan falls back to the World Bank, and
// read when composing that row source note. Safe as module state only
// because the refresh loop runs markets strictly sequentially, one await
// at a time -- there is no interleaving to race with.
let jpUnemploymentFellBack = false;

// Set when Japan's unemployment came from the workflow relay rather than
// this app's own OECD call. Recorded on the stored row so a reader can
// tell which path produced the figure -- the same reason the World Bank
// fallback is recorded.
let jpUnemploymentViaRelay = false;

// Same mechanism for the United States: PCE is the series the Fed's 2%
// target is defined on, so it is what MMAI scores. CPI is kept as a
// fallback rather than letting the pillar drop out -- losing PS entirely
// would take US coverage to 0.80 and move the composite far more than
// the wedge between the two series does.
let usInflationFellBack = false;

async function settle<T>(label: string, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.error(`Fetch failed [${label}]:`, (err as Error).message);
    return null;
  }
}

/** Japan's unemployment, relayed by the GitHub Actions workflow.
 *
 *  OECD is reachable from the Actions runner and NOT from Vercel --
 *  verified: ~2s from a laptop and from the runner, still failing in
 *  production, so it is OECD refusing Vercel's egress rather than
 *  slowness. The workflow fetches it there and passes it here.
 *
 *  THIS IS AN INPUT FROM OUTSIDE, so it is validated rather than
 *  trusted. The endpoint is already behind CRON_SECRET, so the trust
 *  boundary is the same as triggering a refresh at all -- but a value
 *  that lands in a published score deserves a range check regardless.
 *
 *  Returns null on anything implausible, and the caller then falls back
 *  exactly as it does today. Silently accepting a bad number would be
 *  worse than the staleness this is fixing. */
/** A FIGURE FETCHED BY THE WORKFLOW AND HANDED TO THIS ROUTE.
 *
 *  OECD DOES NOT WORK FROM VERCEL. That is not a guess: on 13 September
 *  2026 Korea was added reading three OECD series directly, and the stored
 *  row came back with policy rate 3 and debt 45.7 from BIS beside inflation
 *  NULL, unemployment NULL and GDP NULL from OECD. Five calls, the same
 *  runtime, the same moment; the two non-OECD ones worked. All three OECD
 *  series had been verified live from a laptop minutes earlier.
 *
 *  This project already knew. Japan's unemployment has been relayed from
 *  the GitHub Action since August for exactly this reason, and the
 *  workflow step doing it is thirty lines above the one that calls this
 *  route. Korea was built on the one source already proven not to work
 *  here, with the evidence sitting in the repository.
 *
 *  So the workflow curls these, and passes them in. The direct fetchers
 *  stay and are still tried first: they work everywhere except Vercel,
 *  which includes scripts/verify-korea-fetch.ts.
 *
 *  Values are validated rather than trusted -- this is a query parameter,
 *  and a relay that starts sending nonsense must not become the published
 *  figure. */
function parseRelayedFigure(
  request: Request,
  key: string,
  bounds: { min: number; max: number; maxAgeDays: number },
): { value: number; observationDate: string } | null {
  const params = new URL(request.url).searchParams;
  const rawValue = params.get(key);
  const rawDate = params.get(`${key}_date`);
  if (!rawValue || !rawDate) return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) {
    console.error(`Relayed ${key} rejected: implausible value "${rawValue}"`);
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    console.error(`Relayed ${key} rejected: bad date "${rawDate}"`);
    return null;
  }
  const when = Date.parse(rawDate);
  const now = Date.now();
  if (Number.isNaN(when) || when > now || now - when > bounds.maxAgeDays * 86_400_000) {
    console.error(`Relayed ${key} rejected: date out of range "${rawDate}"`);
    return null;
  }

  return { value, observationDate: rawDate };
}

export interface RelayedKorea {
  inflation: { value: number; observationDate: string } | null;
  unemployment: { value: number; observationDate: string } | null;
  gdpGrowth: { value: number; observationDate: string } | null;
}

/** Bounds are per indicator and deliberately wide: they reject a unit
 *  mix-up or a parse landing on the wrong column, not an unusual economy. */
function parseRelayedKorea(request: Request): RelayedKorea {
  return {
    inflation: parseRelayedFigure(request, "kr_inflation", { min: -5, max: 30, maxAgeDays: 400 }),
    unemployment: parseRelayedFigure(request, "kr_unemployment", { min: 0.1, max: 30, maxAgeDays: 400 }),
    gdpGrowth: parseRelayedFigure(request, "kr_gdp", { min: -20, max: 20, maxAgeDays: 400 }),
  };
}

function parseRelayedJpUnemployment(request: Request): { value: number; observationDate: string } | null {
  const params = new URL(request.url).searchParams;
  const rawValue = params.get("jp_unemployment");
  const rawDate = params.get("jp_unemployment_date");
  if (!rawValue || !rawDate) return null;

  const value = Number(rawValue);
  // Japan's unemployment has not left roughly 2-6% in decades. A band of
  // 0-30 rejects nonsense without pretending to know the right answer.
  if (!Number.isFinite(value) || value <= 0 || value > 30) {
    console.error(`Relayed JP unemployment rejected: implausible value "${rawValue}"`);
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    console.error(`Relayed JP unemployment rejected: bad date "${rawDate}"`);
    return null;
  }
  const when = Date.parse(rawDate);
  const now = Date.now();
  // Not in the future, and not older than two years -- either would mean
  // the relay is broken rather than helping.
  if (Number.isNaN(when) || when > now || now - when > 730 * 86_400_000) {
    console.error(`Relayed JP unemployment rejected: date out of range "${rawDate}"`);
    return null;
  }

  return { value, observationDate: rawDate };
}

/** WHEN each figure refers to, as distinct from when it was fetched.
 *
 *  Audit finding M-6. gulf_indicators has carried a date per indicator
 *  for a while; raw_indicators -- which drives the actual score -- had
 *  ONE date for all five, and it recorded the FETCH date. So the scored
 *  half of the site could not tell a reader that the US GDP figure in a
 *  row stamped today is a full-year annual number.
 *
 *  Every fetcher already returns its observation period. Until now the
 *  refresh route threw all five away. Null means the source did not
 *  supply one, or that indicator failed this run -- never a guess.
 */
interface ObservationDates {
  inflation: string | null;
  gdpGrowth: string | null;
  unemployment: string | null;
  policyRate: string | null;
  brent: string | null;
}

interface FetchedIndicators {
  raw: RawIndicators;
  dates: ObservationDates;
  /** THE ANNOUNCED TARGET RANGE, WHERE A CENTRAL BANK SETS ONE.
   *
   *  Only the US publishes a range today. The score uses the Effective
   *  Federal Funds Rate, what banks actually paid, while the FOMC
   *  announces a range and the press quotes its top. On 25 September
   *  2026 that was 3.88% against "4%", with nothing on the card to
   *  explain the gap.
   *
   *  Left undefined by every other market, and written as NULL either
   *  way, so a range can never outlive the decision that set it. */
  rateTarget?: { low: number | null; high: number | null };
}

/** THE DAILY WRITE MUST NOT DEPEND ON A MIGRATION HAVING BEEN RUN.
 *
 *  policy_rate_target_low/high were added by hand in the Supabase editor on
 *  25 September 2026. If the deploy lands first, PostgREST rejects the
 *  whole insert with PGRST204 ("column not found"), every market's write
 *  fails, and the route still answers 200 -- so the refresh workflow goes
 *  GREEN while nothing at all is saved, and the site only shows it days
 *  later when the rows age out. That is the shape of the 16-19 September
 *  outage, and it is the worst failure available here: silent.
 *
 *  So the insert retries without the two new columns, and says so loudly in
 *  the log. Narrow on purpose -- only PGRST204, and only when the message
 *  names one of these two columns. Any other write failure still throws,
 *  because any other write failure is real.
 *
 *  A single-row PostgREST insert is atomic: the rejected attempt wrote
 *  nothing, so the retry cannot double-insert. */
async function insertRawIndicators(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  row: Record<string, unknown>
) {
  const first = await supabase.from("raw_indicators").insert(row);
  const missingColumn =
    first.error?.code === "PGRST204" && /policy_rate_target/.test(first.error.message);
  if (!missingColumn) return first;

  console.warn(
    `${row.market}: raw_indicators has no policy_rate_target_low/high yet -- ` +
      `writing the row without the Fed's announced range. Run ` +
      `supabase/migrations/2026-09-25-policy-rate-target.sql to fix this. ` +
      `(${first.error?.message})`
  );
  const withoutTarget = { ...row };
  delete withoutTarget.policy_rate_target_low;
  delete withoutTarget.policy_rate_target_high;
  return supabase.from("raw_indicators").insert(withoutTarget);
}

/** THE ONE FIGURE ON THIS SITE THAT MOVES EVERY TRADING DAY.
 *
 *  Written on EVERY run, not just the day's first: the EIA publishes
 *  Brent during the US afternoon and the first run to land is mid-morning
 *  UTC, so a once-a-day write would sit permanently a day further behind
 *  than the source already is.
 *
 *  THE WHOLE WINDOW EVERY TIME, not just the newest day. It costs one
 *  request, it heals any hole a failed run left, and it lets a revision
 *  land -- an EIA spot price is not frozen the way a published yield
 *  curve is, which is why this upserts rather than ignoring conflicts
 *  the way the bond-yield block does.
 *
 *  Never throws: a commodity price is shown beside the score, not inside
 *  it, and no part of the index depends on it. */
async function refreshBrentDaily(
  supabase: ReturnType<typeof getServiceSupabaseClient>
): Promise<{ written: number; newest: string | null; error?: string }> {
  try {
    const points = await fetchBrentDailySeries();
    const rows = points.map((p) => ({
      series: "brent_spot_daily",
      observation_date: p.date,
      price: p.price,
      unit: "$/bbl",
      source: "U.S. Energy Information Administration",
      fetched_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("commodity_prices")
      .upsert(rows, { onConflict: "series,observation_date" });
    if (error) {
      // The table is created by a hand-run migration, so a deploy can
      // land before it exists. PostgREST answers PGRST205 for an unknown
      // TABLE (PGRST204 is an unknown COLUMN, which is the policy-rate
      // case), and older versions pass through Postgres's own 42P01.
      // Narrow to this table by name so no other write failure is hidden.
      const missingTable =
        (error.code === "PGRST205" || error.code === "42P01") && /commodity_prices/.test(error.message);
      if (missingTable) {
        console.warn(
          "commodity_prices does not exist yet -- the daily oil price is not being stored. " +
            "Run supabase/migrations/2026-10-02-commodity-prices.sql. " +
            `(${error.message})`
        );
        return { written: 0, newest: null, error: "table missing" };
      }
      throw new Error(error.message);
    }
    return { written: rows.length, newest: points[points.length - 1]?.date ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Daily Brent failed:", message);
    return { written: 0, newest: null, error: message };
  }
}

async function fetchRawIndicators(
  market: string,
  brent: { brentYoY: number; observationDate: string } | null,
  relayedJpUnemployment: { value: number; observationDate: string } | null,
  relayedKorea: RelayedKorea
): Promise<FetchedIndicators> {
  const brentYoY = brent?.brentYoY ?? null;
  const brentDate = brent?.observationDate ?? null;
  if (market === "US") {
    // Price Stability scores a deviation from a 2% target. For the US
    // that target is the Fed's, and the Fed defines it on the PCE price
    // index -- not CPI. Scoring CPI against a PCE-defined target measures
    // the country against a benchmark it does not use. Charter section 10
    // reached this conclusion independently. CPI is no longer stored for
    // the US -- it is fetched only if BEA is unavailable, and the row's
    // source_note records it when that happens.
    const [infl, unemp, rate, gdp] = await Promise.all([
      settle("US inflation (PCE)", fetchUsPceInflation()),
      settle("US unemployment", fetchUsUnemployment()),
      settle("US policy rate", fetchUsPolicyRate()),
      settle("US GDP growth (quarterly YoY)", fetchUsGdpGrowthQuarterly()),
    ]);

    let usInflation = infl?.inflation ?? null;
    // THE FALLBACK CARRIES ITS OWN OBSERVATION PERIOD, exactly as Japan's
    // does below. Without this line the row stored a CPI figure under a
    // NULL date, and a null date is not a small cosmetic gap:
    //
    //   - stalenessOf() returns null for a null date -- "no opinion", which
    //     stalenessWarnings then treats as a pass. US inflation would be
    //     exempt from every age rule for as long as the fallback lasted.
    //   - the source audit reads a null date as "unknown period", skips the
    //     date comparison, and compares live PCE against stored CPI. Those
    //     legitimately differ by several tenths, so it would report the site
    //     as wrong on a day the site is doing exactly what it documents.
    let usInflationDate = infl?.observationDate ?? null;
    let fellBack = false;
    if (usInflation == null) {
      const fb = await settle("US inflation (CPI fallback)", fetchUsInflation());
      if (fb?.inflation != null) {
        usInflation = fb.inflation;
        usInflationDate = fb.observationDate ?? null;
        fellBack = true;
      }
    }
    usInflationFellBack = fellBack;

    return {
      raw: {
        inflation: usInflation,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: usInflationDate,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
      // Both bounds or neither: readTargetRange() returns nulls rather
      // than half a range, and a failed fetch leaves `rate` undefined,
      // which also stores nulls. Yesterday's range is never carried over.
      rateTarget: { low: rate?.targetLow ?? null, high: rate?.targetHigh ?? null },
    };
  }

  if (market === "JP") {
    // CPI/unemployment/GDP all via World Bank (CC BY 4.0, no storage
    // restriction — confirmed 2026-08-22, switched from FRED's
    // redistribution of OECD data because FRED's Terms of Service
    // prohibit storing/caching FRED Content in a database, which this
    // app's refresh pipeline does for every indicator). Policy rate via
    // BOJ's official API (DB=FM01, series STRDCLUCON — confirmed live
    // in-browser 2026-08-21, after this server's own fetch was blocked).
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("JP inflation (e-Stat monthly)", fetchJapanInflation()),
      settle("JP unemployment", fetchJapanUnemployment()),
      settle("JP GDP growth (quarterly YoY)", fetchJapanGdpGrowthQuarterly()),
      settle("JP policy rate", fetchJapanPolicyRate()),
    ]);

    // FALLBACK, added 2026-08-31 after this broke in production.
    // OECD answers instantly from a laptop and from GitHub's runners and
    // fails from Vercel -- the same shape as the Saudi central bank being
    // unreachable from Vercel while fine locally (handover 11.2).
    //
    // The symptom was not a missing number, it was a MOVED SCORE. Under
    // the old engine a null unemployment reading was reweighted around,
    // and Japan published 75.35 instead of ~79.1 for two days -- a 3.8
    // point drop caused by a fetcher rather than by Japan.
    //
    // v2 cannot produce that particular lie: it withholds the score
    // rather than reweighting. The fallback below still matters, because
    // withholding Japan for two days is its own kind of wrong.
    //
    // So: prefer OECD's monthly figure, fall back to the World Bank
    // annual series that served Japan reliably for months. A slightly
    // staler number beats silently dropping a whole pillar. Which source
    // was used is recorded in the row's source note.
    let jpUnemployment = unemp?.unemployment ?? null;
    // The fallback carries its own observation period. Without this, a run
    // that fell back would report a NULL date for a figure that has one.
    let jpUnemploymentDate = unemp?.observationDate ?? null;

    // Preference order: this app's own OECD call (in case it ever starts
    // working from Vercel), then the relay -- which is the SAME OECD
    // series fetched from somewhere that can reach it -- then the World
    // Bank annual figure as a last resort.
    jpUnemploymentViaRelay = false;
    if (jpUnemployment == null && relayedJpUnemployment) {
      jpUnemployment = relayedJpUnemployment.value;
      jpUnemploymentDate = relayedJpUnemployment.observationDate;
      jpUnemploymentViaRelay = true;
    }
    let jpFellBack = false;
    if (jpUnemployment == null) {
      const fb = await settle("JP unemployment (World Bank fallback)", fetchUnemployment("JPN"));
      if (fb?.unemployment != null) {
        jpUnemployment = fb.unemployment;
        jpUnemploymentDate = fb.observationDate ?? null;
        jpFellBack = true;
      }
    }
    jpUnemploymentFellBack = jpFellBack;
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: jpUnemployment,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: jpUnemploymentDate,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "AU") {
    // CPI via ABS Data API (CC BY 4.0, confirmed live via direct browser
    // test 2026-08-21). Unemployment/GDP via World Bank. Policy rate via
    // RBA's own F1.1 table -- cross-verified: the last published row
    // matched an independent news report of the same rate on the same date.
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("AU inflation", fetchAustraliaInflation()),
      settle("AU unemployment", fetchAustraliaUnemployment()),
      settle("AU GDP growth (quarterly YoY)", fetchAustraliaGdpGrowthQuarterly()),
      settle("AU policy rate", fetchAustraliaPolicyRate()),
    ]);
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "SE") {
    // SWEDEN, added 2026-09-12. Statistics Sweden publishes all three of
    // its national figures as finished RATES -- CPI "annual changes",
    // labour status ALÖSP "unemployment rate, percent", and NR0103DH
    // "change in volume corresp. period previous year". Nothing is
    // computed from an index here, which removes the class of bug that
    // Canada's and Australia's fetchers each have to get right.
    //
    // Licence: CC BY 4.0, stated on SCB's own pages -- the standard this
    // project adopted after Norway, where a third-party catalog said
    // "open" and the institution itself never did.
    //
    // The policy rate comes from BIS rather than the Riksbank directly,
    // for the same reason Saudi Arabia's and Kuwait's do: BIS's terms
    // permit commercial use with citation and need no permission email.
    // BIS names Sveriges Riksbank as the source in its own response.
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("SE inflation", fetchSwedenInflation()),
      settle("SE unemployment", fetchSwedenUnemployment()),
      settle("SE GDP growth (quarterly YoY)", fetchSwedenGdpGrowthQuarterly()),
      settle("SE policy rate (BIS)", fetchBisPolicyRate("SE")),
    ]);
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "EA") {
    // GDP/unemployment via Eurostat; INFLATION and policy rate (deposit
    // facility) via the ECB's own Data Portal — both confirmed live
    // 2026-08-21. See lib/fetchers/eurostat.ts for the EA20→EA21 geo
    // code note (that's the fix for the unemployment fetch that was
    // previously flagged as broken).
    const [infl, gdp, unemp, rate] = await Promise.all([
      settle("EA inflation", fetchEuroAreaInflation()),
      settle("EA GDP growth (quarterly YoY)", fetchEuroAreaGdpGrowthQuarterly()),
      settle("EA unemployment", fetchEuroAreaUnemployment()),
      settle("EA policy rate", fetchEuroAreaPolicyRate()),
    ]);
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "CA") {
    // CPI and unemployment both via Statistics Canada's WDS API (CPI's
    // YoY computed from the raw index; unemployment published as a rate
    // already). GDP via World Bank. Policy rate via the Bank of
    // Canada's own Valet API. All confirmed live 2026-08-21, with
    // unemployment moved off the World Bank 2026-08-28 -- that was an
    // ILO modelled ANNUAL estimate running a year behind (2025: 6.907)
    // where StatCan publishes the real monthly rate (2026-07: 6.4).
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("CA inflation", fetchCanadaInflation()),
      settle("CA unemployment", fetchCanadaUnemployment()),
      settle("CA GDP growth (quarterly YoY)", fetchCanadaGdpGrowthQuarterly()),
      settle("CA policy rate", fetchCanadaPolicyRate()),
    ]);
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "UK") {
    // CPI via ONS (the old api.ons.gov.uk domain is decommissioned; this
    // uses the still-live www.ons.gov.uk timeseries data endpoint — see
    // lib/fetchers/ons.ts). GDP/unemployment via World Bank, same
    // pattern as JP/AU. Policy rate via the Bank of England's IADB.
    // All confirmed live 2026-08-21.
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("UK inflation", fetchUkInflation()),
      settle("UK unemployment", fetchUkUnemployment()),
      settle("UK GDP growth (quarterly YoY)", fetchUkGdpGrowthQuarterly()),
      settle("UK policy rate", fetchUkPolicyRate()),
    ]);
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "KR") {
    // KOREA, added 2026-09-13. The ninth market, and the first that
    // needed no new institution and no new licence: inflation,
    // unemployment and GDP all come from OECD, the policy rate and debt
    // from BIS, and both were already audited and wired here.
    //
    // THIS BRANCH DOES NOT USE Promise.all, AND THAT IS THE POINT.
    //
    // Every other market fans its sources out concurrently because they
    // are different institutions. Korea's three come from ONE, and OECD
    // answers concurrent requests with HTTP 500 across the board -- not
    // for the extra ones, for ALL of them. While researching this market
    // a parallel probe reported "no OECD data for Japan", which is false:
    // this project fetches Japan's unemployment from OECD every day.
    //
    // A Promise.all here would therefore not fail loudly. It would return
    // three nulls, settle() would swallow them, the row would be written
    // PARTIAL, and Korea would silently stop being scored. fetchKoreaReadings
    // runs them in series and captures each failure separately, so one dead
    // series cannot take the other two with it.
    // Tried directly first, then relayed. The direct path works from
    // anywhere that is not Vercel -- including scripts/verify-korea-fetch.ts
    // -- and on Vercel every OECD call returns nothing, which is why the
    // workflow fetches these three with curl and hands them over. See
    // parseRelayedFigure for the evidence.
    const kr = await fetchKoreaReadings();
    for (const message of kr.errors) console.warn(`  ${message}`);

    const inflation = kr.inflation
      ? { value: kr.inflation.inflation, observationDate: kr.inflation.observationDate }
      : relayedKorea.inflation;
    const unemployment = kr.unemployment
      ? { value: kr.unemployment.unemployment, observationDate: kr.unemployment.observationDate }
      : relayedKorea.unemployment;
    const gdpGrowth = kr.gdpGrowth
      ? { value: kr.gdpGrowth.gdpGrowth, observationDate: kr.gdpGrowth.observationDate }
      : relayedKorea.gdpGrowth;

    for (const [label, direct, relayed] of [
      ["inflation", kr.inflation, relayedKorea.inflation],
      ["unemployment", kr.unemployment, relayedKorea.unemployment],
      ["GDP growth", kr.gdpGrowth, relayedKorea.gdpGrowth],
    ] as const) {
      if (!direct && relayed) console.log(`KR ${label} came from the workflow relay`);
    }

    const rate = await settle("KR policy rate (BIS)", fetchBisPolicyRate("KR"));
    return {
      raw: {
        inflation: inflation?.value ?? null,
        gdpGrowth: gdpGrowth?.value ?? null,
        unemployment: unemployment?.value ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: inflation?.observationDate ?? null,
        gdpGrowth: gdpGrowth?.observationDate ?? null,
        unemployment: unemployment?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  if (market === "NO") {
    // NORWAY, reactivated 2026-09-12 after three weeks dormant. Three of
    // these four lines changed, and each change has a reason:
    //
    //   policy rate   was Norges Bank direct. Their terms do not state
    //                 whether commercial reuse is permitted, which is why
    //                 Norway was paused at all. BIS republish the same
    //                 rate, naming Norges Bank as the source, under terms
    //                 that do permit it -- the route that already
    //                 unblocked Saudi Arabia, Kuwait and Sweden. No email
    //                 was ever needed. lib/fetchers/norgesbank.ts is now
    //                 unused: correct code against an unclear licence.
    //
    //   unemployment  was the World Bank's ILO MODELLED estimate --
    //                 annual, lagging a year or more, and not Norway's
    //                 own measurement. Now Eurostat's monthly harmonised
    //                 rate, the same definition every other market uses.
    //
    //   GDP growth    was World Bank annual. Now Eurostat quarterly,
    //                 year over year, matching every other market.
    //
    // Inflation is unchanged and stays with Statistics Norway: Norges
    // Bank's 2% target is set on Norway's own CPI, so that is the series
    // the score must read.
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("NO inflation", fetchNorwayInflation()),
      settle("NO unemployment", fetchNorwayUnemployment()),
      settle("NO GDP growth (quarterly YoY)", fetchNorwayGdpGrowthQuarterly()),
      settle("NO policy rate (BIS)", fetchBisPolicyRate("NO")),
    ]);
    return {
      raw: {
        inflation: infl?.inflation ?? null,
        gdpGrowth: gdp?.gdpGrowth ?? null,
        unemployment: unemp?.unemployment ?? null,
        policyRate: rate?.policyRate ?? null,
        brentYoY,
      },
      dates: {
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
    };
  }

  throw new Error(`fetchRawIndicators: unknown market "${market}"`);
}

// Norway rejoined 2026-09-12. It was paused on 2026-08-22 pending a
// licence answer from Norges Bank that nobody ever needed to ask for --
// BIS already publish the rate under usable terms. The comment that stood
// here for three weeks said the branch was "ready to reactivate with a
// one-line change", and it was.
const MARKETS = ["US", "EA", "CA", "UK", "JP", "AU", "SE", "NO", "KR"];

/** Every figure this run wrote, checked against how often its source
 *  actually publishes.
 *
 *  This exists because a source can DIE WITHOUT FAILING. Eurostat retired
 *  the euro area HICP dataset on 2026-02-04; it kept answering instantly
 *  and kept handing back December 2025, and MMAI published a nine-month-old
 *  inflation figure as live until a human went looking. Every check the
 *  project had measured `fetched_at` -- when we last ASKED.
 *
 *  Cadence comes from lib/sources.ts, which already records how often each
 *  institution publishes, so the limits live with the source rather than
 *  being duplicated here.
 *
 *  Returns one line per suspect figure. Empty means nothing looked dead --
 *  NOT that everything is current. */
function stalenessWarnings(
  market: string,
  raw: RawIndicators,
  dates: ObservationDates,
  debtPeriod: string | null
): string[] {
  const marketName = MARKET_NAMES[market];
  if (!marketName) return [];

  // Pillar -> the observation date this run recorded for it. Fiscal
  // Resilience is the odd one: BIS publishes a QUARTER, not a day.
  const dateFor: Record<PillarKey, string | null> = {
    PS: dates.inflation,
    GM: dates.gdpGrowth,
    LM: dates.unemployment,
    MC: dates.policyRate,
    FR: debtPeriod ? quarterToDate(debtPeriod) : null,
  };

  const warnings: string[] = [];
  for (const key of Object.keys(dateFor) as PillarKey[]) {
    const source = sourceForPillar(marketName, key);
    if (!source) continue;

    // A MISSING DATE IS NOT A PASS, and this loop used to read it as one.
    //
    // stalenessOf() is explicit that null means "no opinion, never fine --
    // a caller must not read it as a pass". This caller did exactly that:
    // `if (verdict?.stale)` is false for null, so a figure with no date at
    // all sailed through every age rule.
    //
    // That is not a theoretical gap, it is the failure mode of a dead
    // source. When a fetcher throws, settle() returns null and the row is
    // written with a NULL observation date -- not a frozen old one. So the
    // one thing guaranteed to happen when a source dies permanently was
    // the one thing this check could not see. A source could stop
    // answering forever and staleMarkets would stay 0.
    //
    // A figure present with no date is now reported. A figure that is
    // ABSENT entirely is not: that is a null pillar, already visible on the
    // page as a gap, and warning about it here would fire for every market
    // that legitimately lacks one.
    if (dateFor[key] == null) {
      if (raw[RAW_FIELD[key].key] != null) {
        warnings.push(`${RAW_FIELD[key].label}: a figure with no observation date, so its age cannot be checked`);
      }
      continue;
    }

    const verdict = stalenessOf(source, dateFor[key]);
    if (verdict?.stale) {
      warnings.push(describeStale(RAW_FIELD[key].label, verdict));
    }
  }
  return warnings;
}

// The provenance line stored on every row is GENERATED from
// lib/sources.ts -- see sourceNoteFor(). It used to be a hand-maintained
// table right here, and it drifted three separate ways before anyone
// noticed:
//
//   - Four markets credited the WORLD BANK for figures that came from
//     Statistics Canada, the ONS, the ABS and e-Stat.
//   - Every market still credited the EIA, which stopped scoring
//     anything when the oil pillar was retired on 2026-09-01.
//   - No market credited the BIS, which had started scoring Fiscal
//     Resilience on that same day.
//
// The registry already knew all of this. The table was a second copy of
// an answer that existed elsewhere, and second copies drift. Deleted
// rather than corrected: correcting it would have left the same trap for
// whoever changes a source next.

/** THE OBSERVATORY — tracked, never scored.
 *
 *  Runs after the scored markets and writes to its OWN table. Nothing
 *  here computes a composite, writes to mmai_scores, or touches
 *  raw_indicators: these countries are excluded from the index on
 *  purpose, and lib/observatory.ts records why for each one.
 *
 *  A SEPARATE TABLE, NOT raw_indicators. The columns would have fitted.
 *  But seven places read raw_indicators, several with a fixed row limit
 *  and no market filter — the source audit takes 200 rows and its own
 *  comment records a force-refresh writing 60 in one day. Two more
 *  countries there would quietly shorten the lookback window for every
 *  SCORED market.
 *
 *  FAILURE IS PER COUNTRY AND PER FIGURE. settle() turns each throw into
 *  a null, so one dead source costs one cell rather than the row, and
 *  the page shows a gap where a gap exists. That matters more here than
 *  in the index: there is no score to withhold, so a missing figure is
 *  the only signal a reader gets. */
async function refreshObservatory(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  debtByMarket: Map<string, { debtPctGdp: number; period: string }>,
  countries: ObservatoryCountry[],
  earlierToday: Map<string, ObservatoryRow>,
): Promise<{ country: string; status: string }[]> {
  const today = new Date().toISOString().slice(0, 10);

  // ALL COUNTRIES AT ONCE. This step runs last, under the route's 60s
  // maxDuration, and each country can cost up to ~8s (Eurostat) plus ~15s
  // (BIS) in the worst case. One after another was fine for two; at five
  // (19 September: Poland, Czechia, Hungary) a slow day could run past
  // the limit and lose the JSON reply the refresh workflow reads its
  // freshness and alert checks from. Each country still fails on its own.
  return Promise.all(countries.map(async (country) => {
    const code = country.code;
    const [infl, unemp, gdp, yld] = await Promise.all([
      settle(`${code} inflation`, fetchObservatoryInflation(code)),
      settle(`${code} unemployment`, fetchObservatoryUnemployment(code)),
      settle(`${code} GDP growth`, fetchObservatoryGdpGrowth(code)),
      settle(`${code} 10y yield`, fetchObservatoryBondYield(code)),
    ]);

    // A policy rate ONLY where the country sets one. Finland uses the
    // euro; BIS correctly has no series, and asking would log a failure
    // for something that is not broken. The registry is the authority.
    const setsOwnRate = observatorySetsOwnRate(country);
    const rate = setsOwnRate
      ? await settle(`${code} policy rate (BIS)`, fetchBisPolicyRate(code as BisPolicyRateArea))
      : null;

    const debt = debtByMarket.get(code) ?? null;

    // Anything that failed this time keeps today's earlier value and
    // its date (lib/observatory.ts, fillFromEarlier): a retry can add a
    // figure and never take one away.
    const earlier = earlierToday.get(code);
    const row = fillFromEarlier({
      country_code: code,
      inflation: infl?.inflation ?? null,
      gdp_growth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policy_rate: rate?.policyRate ?? null,
      debt_pct_gdp: debt?.debtPctGdp ?? null,
      yield_10y: yld?.yield10y ?? null,
      inflation_observation_date: infl?.observationDate ?? null,
      gdp_observation_date: gdp?.observationDate ?? null,
      unemployment_observation_date: unemp?.observationDate ?? null,
      policy_rate_observation_date: rate?.observationDate ?? null,
      debt_observation_period: debt?.period ?? null,
      yield_observation_date: yld?.observationDate ?? null,
      observation_date: today,
      source_note: "ECB (HICP) · Eurostat (unemployment, GDP, 10y yield) · BIS (policy rate, debt)",
    }, earlier);
    const { error } = await supabase.from("observatory_indicators").insert(row);

    const got = [row.inflation, row.unemployment, row.gdp_growth, row.yield_10y, row.debt_pct_gdp].filter((v) => v != null).length + (row.policy_rate != null ? 1 : 0);
    const wanted = setsOwnRate ? 6 : 5;
    if (error) console.error(`Observatory write failed for ${code}: ${error.message}`);
    return {
      country: code,
      status: error ? `error: ${error.message}` : `ok (${got}/${wanted} figures${earlier ? ", retried" : ""})`,
    };
  }));
}

/** Today's newest Observatory row per country. */
async function observatoryRowsToday(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  today: string,
): Promise<Map<string, ObservatoryRow>> {
  const { data, error } = await supabase
    .from("observatory_indicators")
    .select("*")
    .gte("fetched_at", `${today}T00:00:00Z`)
    .order("fetched_at", { ascending: false });
  // Not fatal: every country is then simply fetched again, with nothing
  // earlier to fill a failure from. But say so, rather than doing it quietly.
  if (error) console.error(`Observatory: could not read today's rows, fetching every country: ${error.message}`);
  const out = new Map<string, ObservatoryRow>();
  for (const r of (data ?? []) as ObservatoryRow[]) if (!out.has(r.country_code)) out.set(r.country_code, r);
  return out;
}

/** The Observatory step, run by EVERY refresh -- including the ones that
 *  find every scored market already done and stop there. Fetches only
 *  countries whose row for today is missing or incomplete (all of them
 *  under ?force=1). BIS debt is fetched here only when the caller has not
 *  already fetched it and a country actually needs it. */
async function refreshObservatoryIfNeeded(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  today: string,
  force: boolean,
  debtByMarket?: Map<string, { debtPctGdp: number; period: string }>,
): Promise<{ country: string; status: string }[]> {
  const earlier = force ? new Map<string, ObservatoryRow>() : await observatoryRowsToday(supabase, today);
  const todo = OBSERVATORY.filter((c) => force || needsObservatoryFetch(earlier.get(c.code), c));
  const skipped = OBSERVATORY.filter((c) => !todo.includes(c)).map((c) => ({ country: c.code, status: "complete for today" }));
  if (todo.length === 0) return skipped;
  const debt = debtByMarket ?? new Map(((await settle("Government debt (BIS)", fetchGovernmentDebt())) ?? []).map((d) => [d.market, d]));
  return [...(await refreshObservatory(supabase, debt, todo, earlier)), ...skipped];
}

export async function GET(request: Request) {
  // Protect this endpoint so only Vercel Cron (or you, manually, with the
  // secret) can trigger a refresh — prevents random internet traffic from
  // spamming your data sources on your behalf.
  // Fails CLOSED: a missing CRON_SECRET refuses everyone rather than
  // admitting everyone. See lib/cronAuth.ts for what the old fail-open
  // version would have cost.
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const results: Array<{ market: string; status: string; composite: number | null }> = [];

  // ---------- Freshness guard ----------
  // The scheduled trigger runs SIX times a day, not once, because a
  // single daily attempt has no way to recover from a missed run -- and
  // Vercel's Hobby-tier crons skipped a day entirely, leaving the site
  // showing a stale "last updated" date to every visitor.
  //
  // This is what makes the extra attempts safe: a market that already
  // has a reading stamped today is skipped, so the later runs are
  // no-ops on a good day and fill the gap on a bad one. Self-healing
  // rather than duplicating.
  //
  // ?force=1 overrides it, for a deliberate re-run after fixing a source.
  const force = new URL(request.url).searchParams.get("force") === "1";
  const today = new Date().toISOString().slice(0, 10);
  let alreadyToday = new Set<string>();
  if (!force) {
    const { data: doneRows } = await supabase
      .from("raw_indicators")
      .select("market")
      .gte("fetched_at", `${today}T00:00:00Z`);
    alreadyToday = new Set((doneRows ?? []).map((r) => r.market as string));
  }

  const pending = MARKETS.filter((m) => !alreadyToday.has(m));
  if (pending.length === 0) {
    // The scored markets are done for today -- but the Observatory is
    // retried on every run. This early return used to skip it, so a
    // figure missed by the morning run stayed N/A until the next day.
    let observatory: { country: string; status: string }[] = [];
    try {
      observatory = await refreshObservatoryIfNeeded(supabase, today, false);
    } catch (err) {
      observatory = [{ country: "all", status: `error: ${err instanceof Error ? err.message : String(err)}` }];
    }
    // AND THE DAILY PRICE, for the same reason, only more so. The scored
    // figures are monthly and genuinely finished for the day; Brent is a
    // daily series the EIA publishes during the US afternoon, while the
    // first run to LAND each day is mid-morning UTC. Writing it only on
    // that run would leave the price an extra day behind for ever, and
    // nothing on the page would show why.
    const brent = await refreshBrentDaily(supabase);
    return NextResponse.json({
      refreshedAt: new Date().toISOString(),
      skipped: true,
      reason: `All ${MARKETS.length} markets already have a reading for ${today}. Pass ?force=1 to refresh anyway.`,
      results: [],
      observatory,
      brent,
    });
  }

  // Fetched once, shared by every market -- see the comment above
  // fetchRawIndicators(). Outside the per-market try/catch below so one
  // market's Supabase error can't re-trigger a redundant EIA call.
  // Parsed once, outside the loop: it is the same value for every market
  // and only Japan reads it.
  const relayedKr = parseRelayedKorea(request);
  const relayedJp = parseRelayedJpUnemployment(request);
  if (relayedJp) {
    console.log(
      `JP unemployment relayed by the workflow: ${relayedJp.value}% (${relayedJp.observationDate})`
    );
  }

  const brentResult = await settle("Brent Crude YoY", fetchBrentYoY());

  // Fiscal Resilience. One BIS request returns all six markets, so it is
  // fetched once here rather than per market -- same shape as Brent
  // above, and for the same reason.
  //
  // Unlike Brent, the six values are DIFFERENT. That is the whole point
  // of the pillar that replaced External & Commodities: an indicator
  // that gives every market the same number cannot separate them.
  // Set when every notification for a market fails, which points at the
  // sender rather than the addresses. Surfaced in the response so the
  // refresh workflow fails on it.
  let notificationsBroken = false;

  // Every market's live pillar scores, used after the loop to check the
  // statistics this project PUBLISHES about itself. See below.
  // Per-market dimension percentiles, collected to check the figures the
  // Learn page publishes against what the live markets actually produce.
  const liveDimPercentiles: Array<Record<DimensionKey, number>> = [];

  const debtResult = await settle("Government debt (BIS)", fetchGovernmentDebt());
  const debtByMarket = new Map((debtResult ?? []).map((d) => [d.market, d]));
  if (debtResult == null) {
    console.warn("BIS government debt unavailable this run -- Fiscal Resilience will be null for every market");
  }

  for (const market of pending) {
    try {
      const { raw, dates, rateTarget } = await fetchRawIndicators(market, brentResult, relayedJp, relayedKr);

      // Set here rather than inside each of fetchRawIndicators()'s
      // seven per-market branches: the value is looked up from one
      // shared response, so threading it through every branch would be
      // seven chances to paste the wrong market's figure.
      const debt = debtByMarket.get(market) ?? null;
      raw.debtPctGdp = debt?.debtPctGdp ?? null;

      // ENGINE v2.0 IS NOW THE ONLY ENGINE. The five-pillar composite that
      // used to run alongside it is retired: it no longer computes, no
      // longer writes its columns, and its code is gone from the tree.
      //
      // v2 withholds rather than reweighting, so percentile is null on a
      // run where any indicator failed. That is a row with no score --
      // deliberately, and not an error to paper over.
      //
      // THE BAND IS NEVER NULL, AND THE COMMENT HERE USED TO SAY IT WAS.
      //
      // It read: "a row with no score and no band, which is the intended
      // behaviour and what the mmai_scores check constraint enforces".
      // The schema says the exact opposite -- band is declared NOT NULL.
      // So a market that withheld its score could not be WRITTEN AT ALL:
      // the insert was refused, the market got no row, and on the site
      // that is indistinguishable from a market never configured.
      //
      // It lay dormant because until 13 September every market always
      // came back with all five indicators. Korea arrived with three
      // nulls -- OECD returns nothing from Vercel -- and the run
      // reported a Postgres constraint violation instead of a withheld
      // score. The comment had been describing a guarantee that was
      // never there.
      //
      // percentileBandLabel already answers null with "Not published",
      // which is the honest label and satisfies the column. A withheld
      // score is now a stored fact rather than a failed write.
      const v2 = computeMmai(raw, market);
      const composite = v2.percentile;
      const coverage = v2.percentile != null ? 1 : 0;
      const band = { label: percentileBandLabel(composite) };

      // Collected for the published-statistics drift check at the end of
      // the run. Only scorable markets contribute: a market that withheld
      // its score has no dimensions to spread.
      if (v2.dimensions) liveDimPercentiles.push(dimensionPercentiles(v2.dimensions));

      // One engine, one stamp. This is what makes the cutover safe -- see
      // the comparability guard below.
      const formulaVersion = "v2.0";

      const observationDate = new Date().toISOString().slice(0, 10);

      // Look up the previous score BEFORE writing the new one — this is
      // the only way to know whether the band actually changed.
      const { data: previousRows } = await supabase
        .from("mmai_scores")
        .select("band, composite, observation_date, dim_conditions, dim_direction, dim_capacity, percentile, composite_z, formula_version")
        .eq("market", market)
        .order("observation_date", { ascending: false })
        .order("computed_at", { ascending: false })
        .limit(1);
      const previousRow = previousRows?.[0];
      const previousBand = previousRow?.band as string | undefined;

      // WHICH indicators contributed, as a 5-character signature
      // ("11111" = all five). This mattered enormously under the old
      // engine, which reweighted around whatever was populated, so a
      // score built from four inputs was not the same measurement as one
      // built from five and comparing them reported a band change with no
      // economic content behind it.
      //
      // Under v2 it is belt-and-braces: a row missing any indicator has
      // no score and no band, so it cannot reach the comparison at all.
      // Kept because it costs nothing and stays correct if the
      // withholding rule is ever relaxed.
      //
      // This is not hypothetical. If Labour Market alone goes null for
      // Canada, the reweighting lifts its composite from 76.5 to 81.2
      // and crosses into a higher band. Without this guard every
      // subscriber watching Canada is emailed an upgrade caused by a
      // fetcher outage, then a downgrade when the source recovers.
      //
      // Same reasoning as isFullyPopulated() in lib/weeklyChanges.ts,
      // which exists to stop exactly this class of fake delta on the
      // homepage feed. The email path never got the equivalent guard.
      // Now over the five SCORED INDICATORS rather than the five retired
      // pillars. Largely belt-and-braces under v2, which withholds the
      // score entirely when an indicator is missing -- so a row that has a
      // band necessarily had all five. Kept anyway: it costs nothing and
      // stays correct if the withholding rule is ever relaxed.
      const shapeOf = (vals: Array<number | null | undefined>) => vals.map((v) => (v == null ? "0" : "1")).join("");
      const currentShape = shapeOf([raw.inflation, raw.gdpGrowth, raw.unemployment, raw.policyRate, raw.debtPctGdp]);
      const previousShape = previousRow
        ? shapeOf([previousRow.dim_conditions, previousRow.dim_direction, previousRow.dim_capacity, previousRow.percentile, previousRow.composite_z])
        : null;
      // A BAND MOVE CAUSED BY CHANGING THE ENGINE IS NOT AN ECONOMIC MOVE.
      //
      // On the day the three-dimension composite becomes the published
      // headline, every market's band changes at once because the method
      // changed -- Japan moves from 82.2 to 50.7 without anything happening
      // in Japan. Emailing subscribers about that is the same class of
      // false alert the pillar-shape signature exists to prevent, except
      // hitting every subscriber and every market simultaneously.
      //
      // The shape signature cannot catch it: pillar coverage is unchanged,
      // it is the formula that moved.
      //
      // THE STAMPS ARE NOW COMPARED EXACTLY, and that change is the whole
      // reason the cutover is safe.
      //
      // The previous version normalised the stamp: any row whose
      // formula_version CONTAINED the alert engine was treated as that
      // engine. That was right during the migration, when the stamp
      // flapped between "v1.0" and "v1.0+v2.0" depending on whether v2
      // managed to compute, and the band came from v1 either way.
      //
      // It would have failed at the cutover itself. By this point every
      // recent row is stamped "v1.0+v2.0", and once ALERT_ENGINE became
      // "v2.0" the normaliser would read BOTH yesterday's row and today's
      // as "v2.0" -- identical, therefore comparable -- and cheerfully
      // email every subscriber about a band change that was the formula
      // moving, not the economy. Six markets, every subscriber, at once:
      // exactly the wave this guard exists to prevent.
      //
      // With one engine the stamp cannot flap, so exact comparison is both
      // correct and simpler. Yesterday's "v1.0+v2.0" does not equal today's
      // "v2.0", the wave is suppressed once, and alerting resumes the next
      // day when both rows read "v2.0".
      const previousVersion = (previousRow?.formula_version as string | undefined) ?? null;
      const sameEngine = previousVersion === null || previousVersion === formulaVersion;
      const comparableToPrevious = previousShape !== null && previousShape === currentShape && sameEngine;

      // SOURCE_NOTES describes what a fully-successful run looks like --
      // if any live indicator actually came back null this run (a source
      // was temporarily down/rate-limited/changed shape), say so instead
      // of claiming "(live)" for data that didn't actually arrive.
      const partial = [raw.inflation, raw.gdpGrowth, raw.unemployment, raw.policyRate, raw.brentYoY].some((v) => v == null);
      const marketName = MARKET_NAMES[market];
      const baseNote = marketName ? sourceNoteFor(marketName) : "manual fallback — fetcher not yet wired";
      // Records WHICH source produced Japan unemployment on this run, so
      // a reader of the stored row can tell a monthly OECD figure from an
      // annual World Bank one rather than having to guess.
      const fallbackNote =
        (market === "JP" && jpUnemploymentFellBack
          ? " — JP unemployment via World Bank annual (OECD unavailable)"
          : market === "JP" && jpUnemploymentViaRelay
            ? " — JP unemployment via OECD, relayed by the refresh workflow (Vercel cannot reach OECD)"
          : "") +
        (market === "US" && usInflationFellBack
          ? " — US inflation via BLS CPI (BEA PCE unavailable); PCE is the scored series"
          : "");
      // A figure older than its source's publication rhythm allows is a
      // dead source, not a slow one. Recorded on the row AND surfaced in
      // the response so the workflow can fail on it -- a warning nobody
      // is shown is the same as no warning, which is how the Eurostat
      // series survived nine months.
      const staleWarnings = stalenessWarnings(market, raw, dates, debt?.period ?? null);
      if (staleWarnings.length > 0) {
        console.warn(`${market} STALE: ${staleWarnings.join("; ")}`);
      }
      const staleNote = staleWarnings.length > 0 ? ` — STALE: ${staleWarnings.join("; ")}` : "";

      const sourceNote = (partial ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)` : baseNote) + fallbackNote + staleNote;

      // ---------- Publication-regression guard ----------
      // A transient source outage must not replace a PUBLISHED score
      // with a gap on the live site.
      //
      // Observed 2026-08-31: a forced re-run to pick up the US PCE change
      // re-fetched every market, both Statistics Canada calls (inflation
      // AND unemployment) failed together, Canada's coverage fell to 0.6,
      // and a good 76.50 was overwritten with "Not Publishable". The run
      // an hour earlier had all five pillars. Nothing about Canada's
      // economy changed -- a source was briefly unavailable.
      //
      // The freshness guard above prevents duplicate WORK. It does nothing
      // about a re-run producing WORSE data, a risk that exists only
      // because ?force=1 exists. This is the other half of it.
      //
      // Deliberately narrow: it fires only when a run produces NO
      // publishable score at all AND a recent one exists. A market that
      // merely loses one pillar while staying above the gate still writes,
      // because that is a real change in what could be measured -- and the
      // shape signature above already stops it faking a band move.
      //
      // Bounded by STALE_AFTER_DAYS so a permanently dead source cannot
      // freeze a stale score forever. Past that window the gap IS the
      // truth and the site should show it.
      const STALE_AFTER_DAYS = 3;
      const previousComposite = previousRow?.composite as number | null | undefined;
      const previousObsDate = previousRow?.observation_date as string | undefined;
      const previousAgeDays = previousObsDate
        ? (Date.parse(observationDate) - Date.parse(previousObsDate)) / 86_400_000
        : Number.POSITIVE_INFINITY;

      if (composite == null && previousComposite != null && previousAgeDays <= STALE_AFTER_DAYS) {
        console.error(
          `${market}: SKIPPED WRITE — no publishable score this run ` +
            `(coverage ${coverage.toFixed(2)}, shape ${currentShape}), but a published ` +
            `score of ${previousComposite} exists from ${previousObsDate}. Treating this as a ` +
            `transient source failure rather than overwriting good data; the next ` +
            `run retries. Source note would have been: ${sourceNote}`
        );
        results.push({
          market,
          status: `skipped: nothing publishable this run (coverage ${coverage.toFixed(2)}); kept ${previousObsDate} reading`,
          composite: null,
        });
        continue;
      }

      // Supabase's client doesn't throw on a failed write -- it returns
      // {error}. Run both inserts, then check both errors together (not
      // one at a time) so a real failure never gets masked by the other
      // insert also failing, and so a bad write is never silently
      // reported as "status: ok" with nothing actually saved.
      const [rawInsert, scoreInsert] = await Promise.all([
        insertRawIndicators(supabase, {
          market,
          inflation: raw.inflation,
          gdp_growth: raw.gdpGrowth,
          unemployment: raw.unemployment,
          policy_rate: raw.policyRate,
          // The announced range beside the rate that was actually paid.
          // Written every run, null included, so a range cannot survive
          // the decision that set it -- see rateTarget above.
          policy_rate_target_low: rateTarget?.low ?? null,
          policy_rate_target_high: rateTarget?.high ?? null,
          brent_yoy: raw.brentYoY,
          debt_pct_gdp: raw.debtPctGdp,
          observation_date: observationDate,
          // WHEN each figure refers to, not when it was fetched (audit M-6).
          inflation_observation_date: dates.inflation,
          gdp_observation_date: dates.gdpGrowth,
          unemployment_observation_date: dates.unemployment,
          policy_rate_observation_date: dates.policyRate,
          brent_observation_date: dates.brent,
          // BIS's own quarter label, e.g. "2025-Q4", stored verbatim.
          // A quarter is not a day: converting it to a date would invent
          // a precision the release does not have, which is the mistake
          // per-indicator dates were added to stop.
          debt_observation_period: debt?.period ?? null,
          source_note: sourceNote,
          status: "current",
        }),
        supabase.from("mmai_scores").insert({
          market,
          observation_date: observationDate,
          // The pillar_* columns are no longer written. Rows from before
          // 5 September 2026 keep the five-pillar scores they were built
          // with -- that is the historical record and the export button
          // still hands it to readers -- but nothing new is added to a
          // scheme the site no longer runs.
          composite,
          coverage,
          band: band?.label ?? null,
          dim_conditions: v2.dimensions?.C ?? null,
          dim_direction: v2.dimensions?.D ?? null,
          dim_capacity: v2.dimensions?.K ?? null,
          composite_z: v2.composite,
          percentile: v2.percentile,
          formula_version: formulaVersion,
        }).select("id").single(),
      ]);

      const insertErrors = [rawInsert.error, scoreInsert.error].filter((e): e is NonNullable<typeof e> => e != null);
      if (insertErrors.length > 0) {
        throw new Error(`Supabase write failed for ${market}: ${insertErrors.map((e) => e.message).join("; ")}`);
      }

      // Band actually changed (and there WAS a previous band to compare
      // against, i.e. this isn't the market's very first-ever row) --
      // notify every subscriber watching this market.
      if (band && previousBand && previousBand !== band.label && composite !== null && !comparableToPrevious) {
        // Deliberately silent to subscribers, loud in the logs: the band
        // moved, but the two readings were built from different pillars,
        // so there is nothing honest to tell anyone.
        console.warn(
          `${market}: band ${previousBand} -> ${band.label} SUPPRESSED — ` +
            (sameEngine
              ? `pillar coverage changed (${previousShape} -> ${currentShape})`
              : `scoring engine changed (${previousVersion} -> ${formulaVersion}; band engine ${ALERT_ENGINE})`) +
            `. Not an economic move; no email sent.`
        );
      }

      // ONE ALERT PER MARKET PER DAY, NO MATTER HOW MANY RUNS RACE.
      //
      // On 4 September 2026 two refreshes wrote the same four markets less
      // than a second apart -- GitHub's schedule and the Vercel cron, which
      // was due at 06:00 and fired at 06:29. The freshness guard is
      // check-then-write: both runs asked "has this market been done
      // today?" before either had written, both heard no, and both wrote.
      // The rows were identical that day, so nothing showed.
      //
      // The email path would not have been so forgiving. Each run reads
      // the previous band BEFORE writing its own, so on a day a band
      // genuinely moves, both runs see the same crossing -- and the sender
      // keeps no record of what it has sent. Every subscriber watching the
      // market would have had the alert twice.
      //
      // So the email belongs to whichever run wrote TODAY'S FIRST score
      // row. ids come from an identity sequence and are handed out at
      // insert time, so "first" is the lowest id, and every racing run
      // agrees on which that is once its own write has landed: the run
      // that inserted first sees itself lowest, the later one always sees
      // the earlier. Exactly one sends, with no new table and no lock.
      //
      // The Vercel cron is gone now too, but this does not depend on that:
      // a hand-triggered run overlapping the schedule is the same race.
      //
      // A same-day forced re-run therefore never emails. Deliberate: one
      // alert per market per day. A correction that lands the same
      // afternoon shows on the site without a second message.
      //
      // If the ownership read itself fails the email still goes: a
      // duplicate alert is an annoyance, a missing one is a broken promise.
      let ownsToday = true;
      const myScoreId = scoreInsert.data?.id;
      if (myScoreId != null) {
        const { data: firstToday, error: firstErr } = await supabase
          .from("mmai_scores")
          .select("id")
          .eq("market", market)
          .eq("observation_date", observationDate)
          .order("id", { ascending: true })
          .limit(1);
        if (firstErr) {
          console.error(`${market}: could not confirm this run owns today's alert (${firstErr.message}); sending anyway`);
        } else if (firstToday?.[0]) {
          ownsToday = firstToday[0].id === myScoreId;
        }
      }

      if (band && previousBand && previousBand !== band.label && composite !== null && comparableToPrevious && !ownsToday) {
        console.warn(`${market}: band ${previousBand} -> ${band.label} already reported by an earlier run today; no second email.`);
      }

      if (band && previousBand && previousBand !== band.label && composite !== null && comparableToPrevious && ownsToday) {
        const { data: subscribers } = await supabase
          .from("subscribers")
          .select("email, unsubscribe_token, markets");
        const watchers = (subscribers ?? []).filter((s) => (s.markets as string[]).includes(market));

        // ONE BAD ADDRESS AND A BROKEN SENDER LOOK IDENTICAL FROM HERE.
        //
        // This loop used to swallow every failure into console.error and
        // carry on, which is right for a single bounced address and very
        // wrong for a sender that cannot send at all. Nobody reads Vercel
        // logs, so a systemic failure would be invisible until a
        // subscriber complained -- and band crossings are rare enough
        // that "invisible" could mean months.
        //
        // The distinction that matters: SOME failing is bad addresses,
        // ALL failing is the sender being broken. Only the second is
        // escalated, so a genuinely dead mailbox cannot cry wolf.
        //
        // Worth checking when this fires: a vercel.app address CANNOT be
        // verified as a sending domain in Resend -- verification needs DNS
        // records on a domain you own. While the site is still on its
        // vercel.app address that is almost certainly the cause, and no
        // amount of retrying fixes it. IS_VERCEL_DOMAIN below says so in
        // the log rather than asserting it forever after a domain move.
        let sent = 0;
        let failed = 0;
        for (const sub of watchers) {
          try {
            await sendBandCrossingEmail(
              sub.email as string,
              { marketCode: market, marketName: MARKET_NAMES[market] ?? market, oldBand: previousBand, newBand: band.label, score: composite },
              sub.unsubscribe_token as string
            );
            sent += 1;
          } catch (emailErr) {
            failed += 1;
            // One subscriber's bad/bounced address shouldn't block the rest.
            console.error(`Notification failed for ${sub.email}:`, emailErr);
          }
        }
        if (failed > 0 && sent === 0) {
          notificationsBroken = true;
          console.error(
            `ALL ${failed} notification(s) for ${market} failed. This is the sender, not the recipients. ` +
              (IS_VERCEL_DOMAIN
                ? `The site is still on a vercel.app address, which cannot be verified as a Resend sending domain. That is the likely cause.`
                : `Check that ${ALERT_FROM} is on a domain verified in Resend.`)
          );
        }
      }

      results.push({
        market,
        status: "ok",
        composite,
        ...(staleWarnings.length > 0 ? { stale: staleWarnings } : {}),
      });
    } catch (err) {
      console.error(`Refresh failed for ${market}:`, err);
      results.push({ market, status: `error: ${(err as Error).message}`, composite: null });
    }
  }

  // ---------- Bond yields ----------
  // Writes the WHOLE series each source returns, not just today's row.
  // bond_yields has a unique (market, observation_date), so the first
  // run backfills every day the sources still publish and later runs
  // insert only the new trading day -- ignoreDuplicates makes a re-run
  // a no-op rather than an error. That is why this needed no separate
  // backfill script and no extra SQL.
  //
  // A yield for a given day is a FACT about that day and never changes,
  // which is what makes ignoring conflicts correct here. Contrast
  // raw_indicators, which appends a fresh row per run because the score
  // is recomputed.
  let bondResult: { inserted: number; markets: number; error?: string } = { inserted: 0, markets: 0 };
  try {
    const series = await fetchAllBondYieldSeries();
    // One year, so Australia's thirteen years of history doesn't land in
    // one go while the other five contribute a few months.
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = Object.values(series)
      .flat()
      .filter((y) => y.observationDate >= cutoff)
      .map((y) => ({
        market: y.market,
        yield_10y: y.yield10y,
        yield_2y: y.yield2y,
        observation_date: y.observationDate,
        source_note: BOND_YIELD_SOURCE[y.market] ?? null,
      }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("bond_yields")
        .upsert(rows, { onConflict: "market,observation_date", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      bondResult = { inserted: rows.length, markets: Object.keys(series).length };
    }
  } catch (err) {
    // Never fails the whole refresh: bond yields are a displayed
    // indicator, not a pillar, so the scores above are unaffected.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Bond yields failed:", message);
    bondResult = { inserted: 0, markets: 0, error: message };
  }

  // ---------- The daily oil price ----------
  // Beside the bond yields, which is the other series here that moves
  // every trading day rather than once a month. The same call runs on the
  // early-return path above, so it happens on every run of the day.
  const brentDaily = await refreshBrentDaily(supabase);

  // ---------- THE OBSERVATORY ----------
  //
  // Tracked countries, written to their own table with no score. Runs
  // last and cannot fail the refresh: these are a display, not a pillar,
  // so every scored market above is unaffected by whatever happens here.
  // It reuses the BIS debt already fetched for the index rather than
  // asking again -- one request covers every country BIS carries.
  let observatory: { country: string; status: string }[] = [];
  try {
    observatory = await refreshObservatoryIfNeeded(supabase, today, force, debtByMarket);
    for (const r of observatory) console.log(`  Observatory ${r.country}: ${r.status}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Observatory refresh failed:", message);
    observatory = [{ country: "all", status: `error: ${message}` }];
  }

  // ---------- ARE THE PUBLISHED STATISTICS STILL TRUE? ----------
  //
  // PILLAR_CROSS_MARKET_SD is printed on the Learn page as a measured
  // fact about how far each pillar spreads the six markets. It is
  // measured offline from lib/history.ts, whose final point comes from
  // FALLBACK_MARKETS -- a snapshot a human keeps in sync by hand.
  //
  // On 2026-09-02 that snapshot was found still holding euro area
  // inflation of 2.0, the figure from Eurostat's retired dataset. The
  // published spread for Growth Momentum was 3.3 when the truth was 6.0,
  // and the page told readers growth separated the markets least when
  // monetary conditions did.
  //
  // scripts/measure-pillar-influence.ts already runs in CI and passed
  // throughout, because it checks that the constants match the PANEL. It
  // cannot tell that the panel is stale. Only a live run can, which is
  // why this check lives here and not in CI.
  //
  // Tolerance is 1.0 SD points. These figures are published to one
  // decimal and move as real economies move; failing on every small
  // drift would train everyone to ignore the alarm. 1.0 is roughly the
  // point at which the published ordering starts to change, which is
  // when a reader would be told something untrue.
  const publishedDrift: string[] = [];
  // REPOINTED AT THE DIMENSIONS. This compared live PILLAR spreads against
  // the pillar figures the Learn page used to publish. The Learn page now
  // publishes DIMENSION_CROSS_MARKET_SD, so the old check was guarding a
  // statistic no reader can see -- dead code that looked alive.
  // Only when every market was scored this run -- lib/publishedDrift.ts
  // says why (a false alarm on 22 September skipped the Gulf refresh).
  const driftCheck = checkPublishedDrift(liveDimPercentiles, MARKETS.length);
  if (driftCheck.skipped) console.log(`Published-statistics check skipped: ${driftCheck.skipped}.`);
  publishedDrift.push(...driftCheck.drift);
  if (publishedDrift.length > 0) {
    console.warn(`PUBLISHED STATISTICS HAVE DRIFTED: ${publishedDrift.join("; ")}`);
  }

  // Hoisted to the top of the response, not buried per market: the
  // refresh workflow fails the run on this field, which turns a silent
  // rot into an email. See .github/workflows/refresh.yml.
  const staleCount = results.filter((r) => "stale" in r && Array.isArray(r.stale) && r.stale.length > 0).length;

  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    staleMarkets: staleCount,
    notificationsBroken,
    publishedDrift,
    results,
    bondYields: bondResult,
    brent: brentDaily,
    observatory,
  });
}
