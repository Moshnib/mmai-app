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
  { market: "United States", indicator: "GDP Growth", pillar: "GM", institution: "U.S. Bureau of Economic Analysis", license: "Public domain — U.S. federal government work", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — Power BI Connection Guide, Step 3" },

  // ---------- Euro Area ----------
  { market: "Euro Area", indicator: "Inflation (HICP)", pillar: "PS", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — Guide, Step 5" },
  { market: "Euro Area", indicator: "GDP Growth", pillar: "GM", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — Guide, Step 5" },
  { market: "Euro Area", indicator: "Unemployment", pillar: "LM", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "manual", lastVerified: "2026-08-14", note: "Endpoint returns empty for current query — needs a parameter fix before wiring" },
  { market: "Euro Area", indicator: "Policy Rate (Deposit Facility)", pillar: "MC", institution: "European Central Bank", license: "Free access and reuse policy for published statistics", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — Guide, Step 6" },

  // ---------- Canada ----------
  { market: "Canada", indicator: "Inflation (CPI)", pillar: "PS", institution: "Statistics Canada", license: "Open Licence — explicit right to publish, distribute, sell", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — Guide, Step 7" },
  { market: "Canada", indicator: "GDP Growth", pillar: "GM", institution: "Statistics Canada / World Bank", license: "Open Licence / CC BY 4.0", status: "manual", lastVerified: "2026-08-14" },
  { market: "Canada", indicator: "Unemployment", pillar: "LM", institution: "Statistics Canada / World Bank", license: "Open Licence / CC BY 4.0", status: "manual", lastVerified: "2026-08-14" },
  { market: "Canada", indicator: "Policy Rate (Overnight Target)", pillar: "MC", institution: "Bank of Canada", license: "No key required — standard terms of use", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — Guide, Step 8" },

  // ---------- United Kingdom ----------
  { market: "United Kingdom", indicator: "Inflation (CPI)", pillar: "PS", institution: "UK Office for National Statistics", license: "Open Government Licence v3.0 — no permission required, commercial use explicit", status: "manual", lastVerified: "2026-08-18", note: "Fetcher not yet wired — Guide, Step 9" },
  { market: "United Kingdom", indicator: "GDP Growth", pillar: "GM", institution: "UK Office for National Statistics", license: "Open Government Licence v3.0", status: "manual", lastVerified: "2026-08-18" },
  { market: "United Kingdom", indicator: "Unemployment", pillar: "LM", institution: "UK Office for National Statistics", license: "Open Government Licence v3.0", status: "manual", lastVerified: "2026-08-18" },
  { market: "United Kingdom", indicator: "Policy Rate (Bank Rate)", pillar: "MC", institution: "Bank of England", license: "Open Government Licence v3.0", status: "manual", lastVerified: "2026-08-18", note: "Fetcher not yet wired — Guide, Step 10" },

  // ---------- Japan ----------
  { market: "Japan", indicator: "Inflation (CPI, OECD series via FRED)", pillar: "PS", institution: "OECD (distributed via FRED)", license: "CC BY 4.0 — commercial use explicit, attribution required", status: "live", lastVerified: "2026-08-21" },
  { market: "Japan", indicator: "GDP Growth", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21" },
  { market: "Japan", indicator: "Unemployment (OECD series via FRED)", pillar: "LM", institution: "OECD (distributed via FRED)", license: "CC BY 4.0 — commercial use explicit, attribution required", status: "live", lastVerified: "2026-08-21" },
  { market: "Japan", indicator: "Policy Rate (Uncollateralized Overnight Call Rate)", pillar: "MC", institution: "Bank of Japan", license: "Publicly available statistical data — BOJ is a special corporation, not a government agency, but data is free for public use", status: "live", lastVerified: "2026-08-21" },

  // ---------- Shared across all markets ----------
  { market: "All markets", indicator: "Brent Crude (External & Commodities pillar)", pillar: "EC", institution: "U.S. Energy Information Administration", license: "Public domain — citation requested", status: "manual", lastVerified: "2026-08-14", note: "Fetcher not yet wired — same pattern as bls.ts/fred.ts" },
];

export function sourcesForMarket(marketName: string): SourceEntry[] {
  return SOURCES.filter((s) => s.market === marketName || s.market === "All markets");
}

export function sourceForPillar(marketName: string, pillar: "PS" | "GM" | "LM" | "MC" | "EC"): SourceEntry | undefined {
  return sourcesForMarket(marketName).find((s) => s.pillar === pillar);
}
