import type { SourceCadence } from "./sources";
import type { FetchStatus } from "./sources";

// ============================================================
// GULF WATCH — DATA SOURCE REGISTRY
// Sibling to lib/sources.ts, not a widened version of it: SourceEntry's
// `pillar` field is typed strictly to the 5 scoring pillars and
// sourceForPillar() depends on that being exhaustive -- these six
// countries don't have pillars at all, just the honest categories in
// GulfCategory below (four since BIS policy rates were added).
// Single source of truth for the /sources page's Gulf Watch section.
// ============================================================

export type GulfCategory = "cost-of-living" | "investment-confidence" | "currency-stability" | "monetary-policy";

export interface GulfSourceEntry {
  country: string;
  countryCode: string;
  indicator: string;
  category: GulfCategory;
  institution: string;
  license: string;
  status: FetchStatus;
  /** How often the ISSUING INSTITUTION publishes. Audit M-5.
   *
   *  Gulf staleness is the most material on the site -- UAE, Kuwait and
   *  Oman inflation run about 607 days behind, and three current-account
   *  figures about 973 -- and every entry said only "live", which reads
   *  as "current". It means the fetcher succeeded.
   *
   *  Cadence is what the publisher SHOULD produce; the observation date
   *  on each card is what we actually have. Both together are the honest
   *  picture, and neither alone is. */
  cadence?: SourceCadence;
  lastVerified: string;
  note?: string;
  url?: string;
}

export const GULF_NAME_TO_CODE: Record<string, string> = {
  "United Arab Emirates": "AE",
  Bahrain: "BH",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Kuwait: "KW",
  Oman: "OM",
};

