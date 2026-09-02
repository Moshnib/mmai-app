import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { computePillarScores, computeComposite, bandFor, type RawIndicators } from "@/lib/scoring";
import { fetchUsInflation, fetchUsUnemployment } from "@/lib/fetchers/bls";
import { fetchUsPolicyRate } from "@/lib/fetchers/nyfed";
import { fetchJapanPolicyRate } from "@/lib/fetchers/boj";
import { fetchGdpGrowth, fetchUnemployment } from "@/lib/fetchers/worldbank";
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
import { fetchNorwayPolicyRate } from "@/lib/fetchers/norgesbank";
import { fetchUsGdpGrowthQuarterly, fetchUsPceInflation } from "@/lib/fetchers/bea";
import { fetchBrentYoY } from "@/lib/fetchers/eia";
import { fetchGovernmentDebt } from "@/lib/fetchers/bis";
import { sendBandCrossingEmail } from "@/lib/notify";
import { FALLBACK_MARKETS } from "@/lib/markets";

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
 * out the whole market — computeComposite() already reweights around
 * missing pillars and only withholds a score below 70% coverage, so a
 * single null indicator here still produces a valid, published score.
 *
 * UAE was removed 2026-08-19 (no verified policy-rate source, never
 * cleared the 70% coverage threshold). Market Momentum was removed the
 * same day (no licensed equity source) — its weight was redistributed
 * into the remaining five pillars in lib/scoring.ts.
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
}

