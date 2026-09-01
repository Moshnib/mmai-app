// ============================================================
// DATA SOURCE REGISTRY
// One entry per (market, indicator) pair actually used in the app.
// This is the single source of truth for the /sources page, and is
// deliberately kept separate from lib/markets.ts so a licensing or
// freshness change never requires touching the scoring logic.
// ============================================================

// "unavailable" is for Gulf Watch: a country with no source at all for an
// indicator (e.g. Kuwait's real estate). Labeling that "manual" would be a
// false statement -- "manual" means a human-verified figure exists; here,
// none does.
export type FetchStatus = "live" | "manual" | "unavailable";

/** How often the ISSUING INSTITUTION publishes a new figure.
 *
 *  Separate from `status`, and added 2026-09-01 for audit finding M-5.
 *  Every entry in this registry carried status "live", which a reader
 *  reasonably takes to mean "current". It does not -- it means the fetcher
 *  succeeded. A World Bank annual series fetched successfully today is
 *  WORKING, not CURRENT, and the two were being reported with one word.
 *
 *  Showing cadence alongside status lets a reader see that a figure
 *  updating once a year is doing exactly what it should. */
export type SourceCadence = "daily" | "monthly" | "quarterly" | "annual" | "per decision";

export interface SourceEntry {
  market: string;
  indicator: string;
  /** Verified from each fetcher own request, not assumed. */
  cadence: SourceCadence;
  pillar: "PS" | "GM" | "LM" | "MC" | "EC";
  institution: string;
  license: string;
  status: FetchStatus;
  /** INTERNAL / maintenance only -- deliberately not shown on the public
   *  Sources page. This is the date a human last re-read the institution's
   *  licence terms, so it only moves when someone actually does that. On a
   *  public page it reads as staleness ("why does this say August?") when it
   *  is really a record of legal review. Visitors see the live data-refresh
   *  time instead; see components/SourcesTable.tsx. */
  lastVerified: string;
  note?: string;
  /** The institution's own public page for this series. The whole premise of
   *  this page is "check our work" -- without a link, a reader who wants to
   *  verify a figure has to go find the agency themselves. Points at the
   *  human-readable landing page, not the raw API endpoint. */
  url?: string;
}

