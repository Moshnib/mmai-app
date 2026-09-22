import type { Granularity } from "@/lib/gulfHistoryHelpers";

// ============================================================
// GULF WATCH — country list.
// Deliberately separate from lib/markets.ts's FALLBACK_MARKETS: these
// six countries never get a composite score, so they don't belong in
// the same list that drives the main scored-market pipeline. See
// MMAI_MASTER_HANDOVER.md section 11 for the full story.
// ============================================================

export interface GulfCountry {
  code: string;
  name: string;
}

export const GULF_COUNTRIES: GulfCountry[] = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "BH", name: "Bahrain" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" },
];

// ============================================================
// REPORTING GRANULARITY per indicator.
//
// This is a property of WHICH SOURCE serves each field, so it lives in
// code next to the country list rather than in the database -- it can
// only change when a fetcher changes, and it must NOT be guessed from a
// stored date. An annual figure and a genuine January monthly reading
// both serialize to "YYYY-01-01"; sniffing the string can't tell them
// apart, and getting it wrong means printing "Jan 2025" for a figure
// that is really the whole of 2025 -- inventing a precision the source
// never claimed. See formatPeriod() in lib/gulfHistoryHelpers.ts.
//
// KEEP IN SYNC with fetchCpi() in app/api/refresh-gulf/route.ts -- if a
// country's CPI source is ever swapped, this map has to move with it.
// ============================================================

/** Since 19 September, KW and OM read MONTHLY CPI from the IMF and AE
 *  QUARTERLY CPI from the IMF, relayed by the refresh workflow; they were
 *  World Bank annual. There is deliberately no World Bank fallback for
 *  them: an annual figure under a monthly label would print "Jan 2025",
 *  and a non-null fallback would stop carry-forward keeping the last IMF
 *  figure. BH/QA/SA each have their own national monthly source. */
export const GULF_CPI_GRANULARITY: Record<string, Granularity> = {
  AE: "quarterly", // IMF CPI, relayed
  KW: "monthly", // IMF CPI, relayed
  OM: "monthly", // IMF CPI, relayed
  BH: "monthly", // data.gov.bh, relayed (the route's own fetch as fallback)
  QA: "monthly", // data.gov.qa
  SA: "monthly", // Data Saudi
};

/** WHERE A NEWER MONTH IS PUBLISHED, LINKED RATHER THAN COPIED -- for
 *  each country whose card's source lags the country's own statistics
 *  office. The UAE case first:
 *
 *  The UAE figure is the IMF's quarterly one. The UAE's federal statistics
 *  centre (FCSC) and Dubai's statistics office publish MONTHLY inflation,
 *  but neither can be read automatically within its terms (22 September
 *  2026): FCSC's data system and open-data portal sit behind Cloudflare
 *  bot protection, and data.dubai's open dataset stopped at December 2025
 *  while its newer figures fall under terms allowing personal,
 *  non-commercial use only. A link needs no permission and copies nothing,
 *  so the card points readers to both. Handover §48. */
/*  Each link says what it covers: FCSC's figure is UAE-wide, Dubai's is
 *  the emirate's own index -- side by side they must not read as two
 *  sources for one national number. */
export const GULF_MONTHLY_ELSEWHERE: Record<string, Array<{ scope: string; label: string; url: string }>> = {
  AE: [
    { scope: "UAE-wide from the", label: "federal statistics centre (FCSC)", url: "https://uaestat.fcsc.gov.ae/" },
    { scope: "Dubai only from", label: "Dubai Statistics", url: "https://data.dubai/en/e/statistics/35681/724471" },
  ],
  // Qatar's card reads data.gov.qa, whose monthly CPI dataset stops at
  // December 2025 (checked 22 September 2026, last modified August); the
  // National Planning Council itself had published to June 2026.
  QA: [
    { scope: "from Qatar's", label: "National Planning Council", url: "https://www.npc.qa/en/statistics/Pages/allindicators.aspx" },
  ],
  // Kuwait's card reads the IMF, which lags: on 22 September its June
  // value was a 0.00 placeholder while the Central Statistical Bureau had
  // published June at 2.19%.
  KW: [
    { scope: "from Kuwait's", label: "Central Statistical Bureau", url: "https://www.csb.gov.kw/Pages/Statistics_en?ID=34&ParentCatID=3" },
  ],
};

