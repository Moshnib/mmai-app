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
  /** Overrides the default maximum age for this source only, in days.
   *
   *  Cadence describes how often an institution publishes; it does NOT
   *  describe how far behind it publishes, and those differ a lot. Set
   *  this only when a source is legitimately slower than others of the
   *  same cadence, and say why in `note` -- see lib/freshness.ts. */
  maxAgeDays?: number;
  /** Which pillar this source scores, if any.
   *
   *  OPTIONAL since 2026-09-01. Brent crude is still fetched and still
   *  shown in the weekly feed, but stopped being a scored pillar when
   *  Fiscal Resilience replaced External & Commodities. Forcing a pillar
   *  on it would have meant either deleting a source the app really uses
   *  or filing it under a pillar it does not feed -- both worse than
   *  saying plainly that it scores nothing. */
  pillar?: "PS" | "GM" | "LM" | "MC" | "FR";
  institution: string;
  /** How this institution is named in the provenance line stored on every
   *  row. Short because those lines concatenate several of them.
   *
   *  Required on every LIVE entry -- scripts/verify-sources.ts enforces it,
   *  because the provenance line is now GENERATED from this registry rather
   *  than written by hand. It used to be hand-written in
   *  app/api/refresh/route.ts and drifted badly: four markets credited the
   *  World Bank for figures that came from Statistics Canada, the ONS, the
   *  ABS and e-Stat, and stayed wrong for weeks on the page whose entire
   *  purpose is letting a reader check the work. */
  shortName?: string;
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
  { market: "United States", indicator: "Inflation (headline PCE)", cadence: "monthly", pillar: "PS", institution: "U.S. Bureau of Economic Analysis", shortName: "BEA", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-31", note: "The Fed states its 2% objective on the PCE price index, so PCE is what MMAI scores for the US. BLS CPI is retained as an automatic fallback if BEA is unavailable.", url: "https://www.bea.gov/data/personal-consumption-expenditures-price-index" },
  { market: "United States", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "U.S. Bureau of Labor Statistics", shortName: "BLS", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-19" , url: "https://www.bls.gov/cps/" },
  { market: "United States", indicator: "Policy Rate (Effective Federal Funds Rate)", cadence: "daily", pillar: "MC", institution: "Federal Reserve Bank of New York", shortName: "New York Fed", license: "NY Fed Terms of Use — free to use, store, and distribute for personal or business purposes, with a required reference-rate notice", status: "live", lastVerified: "2026-08-22", note: "The Effective Federal Funds Rate (EFFR) is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the EFFR by MMAI, does not sanction or endorse any particular republication, and has no liability for your use." , url: "https://www.newyorkfed.org/markets/reference-rates/effr" },
  { market: "United States", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "U.S. Bureau of Economic Analysis", shortName: "BEA", license: "Public domain — U.S. federal government work", status: "live", lastVerified: "2026-08-22" , url: "https://www.bea.gov/data/gdp/gross-domestic-product" },

  // ---------- Euro Area ----------
  { market: "Euro Area", indicator: "Inflation (HICP)", cadence: "monthly", pillar: "PS", institution: "European Central Bank", shortName: "ECB", license: "Free access and reuse policy for published statistics", status: "live", lastVerified: "2026-09-02", note: "Moved from Eurostat to the ECB on 2 September 2026. Eurostat retired its prc_hicp_manr dataset on 4 February 2026 when the euro area HICP methodology changed, and it stopped gaining new months without ever returning an error — so this figure was nine months out of date before it was caught. The ECB series is the current one." , url: "https://data.ecb.europa.eu/" },
  { market: "Euro Area", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Eurostat", shortName: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21", note: "Chain-linked volumes, percentage change on the same quarter of the previous year (namq_10_gdp)" , url: "https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table" },
  { market: "Euro Area", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Eurostat", shortName: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-08-21", note: "Published monthly across the euro area" , url: "https://ec.europa.eu/eurostat" },
  { market: "Euro Area", indicator: "Policy Rate (Deposit Facility)", cadence: "per decision", pillar: "MC", institution: "European Central Bank", shortName: "ECB", license: "Free access and reuse policy for published statistics", status: "live", lastVerified: "2026-08-21" , url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },

  // ---------- Canada ----------
  { market: "Canada", indicator: "Inflation (CPI)", cadence: "monthly", pillar: "PS", institution: "Statistics Canada", shortName: "Statistics Canada", license: "Open Licence — explicit right to publish, distribute, sell", status: "live", lastVerified: "2026-08-21" , url: "https://www.statcan.gc.ca/" },
  { market: "Canada", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Statistics Canada", shortName: "Statistics Canada", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Computed year-over-year from monthly GDP levels, vector 62305752 — StatCan's own headline is annualised, which is a different measure" , url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610043401" },
  { market: "Canada", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Statistics Canada", shortName: "Statistics Canada", license: "Open Licence — explicit right to publish, distribute, sell", status: "live", lastVerified: "2026-08-28", note: "Labour Force Survey, monthly, seasonally adjusted (table 14-10-0287-01)" , url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701" },
  { market: "Canada", indicator: "Policy Rate (Overnight Target)", cadence: "per decision", pillar: "MC", institution: "Bank of Canada", shortName: "Bank of Canada", license: "Bank of Canada Terms of Use — free to use, copy, and distribute, with attribution", status: "live", lastVerified: "2026-08-22" , url: "https://www.bankofcanada.ca/rates/interest-rates/canadian-interest-rates/" },

  // ---------- United Kingdom ----------
  { market: "United Kingdom", indicator: "Inflation (CPI)", cadence: "monthly", pillar: "PS", institution: "UK Office for National Statistics", shortName: "ONS", license: "Open Government Licence v3.0 — no permission required, commercial use explicit", status: "live", lastVerified: "2026-08-21" , url: "https://www.ons.gov.uk/economy/inflationandpriceindices" },
  { market: "United Kingdom", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "UK Office for National Statistics", shortName: "ONS", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Series IHYR, quarter on the same quarter a year earlier — NOT the headline IHYQ, which compares to the previous quarter" , url: "https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ihyr/qna" },
  { market: "United Kingdom", indicator: "Unemployment", cadence: "monthly", maxAgeDays: 170, pillar: "LM", institution: "UK Office for National Statistics", shortName: "ONS", license: "Open Government Licence v3.0 — no permission required, commercial use explicit", status: "live", lastVerified: "2026-08-28", note: "Series MGSX, aged 16+, seasonally adjusted. A rolling three-month average stamped with its middle month — the UK's own headline measure — ONS labour-market data runs about four months behind: verified 2026-09-02, series MGSX ended at 2026 MAY. maxAgeDays is set to 170 for that reason, NOT because monthly staleness is tolerated generally." , url: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment" },
  { market: "United Kingdom", indicator: "Policy Rate (Bank Rate)", cadence: "per decision", pillar: "MC", institution: "Bank of England", shortName: "Bank of England", license: "Open Government Licence v3.0", status: "live", lastVerified: "2026-08-21" , url: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp" },

  // ---------- Japan ----------
  { market: "Japan", indicator: "Inflation (CPI, all items)", cadence: "monthly", pillar: "PS", institution: "Statistics Bureau of Japan (via e-Stat)", shortName: "e-Stat", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-22", note: "Table 0003427113, year-over-year change, all items, national (not the Tokyo ku-area series)" , url: "https://www.e-stat.go.jp/en/stat-search/files?tstat=000001150147" },
  { market: "Japan", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Cabinet Office of Japan (via e-Stat)", shortName: "e-Stat", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "Table 0003109750, real, seasonally adjusted. Linked to the National Accounts survey page (statistics code 00100409): the previous per-table link 404d, and e-Stat table URLs do not survive a rebase" , url: "https://www.e-stat.go.jp/en/statistics/00100409" },
  { market: "Japan", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "OECD (republishing Japan's Statistics Bureau)", shortName: "OECD", license: "CC BY 4.0 — OECD default licence, commercial use explicit", status: "live", lastVerified: "2026-08-28", note: "Monthly, seasonally adjusted, 15+. Via OECD because Japan's own e-Stat API requires a registered key — the other markets use their national statistics office directly" , url: "https://data-explorer.oecd.org/" },
  { market: "Japan", indicator: "Policy Rate (Uncollateralized Overnight Call Rate)", cadence: "per decision", pillar: "MC", institution: "Bank of Japan", shortName: "Bank of Japan", license: "Free for non-commercial use with attribution to the Bank of Japan", status: "live", lastVerified: "2026-08-22", note: "Commercial use requires separate permission from the Bank of Japan's Public Relations Department — must be requested before this site is ever monetized" , url: "https://www.boj.or.jp/en/statistics/index.htm" },

  // ---------- Australia ----------
  { market: "Australia", indicator: "Inflation (CPI)", cadence: "monthly", pillar: "PS", institution: "Australian Bureau of Statistics", shortName: "ABS", license: "CC BY 4.0 — confirmed directly on ABS's own copyright page", status: "live", lastVerified: "2026-08-21" , url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation" },
  { market: "Australia", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Australian Bureau of Statistics", shortName: "ABS", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-21", note: "ANA_AGG M1.GPM.20.AUS.Q — chain volume measures, not the M4 current-price series" , url: "https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product" },
  { market: "Australia", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Australian Bureau of Statistics", shortName: "ABS", license: "CC BY 4.0", status: "live", lastVerified: "2026-08-28", note: "Labour Force survey, monthly, seasonally adjusted, 15+" , url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia" },
  { market: "Australia", indicator: "Cash Rate Target", cadence: "per decision", pillar: "MC", institution: "Reserve Bank of Australia", shortName: "RBA", license: "RBA Copyright and Disclaimer Notice — free for personal and commercial use with attribution (a separate clause from RBA's general CC BY 4.0, since the Cash Rate is specifically excluded from that license)", status: "live", lastVerified: "2026-08-22" , url: "https://www.rba.gov.au/statistics/cash-rate/" },

  // ---------- Sweden ----------
  // Added 2026-09-12. Every figure verified against the live API before
  // wiring (scripts/verify-sweden-fetch.ts), per this project's rule.
  { market: "Sweden", indicator: "Inflation (CPIF, annual change)", cadence: "monthly", pillar: "PS", institution: "Statistics Sweden (SCB)", shortName: "Statistics Sweden", license: "CC0 via the open-data API — SCB: data \"may be used and disseminated ... without any requirement to state the source\". CC BY 4.0 for statistics taken from the website. No registration, no key, no prior permission, free of charge. MMAI attributes anyway.", status: "live", lastVerified: "2026-09-12", note: "CPIF, not CPI — the Riksbank's formal target variable since 2017. CPIF is the same basket with mortgage-rate effects removed; CPI falls when the Riksbank cuts, so scoring distance from the 2% target on CPI would read the policy rather than the inflation. Measured at wiring: CPI 0.2%, CPIF 0.7%. SCB publishes the year-over-year rate itself, so nothing is computed from an index here.", url: "https://www.scb.se/en/finding-statistics/statistics-by-subject-area/prices-and-economic-trends/price-statistics/consumer-price-index-cpi/" },
  { market: "Sweden", indicator: "Unemployment (LFS, seasonally adjusted)", cadence: "monthly", pillar: "LM", institution: "Statistics Sweden (SCB)", shortName: "Statistics Sweden", license: "CC0 via the open-data API — SCB: data \"may be used and disseminated ... without any requirement to state the source\". CC BY 4.0 for statistics taken from the website. No registration, no key, no prior permission, free of charge. MMAI attributes anyway.", status: "live", lastVerified: "2026-09-12", note: "Labour force survey, ages 15-74, seasonally adjusted rate (labour status ALÖSP).", url: "https://www.scb.se/en/finding-statistics/statistics-by-subject-area/labour-market/labour-force-supply/labour-force-surveys-lfs/" },
  { market: "Sweden", indicator: "GDP Growth (quarterly, YoY)", cadence: "quarterly", pillar: "GM", institution: "Statistics Sweden (SCB)", shortName: "Statistics Sweden", license: "CC0 via the open-data API — SCB: data \"may be used and disseminated ... without any requirement to state the source\". CC BY 4.0 for statistics taken from the website. No registration, no key, no prior permission, free of charge. MMAI attributes anyway.", status: "live", lastVerified: "2026-09-12", note: "Production approach, working-day adjusted volume change on the same quarter a year earlier (NR0103DH) — the same concept as the other markets' growth figures, not the quarter-on-quarter series sitting beside it.", url: "https://www.scb.se/en/finding-statistics/statistics-by-subject-area/national-accounts/national-accounts/national-accounts-quarterly-and-annual-estimates/" },
  { market: "Sweden", indicator: "Policy Rate", cadence: "per decision", pillar: "MC", institution: "Bank for International Settlements (originating source: Sveriges Riksbank)", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-12", note: "Read from BIS rather than the Riksbank directly, for the same reason Saudi Arabia's and Kuwait's rates are: BIS's terms are explicit about commercial use and need no permission email. BIS names Sveriges Riksbank as the source in its own response.", url: "https://data.bis.org/topics/CBPOL" },
  { market: "Sweden", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-12", note: "BIS publishes credit statistics roughly three quarters in arrears, so the quarterly default would fire on data that is perfectly current — the same allowance every other BIS debt row carries. Sweden read 34% of GDP at 2025-Q4 when this was wired.", url: "https://data.bis.org/topics/TOTAL_CREDIT" },

  // ---------- Norway ----------
  // LIVE AGAIN 2026-09-12, after three weeks dormant.
  //
  // Norway was parked because Norges Bank's own terms do not confirm
  // commercial reuse of the Key Policy Rate, and the plan of record was
  // to write and ask them. That was never necessary: BIS already
  // republish the same rate, naming Norges Bank as its source, under
  // terms that state commercial use is permitted. The identical route
  // had already been used for Saudi Arabia and Kuwait in August and for
  // Sweden days earlier.
  //
  // Two other rows changed at the same time. Norway's GDP and
  // unemployment were World Bank ANNUAL series -- and the unemployment
  // one was an ILO modelled estimate rather than Norway's own
  // measurement. Both now read Eurostat, monthly and quarterly, the same
  // definitions every other market uses.
  { market: "Norway", indicator: "Inflation (CPI, 12-month rate)", cadence: "monthly", pillar: "PS", institution: "Statistics Norway (SSB)", shortName: "Statistics Norway", license: "CC BY 4.0 — confirmed directly on SSB's own API documentation", status: "live", lastVerified: "2026-09-12", note: "Norway's own CPI, not the HICP Eurostat also publishes for Norway: Norges Bank sets its 2% target on this series, and MMAI scores every market on the measure its own central bank targets. SSB publishes the 12-month rate directly, so no year-over-year arithmetic happens here. Table 14700 — table 03013 carries its own notice that it stopped updating in February 2026.", url: "https://www.ssb.no/en/priser-og-prisindekser/konsumpriser/statistikk/konsumprisindeksen" },
  { market: "Norway", indicator: "GDP Growth", cadence: "quarterly", pillar: "GM", institution: "Eurostat", shortName: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-09-12", note: "Quarterly, year over year, same unit as every other market. Moved off a World Bank annual series that lagged a year or more. This is TOTAL GDP including petroleum — Norwegians usually quote mainland GDP instead, but total is what the other markets report and what the reference ladder is built from. Measured over twelve quarters before wiring: Norway averaged 1.09% against the euro area's 0.98%, so the oil sector is not distorting it.", url: "https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table" },
  { market: "Norway", indicator: "Unemployment", cadence: "monthly", pillar: "LM", institution: "Eurostat", shortName: "Eurostat", license: "Free reuse, commercial and non-commercial, with attribution", status: "live", lastVerified: "2026-09-12", note: "Harmonised Labour Force Survey rate, seasonally adjusted — the same definition every other market uses. Replaces a World Bank ILO MODELLED annual estimate, which was not Norway's own measurement and lagged a year behind the monthly figures sitting beside it.", url: "https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table" },
  { market: "Norway", indicator: "Policy Rate (Key Policy Rate)", cadence: "per decision", pillar: "MC", institution: "Bank for International Settlements (originating source: Norges Bank)", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-12", note: "Read from BIS rather than Norges Bank directly, and that is what ended Norway's three-week pause. Norges Bank's own terms require quoting them as source but never state whether commercial reuse is permitted; BIS's terms do, and BIS name Norges Bank as the source in their own response. The same route was already carrying Saudi Arabia's and Kuwait's rates since August and Sweden's since 12 September — the answer was in the repository the whole time it was being waited on.", url: "https://data.bis.org/topics/CBPOL" },

  // ---------- Shared across all markets ----------
  { market: "All markets", indicator: "Brent Crude (context only — not scored)", cadence: "monthly", institution: "U.S. Energy Information Administration", shortName: "EIA", license: "Public domain — citation requested", status: "live", lastVerified: "2026-08-22", note: "NO LONGER SCORED as of 1 September 2026. This is a single global oil price: the identical figure applied to all six markets, so as a pillar it moved every score together and could not affect the ranking of one country against another. It is still shown in the weekly feed, where a global price is exactly what it claims to be." , url: "https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" },

  // ---------- Fiscal Resilience — one BIS series, published per country ----------
  // BIS returns all six in a single request, but these are SIX DIFFERENT
  // national figures, not one shared number. Listed per market so the
  // Sources page cannot be read as repeating the Brent mistake.
  //
  // Named as BIS names it. This is "Credit to General government from All
  // sectors at Market value", which is closely related to gross government
  // debt and built for cross-country comparison, but is not identical to
  // the headline debt figure a national treasury publishes.
  { market: "United States", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-01", note: "BIS series WS_TC: credit to general government from all sectors, at market value" , url: "https://data.bis.org/topics/TOTAL_CREDIT" },
  { market: "Euro Area", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-01", note: "Published for the euro area as a whole, not per member state" , url: "https://data.bis.org/topics/TOTAL_CREDIT" },
  { market: "United Kingdom", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-01" , note: "BIS publishes credit statistics about three quarters in arrears, so maxAgeDays is 420 rather than the 240-day quarterly default — verified 2026-09-02, when 2025-Q4 was still the newest available.", url: "https://data.bis.org/topics/TOTAL_CREDIT" },
  { market: "Canada", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-01" , note: "BIS publishes credit statistics about three quarters in arrears, so maxAgeDays is 420 rather than the 240-day quarterly default — verified 2026-09-02, when 2025-Q4 was still the newest available.", url: "https://data.bis.org/topics/TOTAL_CREDIT" },
  { market: "Japan", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-01", note: "Japan's ratio is the highest of the six by a wide margin. It is also the least comparable: the debt is overwhelmingly held domestically, in yen, at near-zero rates. That gentler treatment belonged to the retired five-pillar engine; under the three dimensions the debt reading is standardised against the same history as every other market, with no Japan-specific allowance" , url: "https://data.bis.org/topics/TOTAL_CREDIT" },
  { market: "Australia", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-01" , note: "BIS publishes credit statistics about three quarters in arrears, so maxAgeDays is 420 rather than the 240-day quarterly default — verified 2026-09-02, when 2025-Q4 was still the newest available.", url: "https://data.bis.org/topics/TOTAL_CREDIT" },
  { market: "Norway", indicator: "Government Debt (% of GDP)", cadence: "quarterly", maxAgeDays: 420, pillar: "FR", institution: "Bank for International Settlements", shortName: "BIS", license: "BIS Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers", status: "live", lastVerified: "2026-09-12", note: "BIS publishes credit statistics roughly three quarters in arrears, so the quarterly default would fire on data that is perfectly current — the same allowance every other BIS debt row carries. Norway read 53.9% of GDP at 2025-Q4 when this was wired. Worth one caveat: this is GROSS debt, and Norway holds the world's largest sovereign wealth fund, so Norway's true fiscal capacity is materially stronger than the figure implies. MMAI uses gross debt for every market, so the understatement is consistent across the index rather than corrected for Norway alone." , url: "https://data.bis.org/topics/TOTAL_CREDIT" },
];

export function sourcesForMarket(marketName: string): SourceEntry[] {
  return SOURCES.filter((s) => s.market === marketName || s.market === "All markets");
}

export function sourceForPillar(marketName: string, pillar: "PS" | "GM" | "LM" | "MC" | "FR"): SourceEntry | undefined {
  return sourcesForMarket(marketName).find((s) => s.pillar === pillar);
}

/** Every source behind one dimension. A dimension can hold two
 *  indicators, so this returns a list where sourceForPillar returned one.
 *  The registry stays keyed by pillar deliberately: which institution
 *  publishes a country’s unemployment rate did not change when the
 *  scoring did, and rewriting the registry to match a scoring change would
 *  be exactly the kind of unnecessary churn that loses provenance. */
export function sourcesForDimension(
  marketName: string,
  pillars: readonly ("PS" | "GM" | "LM" | "MC" | "FR")[]
): SourceEntry[] {
  const all = sourcesForMarket(marketName);
  return pillars.map((p) => all.find((s) => s.pillar === p)).filter((s): s is SourceEntry => s != null);
}

/** The provenance line stored on every scored row and shown to readers.
 *
 *  GENERATED FROM THIS REGISTRY, NOT WRITTEN BY HAND.
 *
 *  It used to be a hand-maintained table in app/api/refresh/route.ts. As
 *  fetchers were replaced through August and September 2026 the table was
 *  not updated with them, and four markets ended up crediting the WORLD
 *  BANK for figures that actually came from Statistics Canada, the ONS,
 *  the ABS and e-Stat. It stayed wrong for weeks, on the page whose whole
 *  purpose is letting a reader check the work -- and it also made the data
 *  look older than it is, since the World Bank publishes annually.
 *
 *  Nothing bound those strings to the fetchers that ran. Generating them
 *  removes the possibility rather than testing for it: change a source
 *  here and the provenance changes with it, because there is only one
 *  place the answer lives.
 *
 *  Institutions appear in registry order and are de-duplicated, so a
 *  source covering two pillars (Statistics Canada does inflation,
 *  unemployment and GDP) is named once. */
export function sourceNoteFor(marketName: string): string {
  const names: string[] = [];
  for (const s of sourcesForMarket(marketName)) {
    // Unscored sources are excluded: Brent is still fetched and still
    // shown in the weekly feed, but naming it here would imply it
    // contributed to a score, which it stopped doing on 2026-09-01.
    if (s.pillar == null) continue;
    if (s.status !== "live") continue;
    const short = s.shortName ?? s.institution;
    if (!names.includes(short)) names.push(short);
  }
  return names.length > 0 ? `${names.join(" + ")} (live)` : "no live scored source";
}