async function fetchRawIndicators(
  market: string,
  brent: { brentYoY: number; observationDate: string } | null,
  relayedJpUnemployment: { value: number; observationDate: string } | null
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
    let fellBack = false;
    if (usInflation == null) {
      const fb = await settle("US inflation (CPI fallback)", fetchUsInflation());
      if (fb?.inflation != null) {
        usInflation = fb.inflation;
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
        inflation: infl?.observationDate ?? null,
        gdpGrowth: gdp?.observationDate ?? null,
        unemployment: unemp?.observationDate ?? null,
        policyRate: rate?.observationDate ?? null,
        brent: brentDate,
      },
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
    // The symptom was not a missing number, it was a MOVED SCORE. With
    // the Labour Market pillar null, computeComposite reweights across
    // the remaining four and Japan published 75.35 instead of ~79.1 for
    // two days -- a 3.8 point drop caused by a fetcher, not by Japan.
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

  if (market === "NO") {
    // CPI (already a 12-month rate, no YoY math needed) via Statistics
    // Norway's PxWebApi. GDP/unemployment via World Bank, same pattern
    // as JP/AU/CA/UK. Policy rate via Norges Bank's own Data Portal.
    // All confirmed live 2026-08-21.
    const [infl, unemp, gdp, rate] = await Promise.all([
      settle("NO inflation", fetchNorwayInflation()),
      settle("NO unemployment", fetchUnemployment("NOR")),
      settle("NO GDP growth", fetchGdpGrowth("NOR")),
      settle("NO policy rate", fetchNorwayPolicyRate()),
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

// Norway paused 2026-08-22 pending Norges Bank license confirmation — see
// the matching comment in lib/markets.ts. fetchRawIndicators()'s "NO"
// branch below is left in place, ready to reactivate with a one-line change.
const MARKETS = ["US", "EA", "CA", "UK", "JP", "AU"];

// CORRECTED 2026-09-02. These strings are stored on every row and shown
// to readers as provenance, and four of the seven credited the WORLD BANK
// for data it did not supply -- left behind as each fetcher was replaced
// by a national source. Canada reads Statistics Canada, the UK reads the
// ONS, Australia reads the ABS, and Japan reads e-Stat. The World Bank is
// now used ONLY as Japan unemployment fallback and for dormant Norway.
//
// This is not cosmetic. The site asks readers to check its work and
// tracks a licence per institution, so naming the wrong institution is a
// false statement about where a number came from -- and it made the data
// look worse than it is, since the World Bank publishes annually.
//
// KEEP IN STEP WITH THE ACTUAL settle() CALLS ABOVE. There is no test
// binding these strings to the fetchers; they drifted for weeks unnoticed.
const SOURCE_NOTES: Record<string, string> = {
  US: "BEA (PCE + GDP) + BLS + New York Fed + EIA (live)",
  JP: "e-Stat + OECD + Bank of Japan + EIA (live)",
  AU: "ABS + RBA + EIA (live)",
  EA: "ECB (HICP + policy rate) + Eurostat + EIA (live)",
  CA: "Statistics Canada + Bank of Canada + EIA (live)",
  UK: "ONS + Bank of England + EIA (live)",
  NO: "Statistics Norway + World Bank + Norges Bank + EIA (live)",
};

export async function GET(request: Request) {
  // Protect this endpoint so only Vercel Cron (or you, manually, with the
  // secret) can trigger a refresh — prevents random internet traffic from
  // spamming your data sources on your behalf.
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const results: Array<{ market: string; status: string; composite: number | null }> = [];

  // ---------- Freshness guard ----------
  // The scheduled trigger runs THREE times a day, not once, because a
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
    return NextResponse.json({
      refreshedAt: new Date().toISOString(),
      skipped: true,
      reason: `All ${MARKETS.length} markets already have a reading for ${today}. Pass ?force=1 to refresh anyway.`,
      results: [],
    });
  }

  // Fetched once, shared by every market -- see the comment above
  // fetchRawIndicators(). Outside the per-market try/catch below so one
  // market's Supabase error can't re-trigger a redundant EIA call.
  // Parsed once, outside the loop: it is the same value for every market
  // and only Japan reads it.
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
  const debtResult = await settle("Government debt (BIS)", fetchGovernmentDebt());
  const debtByMarket = new Map((debtResult ?? []).map((d) => [d.market, d]));
  if (debtResult == null) {
    console.warn("BIS government debt unavailable this run -- Fiscal Resilience will be null for every market");
  }

  for (const market of pending) {
    try {
      const { raw, dates } = await fetchRawIndicators(market, brentResult, relayedJp);

      // Set here rather than inside each of fetchRawIndicators()'s
      // seven per-market branches: the value is looked up from one
      // shared response, so threading it through every branch would be
      // seven chances to paste the wrong market's figure.
      const debt = debtByMarket.get(market) ?? null;
      raw.debtPctGdp = debt?.debtPctGdp ?? null;

      const pillars = computePillarScores(raw, market);
      const { composite, coverage } = computeComposite(pillars);
      const band = bandFor(composite);
      const observationDate = new Date().toISOString().slice(0, 10);

      // Look up the previous score BEFORE writing the new one — this is
      // the only way to know whether the band actually changed.
      const { data: previousRows } = await supabase
        .from("mmai_scores")
        .select("band, composite, observation_date, pillar_ps, pillar_gm, pillar_lm, pillar_mc, pillar_fr")
        .eq("market", market)
        .order("observation_date", { ascending: false })
        .order("computed_at", { ascending: false })
        .limit(1);
      const previousRow = previousRows?.[0];
      const previousBand = previousRow?.band as string | undefined;

      // WHICH pillars contributed, as a 5-character signature ("11111" =
      // all five). computeComposite reweights across whatever is
      // populated, so a composite built from four pillars is not the
      // same measurement as one built from five -- comparing them
      // reports a band change with no economic content behind it.
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
      const shapeOf = (vals: Array<number | null | undefined>) => vals.map((v) => (v == null ? "0" : "1")).join("");
      const currentShape = shapeOf([pillars.PS, pillars.GM, pillars.LM, pillars.MC, pillars.FR]);
      const previousShape = previousRow
        ? shapeOf([previousRow.pillar_ps, previousRow.pillar_gm, previousRow.pillar_lm, previousRow.pillar_mc, previousRow.pillar_fr])
        : null;
      const comparableToPrevious = previousShape !== null && previousShape === currentShape;

      // SOURCE_NOTES describes what a fully-successful run looks like --
      // if any live indicator actually came back null this run (a source
      // was temporarily down/rate-limited/changed shape), say so instead
      // of claiming "(live)" for data that didn't actually arrive.
      const partial = [raw.inflation, raw.gdpGrowth, raw.unemployment, raw.policyRate, raw.brentYoY].some((v) => v == null);
      const baseNote = SOURCE_NOTES[market] ?? "manual fallback — fetcher not yet wired";
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
      const sourceNote = (partial ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)` : baseNote) + fallbackNote;

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
        supabase.from("raw_indicators").insert({
          market,
          inflation: raw.inflation,
          gdp_growth: raw.gdpGrowth,
          unemployment: raw.unemployment,
          policy_rate: raw.policyRate,
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
          pillar_ps: pillars.PS,
          pillar_gm: pillars.GM,
          pillar_lm: pillars.LM,
          pillar_mc: pillars.MC,
          // pillar_ec is deliberately left unwritten. Rows before
          // 2026-09-01 hold real External & Commodities scores and those
          // stay as they are; writing a Fiscal Resilience value into a
          // column named for a different pillar would corrupt the record
          // the export button hands to readers.
          pillar_fr: pillars.FR,
          composite,
          coverage,
          band: band.label,
        }),
      ]);

      const insertErrors = [rawInsert.error, scoreInsert.error].filter((e): e is NonNullable<typeof e> => e != null);
      if (insertErrors.length > 0) {
        throw new Error(`Supabase write failed for ${market}: ${insertErrors.map((e) => e.message).join("; ")}`);
      }

      // Band actually changed (and there WAS a previous band to compare
      // against, i.e. this isn't the market's very first-ever row) --
      // notify every subscriber watching this market.
      if (previousBand && previousBand !== band.label && composite !== null && !comparableToPrevious) {
        // Deliberately silent to subscribers, loud in the logs: the band
        // moved, but the two readings were built from different pillars,
        // so there is nothing honest to tell anyone.
        console.warn(
          `${market}: band ${previousBand} -> ${band.label} SUPPRESSED — pillar coverage changed (${previousShape} -> ${currentShape}). Not an economic move; no email sent.`
        );
      }

      if (previousBand && previousBand !== band.label && composite !== null && comparableToPrevious) {
        const { data: subscribers } = await supabase
          .from("subscribers")
          .select("email, unsubscribe_token, markets");
        const watchers = (subscribers ?? []).filter((s) => (s.markets as string[]).includes(market));

        for (const sub of watchers) {
          try {
            await sendBandCrossingEmail(
              sub.email as string,
              { marketCode: market, marketName: MARKET_NAMES[market] ?? market, oldBand: previousBand, newBand: band.label, score: composite },
              sub.unsubscribe_token as string
            );
          } catch (emailErr) {
            // One subscriber's bad/bounced address shouldn't block the rest.
            console.error(`Notification failed for ${sub.email}:`, emailErr);
          }
        }
      }

      results.push({ market, status: "ok", composite });
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

  return NextResponse.json({ refreshedAt: new Date().toISOString(), results, bondYields: bondResult });
}
