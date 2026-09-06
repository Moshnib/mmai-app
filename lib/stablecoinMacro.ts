// ============================================================
//  DOES STABLECOIN SUPPLY MOVE WITH THE MACRO CYCLE?
//
//  The site owner's objection, and it was the right one: the stablecoins
//  page showed numbers with no connection to the macro economy, on a
//  site whose entire premise is the macro level. A total in dollars,
//  three chain cards and a supply line say nothing about whether any of
//  it relates to anything the rest of MMAI measures.
//
//  The temptation is to assert a relationship -- "a read on dollar
//  demand outside banking" implies one, and it sounds right. This
//  MEASURES it instead, against the longest macro series the project
//  holds that covers the same window: the US 10-year yield, daily since
//  2013, from the same bond_yields table the rest of the site uses.
//
//  THE ANSWER IS NO, AND PUBLISHING THAT IS THE POINT. Correlation of
//  monthly changes at every lag from zero to three months, and of growth
//  against the level of the yield, all come out statistically
//  insignificant. Meanwhile supply more than doubled while the yield
//  barely moved. A reader is better served by "we checked, it does not
//  track the rate cycle" than by an implication nobody tested.
//
//  THE VERDICT IS DERIVED, NEVER WRITTEN DOWN. If the relationship ever
//  becomes significant the page says so by itself. A hand-typed "no
//  relationship" would be true today and a lie later, which is the same
//  defect as a hand-copied constant.
// ============================================================

import { ETHEREUM_STABLECOIN_HISTORY, type StablecoinHistoryPoint } from "./stablecoinHistory";

/** Pearson correlation. Returns NaN for a degenerate series rather than
 *  dividing by zero. */
export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da === 0 || db === 0 ? NaN : num / Math.sqrt(da * db);
}

/** Student's t for a correlation, so significance is stated rather than
 *  eyeballed from the size of r. */
export function tStatistic(r: number, n: number): number {
  if (!Number.isFinite(r) || n < 3 || Math.abs(r) >= 1) return NaN;
  return r * Math.sqrt((n - 2) / (1 - r * r));
}

/** The conventional two-sided bar at roughly 5% for these sample sizes.
 *  Deliberately a round 2.0 rather than a per-n table: the honest
 *  reading of these results does not turn on the third decimal, and a
 *  lookup table would imply a precision the sample size cannot support. */
export const SIGNIFICANCE_T = 2;

export interface LagResult {
  lagMonths: number;
  r: number;
  t: number;
  n: number;
  significant: boolean;
}

export interface MacroLink {
  /** Correlation of month-on-month supply growth against the change in
   *  the yield, at each lag. */
  lags: LagResult[];
  /** Supply growth against the LEVEL of the yield, which is the other
   *  shape the relationship could plausibly take. */
  level: LagResult;
  /** True only if something, anywhere, cleared the bar. */
  anySignificant: boolean;
  supplyStart: number;
  supplyEnd: number;
  yieldStart: number;
  yieldEnd: number;
  firstDate: string;
  lastDate: string;
  months: number;
}

export interface YieldPoint { date: string; yield10y: number }

/**
 * Pair each supply observation with the most recent yield on or before
 * it, then measure. Returns null when there is not enough overlap to say
 * anything, which the page must render as "not enough data" rather than
 * as an absence of relationship -- those are different claims.
 */
export function measureMacroLink(
  yields: readonly YieldPoint[],
  history: readonly StablecoinHistoryPoint[] = ETHEREUM_STABLECOIN_HISTORY,
): MacroLink | null {
  if (yields.length === 0 || history.length < 12) return null;

  const sorted = [...yields].sort((a, b) => a.date.localeCompare(b.date));
  const paired: { date: string; supply: number; y: number }[] = [];
  for (const p of history) {
    // Most recent yield at or before the block date. A supply read on a
    // weekend has no yield of its own; the last trading day is the
    // honest partner, not an interpolation.
    let best: number | null = null;
    for (const q of sorted) { if (q.date <= p.date) best = q.yield10y; else break; }
    if (best != null) paired.push({ date: p.date, supply: p.total, y: best });
  }
  if (paired.length < 12) return null;

  // Growth rates, not levels. Two series that both trend upward
  // correlate whether or not they have anything to do with each other,
  // which is the classic way to manufacture a relationship out of
  // nothing.
  const supplyGrowth: number[] = [];
  const yieldChange: number[] = [];
  const yieldLevel: number[] = [];
  for (let i = 1; i < paired.length; i++) {
    supplyGrowth.push((paired[i].supply - paired[i - 1].supply) / paired[i - 1].supply);
    yieldChange.push(paired[i].y - paired[i - 1].y);
    yieldLevel.push(paired[i].y);
  }

  // Lags, because money moves slower than a bond market. Testing only
  // the contemporaneous month would let "we found nothing" mean "we did
  // not look".
  const lags: LagResult[] = [];
  for (let lag = 0; lag <= 3; lag++) {
    const a = supplyGrowth.slice(lag);
    const b = yieldChange.slice(0, yieldChange.length - lag);
    const r = pearson(a, b);
    const t = tStatistic(r, a.length);
    lags.push({ lagMonths: lag, r, t, n: a.length, significant: Math.abs(t) > SIGNIFICANCE_T });
  }

  const rl = pearson(supplyGrowth, yieldLevel);
  const tl = tStatistic(rl, supplyGrowth.length);
  const level: LagResult = {
    lagMonths: 0, r: rl, t: tl, n: supplyGrowth.length,
    significant: Math.abs(tl) > SIGNIFICANCE_T,
  };

  return {
    lags,
    level,
    anySignificant: lags.some((l) => l.significant) || level.significant,
    supplyStart: paired[0].supply,
    supplyEnd: paired[paired.length - 1].supply,
    yieldStart: paired[0].y,
    yieldEnd: paired[paired.length - 1].y,
    firstDate: paired[0].date,
    lastDate: paired[paired.length - 1].date,
    months: paired.length,
  };
}
