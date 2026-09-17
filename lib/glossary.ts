import { REFERENCE_SET } from "@/lib/referenceSet";
import {
  REFERENCE_COUNT,
  PERCENTILE_BANDS,
  DIMENSION_NAMES,
  DIMENSION_QUESTIONS,
} from "@/lib/composite";

// ============================================================
//  PLAIN MEANINGS FOR THE SITE'S OWN WORDS
//
//  Shown by components/Term.tsx when a reader taps or points at a term.
//  Every number in these is read from the engine -- how many market-years,
//  which years, how many economies, where the bands start -- so a
//  definition can never describe a reference set the site no longer uses.
//  (lib/composite.ts' percentileReading() types "148 ... six ... 2000 and
//  2025" by hand; it is deliberately not reused here.)
// ============================================================

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const ECONOMIES = new Set(REFERENCE_SET.map((r) => r.m)).size;
// Not every economy has every year (the count is below economies x years),
// so a definition says "between" the first and last year, never "each year".
const FIRST_YEAR = Math.min(...REFERENCE_SET.map((r) => r.y));
const LAST_YEAR = Math.max(...REFERENCE_SET.map((r) => r.y));
const economiesWord = WORDS[ECONOMIES] ?? String(ECONOMIES);

const bands = PERCENTILE_BANDS.map((b, i) => {
  const top = i === 0 ? null : PERCENTILE_BANDS[i - 1].min;
  // "60 to under 80": a band's upper edge belongs to the band above it.
  return top === null ? `${b.min} and above: ${b.label}` : `${b.min} to under ${top}: ${b.label}`;
}).join("; ");

export const GLOSSARY = {
  "market-year": `One economy in one year. Every MMAI score is ranked against ${REFERENCE_COUNT} of them: ${economiesWord} economies, in years between ${FIRST_YEAR} and ${LAST_YEAR}.`,
  rank: `Where a reading falls in that record of ${REFERENCE_COUNT} market-years. 80 means better than 80% of them, and 50 is the historical middle. It is a rank, not a mark out of 100.`,
  band: `A plain name for the rank. ${bands}.`,
  dimensions: `The score is built from three parts. ${(["C", "D", "K"] as const)
    .map((k) => `${DIMENSION_NAMES[k]}: ${DIMENSION_QUESTIONS[k]}`)
    .join(" ")}`,
  "policy rate": "The interest rate a central bank sets. It feeds through to what banks, businesses and households pay to borrow.",
  "yield spread": "The ten-year government bond yield minus a shorter rate. It is usually positive: lenders normally want more to lend for longer. Below zero is unusual.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
