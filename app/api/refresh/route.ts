import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { computePillarScores, computeComposite, bandFor, type RawIndicators } from "@/lib/scoring";
import { fetchUsInflation, fetchUsUnemployment } from "@/lib/fetchers/bls";
import { fetchUsPolicyRate, fetchJapanInflation, fetchJapanUnemployment } from "@/lib/fetchers/fred";
import { fetchJapanPolicyRate } from "@/lib/fetchers/boj";
import { fetchGdpGrowth, fetchUnemployment } from "@/lib/fetchers/worldbank";
import { fetchAustraliaInflation } from "@/lib/fetchers/abs";
import { fetchAustraliaPolicyRate } from "@/lib/fetchers/rba";
import { sendBandCrossingEmail } from "@/lib/notify";
import { FALLBACK_MARKETS } from "@/lib/markets";

const MARKET_NAMES: Record<string, string> = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));

// A shared, roughly-current Brent YoY figure until a dedicated EIA fetcher
// is added (see lib/fetchers/eia.ts — TODO, same pattern as bls.ts/fred.ts).
// Keeping this as one constant, not a per-market guess, mirrors Equation 5's
// design: External & Commodities is a single global input shared by every market.
const BRENT_YOY_PLACEHOLDER = -5;

/**
 * TODO — extend this map as each remaining source from the Power BI
 * Connection Guide gets its own fetcher, following the exact pattern
 * of lib/fetchers/bls.ts and lib/fetchers/fred.ts:
 *
 *   EA: Eurostat (HICP, GDP) + ECB (policy rate)      — Guide Steps 5-6
 *   CA: Statistics Canada (CPI) + Bank of Canada       — Guide Steps 7-8
 *   UK: ONS (CPI, GDP, unemployment) + Bank of England — Guide Steps 9-10
 *
 * Until each is added, those markets fall back to the last verified
 * manual figures — never silently zero, per the coverage rule.
 *
 * UAE was removed 2026-08-19 (no verified policy-rate source, never
 * cleared the 70% coverage threshold). Market Momentum was removed the
 * same day (no licensed equity source) — its weight was redistributed
 * into the remaining five pillars in lib/scoring.ts.
 */
async function fetchRawIndicators(market: string): Promise<RawIndicators> {
  if (market === "US") {
    const [infl, unemp, rate] = await Promise.all([
      fetchUsInflation(),
      fetchUsUnemployment(),
      fetchUsPolicyRate(),
    ]);
    return {
      inflation: infl.inflation,
      gdpGrowth: 1.5, // TODO: wire lib/fetchers/bea.ts (Guide Step 3)
      unemployment: unemp.unemployment,
      policyRate: rate.policyRate,
      brentYoY: BRENT_YOY_PLACEHOLDER,
    };
  }

  if (market === "JP") {
    // CPI/unemployment via FRED's redistribution of OECD data (CC BY 4.0,
    // verified 2026-08-21). GDP via World Bank (same source already used
    // for the historical UAE dataset). Policy rate via BOJ's official API
    // (DB=FM01, series STRDCLUCON — confirmed live in-browser 2026-08-21,
    // after this server's own fetch was blocked; see README for that note).
    const [infl, unemp, gdp, rate] = await Promise.all([
      fetchJapanInflation(),
      fetchJapanUnemployment(),
      fetchGdpGrowth("JPN"),
      fetchJapanPolicyRate(),
    ]);
    return {
      inflation: infl.inflation,
      gdpGrowth: gdp.gdpGrowth,
      unemployment: unemp.unemployment,
      policyRate: rate.policyRate,
      brentYoY: BRENT_YOY_PLACEHOLDER,
    };
  }

  if (market === "AU") {
    // CPI via ABS Data API (CC BY 4.0, confirmed live via direct browser
    // test 2026-08-21). Unemployment/GDP via World Bank. Policy rate via
    // RBA's own F1.1 table -- cross-verified: the last published row
    // matched an independent news report of the same rate on the same date.
    const [infl, unemp, gdp, rate] = await Promise.all([
      fetchAustraliaInflation(),
      fetchUnemployment("AUS"),
      fetchGdpGrowth("AUS"),
      fetchAustraliaPolicyRate(),
    ]);
    return {
      inflation: infl.inflation,
      gdpGrowth: gdp.gdpGrowth,
      unemployment: unemp.unemployment,
      policyRate: rate.policyRate,
      brentYoY: BRENT_YOY_PLACEHOLDER,
    };
  }

  // Placeholder values for markets not yet wired — matches the last
  // manually-verified figures used throughout the project's other
  // deliverables, so nothing regresses while fetchers are added one by one.
  const fallback: Record<string, RawIndicators> = {
    EA: { inflation: 2.9, gdpGrowth: 1.0, unemployment: 6.3, policyRate: 2.25, brentYoY: BRENT_YOY_PLACEHOLDER },
    CA: { inflation: 2.8, gdpGrowth: 3.4, unemployment: 6.4, policyRate: 2.25, brentYoY: BRENT_YOY_PLACEHOLDER },
    UK: { inflation: 2.8, gdpGrowth: 0.4, unemployment: 4.9, policyRate: 3.75, brentYoY: BRENT_YOY_PLACEHOLDER },
  };
  return fallback[market] ?? {};
}

const MARKETS = ["US", "EA", "CA", "UK", "JP", "AU"];

export async function GET(request: Request) {
  // Protect this endpoint so only Vercel Cron (or you, manually, with the
  // secret) can trigger a refresh — prevents random internet traffic from
  // spamming BLS/FRED on your behalf.
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const results: Array<{ market: string; status: string; composite: number | null }> = [];

  for (const market of MARKETS) {
    try {
      const raw = await fetchRawIndicators(market);
      const pillars = computePillarScores(raw);
      const { composite, coverage } = computeComposite(pillars);
      const band = bandFor(composite);
      const observationDate = new Date().toISOString().slice(0, 10);

      // Look up the previous score BEFORE writing the new one — this is
      // the only way to know whether the band actually changed.
      const { data: previousRows } = await supabase
        .from("mmai_scores")
        .select("band")
        .eq("market", market)
        .order("observation_date", { ascending: false })
        .order("computed_at", { ascending: false })
        .limit(1);
      const previousBand = previousRows?.[0]?.band as string | undefined;

      await supabase.from("raw_indicators").insert({
        market,
        inflation: raw.inflation,
        gdp_growth: raw.gdpGrowth,
        unemployment: raw.unemployment,
        policy_rate: raw.policyRate,
        brent_yoy: raw.brentYoY,
        observation_date: observationDate,
        source_note: market === "US" ? "BLS + FRED (live)" : market === "JP" ? "FRED (OECD) + World Bank + BOJ (live)" : market === "AU" ? "ABS + World Bank + RBA (live)" : "manual fallback — fetcher not yet wired",
        status: "current",
      });

      await supabase.from("mmai_scores").insert({
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
      });

      // Band actually changed (and there WAS a previous band to compare
      // against, i.e. this isn't the market's very first-ever row) --
      // notify every subscriber watching this market.
      if (previousBand && previousBand !== band.label && composite !== null) {
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

  return NextResponse.json({ refreshedAt: new Date().toISOString(), results });
}
