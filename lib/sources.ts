// ============================================================
// DATA SOURCE REGISTRY
// One entry per (market, indicator) pair actually used in the app.
// This is the single source of truth for the /sources page, and is
// deliberately kept separate from lib/markets.ts so a licensing or
// freshness change never requires touching the scoring logic.
// ============================================================

export type FetchStatus = "live" | "manual";

export interface SourceEntry {
  market: string;
  indicator: string;
  pillar: "PS" | "GM" | "LM" | "MC" | "EC";
  institution: string;
  license: string;
  status: FetchStatus;
  lastVerified: string; // date the URL/license was last actually checked, not just written
  note?: string;
}

export const SOURCES: SourceEntry[] = [
  // ---------- United States ----------
  { market: "United States", indicator: "Inflation (CPI)", pillar: "PS", institution: "U.S. Bureau of Labor Statistics", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-19" },
  { market: "United States", indicator: "Unemployment", pillar: "LM", institution: "U.S. Bureau of Labor Statistics", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-19" },
  { market: "United States", indicator: "Policy Rate (Fed Funds)", pillar: "MC", institution: "Federal Reserve (via FRED)", license: "Public domain — the Federal Reserve is the data owner", status: "live", lastVerified: "2026-08-19" },
  { market: "United States", indicator: "GDP Growth", pillar: "GM", institution: "U.S. Bureau of Economic Analysis", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-22" },

  // ---------- Euro Area ----------
  { market: "Euro Area", indicator: "Inflation (HICP)", pillar: "PS", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21" },
  { market: "Euro Area", indicator: "GDP Growth", pillar: "GM", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" },
  { market: "Euro Area", indicator: "Unemployment", pillar: "LM", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21", note: "Published monthly across the euro area" },
  { market: "Euro Area", indicator: "Policy Rate (Deposit Facility)", pillar: "MC", institution: "European Central Bank", license: "Free access and reuse policy for published statistics", status: "live", lastVerified: "2026-08-21" },

  // ---------- Canada ----------
  { market: "Canada", indicator: "Inflation (CPI)", pillar: "PS", institution: "Statistics Canada", license: "Open Licence — explicit right to publish, distribute, sell", status: "live", lastVerified: "2026-08-21" },
  { market: "Canada", indicator: "GDP Growth", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" },
  { market: "Canada", indicator: "Unemployment", pillar: "LM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "ILO modelled annual estimate, not Statistics Canada's own monthly rate — updates once a year" },
  { market: "Canada", indicator: "Policy Rate (Overnight Target)", pillar: "MC", institution: "Bank of Canada", license: "No key required — standard terms of use", status: "live", lastVerified: "2026-08-21" },

  // ---------- United Kingdom ----------
  { market: "United Kingdom", indicator: "Inflation (CPI)", pillar: "PS", institution: "UK Office for National Statistics", license: "Open Government Licence v3.0 — no permission required, commercial use explicit", status: "live", lastVerified: "2026-08-21" },
  { market: "United Kingdom", indicator: "GDP Growth", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" },
  { market: "United Kingdom", indicator: "Unemployment", pillar: "LM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "ILO modelled annual estimate, not ONS's own headline rate — updates once a year" },
  { market: "United Kingdom", indicator: "Policy Rate (Bank Rate)", pillar: "MC", institution: "Bank of England", license: "Open Government Licence v3.0", status: "live", lastVerified: "2026-08-21" },

  // ---------- Japan ----------
  { market: "Japan", indicator: "Inflation (CPI, OECD series via FRED)", pillar: "PS", institution: "OECD (distributed via FRED)", license: "CC BY 4.0 — commercial use explicit, attribution required", status: "live", lastVerified: "2026-08-21" },
  { market: "Japan", indicator: "GDP Growth", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21" },
  { market: "Japan", indicator: "Unemployment (OECD series via FRED)", pillar: "LM", institution: "OECD (distributed via FRED)", license: "CC BY 4.0 — commercial use explicit, attribution required", status: "live", lastVerified: "2026-08-21" },
  { market: "Japan", indicator: "Policy Rate (Uncollateralized Overnight Call Rate)", pillar: "MC", institution: "Bank of Japan", license: "Publicly available statistical data — BOJ is a special corporation, not a government agency, but data is free for public use", status: "live", lastVerified: "2026-08-21" },

  // ---------- Australia ----------
  { market: "Australia", indicator: "Inflation (CPI)", pillar: "PS", institution: "Australian Bureau of Statistics", license: "CC BY 4.0 — confirmed directly on ABS's own copyright page", status: "live", lastVerified: "2026-08-21" },
  { market: "Australia", indicator: "GDP Growth", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21" },
  { market: "Australia", indicator: "Unemployment", pillar: "LM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21" },
  { market: "Australia", indicator: "Cash Rate Target", pillar: "MC", institution: "Reserve Bank of Australia", license: "CC BY 4.0 — confirmed directly on RBA's own copyright page", status: "live", lastVerified: "2026-08-21" },

  // ---------- Norway ----------
  { market: "Norway", indicator: "Inflation (CPI, 12-month rate)", pillar: "PS", institution: "Statistics Norway (SSB)", license: "CC BY 4.0 — confirmed directly on SSB's own API documentation", status: "live", lastVerified: "2026-08-21" },
  { market: "Norway", indicator: "GDP Growth", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" },
  { market: "Norway", indicator: "Unemployment", pillar: "LM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "ILO modelled annual estimate, not SSB's own monthly rate — updates once a year" },
  { market: "Norway", indicator: "Policy Rate (Key Policy Rate)", pillar: "MC", institution: "Norges Bank", license: "Governed by Norway's national open-government-data framework (NLOD)", status: "live", lastVerified: "2026-08-21", note: "Published under Norway's national open-data policy" },

  // ---------- Shared across all markets ----------
  { market: "All markets", indicator: "Brent Crude (External & Commodities pillar)", pillar: "EC", institution: "U.S. Energy Information Administration", license: "Public domain — citation requested", status: "live", lastVerified: "2026-08-22", note: "This is a single global oil price, so the same figure is used for every market" },
];

export function sourcesForMarket(marketName: string): SourceEntry[] {
  return SOURCES.filter((s) => s.market === marketName || s.market === "All markets");
}

export function sourceForPillar(marketName: string, pillar: "PS" | "GM" | "LM" | "MC" | "EC"): SourceEntry | undefined {
  return sourcesForMarket(marketName).find((s) => s.pillar === pillar);
}
