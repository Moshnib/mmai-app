// ============================================================
//  THE ANNOUNCED RATE AND THE RATE THAT WAS PAID
//
//  MMAI scores the short-term rate each central bank steers, and for most
//  of them that is a single number the bank announces. The US is the clear
//  exception: the Fed does not announce a number at all -- the FOMC
//  announces a TARGET RANGE and the market settles inside it -- so the US
//  is scored on the Effective Federal Funds Rate, what banks actually paid
//  overnight, calculated and published daily by the New York Fed.
//
//  (Japan is a milder version of the same thing: the Bank of Japan steers
//  the uncollateralised overnight call rate to "around" a figure and
//  lib/fetchers/boj.ts reads where the market settled. No range is
//  published to show beside it, so nothing here applies to Japan yet.)
//
//  On 25 September 2026 the card read 3.88% and every newspaper said the
//  Fed rate was 4%. Both were correct: the range had been 3.75-4.00% since
//  16 September and the press quotes its top. Nothing on the page said so,
//  so the only conclusion available to a reader was that MMAI was wrong.
//
//  This file holds the two rules that fix that, kept apart from the
//  fetcher and the component so both can be tested without a network or a
//  browser:
//
//    targetFromRow   both bounds or neither, never half a range
//    formatTarget    how the range is printed, and how it is read aloud
//
//  BOTH BOUNDS OR NEITHER is the whole safety rule. A single bound printed
//  beside a rate invents a fact, and the point of showing the range is to
//  remove a discrepancy, not to add a subtler one.
// ============================================================

export interface TargetRange {
  low: number;
  high: number;
}

/** A stored row's two target columns, turned into a range or nothing.
 *
 *  Rejects a half-written pair, a non-number, and an inverted range. It
 *  does NOT check the range against the rate -- that check belongs at the
 *  source, in readTargetRange() in lib/fetchers/nyfed.ts, which sees the
 *  rate and the range in the same NY Fed row and stores nulls when they
 *  disagree. Anything that reaches the database has already passed it. */
export function targetFromRow(low: unknown, high: unknown): TargetRange | null {
  if (typeof low !== "number" || typeof high !== "number") return null;
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (high < low) return null;
  return { low, high };
}

/** TWO DECIMALS, matching RAW_DECIMALS.MC and for the same reason: a
 *  policy rate is set to the nearest quarter-point, and one decimal
 *  invents rates no committee ever voted for -- 3.75 printed as "3.8".
 *
 *  An en dash between the bounds, because it is a range and not a minus
 *  sign, and a screen reader is given "3.75 to 4.00 percent" instead: it
 *  announces an en dash as nothing at all, which would leave a listener
 *  with two unconnected numbers. */
export function formatTarget(range: TargetRange): { shown: string; spoken: string } {
  const low = range.low.toFixed(2);
  const high = range.high.toFixed(2);
  return { shown: `${low}–${high}%`, spoken: `${low} to ${high} percent` };
}

/** WHICH OF THE TWO NUMBERS IS THE SCORED ONE, said in front of the range.
 *
 *  Showing both without saying which is which trades one confusion for
 *  another: a reader who checks MMAI's arithmetic needs to know the
 *  composite is built from the rate that was paid, not from the top of the
 *  announced range.
 *
 *  Naming the Fed is the point for the US -- that is the phrase the news
 *  uses, and matching it is what closes the gap. No other market announces
 *  a range today; if one starts to, it gets the neutral wording until
 *  somebody writes its institution in here deliberately. */
export function targetPrefix(market: string): string {
  return market === "US" ? "effective rate · Fed target" : "rate paid · announced target";
}

/** THE WHOLE LINE AS A SENTENCE, for a screen reader.
 *
 *  The visible line is two labels and a range separated by a middot and an
 *  en dash, and a screen reader announces both of those as nothing, or as
 *  "dot" and "dash", depending on its verbosity setting. Either way a
 *  listener gets a string of numbers with no grammar holding them
 *  together -- which is the same failure the range's own spoken form was
 *  written to avoid, one word further out.
 *
 *  So the visible line is hidden from the accessibility tree entirely and
 *  this is read instead. It says the same thing in words. */
export function spokenTarget(market: string, range: TargetRange): string {
  const scored = market === "US" ? "the effective rate" : "the rate actually paid";
  const setter = market === "US" ? "the Fed's target range is" : "the announced target range is";
  return `The figure above is ${scored}; ${setter} ${formatTarget(range).spoken}`;
}
