import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { computePillarScores, computeComposite, bandFor, type RawIndicators } from "@/lib/scoring";
import { fetchUsInflation, fetchUsUnemployment } from "@/lib/fetchers/bls";
import { fetchUsPolicyRate } from "@/lib/fetchers/fred";

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

const MARKETS = ["US", "EA", "CA", "UK"];

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

      await supabase.from("raw_indicators").insert({
        market,
        inflation: raw.inflation,
        gdp_growth: raw.gdpGrowth,
        unemployment: raw.unemployment,
        policy_rate: raw.policyRate,
        brent_yoy: raw.brentYoY,
        observation_date: observationDate,
        source_note: market === "US" ? "BLS + FRED (live)" : "manual fallback — fetcher not yet wired",
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

      results.push({ market, status: "ok", composite });
    } catch (err) {
      console.error(`Refresh failed for ${market}:`, err);
      results.push({ market, status: `error: ${(err as Error).message}`, composite: null });
    }
  }

  return NextResponse.json({ refreshedAt: new Date().toISOString(), results });
}
