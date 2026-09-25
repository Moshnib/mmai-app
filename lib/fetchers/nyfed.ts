// ============================================================
// Federal Reserve Bank of New York fetcher — Effective Federal Funds
// Rate (EFFR), the daily reference rate NY Fed itself calculates and
// publishes. Used in place of FRED (the St. Louis Fed's redistribution
// portal) specifically because FRED's Terms of Service prohibit storing
// or caching FRED Content in a database, which conflicts with this
// app's refresh pipeline. The NY Fed's own Terms of Use, by contrast,
// explicitly permit downloading, storing, and using Content for
// personal or business purposes.
//
// NY Fed's Terms of Use require a specific notice for Reference Rates
// data (see the "Reference Rates" Use Restriction at
// newyorkfed.org/privacy/termsofuse), reproduced on the Sources page:
// "The Effective Federal Funds Rate (EFFR) is subject to the Terms of
// Use posted at newyorkfed.org. The New York Fed is not responsible for
// publication of the EFFR by MMAI, does not sanction or endorse any
// particular republication, and has no liability for your use."
// ============================================================

interface NyFedRateRow {
  effectiveDate: string;
  type: string;
  percentRate: number;
  /** The FOMC's announced target range, which the same row carries. */
  targetRateFrom?: number;
  targetRateTo?: number;
}

export interface UsPolicyRate {
  /** EFFR: what banks actually paid, and the figure the score uses. */
  policyRate: number;
  observationDate: string;
  /** The announced target range, when the row carries a sane one. The
   *  press quotes its top ("the Fed rate is 4%"), so a card showing only
   *  EFFR reads as wrong to anyone who follows the news. */
  targetLow: number | null;
  targetHigh: number | null;
}

/** HOW FAR OUTSIDE ITS RANGE THE EFFECTIVE RATE MAY SIT, in points.
 *
 *  EFFR is a market average and normally prints a few basis points above
 *  the floor -- 3.88 inside 3.75-4.00. It has gone outside: the September
 *  2019 repo squeeze put it 5bp above the ceiling. Ten basis points covers
 *  that with room and is still tighter than one Fed decision, which moves
 *  in twenty-fives.
 *
 *  It was 0.5 first, which was useless: a range a full cut out of date
 *  (3.88 against 4.00-4.25) sailed through it. */
const RATE_MAY_SIT_OUTSIDE_BY = 0.1;

/** A range is only used when it is a range, and one the rate could
 *  plausibly sit in. A wrong range printed beside the rate is worse than
 *  no range: it would be the discrepancy this exists to remove.
 *
 *  WHAT ACTUALLY KEEPS THE PAIR HONEST IS STRUCTURAL, not this function:
 *  the rate and the range are two fields of ONE NY Fed row for one
 *  effective date, they are stored together on that row, they are read
 *  back together, and both columns are rewritten (null included) on every
 *  run. There is no path by which today's rate meets last month's range.
 *
 *  This is the belt to that braces -- it catches a source that starts
 *  answering nonsense. It is not a staleness detector and cannot be one:
 *  a rate sitting near the top of its range is within ten basis points of
 *  a range one cut stale, and no tolerance separates those. */
export function readTargetRange(row: { percentRate: number; targetRateFrom?: number; targetRateTo?: number }): { targetLow: number | null; targetHigh: number | null } {
  const low = row.targetRateFrom;
  const high = row.targetRateTo;
  const sane = typeof low === "number" && typeof high === "number"
    && Number.isFinite(low) && Number.isFinite(high)
    && low >= 0 && high >= low && high <= 25
    && row.percentRate >= low - RATE_MAY_SIT_OUTSIDE_BY
    && row.percentRate <= high + RATE_MAY_SIT_OUTSIDE_BY;
  return sane ? { targetLow: low, targetHigh: high } : { targetLow: null, targetHigh: null };
}

export async function fetchUsPolicyRate(): Promise<UsPolicyRate> {
  const url = "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json";
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NY Fed request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: NyFedRateRow[] = json?.refRates ?? [];
  const latest = rows.find((r) => r.type === "EFFR");
  if (!latest) throw new Error("NY Fed EFFR: no EFFR row found in response");

  return { policyRate: latest.percentRate, observationDate: latest.effectiveDate, ...readTargetRange(latest) };
}