/** FX reserves and current account are World Bank for all six countries,
 *  with no per-country variation -- both are inherently annual series. */
export const GULF_FX_RESERVES_GRANULARITY = "annual" as const;
export const GULF_CURRENT_ACCOUNT_GRANULARITY = "annual" as const;

/** Real estate exists only for Qatar today (a monthly transaction count
 *  from data.gov.qa). */
export const GULF_REAL_ESTATE_GRANULARITY = "monthly" as const;

/** Per country, because the sources differ. Saudi Arabia and Kuwait read
 *  BIS's DAILY series: the date is the day that rate was in effect.
 *  Qatar (since 19 September) reads the IMF's MONTHLY "monetary
 *  policy-related" rate, stamped the first of its month -- printed as a
 *  day it would read "1 Aug 2026". UAE and Bahrain have no usable source
 *  (absent from BIS and IMF; their central banks are bot-protected), and
 *  Oman's IMF rate series stopped in 2022. */
export const GULF_POLICY_RATE_GRANULARITY: Record<string, Granularity> = {
  SA: "daily",
  KW: "daily",
  QA: "monthly",
};

/** Which countries have a usable policy-rate source, and the heading to
 *  show for each. Saudi's repo rate and Kuwait's discount rate are
 *  different instruments, so the heading is per-country rather than a
 *  shared "Policy rate".
 *
 *  CRITICAL: this is the source of truth for "does a policy-rate source
 *  EXIST", and it must never be inferred from whether a given row
 *  happens to carry a value. A transient BIS outage leaves policy_rate
 *  null for a day; deriving existence from the data would then make the
 *  card claim no source exists for Saudi Arabia and Kuwait -- false, and
 *  the same class of dishonest copy this whole feature was built to fix,
 *  just pointing the other way. Presence of DATA and existence of a
 *  SOURCE are separate questions. */
// THE NAME HAS OUTGROWN THE MAP. Sweden is a scored market, not Gulf
// Watch, but it reads its policy rate from the same BIS dataflow and
// fetchBisPolicyRate looks its label up here. Left in place rather than
// moved, because moving it would touch every Gulf caller for one entry;
// renaming is worth doing the next time this file is opened for its own
// reasons.
export const GULF_POLICY_RATE_LABELS: Record<string, string> = {
  SA: "Policy rate (repo)",
  KW: "Policy rate (discount)",
  // Qatar, 19 September: the IMF's "monetary policy-related" rate for
  // Qatar Central Bank, relayed by the refresh workflow. Listing it here
  // is deliberate: it makes the card show the row, and makes a missing
  // relay count toward PARTIAL rather than passing unnoticed.
  QA: "Policy rate (monetary policy-related)",
  SE: "Policy rate",
  // Norway reactivated 2026-09-12. Read through BIS rather than Norges
  // Bank directly: the rate is identical and BIS state the reuse terms
  // that Norges Bank do not. BIS name Norges Bank as the source.
  NO: "Policy rate",
  // Korea joined 2026-09-13. The Bank of Korea Base Rate.
  KR: "Policy rate",
  // Observatory. Denmark sets this to hold the krone to the euro rather
  // than to steer Danish prices -- it has no inflation target.
  DK: "Policy rate (certificates of deposit)",
  // Observatory, 19 September. Each central bank's own name for the rate
  // it steers by; BIS publishes all three as the central bank policy rate.
  PL: "Policy rate (reference rate)",
  CZ: "Policy rate (2-week repo rate)",
  HU: "Policy rate (base rate)",
};