export const SOURCES: SourceEntry[] = [
  // ---------- United States ----------
  { market: "United States", indicator: "Inflation (headline PCE)", cadence: "monthly", pillar: "PS", institution: "U.S. Bureau of Economic Analysis", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-31", note: "The Fed states its 2% objective on the PCE price index, so PCE is what MMAI scores for the US. BLS CPI is retained as an automatic fallback if BEA is unavailable.", url: "https://www.bea.gov/data/personal-consumption-expenditures-price-index" },
  { market: "United States", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "U.S. Bureau of Labor Statistics", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-19" , url: "https://www.bls.gov/cps/" },
  { market: "United States", indicator: "Policy Rate (Effective Federal Funds Rate)", cadence: "daily", pillar: "MC", institution: "Federal Reserve Bank of New York", license: "NY Fed Terms of Use — free to use, store, and distribute for personal or business purposes, with a required reference-rate notice", status: "live", lastVerified: "2026-08-22", note: "The Effective Federal Funds Rate (EFFR) is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the EFFR by MMAI, does not sanction or endorse any particular republication, and has no liability for your use." , url: "https://www.newyorkfed.org/markets/reference-rates/effr" },
  { market: "United States", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "U.S. Bureau of Economic Analysis", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-22" , url: "https://www.bea.gov/data/gdp/gross-domestic-product" },

  // ---------- Euro Area ----------
  { market: "Euro Area", indicator: "Inflation (HICP)", cadence: "monthly", pillar: "PS", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21" , url: "https://ec.europa.eu/eurostat" },
  { market: "Euro Area", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" , url: "https://ec.europa.eu/eurostat" },
  { market: "Euro Area", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21", note: "Published monthly across the euro area" , url: "https://ec.europa.eu/eurostat" },
  { market: "Euro Area", indicator: "Policy Rate (Deposit Facility)", cadence: "per decision", pillar: "MC", institution: "European Central Bank", license: "Free access and reuse policy for published statistics", status: "live", lastVerified: "2026-08-21" , url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },

  // ---------- Canada ----------
  { market: "Canada", indicator: "Inflation (CPI)", cadence: "monthly", pillar: "PS", institution: "Statistics Canada", license: "Open Licence — explicit right to publish, distribute, sell", status: "live", lastVerified: "2026-08-21" , url: "https://www.statcan.gc.ca/" },
  { market: "Canada", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Statistics Canada", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" , url: "https://data.worldbank.org/" },
  { market: "Canada", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Statistics Canada", license: "Open Licence — explicit right to publish, distribute, sell", status: "live", lastVerified: "2026-08-28", note: "Labour Force Survey, monthly, seasonally adjusted (table 14-10-0287-01)" , url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701" },
  { market: "Canada", indicator: "Policy Rate (Overnight Target)", cadence: "per decision", pillar: "MC", institution: "Bank of Canada", license: "Bank of Canada Terms of Use — free to use, copy, and distribute, with attribution", status: "live", lastVerified: "2026-08-22" , url: "https://www.bankofcanada.ca/rates/interest-rates/canadian-interest-rates/" },

  // ---------- United Kingdom ----------
  { market: "United Kingdom", indicator: "Inflation (CPI)", cadence: "monthly", pillar: "PS", institution: "UK Office for National Statistics", license: "Open Government Licence v3.0 — no permission required, commercial use explicit", status: "live", lastVerified: "2026-08-21" , url: "https://www.ons.gov.uk/economy/inflationandpriceindices" },
  { market: "United Kingdom", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "UK Office for National Statistics", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" , url: "https://data.worldbank.org/" },
  { market: "United Kingdom", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "UK Office for National Statistics", license: "Open Government Licence v3.0 — no permission required, commercial use explicit", status: "live", lastVerified: "2026-08-28", note: "Series MGSX, aged 16+, seasonally adjusted. A rolling three-month average stamped with its middle month — the UK's own headline measure" , url: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment" },
  { market: "United Kingdom", indicator: "Policy Rate (Bank Rate)", cadence: "per decision", pillar: "MC", institution: "Bank of England", license: "Open Government Licence v3.0", status: "live", lastVerified: "2026-08-21" , url: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp" },

  // ---------- Japan ----------
  { market: "Japan", indicator: "Inflation (CPI)", cadence: "annual", pillar: "PS", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-22", note: "Annual figure, updates once a year" , url: "https://data.worldbank.org/" },
  { market: "Japan", indicator: "GDP Growth", cadence: "annual", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" , url: "https://data.worldbank.org/" },
  { market: "Japan", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "OECD (republishing Japan's Statistics Bureau)", license: "CC BY 4.0 — OECD default licence, commercial use explicit", status: "live", lastVerified: "2026-08-28", note: "Monthly, seasonally adjusted, 15+. Via OECD because Japan's own e-Stat API requires a registered key — the other markets use their national statistics office directly" , url: "https://data-explorer.oecd.org/" },
  { market: "Japan", indicator: "Policy Rate (Uncollateralized Overnight Call Rate)", cadence: "per decision", pillar: "MC", institution: "Bank of Japan", license: "Free for non-commercial use with attribution to the Bank of Japan", status: "live", lastVerified: "2026-08-22", note: "Commercial use requires separate permission from the Bank of Japan's Public Relations Department — must be requested before this site is ever monetized" , url: "https://www.boj.or.jp/en/statistics/index.htm" },

  // ---------- Australia ----------
  { market: "Australia", indicator: "Inflation (CPI)", cadence: "monthly", pillar: "PS", institution: "Australian Bureau of Statistics", license: "CC BY 4.0 — confirmed directly on ABS's own copyright page", status: "live", lastVerified: "2026-08-21" , url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation" },
  { market: "Australia", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Australian Bureau of Statistics", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" , url: "https://data.worldbank.org/" },
  { market: "Australia", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Australian Bureau of Statistics", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-28", note: "Labour Force survey, monthly, seasonally adjusted, 15+" , url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia" },
  { market: "Australia", indicator: "Cash Rate Target", cadence: "per decision", pillar: "MC", institution: "Reserve Bank of Australia", license: "RBA Copyright and Disclaimer Notice — free for personal and commercial use with attribution (a separate clause from RBA's general CC BY 4.0, since the Cash Rate is specifically excluded from that license)", status: "live", lastVerified: "2026-08-22" , url: "https://www.rba.gov.au/statistics/cash-rate/" },

  // ---------- Norway ----------
  { market: "Norway", indicator: "Inflation (CPI, 12-month rate)", cadence: "monthly", pillar: "PS", institution: "Statistics Norway (SSB)", license: "CC BY 4.0 — confirmed directly on SSB's own API documentation", status: "live", lastVerified: "2026-08-21" , url: "https://www.ssb.no/en/priser-og-prisindekser/konsumpriser/statistikk/konsumprisindeksen" },
  { market: "Norway", indicator: "GDP Growth", cadence: "annual", pillar: "GM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Annual figure, updates once a year" , url: "https://data.worldbank.org/" },
  { market: "Norway", indicator: "Unemployment", cadence: "annual", pillar: "LM", institution: "World Bank", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "ILO modelled annual estimate, not SSB's own monthly rate — updates once a year" , url: "https://data.worldbank.org/" },
  { market: "Norway", indicator: "Policy Rate (Key Policy Rate)", cadence: "per decision", pillar: "MC", institution: "Norges Bank", license: "Unresolved — Norges Bank's own terms require quoting them as source, but do not explicitly confirm commercial use is permitted", status: "live", lastVerified: "2026-08-22", note: "Norway's national data catalog separately tags this dataset under an open license that would permit commercial use, but Norges Bank has not confirmed this on their own site — awaiting written confirmation from Norges Bank directly" , url: "https://www.norges-bank.no/en/topics/Monetary-policy/Policy-rate/" },

  // ---------- Shared across all markets ----------
  { market: "All markets", indicator: "Brent Crude (External & Commodities pillar)", cadence: "daily", pillar: "EC", institution: "U.S. Energy Information Administration", license: "Public domain — citation requested", status: "live", lastVerified: "2026-08-22", note: "This is a single global oil price, so the same figure is used for every market" , url: "https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" },
];

export function sourcesForMarket(marketName: string): SourceEntry[] {
  return SOURCES.filter((s) => s.market === marketName || s.market === "All markets");
}

export function sourceForPillar(marketName: string, pillar: "PS" | "GM" | "LM" | "MC" | "EC"): SourceEntry | undefined {
  return sourcesForMarket(marketName).find((s) => s.pillar === pillar);
}