export const GULF_SOURCES: GulfSourceEntry[] = [
  // ---------- United Arab Emirates ----------
  { country: "United Arab Emirates", countryCode: "AE", indicator: "Inflation (CPI)", category: "cost-of-living", institution: "International Monetary Fund (CPI dataset)", license: "IMF terms for statistical Data — may be published and distributed with attribution; commercial reuse requires permission from copyright@imf.org", cadence: "quarterly", status: "live", lastVerified: "2026-09-19", note: "Quarterly, from the IMF — the most recent official UAE series that can be read automatically. The IMF posts it well behind: Q4 2025 was the newest in September 2026. The UAE's own statistics centre (FCSC) publishes monthly, but behind Cloudflare bot-protection that is not bypassed. Fetched by the refresh workflow and passed to the site. Source: International Monetary Fund, Consumer Price Index (CPI).", url: "https://data.imf.org/en/datasets/IMF.STA:CPI" },
  { country: "United Arab Emirates", countryCode: "AE", indicator: "Real Estate Activity", category: "investment-confidence", institution: "—", license: "—", status: "unavailable", lastVerified: "2026-08-26", note: "Dubai Land Department's free public tool is CAPTCHA-protected; their API requires a Dubai trade licence and AED 30,000/year." },
  { country: "United Arab Emirates", countryCode: "AE", indicator: "FX Reserves (Import Cover)", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "United Arab Emirates", countryCode: "AE", indicator: "Current Account Balance", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },

  // ---------- Bahrain ----------
  { country: "Bahrain", countryCode: "BH", indicator: "Inflation (CPI)", category: "cost-of-living", institution: "Information & eGovernment Authority (data.gov.bh)", license: "Bahrain Open Government Data License v1.0 — commercial use explicitly permitted", cadence: "monthly", status: "live", lastVerified: "2026-08-26", url: "https://www.data.gov.bh/" },
  { country: "Bahrain", countryCode: "BH", indicator: "Real Estate Activity", category: "investment-confidence", institution: "—", license: "—", status: "unavailable", lastVerified: "2026-08-26", note: "The Survey and Land Registration Bureau has real transaction data, but only via scraping a legacy page, and it isn't covered by the confirmed open-data licence." },
  { country: "Bahrain", countryCode: "BH", indicator: "FX Reserves (Import Cover)", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Bahrain", countryCode: "BH", indicator: "Current Account Balance", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },

  // ---------- Qatar ----------
  { country: "Qatar", countryCode: "QA", indicator: "Inflation (CPI)", category: "cost-of-living", institution: "National Planning Council (data.gov.qa)", license: "CC BY 4.0", cadence: "monthly", status: "live", lastVerified: "2026-08-26", note: "The portal's monthly CPI dataset stopped at the end of 2025 (checked 19 September 2026); the IMF's copy is older still. The National Planning Council still publishes monthly on its own site, whose terms have not yet been checked.", url: "https://www.data.gov.qa/" },
  { country: "Qatar", countryCode: "QA", indicator: "Policy Rate (monetary policy-related)", category: "monetary-policy", institution: "International Monetary Fund (MFS_IR dataset), republishing Qatar Central Bank", license: "IMF terms for statistical Data — may be published and distributed with attribution; commercial reuse requires permission from copyright@imf.org", cadence: "monthly", status: "live", lastVerified: "2026-09-19", note: "Qatar Central Bank's monetary-policy-related rate as the IMF publishes it, monthly. Added 19 September 2026. Source: International Monetary Fund, Monetary and Financial Statistics: Interest Rates (MFS_IR).", url: "https://data.imf.org/en/datasets/IMF.STA:MFS_IR" },
  { country: "Qatar", countryCode: "QA", indicator: "Real Estate Activity", category: "investment-confidence", institution: "Ministry of Justice (data.gov.qa)", license: "CC BY 4.0", cadence: "monthly", status: "live", lastVerified: "2026-08-26", note: "Monthly registered property transaction count, aggregated from individual sale records.", url: "https://www.data.gov.qa/" },
  { country: "Qatar", countryCode: "QA", indicator: "FX Reserves (Import Cover)", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Qatar", countryCode: "QA", indicator: "Current Account Balance", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },

  // ---------- Saudi Arabia ----------
  { country: "Saudi Arabia", countryCode: "SA", indicator: "Inflation (CPI)", category: "cost-of-living", institution: "Ministry of Economy & Planning (Data Saudi), republishing GASTAT", license: "No explicit restriction found; robots.txt allows automated access. Written confirmation requested, not yet received.", cadence: "monthly", status: "live", lastVerified: "2026-08-26", note: "GASTAT's own site is PDF/Excel-only with unpredictable URLs; their API portal requires Nafath/Iqama registration. Treated like Bank of Japan's rate: fine for non-commercial use now, must be resolved before monetizing.", url: "https://datasaudi.sa/" },
  { country: "Saudi Arabia", countryCode: "SA", indicator: "Real Estate Activity", category: "investment-confidence", institution: "—", license: "—", status: "unavailable", lastVerified: "2026-08-26", note: "KAPSARC republishes the official REGA index via a free API, but their Terms of Use explicitly prohibit automated access without written permission — contradicts the dataset's own \"Public Domain\" tag. Not used until that's resolved." },
  { country: "Saudi Arabia", countryCode: "SA", indicator: "FX Reserves (Import Cover)", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Saudi Arabia", countryCode: "SA", indicator: "Current Account Balance", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Saudi Arabia", countryCode: "SA", indicator: "Policy Rate (official market repo rate)", category: "monetary-policy", institution: "Bank for International Settlements, republishing the Saudi Arabian Monetary Authority", license: "BIS Terms of permitted use — use is unrestricted provided BIS is cited as the source; commercial use permitted provided inclusion results in no additional charge to subscribers", cadence: "daily", status: "live", lastVerified: "2026-08-28", note: "SAMA's own site is bot-protected, so the rate is taken from BIS's daily central bank policy rate series (WS_CBPOL), which names SAMA as the originating authority.", url: "https://data.bis.org/topics/CBPOL" },

  // ---------- Kuwait ----------
  { country: "Kuwait", countryCode: "KW", indicator: "Inflation (CPI)", category: "cost-of-living", institution: "International Monetary Fund (CPI dataset)", license: "IMF terms for statistical Data — may be published and distributed with attribution; commercial reuse requires permission from copyright@imf.org", cadence: "monthly", status: "live", lastVerified: "2026-09-19", note: "Monthly, from the IMF (was the World Bank's annual figure). The IMF has shipped a literal 0 as Kuwait's newest month before — a placeholder, not a rate — so an exact zero is never published. Source: International Monetary Fund, Consumer Price Index (CPI).", url: "https://data.imf.org/en/datasets/IMF.STA:CPI" },
  { country: "Kuwait", countryCode: "KW", indicator: "Real Estate Activity", category: "investment-confidence", institution: "—", license: "—", status: "unavailable", lastVerified: "2026-08-26", note: "No public data source found." },
  { country: "Kuwait", countryCode: "KW", indicator: "FX Reserves (Import Cover)", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Kuwait", countryCode: "KW", indicator: "Current Account Balance", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Kuwait", countryCode: "KW", indicator: "Policy Rate (discount rate)", category: "monetary-policy", institution: "Bank for International Settlements, republishing the Central Bank of Kuwait", license: "BIS Terms of permitted use — use is unrestricted provided BIS is cited as the source; commercial use permitted provided inclusion results in no additional charge to subscribers", cadence: "daily", status: "live", lastVerified: "2026-08-28", note: "From BIS's daily central bank policy rate series (WS_CBPOL), which names the Central Bank of Kuwait as the originating authority.", url: "https://data.bis.org/topics/CBPOL" },

  // ---------- Oman ----------
  { country: "Oman", countryCode: "OM", indicator: "Inflation (CPI)", category: "cost-of-living", institution: "International Monetary Fund (CPI dataset)", license: "IMF terms for statistical Data — may be published and distributed with attribution; commercial reuse requires permission from copyright@imf.org", cadence: "monthly", status: "live", lastVerified: "2026-09-19", note: "Monthly, from the IMF (was the World Bank's annual figure). Source: International Monetary Fund, Consumer Price Index (CPI).", url: "https://data.imf.org/en/datasets/IMF.STA:CPI" },
  { country: "Oman", countryCode: "OM", indicator: "Real Estate Activity", category: "investment-confidence", institution: "—", license: "—", status: "unavailable", lastVerified: "2026-08-26", note: "Not yet researched." },
  { country: "Oman", countryCode: "OM", indicator: "FX Reserves (Import Cover)", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
  { country: "Oman", countryCode: "OM", indicator: "Current Account Balance", category: "currency-stability", institution: "World Bank", license: "CC BY 4.0", cadence: "annual", status: "live", lastVerified: "2026-08-26", url: "https://data.worldbank.org/" },
];

export function gulfSourcesForCountry(countryName: string): GulfSourceEntry[] {
  return GULF_SOURCES.filter((s) => s.country === countryName);
}
