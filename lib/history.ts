import type { RawIndicators } from "./scoring";

export interface HistoryPoint {
  year: string;       // "2019".."2025", verified/sourced; "2026" is the current live/fallback snapshot
  indicators: RawIndicators;
}

// ============================================================
// HISTORICAL RAW INDICATORS
// Source: MMAI Methodology and Validation report, Appendix B for 2019-2024.
// 2025 added later, sourced from central bank/statistical agency actual-
// outturn reports (ECB Annual Report 2025, RBA Statement on Monetary Policy
// Feb 2026, BoJ Outlook Reports explicitly noting "CPI figures for fiscal
// 2025 are actual values", Vanguard/NIESR trackers for UK/Canada) --
// previously this gap was deliberately left unfilled rather than fabricated.
// The final point in each series is today's live/fallback snapshot
// (matching lib/markets.ts), labeled "2026" to extend the trend to now.
// ============================================================

export const HISTORY: Record<string, HistoryPoint[]> = {
  US: [
    { year: "2019", indicators: { inflation: 1.8, gdpGrowth: 2.3, unemployment: 3.7, policyRate: 2.4, brentYoY: -10, debtPctGdp: 103.5 } },
    { year: "2020", indicators: { inflation: 1.2, gdpGrowth: -2.8, unemployment: 8.1, policyRate: 0.4, brentYoY: -34, debtPctGdp: 129.3 } },
    { year: "2021", indicators: { inflation: 4.7, gdpGrowth: 5.9, unemployment: 5.4, policyRate: 0.1, brentYoY: 69, debtPctGdp: 119.0 } },
    { year: "2022", indicators: { inflation: 8.0, gdpGrowth: 2.1, unemployment: 3.6, policyRate: 1.7, brentYoY: 42, debtPctGdp: 101.5 } },
    { year: "2023", indicators: { inflation: 4.1, gdpGrowth: 2.5, unemployment: 3.6, policyRate: 5.0, brentYoY: -19, debtPctGdp: 105.4 } },
    { year: "2024", indicators: { inflation: 3.0, gdpGrowth: 2.8, unemployment: 4.0, policyRate: 5.3, brentYoY: -2, debtPctGdp: 106.2 } },
    { year: "2025", indicators: { inflation: 2.8, gdpGrowth: 1.7, unemployment: 4.5, policyRate: 3.75, brentYoY: -8, debtPctGdp: 111.0 } },
    { year: "2026", indicators: { inflation: 3.36, gdpGrowth: 2.1, unemployment: 4.1, policyRate: 3.63, brentYoY: 17.91, debtPctGdp: 111.0 } },
  ],
  EA: [
    { year: "2019", indicators: { inflation: 1.2, gdpGrowth: 1.6, unemployment: 7.6, policyRate: -0.4, brentYoY: -10, debtPctGdp: 95.9 } },
    { year: "2020", indicators: { inflation: 0.3, gdpGrowth: -6.1, unemployment: 7.9, policyRate: -0.5, brentYoY: -34, debtPctGdp: 112.6 } },
    { year: "2021", indicators: { inflation: 2.6, gdpGrowth: 5.9, unemployment: 7.7, policyRate: -0.5, brentYoY: 69, debtPctGdp: 105.6 } },
    { year: "2022", indicators: { inflation: 8.4, gdpGrowth: 3.5, unemployment: 6.7, policyRate: 0.8, brentYoY: 42, debtPctGdp: 85.8 } },
    { year: "2023", indicators: { inflation: 5.4, gdpGrowth: 0.4, unemployment: 6.5, policyRate: 3.9, brentYoY: -19, debtPctGdp: 85.7 } },
    { year: "2024", indicators: { inflation: 2.4, gdpGrowth: 0.8, unemployment: 6.4, policyRate: 3.5, brentYoY: -2, debtPctGdp: 85.5 } },
    { year: "2025", indicators: { inflation: 2.1, gdpGrowth: 1.4, unemployment: 6.2, policyRate: 2.0, brentYoY: -8, debtPctGdp: 85.3 } },
    { year: "2026", indicators: { inflation: 2.0, gdpGrowth: 1.2, unemployment: 6.3, policyRate: 2.25, brentYoY: 17.91, debtPctGdp: 85.3 } },
  ],
  CA: [
    { year: "2019", indicators: { inflation: 1.9, gdpGrowth: 1.9, unemployment: 5.7, policyRate: 1.75, brentYoY: -10, debtPctGdp: 87.9 } },
    { year: "2020", indicators: { inflation: 0.7, gdpGrowth: -5.0, unemployment: 9.6, policyRate: 0.25, brentYoY: -34, debtPctGdp: 116.6 } },
    { year: "2021", indicators: { inflation: 3.4, gdpGrowth: 5.0, unemployment: 7.5, policyRate: 0.25, brentYoY: 69, debtPctGdp: 105.9 } },
    { year: "2022", indicators: { inflation: 6.8, gdpGrowth: 3.8, unemployment: 5.3, policyRate: 2.5, brentYoY: 42, debtPctGdp: 86.5 } },
    { year: "2023", indicators: { inflation: 3.9, gdpGrowth: 1.2, unemployment: 5.4, policyRate: 5.0, brentYoY: -19, debtPctGdp: 89.2 } },
    { year: "2024", indicators: { inflation: 2.4, gdpGrowth: 1.3, unemployment: 6.4, policyRate: 4.0, brentYoY: -2, debtPctGdp: 93.5 } },
    { year: "2025", indicators: { inflation: 2.0, gdpGrowth: 1.0, unemployment: 6.6, policyRate: 2.75, brentYoY: -8, debtPctGdp: 96.1 } },
    { year: "2026", indicators: { inflation: 3.03, gdpGrowth: 1.74, unemployment: 6.91, policyRate: 2.25, brentYoY: 17.91, debtPctGdp: 96.1 } },
  ],
  UK: [
    // Sourced from published UK statistics (ONS CPI/GDP/unemployment,
    // Bank of England Bank Rate history) — representative annual figures,
    // same convention as the US/EA/CA series above, not yet individually
    // re-queried year-by-year from the live APIs (see Section 7 of the
    // methodology paper). Brent YoY reuses the shared global series.
    { year: "2019", indicators: { inflation: 1.8, gdpGrowth: 1.4, unemployment: 3.9, policyRate: 0.75, brentYoY: -10, debtPctGdp: 109.9 } },
    { year: "2020", indicators: { inflation: 0.9, gdpGrowth: -10.4, unemployment: 4.5, policyRate: 0.10, brentYoY: -34, debtPctGdp: 140.0 } },
    { year: "2021", indicators: { inflation: 2.6, gdpGrowth: 8.6, unemployment: 4.5, policyRate: 0.25, brentYoY: 69, debtPctGdp: 131.1 } },
    { year: "2022", indicators: { inflation: 9.1, gdpGrowth: 4.1, unemployment: 3.7, policyRate: 3.50, brentYoY: 42, debtPctGdp: 89.8 } },
    { year: "2023", indicators: { inflation: 7.3, gdpGrowth: 0.3, unemployment: 4.0, policyRate: 5.25, brentYoY: -19, debtPctGdp: 90.4 } },
    { year: "2024", indicators: { inflation: 2.5, gdpGrowth: 1.1, unemployment: 4.4, policyRate: 4.75, brentYoY: -2, debtPctGdp: 85.8 } },
    { year: "2025", indicators: { inflation: 3.4, gdpGrowth: 0.7, unemployment: 4.8, policyRate: 3.75, brentYoY: -8, debtPctGdp: 88.8 } },
    { year: "2026", indicators: { inflation: 2.9, gdpGrowth: 1.39, unemployment: 4.75, policyRate: 3.75, brentYoY: 17.91, debtPctGdp: 88.8 } },
  ],
  // Japan (JP): sourced from published statistics (macrotrends CPI/unemployment,
  // European Commission spring forecast for 2023 GDP, IMF/BOJ for the negative-rate
  // period 2019-2023 and the March/July 2024 policy shift to 0.25%). Representative
  // annual figures, same convention as the other historical series above.
  JP: [
    { year: "2019", indicators: { inflation: 0.5, gdpGrowth: -0.4, unemployment: 2.4, policyRate: -0.1, brentYoY: -10, debtPctGdp: 211.8 } },
    { year: "2020", indicators: { inflation: 0.0, gdpGrowth: -4.1, unemployment: 2.8, policyRate: -0.1, brentYoY: -34, debtPctGdp: 231.5 } },
    { year: "2021", indicators: { inflation: -0.2, gdpGrowth: 2.6, unemployment: 2.8, policyRate: -0.1, brentYoY: 69, debtPctGdp: 222.2 } },
    { year: "2022", indicators: { inflation: 2.5, gdpGrowth: 0.9, unemployment: 2.6, policyRate: -0.1, brentYoY: 42, debtPctGdp: 217.1 } },
    { year: "2023", indicators: { inflation: 3.27, gdpGrowth: 1.9, unemployment: 2.6, policyRate: -0.1, brentYoY: -19, debtPctGdp: 209.4 } },
    { year: "2024", indicators: { inflation: 2.74, gdpGrowth: 0.2, unemployment: 2.5, policyRate: 0.25, brentYoY: -2, debtPctGdp: 197.0 } },
    { year: "2025", indicators: { inflation: 2.9, gdpGrowth: 0.9, unemployment: 2.4, policyRate: 0.75, brentYoY: -8, debtPctGdp: 178.8 } },
    { year: "2026", indicators: { inflation: 3.17, gdpGrowth: 1.19, unemployment: 2.45, policyRate: 0.98, brentYoY: 17.91, debtPctGdp: 178.8 } },
  ],
  // Australia (AU): policy rate is REAL data, not estimated -- taken directly
  // from the RBA's own published F1.1 table (year-end values), which was
  // fetched and confirmed live during this build. Inflation/unemployment from
  // macrotrends (cross-checked against ABS/RBA commentary), GDP growth from
  // FocusEconomics and IMF/ABS figures for the COVID and rebound years.
  AU: [
    { year: "2019", indicators: { inflation: 1.6, gdpGrowth: 1.9, unemployment: 5.2, policyRate: 0.75, brentYoY: -10, debtPctGdp: 42.6 } },
    { year: "2020", indicators: { inflation: 0.9, gdpGrowth: -2.4, unemployment: 6.5, policyRate: 0.10, brentYoY: -34, debtPctGdp: 60.8 } },
    { year: "2021", indicators: { inflation: 2.9, gdpGrowth: 4.6, unemployment: 5.1, policyRate: 0.10, brentYoY: 69, debtPctGdp: 57.0 } },
    { year: "2022", indicators: { inflation: 6.59, gdpGrowth: 3.8, unemployment: 3.73, policyRate: 3.05, brentYoY: 42, debtPctGdp: 48.9 } },
    { year: "2023", indicators: { inflation: 5.60, gdpGrowth: 2.06, unemployment: 3.67, policyRate: 4.35, brentYoY: -19, debtPctGdp: 49.1 } },
    { year: "2024", indicators: { inflation: 3.17, gdpGrowth: 1.04, unemployment: 4.07, policyRate: 4.35, brentYoY: -2, debtPctGdp: 49.4 } },
    { year: "2025", indicators: { inflation: 3.6, gdpGrowth: 2.0, unemployment: 4.5, policyRate: 3.6, brentYoY: -8, debtPctGdp: 50.7 } },
    { year: "2026", indicators: { inflation: 3.75, gdpGrowth: 1.35, unemployment: 4.09, policyRate: 4.35, brentYoY: 17.91, debtPctGdp: 50.7 } },
  ],
  // Norway (NO): added 2026-08-21 after a research pass comparing several
  // countries' data accessibility/licensing. Inflation from Statistics
  // Norway's own historical "yearly changes" series (table 03014).
  // GDP growth/unemployment from World Bank. Policy rate (year-end
  // values) read directly off Norges Bank's own official history of
  // policy rate changes. The 2025->2026 policy rate move (4.00 -> 4.25)
  // is a real hike, not a typo -- confirmed via the actual daily API
  // data, which shows the change happened in mid-May 2026, after a
  // cutting cycle through 2025 -- consistent with inflation staying
  // stubbornly close to 3% into mid-2026.
  NO: [
    { year: "2019", indicators: { inflation: 2.2, gdpGrowth: 1.47, unemployment: 3.68, policyRate: 1.50, brentYoY: -10, debtPctGdp: 38.9 } },
    { year: "2020", indicators: { inflation: 1.3, gdpGrowth: -1.36, unemployment: 4.42, policyRate: 0.00, brentYoY: -34, debtPctGdp: 44.4 } },
    { year: "2021", indicators: { inflation: 3.5, gdpGrowth: 4.14, unemployment: 4.36, policyRate: 0.50, brentYoY: 69, debtPctGdp: 40.5 } },
    { year: "2022", indicators: { inflation: 5.8, gdpGrowth: 4.08, unemployment: 3.23, policyRate: 2.75, brentYoY: 42, debtPctGdp: 34.8 } },
    { year: "2023", indicators: { inflation: 5.5, gdpGrowth: 0.35, unemployment: 3.57, policyRate: 4.50, brentYoY: -19, debtPctGdp: 42.4 } },
    { year: "2024", indicators: { inflation: 3.1, gdpGrowth: 1.42, unemployment: 4.00, policyRate: 4.50, brentYoY: -2, debtPctGdp: 52.7 } },
    { year: "2025", indicators: { inflation: 3.1, gdpGrowth: 1.09, unemployment: 4.64, policyRate: 4.00, brentYoY: -8, debtPctGdp: 53.9 } },
    { year: "2026", indicators: { inflation: 3.0, gdpGrowth: 1.09, unemployment: 4.64, policyRate: 4.25, brentYoY: 17.91, debtPctGdp: 53.9 } },
  ],
  // UAE (AE) removed 2026-08-19 — see lib/markets.ts for the reason.
  // Its historical series is preserved in git history if ever needed again.
};
