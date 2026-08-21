import { computePillarScores, computeComposite, type RawIndicators, type PillarScores } from "./scoring";

export interface MarketData {
  code: string;
  name: string;
  raw: RawIndicators;
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
export const FALLBACK_MARKETS: MarketData[] = [
  { code: "US", name: "United States", raw: { inflation: 3.4, gdpGrowth: 1.5, unemployment: 4.2, policyRate: 3.63, brentYoY: -5 } },
  { code: "EA", name: "Euro Area", raw: { inflation: 2.9, gdpGrowth: 1.0, unemployment: 6.3, policyRate: 2.25, brentYoY: -5 } },
  { code: "CA", name: "Canada", raw: { inflation: 2.8, gdpGrowth: 3.4, unemployment: 6.4, policyRate: 2.25, brentYoY: -5 } },
  { code: "UK", name: "United Kingdom", raw: { inflation: 2.8, gdpGrowth: 0.4, unemployment: 4.9, policyRate: 3.75, brentYoY: -5 } },
  { code: "JP", name: "Japan", raw: { inflation: 2.8, gdpGrowth: 0.7, unemployment: 2.3, policyRate: 1.0, brentYoY: -5 } },
];

export function scoreMarket(market: MarketData): { pillars: PillarScores; composite: number | null; coverage: number; coveragePillars: number } {
  const pillars = computePillarScores(market.raw);
  const { composite, coverage, coveragePillars } = computeComposite(pillars);
  return { pillars, composite, coverage, coveragePillars };
}
