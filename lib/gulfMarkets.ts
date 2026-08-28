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
// country's CPI source is ever swapped (e.g. Oman moving off World Bank
// to NCSI's monthly series), this map has to move with it.
// ============================================================

/** AE/KW/OM read CPI from the World Bank (annual, and typically 1-2
 *  years behind). BH/QA/SA each have their own national monthly source. */
export const GULF_CPI_GRANULARITY: Record<string, "annual" | "monthly"> = {
  AE: "annual", // World Bank
  KW: "annual", // World Bank
  OM: "annual", // World Bank
  BH: "monthly", // data.gov.bh
  QA: "monthly", // data.gov.qa
  SA: "monthly", // Data Saudi
};

/** FX reserves and current account are World Bank for all six countries,
 *  with no per-country variation -- both are inherently annual series. */
export const GULF_FX_RESERVES_GRANULARITY = "annual" as const;
export const GULF_CURRENT_ACCOUNT_GRANULARITY = "annual" as const;

/** Real estate exists only for Qatar today (a monthly transaction count
 *  from data.gov.qa). */
export const GULF_REAL_ESTATE_GRANULARITY = "monthly" as const;
