import { computePillarScores, computeComposite, type RawIndicators, type PillarScores } from "./scoring";

export interface MarketData {
  code: string;
  name: string;
  raw: RawIndicators;
  /** WHEN each figure refers to, as distinct from when it was fetched.
   *  Populated only from live data; the hardcoded fallbacks have no
   *  meaningful observation date and deliberately leave this undefined. */
  observationDates?: {
    inflation: string | null;
    gdpGrowth: string | null;
    unemployment: string | null;
    policyRate: string | null;
  };
}

// Verified fallback values — matches lib/scoring.ts test cases exactly.
// Used when Supabase isn't configured yet (e.g. local dev before setup),
// so the app is fully functional out of the box, then swaps to live
// database values once NEXT_PUBLIC_SUPABASE_URL is set.
//
// UAE was removed 2026-08-19: no verified public policy-rate source exists
// (see the licensing audit and Power BI Connection Guide, Step 11), and with
// no realistic path to one, it never cleared the coverage threshold — every
// visit produced N/A. Its historical data remains in lib/history.ts, unused,
// in case a source is found later.
//
// Norway was removed from display 2026-08-22, pending written confirmation
// from Norges Bank on whether commercial reuse of their Key Policy Rate data
// is actually permitted (their own site's terms don't say, see lib/sources.ts).
// All of Norway's code, fetchers, and historical data are untouched — this is
// a one-line re-add once that's resolved, not a rebuild.
// Synced to the live database on 2026-08-24 (observation date 2026-08-23).
// These had drifted badly: Canada carried a 3.4% GDP growth figure against a
// real World Bank value of 1.74%, which alone was enough to rank Canada first
// in demo mode, and every market still carried the retired brentYoY: -5
// placeholder from before the EIA feed was wired up.
export const FALLBACK_MARKETS: MarketData[] = [
  { code: "US", name: "United States", raw: { inflation: 3.36, gdpGrowth: 2.1, unemployment: 4.1, policyRate: 3.63, brentYoY: 17.91 } },
  { code: "EA", name: "Euro Area", raw: { inflation: 2.0, gdpGrowth: 1.2, unemployment: 6.3, policyRate: 2.25, brentYoY: 17.91 } },
  { code: "CA", name: "Canada", raw: { inflation: 3.03, gdpGrowth: 1.74, unemployment: 6.91, policyRate: 2.25, brentYoY: 17.91 } },
  { code: "UK", name: "United Kingdom", raw: { inflation: 2.9, gdpGrowth: 1.39, unemployment: 4.75, policyRate: 3.75, brentYoY: 17.91 } },
  { code: "JP", name: "Japan", raw: { inflation: 3.17, gdpGrowth: 1.19, unemployment: 2.45, policyRate: 0.98, brentYoY: 17.91 } },
  { code: "AU", name: "Australia", raw: { inflation: 3.75, gdpGrowth: 1.35, unemployment: 4.09, policyRate: 4.35, brentYoY: 17.91 } },
];

export function scoreMarket(market: MarketData): { pillars: PillarScores; composite: number | null; coverage: number; coveragePillars: number } {
  const pillars = computePillarScores(market.raw, market.code);
  const { composite, coverage, coveragePillars } = computeComposite(pillars);
  return { pillars, composite, coverage, coveragePillars };
}
