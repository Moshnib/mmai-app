import { type RawIndicators } from "./indicators";
import { computeMmai, dimensionPercentiles, type MmaiResult, type DimensionKey } from "./composite";

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

// Verified fallback values, checked against the reference set.
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
// RESYNCED TO LIVE 2026-09-02. This is the THIRD time these have drifted,
// and the drift is never cosmetic:
//
//   2026-08-24  Canada carried GDP growth of 3.4% against a real 1.74%,
//               which alone ranked Canada first in demo mode.
//   2026-09-02  Euro Area still carried inflation of 2.0 -- the figure from
//               Eurostat's DEAD dataset -- and Japan 3.17 from the World
//               Bank series replaced by e-Stat on 1 September.
//
// The second one had teeth beyond demo mode: lib/history.ts's final point
// is this same snapshot, and scripts/measure-pillar-influence.ts measures
// the PUBLISHED influence figures from it. Stale numbers here became wrong
// numbers on the Learn page, and a claim about which pillar separates the
// markets least was published backwards.
//
// lib/history.ts now DERIVES its last point from this array rather than
// repeating it, so there is one place to update instead of two. There is
// still nothing that notices when THIS drifts from the database -- that
// needs a live query, which CI cannot make. Re-sync it whenever a source
// or a pillar changes.
// These had drifted badly: Canada carried a 3.4% GDP growth figure against a
// real World Bank value of 1.74%, which alone was enough to rank Canada first
// in demo mode, and every market still carried the retired brentYoY: -5
// placeholder from before the EIA feed was wired up.
export const FALLBACK_MARKETS: MarketData[] = [
  { code: "US", name: "United States", raw: { inflation: 3.7, gdpGrowth: 2.1, unemployment: 4.1, policyRate: 3.63, brentYoY: 17.91, debtPctGdp: 111 } },
  { code: "EA", name: "Euro Area", raw: { inflation: 3.3, gdpGrowth: 1, unemployment: 6.4, policyRate: 2.25, brentYoY: 17.91, debtPctGdp: 85.3 } },
  { code: "CA", name: "Canada", raw: { inflation: 3.03, gdpGrowth: 1.13, unemployment: 6.4, policyRate: 2.25, brentYoY: 17.91, debtPctGdp: 96.1 } },
  { code: "UK", name: "United Kingdom", raw: { inflation: 2.9, gdpGrowth: 0.9, unemployment: 4.9, policyRate: 3.75, brentYoY: 17.91, debtPctGdp: 88.8 } },
  { code: "JP", name: "Japan", raw: { inflation: 2, gdpGrowth: 0.55, unemployment: 2.4, policyRate: 0.977, brentYoY: 17.91, debtPctGdp: 178.8 } },
  { code: "AU", name: "Australia", raw: { inflation: 3.45, gdpGrowth: 2.14, unemployment: 4.46, policyRate: 4.35, brentYoY: 17.91, debtPctGdp: 50.7 } },
  // Sweden joined 2026-09-12. Values below are the readings verified live
  // at that date; like every row here they are a fallback for when the
  // database cannot be read, not the published figures.
  { code: "SE", name: "Sweden", raw: { inflation: 0.2, gdpGrowth: 3.3, unemployment: 8.6, policyRate: 1.75, brentYoY: 17.91, debtPctGdp: 34 } },
];

/**
 * ONE COLOUR PER MARKET, FOR THE WHOLE SITE.
 *
 * There were two maps -- one in the Compare chart, one in the bond-yield
 * panel -- and they disagreed on five of six markets. Worse than
 * arbitrary, they had three colours SWAPPED between countries:
 *
 *   red     was the Euro Area on Compare and the United Kingdom on bonds
 *   amber   was the United Kingdom on Compare and Canada on bonds
 *   violet  was Japan on Compare and the Euro Area on bonds
 *
 * A reader who learned "red is the Euro Area" on one page read the red
 * line on the other as the Euro Area when it was the UK. Two charts that
 * are individually well-chosen can still mislead if they contradict each
 * other, and nothing measures that -- the design audit counted hardcoded
 * hexes without ever checking they agreed.
 *
 * These values are the bond panel's, which were measured for perceptual
 * separation on 6 September: the closest pair is 36.7 apart in CIE76 dE,
 * where anything under about 20 reads as one colour on a thin line. The
 * Compare set was equally well separated (36.4) and simply lost the
 * coin-toss; what mattered was picking one.
 *
 * No green anywhere, per the site-wide rule.
 * scripts/test-market-colours.ts holds the line.
 */
export const MARKET_COLORS: Record<string, string> = {
  US: "#22D3EE", // cyan
  EA: "#8B5CF6", // violet
  CA: "#F0975B", // amber
  UK: "#E14B4B", // red
  JP: "#F472B6", // pink
  AU: "#FBBF24", // gold
  // Blue, chosen by measurement. Green was measured first and was the
  // most separated of any candidate -- and is banned: the palette keeps
  // green out entirely so a rising line is never read as a "good" line.
  // scripts/test-market-colours.ts enforces that, and caught it. This is
  // dE 44.3 from its nearest neighbour (US cyan), against 36.7 for the
  // closest existing pair, and reads at 7.9:1 on the page.
  SE: "#60A5FA", // blue
};

// scoreMarket() -- the five-pillar scorer -- was removed at the cutover on
// 5 September 2026. scoreMarketV2 below is the only scorer.

/** ENGINE v2.0 — the three-dimension composite.
 *
 *  Runs beside scoreMarket() rather than replacing it, so a page can move
 *  over one at a time and the two can be compared while they coexist.
 *  Both read the same market.raw, so any difference between them is the
 *  method and nothing else. */
export function scoreMarketV2(market: MarketData): MmaiResult & { dimensionPercentiles: Record<DimensionKey, number> | null } {
  const result = computeMmai(market.raw, market.code);
  return {
    ...result,
    dimensionPercentiles: result.dimensions ? dimensionPercentiles(result.dimensions) : null,
  };
}
