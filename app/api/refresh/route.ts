import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { computePillarScores, computeComposite, bandFor, type RawIndicators } from "@/lib/scoring";
import { fetchUsInflation, fetchUsUnemployment } from "@/lib/fetchers/bls";
import { fetchUsPolicyRate } from "@/lib/fetchers/nyfed";
import { fetchJapanPolicyRate } from "@/lib/fetchers/boj";
import { fetchGdpGrowth, fetchUnemployment, fetchInflation } from "@/lib/fetchers/worldbank";
import { fetchAustraliaInflation, fetchAustraliaUnemployment } from "@/lib/fetchers/abs";
import { fetchJapanUnemployment } from "@/lib/fetchers/oecd";
import { fetchAllBondYieldSeries, BOND_YIELD_SOURCE } from "@/lib/fetchers/bondYields";
import { fetchAustraliaPolicyRate } from "@/lib/fetchers/rba";
import { fetchEuroAreaInflation, fetchEuroAreaGdpGrowth, fetchEuroAreaUnemployment } from "@/lib/fetchers/eurostat";
import { fetchEuroAreaPolicyRate } from "@/lib/fetchers/ecb";
import { fetchCanadaInflation, fetchCanadaUnemployment } from "@/lib/fetchers/statcan";
import { fetchCanadaPolicyRate } from "@/lib/fetchers/boc";
import { fetchUkInflation, fetchUkUnemployment } from "@/lib/fetchers/ons";
import { fetchUkPolicyRate } from "@/lib/fetchers/boe";
import { fetchNorwayInflation } from "@/lib/fetchers/ssb";
import { fetchNorwayPolicyRate } from "@/lib/fetchers/norgesbank";
import { fetchUsGdpGrowth } from "@/lib/fetchers/bea";
import { fetchBrentYoY } from "@/lib/fetchers/eia";
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
async function settle<T>(label: string, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.error(`Fetch failed [${label}]:`, (err as Error).message);
    return null;
  }
}

async function fetchRawIndicators(market: string, brentYoY: number | null): Promise<RawIndicators> {
  if (market === "US") {
    const [infl, unemp, rate, gdp] = await Promise.all([
      settle("US inflation", fetchUsInflation()),
      settle("US unemployment", fetchUsUnemployment()),
      settle("US policy rate", fetchUsPolicyRate()),
      settle("US GDP growth", fetchUsGdpGrowth()),
    ]);
    return {
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
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
      settle("JP inflation", fetchInflation("JPN")),
      settle("JP unemployment", fetchJapanUnemployment()),
      settle("JP GDP growth", fetchGdpGrowth("JPN")),
      settle("JP policy rate", fetchJapanPolicyRate()),
    ]);
    return {
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
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
      settle("AU GDP growth", fetchGdpGrowth("AUS")),
      settle("AU policy rate", fetchAustraliaPolicyRate()),
    ]);
    return {
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
    };
  }

  if (market === "EA") {
    // Inflation/GDP/unemployment via Eurostat, policy rate (deposit
    // facility) via the ECB's own Data Portal — both confirmed live
    // 2026-08-21. See lib/fetchers/eurostat.ts for the EA20→EA21 geo
    // code note (that's the fix for the unemployment fetch that was
    // previously flagged as broken).
    const [infl, gdp, unemp, rate] = await Promise.all([
      settle("EA inflation", fetchEuroAreaInflation()),
      settle("EA GDP growth", fetchEuroAreaGdpGrowth()),
      settle("EA unemployment", fetchEuroAreaUnemployment()),
      settle("EA policy rate", fetchEuroAreaPolicyRate()),
    ]);
    return {
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
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
      settle("CA GDP growth", fetchGdpGrowth("CAN")),
      settle("CA policy rate", fetchCanadaPolicyRate()),
    ]);
    return {
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
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
      settle("UK GDP growth", fetchGdpGrowth("GBR")),
      settle("UK policy rate", fetchUkPolicyRate()),
    ]);
    return {
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
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
      inflation: infl?.inflation ?? null,
      gdpGrowth: gdp?.gdpGrowth ?? null,
      unemployment: unemp?.unemployment ?? null,
      policyRate: rate?.policyRate ?? null,
      brentYoY,
    };
  }

  throw new Error(`fetchRawIndicators: unknown market "${market}"`);
}

// Norway paused 2026-08-22 pending Norges Bank license confirmation — see
// the matching comment in lib/markets.ts. fetchRawIndicators()'s "NO"
// branch below is left in place, ready to reactivate with a one-line change.
const MARKETS = ["US", "EA", "CA", "UK", "JP", "AU"];

const SOURCE_NOTES: Record<string, string> = {
  US: "BLS + BEA + New York Fed + EIA (live)",
  JP: "World Bank + OECD + BOJ + EIA (live)",
  AU: "ABS + World Bank + RBA + EIA (live)",
  EA: "Eurostat + ECB + EIA (live)",
  CA: "Statistics Canada + World Bank + Bank of Canada + EIA (live)",
  UK: "ONS + World Bank + Bank of England + EIA (live)",
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
  const brentResult = await settle("Brent Crude YoY", fetchBrentYoY());
  const brentYoY = brentResult?.brentYoY ?? null;

  for (const market of pending) {
    try {
      const raw = await fetchRawIndicators(market, brentYoY);
      const pillars = computePillarScores(raw);
      const { composite, coverage } = computeComposite(pillars);
      const band = bandFor(composite);
      const observationDate = new Date().toISOString().slice(0, 10);

      // Look up the previous score BEFORE writing the new one — this is
      // the only way to know whether the band actually changed.
      const { data: previousRows } = await supabase
        .from("mmai_scores")
        .select("band, pillar_ps, pillar_gm, pillar_lm, pillar_mc, pillar_ec")
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
      const currentShape = shapeOf([pillars.PS, pillars.GM, pillars.LM, pillars.MC, pillars.EC]);
      const previousShape = previousRow
        ? shapeOf([previousRow.pillar_ps, previousRow.pillar_gm, previousRow.pillar_lm, previousRow.pillar_mc, previousRow.pillar_ec])
        : null;
      const comparableToPrevious = previousShape !== null && previousShape === currentShape;

      // SOURCE_NOTES describes what a fully-successful run looks like --
      // if any live indicator actually came back null this run (a source
      // was temporarily down/rate-limited/changed shape), say so instead
      // of claiming "(live)" for data that didn't actually arrive.
      const partial = [raw.inflation, raw.gdpGrowth, raw.unemployment, raw.policyRate, raw.brentYoY].some((v) => v == null);
      const baseNote = SOURCE_NOTES[market] ?? "manual fallback — fetcher not yet wired";
      const sourceNote = partial ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)` : baseNote;

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
          observation_date: observationDate,
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
          pillar_ec: pillars.EC,
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
