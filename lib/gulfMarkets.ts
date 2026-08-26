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
