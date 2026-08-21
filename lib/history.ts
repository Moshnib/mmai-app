import type { RawIndicators } from "./scoring";

export interface HistoryPoint {
  year: string;       // "2019".."2024", plus "2026" for the current live/fallback snapshot
  indicators: RawIndicators;
}

// ============================================================
// HISTORICAL RAW INDICATORS
// Source: MMAI Methodology and Validation report, Appendix B.
// Same verified dataset used throughout the deck, the pilot back-test,
// and the workbook — reused here rather than re-derived, so every
// chart in the app traces back to the same audited numbers.
// The final point in each series is today's live/fallback snapshot
// (matching lib/markets.ts), labeled "2026" to extend the trend to now.
// ============================================================

export const HISTORY: Record<string, HistoryPoint[]> = {
  US: [
    { year: "2019", indicators: { inflation: 1.8, gdpGrowth: 2.3, unemployment: 3.7, policyRate: 2.4, brentYoY: -10 } },
    { year: "2020", indicators: { inflation: 1.2, gdpGrowth: -2.8, unemployment: 8.1, policyRate: 0.4, brentYoY: -34 } },
    { year: "2021", indicators: { inflation: 4.7, gdpGrowth: 5.9, unemployment: 5.4, policyRate: 0.1, brentYoY: 69 } },
    { year: "2022", indicators: { inflation: 8.0, gdpGrowth: 2.1, unemployment: 3.6, policyRate: 1.7, brentYoY: 42 } },
    { year: "2023", indicators: { inflation: 4.1, gdpGrowth: 2.5, unemployment: 3.6, policyRate: 5.0, brentYoY: -19 } },
    { year: "2024", indicators: { inflation: 3.0, gdpGrowth: 2.8, unemployment: 4.0, policyRate: 5.3, brentYoY: -2 } },
    { year: "2026", indicators: { inflation: 3.4, gdpGrowth: 1.5, unemployment: 4.2, policyRate: 3.63, brentYoY: -5 } },
  ],
  EA: [
    { year: "2019", indicators: { inflation: 1.2, gdpGrowth: 1.6, unemployment: 7.6, policyRate: -0.4, brentYoY: -10 } },
    { year: "2020", indicators: { inflation: 0.3, gdpGrowth: -6.1, unemployment: 7.9, policyRate: -0.5, brentYoY: -34 } },
    { year: "2021", indicators: { inflation: 2.6, gdpGrowth: 5.9, unemployment: 7.7, policyRate: -0.5, brentYoY: 69 } },
    { year: "2022", indicators: { inflation: 8.4, gdpGrowth: 3.5, unemployment: 6.7, policyRate: 0.8, brentYoY: 42 } },
    { year: "2023", indicators: { inflation: 5.4, gdpGrowth: 0.4, unemployment: 6.5, policyRate: 3.9, brentYoY: -19 } },
    { year: "2024", indicators: { inflation: 2.4, gdpGrowth: 0.8, unemployment: 6.4, policyRate: 3.5, brentYoY: -2 } },
    { year: "2026", indicators: { inflation: 2.9, gdpGrowth: 1.0, unemployment: 6.3, policyRate: 2.25, brentYoY: -5 } },
  ],
  CA: [
    { year: "2019", indicators: { inflation: 1.9, gdpGrowth: 1.9, unemployment: 5.7, policyRate: 1.75, brentYoY: -10 } },
    { year: "2020", indicators: { inflation: 0.7, gdpGrowth: -5.0, unemployment: 9.6, policyRate: 0.25, brentYoY: -34 } },
    { year: "2021", indicators: { inflation: 3.4, gdpGrowth: 5.0, unemployment: 7.5, policyRate: 0.25, brentYoY: 69 } },
    { year: "2022", indicators: { inflation: 6.8, gdpGrowth: 3.8, unemployment: 5.3, policyRate: 2.5, brentYoY: 42 } },
    { year: "2023", indicators: { inflation: 3.9, gdpGrowth: 1.2, unemployment: 5.4, policyRate: 5.0, brentYoY: -19 } },
    { year: "2024", indicators: { inflation: 2.4, gdpGrowth: 1.3, unemployment: 6.4, policyRate: 4.0, brentYoY: -2 } },
    { year: "2026", indicators: { inflation: 2.8, gdpGrowth: 3.4, unemployment: 6.4, policyRate: 2.25, brentYoY: -5 } },
  ],
  UK: [
    // Sourced from published UK statistics (ONS CPI/GDP/unemployment,
    // Bank of England Bank Rate history) — representative annual figures,
    // same convention as the US/EA/CA series above, not yet individually
    // re-queried year-by-year from the live APIs (see Section 7 of the
    // methodology paper). Brent YoY reuses the shared global series.
    { year: "2019", indicators: { inflation: 1.8, gdpGrowth: 1.4, unemployment: 3.9, policyRate: 0.75, brentYoY: -10 } },
    { year: "2020", indicators: { inflation: 0.9, gdpGrowth: -10.4, unemployment: 4.5, policyRate: 0.10, brentYoY: -34 } },
    { year: "2021", indicators: { inflation: 2.6, gdpGrowth: 8.6, unemployment: 4.5, policyRate: 0.25, brentYoY: 69 } },
    { year: "2022", indicators: { inflation: 9.1, gdpGrowth: 4.1, unemployment: 3.7, policyRate: 3.50, brentYoY: 42 } },
    { year: "2023", indicators: { inflation: 7.3, gdpGrowth: 0.3, unemployment: 4.0, policyRate: 5.25, brentYoY: -19 } },
    { year: "2024", indicators: { inflation: 2.5, gdpGrowth: 1.1, unemployment: 4.4, policyRate: 4.75, brentYoY: -2 } },
    { year: "2026", indicators: { inflation: 2.8, gdpGrowth: 0.4, unemployment: 4.9, policyRate: 3.75, brentYoY: -5 } },
  ],
  // Japan (JP): sourced from published statistics (macrotrends CPI/unemployment,
  // European Commission spring forecast for 2023 GDP, IMF/BOJ for the negative-rate
  // period 2019-2023 and the March/July 2024 policy shift to 0.25%). Representative
  // annual figures, same convention as the other historical series above.
  JP: [
    { year: "2019", indicators: { inflation: 0.5, gdpGrowth: -0.4, unemployment: 2.4, policyRate: -0.1, brentYoY: -10 } },
    { year: "2020", indicators: { inflation: 0.0, gdpGrowth: -4.1, unemployment: 2.8, policyRate: -0.1, brentYoY: -34 } },
    { year: "2021", indicators: { inflation: -0.2, gdpGrowth: 2.6, unemployment: 2.8, policyRate: -0.1, brentYoY: 69 } },
    { year: "2022", indicators: { inflation: 2.5, gdpGrowth: 0.9, unemployment: 2.6, policyRate: -0.1, brentYoY: 42 } },
    { year: "2023", indicators: { inflation: 3.27, gdpGrowth: 1.9, unemployment: 2.6, policyRate: -0.1, brentYoY: -19 } },
    { year: "2024", indicators: { inflation: 2.74, gdpGrowth: 0.2, unemployment: 2.5, policyRate: 0.25, brentYoY: -2 } },
    { year: "2026", indicators: { inflation: 2.8, gdpGrowth: 0.7, unemployment: 2.3, policyRate: 1.0, brentYoY: -5 } },
  ],
  // UAE (AE) removed 2026-08-19 — see lib/markets.ts for the reason.
  // Its historical series is preserved in git history if ever needed again.
};
