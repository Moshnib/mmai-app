// ============================================================
//  WHICH OBSERVATION A SCORE IS COMPUTED FROM
//
//  The composite is all-or-nothing: a missing indicator withholds it
//  rather than reweighting around the gap, because a country scored on
//  four indicators is not comparable with one scored on five, and that
//  comparison is the whole product.
//
//  Taken literally against the newest row, that blanks an entire country
//  whenever one government website has a bad morning. It happened on
//  4 September 2026: Statistics Canada's unemployment fetch failed and
//  Canada had no score, while the previous day's row was complete.
//
//  So the rule is: score the most recent COMPLETE observation, and say
//  which one it was. That is not interpolation and not a silent fallback
//  -- the figure shown is a real published observation, and its date is
//  displayed whenever it is not today's.
//
//  IT IS BOUNDED. Without a limit, a permanently broken source would
//  freeze a stale score on screen indefinitely and the site would look
//  healthy while being wrong. After MAX_FALLBACK_DAYS the score goes to
//  N/A, which is the honest answer to "we have not been able to measure
//  this for two weeks".
// ============================================================

/** How far back the search for a complete observation may reach.
 *
 *  Fourteen days covers a failed fetch, a weekend, a public holiday and a
 *  re-run -- the realistic causes of a one-off gap. It does not cover a
 *  source that has actually broken, which is the case the bound exists to
 *  expose rather than hide. */
export const MAX_FALLBACK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ObservationPick<T> {
  /** The row to score, or null when nothing complete is within the bound. */
  row: T | null;
  /** observation_date of the row being scored. */
  usedDate: string | null;
  /** observation_date of the newest row, complete or not. */
  newestDate: string | null;
  /** True when the scored row is not the newest one available. */
  isFallback: boolean;
  /** How many days back the scored row sits. Zero when it is the newest. */
  daysBack: number;
  /** Field names absent from the NEWEST row — why the fallback happened. */
  missingInNewest: string[];
  /** True when nothing complete was found inside the bound. */
  exhausted: boolean;
}

/**
 * Picks the most recent complete observation for one market.
 *
 * @param rows        newest-first, all for a single market
 * @param required    the fields that must all be present to score
 * @param dateOf      reads the observation date from a row
 */
export function latestCompleteObservation<T>(
  rows: readonly T[],
  required: readonly (keyof T)[],
  dateOf: (row: T) => string
): ObservationPick<T> {
  const empty: ObservationPick<T> = {
    row: null, usedDate: null, newestDate: null, isFallback: false,
    daysBack: 0, missingInNewest: [], exhausted: false,
  };
  if (rows.length === 0) return empty;

  const isComplete = (r: T) => required.every((k) => r[k] !== null && r[k] !== undefined);
  const missingFrom = (r: T) =>
    required.filter((k) => r[k] === null || r[k] === undefined).map((k) => String(k));

  const newest = rows[0];
  const newestDate = dateOf(newest);
  const missingInNewest = missingFrom(newest);

  if (isComplete(newest)) {
    return { row: newest, usedDate: newestDate, newestDate, isFallback: false, daysBack: 0, missingInNewest: [], exhausted: false };
  }

  const newestMs = Date.parse(newestDate);
  for (const candidate of rows.slice(1)) {
    if (!isComplete(candidate)) continue;
    const candDate = dateOf(candidate);
    const daysBack = Number.isNaN(newestMs) ? 0 : Math.round((newestMs - Date.parse(candDate)) / DAY_MS);
    if (daysBack > MAX_FALLBACK_DAYS) break; // rows are newest-first, so everything after is older still
    return { row: candidate, usedDate: candDate, newestDate, isFallback: true, daysBack, missingInNewest, exhausted: false };
  }

  return { row: null, usedDate: null, newestDate, isFallback: false, daysBack: 0, missingInNewest, exhausted: true };
}

/** The sentence shown beside a score that came from an earlier observation.
 *  Names the date and the reason, because "as of 3 September" without a
 *  cause reads like a bug a reader cannot check. */
export function fallbackNote(pick: ObservationPick<unknown>, format: (iso: string) => string): string | null {
  if (pick.exhausted) {
    const what = pick.missingInNewest.length ? pick.missingInNewest.join(", ") : "an indicator";
    return `No score: ${what} has been unavailable for more than ${MAX_FALLBACK_DAYS} days.`;
  }
  if (!pick.isFallback || !pick.usedDate) return null;
  const what = pick.missingInNewest.length ? pick.missingInNewest.join(", ") : "an indicator";
  return `Scored on ${format(pick.usedDate)} data — the latest complete observation. Today's figures are missing ${what}.`;
}
