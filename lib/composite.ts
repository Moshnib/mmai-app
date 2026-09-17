// ============================================================
//  THE MMAI COMPOSITE — three dimensions, standardised, equally weighted,
//  read as a percentile of the pooled historical distribution.
//
//    CONDITIONS  =  inflation gap  +  unemployment
//    DIRECTION   =  GDP growth  (only)
//    CAPACITY    =  government debt  +  policy rate space
//
//    MMAI_Z  =  ( C' + D' + K' ) / 3   ->  percentile against 148 rows
//
//  WHY THE DIMENSIONS ARE STANDARDISED BEFORE THEY ARE AVERAGED. The three
//  do not vary equally across history -- Conditions moves about a third
//  less than Direction. Averaging them raw would hand Direction the larger
//  voice whatever the 1/3 written beside it said. That is the difference
//  between a NOMINAL weight and an EFFECTIVE one, and it is the error the
//  five-pillar design this replaces actually contained.
//
//  NO WEIGHT IN THIS METHOD IS MEASURED. Two are declared judgments
//  informed by published evidence, two are declared outright, and three
//  are a stated convention. See WEIGHT_STANDING below. The specification
//  says so in those words and the site must too.
//
//  Every constant here is DERIVED at module load from REFERENCE_SET, not
//  typed in. scripts/verify-composite.ts recomputes them independently and
//  fails the build if any drifts from the documented value. Constants
//  copied by hand and never re-checked is how the previous engine shipped
//  a defect that made two of six rankings wrong.
// ============================================================

import { REFERENCE_SET } from "./referenceSet";
import { inflationTargetFor } from "./indicators";

export type DimensionKey = "C" | "D" | "K";

export const DIMENSION_NAMES: Record<DimensionKey, string> = {
  C: "Conditions",
  D: "Direction",
  K: "Capacity",
};

/** ONE COLOUR PER DIMENSION, DEFINED ONCE.
 *  This map was copied into five files and they happened to agree; the
 *  September 2026 restyle had to lift Conditions' red in all five for it
 *  to read on the navy ground, which is the moment copies start to drift.
 *  Hex literals, not CSS variables: ScoreDiagram appends an alpha suffix
 *  to them, and scripts/check-palette-contrast.ts reads them directly. */
export const DIMENSION_TONE: Record<DimensionKey, string> = { C: "#E85A5A", D: "#F0975B", K: "#22D3EE" };

/** What each dimension is asking about, in the site's own voice. */
export const DIMENSION_QUESTIONS: Record<DimensionKey, string> = {
  C: "How are prices and jobs right now?",
  D: "Which way is the economy moving?",
  K: "How much room is there to respond to trouble?",
};

// ------------------------------------------------------------------
//  WEIGHTS
// ------------------------------------------------------------------

/** Blanchflower (2007), NBER WP 13505: the wellbeing cost of a one-point
 *  rise in unemployment against a one-point rise in inflation, 0.0146 to
 *  0.0090. Held as the exact fraction, not a rounding of it. */
const B_INFLATION = 0.0090;
const B_UNEMPLOYMENT = 0.0146;

export const W_INFLATION = B_INFLATION / (B_INFLATION + B_UNEMPLOYMENT);
export const W_UNEMPLOYMENT = B_UNEMPLOYMENT / (B_INFLATION + B_UNEMPLOYMENT);

/** THE CONDITIONS SPLIT AS AN EXACT FRACTION, for publication.
 *
 *  The weights above are an exact ratio of two published coefficients, but
 *  the Learn page printed them as percentages rounded to one decimal --
 *  38.1% and 61.9% -- beside a promise that a reader can reproduce "the
 *  exact score ... no hidden adjustments".
 *
 *  Those are not compatible. Rounding at one decimal shifts the composite
 *  by about 2.1e-4, and the tightest gap between two rungs of the 148-rung
 *  ladder is 1.3e-5 -- fifteen times smaller. Every market happens to land
 *  on the right rung today, so nothing published is wrong; but it is luck
 *  rather than arithmetic, and it would break silently as the data moves.
 *
 *  Publishing the fraction removes the rounding instead of chasing it with
 *  more decimals. scripts/verify-published-formulas.ts holds the line. */
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const COND_WEIGHT_FRACTION: { inflation: string; unemployment: string } = (() => {
  // The coefficients are given to four decimals, so ten-thousandths make
  // them integers exactly, with no floating-point residue to round away.
  const i = Math.round(B_INFLATION * 1e4);
  const u = Math.round(B_UNEMPLOYMENT * 1e4);
  const total = i + u;
  const g = gcd(gcd(i, u), total);
  return { inflation: `${i / g}/${total / g}`, unemployment: `${u / g}/${total / g}` };
})();
export const W_DEBT = 0.5;
export const W_RATE = 0.5;
export const W_DIMENSION = 1 / 3;

/** The standing of each weight, published verbatim. A reader is entitled
 *  to know which numbers were measured and which were decided, and the
 *  honest answer is that none of them were measured for the quantity they
 *  are applied to. */
export const WEIGHT_STANDING = {
  inflation: {
    value: W_INFLATION,
    standing: "judgment" as const,
    basis:
      "0.0090 / (0.0090 + 0.0146), informed by Blanchflower (2007). NOT measured for this " +
      "variable: the published coefficient is estimated on the inflation RATE, and MMAI " +
      "applies it to distance from target. Those are different quantities, and they disagree " +
      "about which direction is an improvement on the 45% of reference rows that sit below " +
      "target. The ratio is real and cited; the application is a declared judgment.",
  },
  unemployment: {
    value: W_UNEMPLOYMENT,
    standing: "judgment" as const,
    basis: "0.0146 / (0.0090 + 0.0146), informed by Blanchflower (2007). Same qualification.",
  },
  debt: { value: W_DEBT, standing: "judgment" as const, basis: "Declared. No measurement behind it." },
  rate: { value: W_RATE, standing: "judgment" as const, basis: "Declared. No measurement behind it." },
  dimensions: {
    value: W_DIMENSION,
    standing: "convention" as const,
    basis:
      "Equal weighting across the three dimensions. The most widely used approach for " +
      "composite indicators and the default in the OECD/JRC Handbook (2008) — a convention, " +
      "not evidence that the three matter equally. No such evidence exists. Robustness " +
      "testing shows this is the one choice the ranking is genuinely sensitive to.",
  },
} as const;

// ------------------------------------------------------------------
//  REFERENCE STATISTICS — derived, never typed in
// ------------------------------------------------------------------

export interface Moments {
  mean: number;
  /** POPULATION standard deviation, divisor n. Not n-1. */
  sd: number;
}

function moments(values: readonly number[]): Moments {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { mean, sd };
}

export type IndicatorKey = "infGap" | "une" | "gdp" | "debt" | "rate";

export const INDICATOR_STATS: Record<IndicatorKey, Moments> = {
  infGap: moments(REFERENCE_SET.map((r) => r.infGap)),
  une: moments(REFERENCE_SET.map((r) => r.une)),
  gdp: moments(REFERENCE_SET.map((r) => r.gdp)),
  debt: moments(REFERENCE_SET.map((r) => r.debt)),
  rate: moments(REFERENCE_SET.map((r) => r.rate)),
};

/** Which way is better. Positive always means better after alignment. */
export const HIGHER_IS_BETTER: Record<IndicatorKey, boolean> = {
  infGap: false, // distance from target — closer is better
  une: false,
  gdp: true,
  debt: false,
  /** A HIGHER policy rate scores better INSIDE CAPACITY, which is the
   *  opposite of a "how tight is policy" reading. Capacity asks whether a
   *  country has room to respond to trouble, and a central bank at 4% has
   *  room to cut that one at 0.5% does not. This is a judgment and the
   *  site must carry the Capacity framing wherever the number appears, or
   *  a reader will reasonably read a high rate as stress. */
  rate: true,
};

/** Sign-aligned z-score: positive is better, always. */
export function q(key: IndicatorKey, value: number): number {
  const { mean, sd } = INDICATOR_STATS[key];
  const z = (value - mean) / sd;
  return HIGHER_IS_BETTER[key] ? z : -z;
}

// ------------------------------------------------------------------
//  DIMENSIONS
// ------------------------------------------------------------------

export interface DimensionInputs {
  infGap: number;
  une: number;
  gdp: number;
  debt: number;
  rate: number;
}

export interface Dimensions {
  C: number;
  D: number;
  K: number;
}

export function rawDimensions(v: DimensionInputs): Dimensions {
  return {
    C: W_INFLATION * q("infGap", v.infGap) + W_UNEMPLOYMENT * q("une", v.une),
    /** Direction has ONE indicator, so it carries no internal weight — D is
     *  the sign-aligned z-score of GDP growth and nothing more. Its standard
     *  deviation over the reference set is therefore exactly 1 by
     *  construction. That same value was the fingerprint of a bug in the
     *  previous build; here it is correct and expected. Do not "fix" it. */
    D: q("gdp", v.gdp),
    K: W_DEBT * q("debt", v.debt) + W_RATE * q("rate", v.rate),
  };
}

/** Dimension moments across the reference set. These depend on the weights
 *  above: change any of them and these move too, which is why they are
 *  derived here rather than pinned. */
export const DIMENSION_STATS: Record<DimensionKey, Moments> = (() => {
  const dims = REFERENCE_SET.map((r) => rawDimensions(r));
  return {
    C: moments(dims.map((d) => d.C)),
    D: moments(dims.map((d) => d.D)),
    K: moments(dims.map((d) => d.K)),
  };
})();

export function standardiseDimensions(d: Dimensions): Dimensions {
  return {
    C: (d.C - DIMENSION_STATS.C.mean) / DIMENSION_STATS.C.sd,
    D: (d.D - DIMENSION_STATS.D.mean) / DIMENSION_STATS.D.sd,
    K: (d.K - DIMENSION_STATS.K.mean) / DIMENSION_STATS.K.sd,
  };
}

export function compositeZ(standardised: Dimensions): number {
  return (standardised.C + standardised.D + standardised.K) * W_DIMENSION;
}

// ------------------------------------------------------------------
//  THE PERCENTILE LADDER
// ------------------------------------------------------------------

/** The 148 historical composites, sorted ascending. A published score is a
 *  rank against this, not a continuous measurement. */
export const LADDER: readonly number[] = REFERENCE_SET
  .map((r) => compositeZ(standardiseDimensions(rawDimensions(r))))
  .sort((a, b) => a - b);

/** One step on the ladder, in percentile points. Nothing finer than this
 *  is meaningful, which is why scores publish to one decimal. */
export const LADDER_STEP = 100 / LADDER.length;

/** HOW BIG THE RECORD IS, AND WHAT IT SPANS -- derived, because the
 *  pages say it constantly.
 *
 *  "148 market-years" was typed out in nine places across the homepage,
 *  Compare and Trends, while About and Learn computed it. All of them
 *  agreed, and that is exactly the state the Australia inflation target
 *  was in before it changed: correct until the day it was not, and wrong
 *  underneath a promise that a reader can reproduce the score by hand.
 *  A number the reader is invited to check should never be typed twice. */
export const REFERENCE_COUNT = REFERENCE_SET.length;

export const REFERENCE_SPAN = (() => {
  const years = REFERENCE_SET.map((r) => r.y);
  return `${Math.min(...years)}–${Math.max(...years)}`;
})();

/** Percentile rank against the pooled six-economy history.
 *
 *  STRICTLY LESS THAN, so ties resolve downward. The current year is
 *  scored against the 2000-2025 ladder and is not part of it, which keeps
 *  a score comparable from one week to the next. */
export function percentileOf(z: number): number {
  let lo = 0;
  let hi = LADDER.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (LADDER[mid] < z) lo = mid + 1;
    else hi = mid;
  }
  return (100 * lo) / LADDER.length;
}

// ------------------------------------------------------------------
//  THE PUBLISHED RESULT
// ------------------------------------------------------------------

export interface CompositeInput {
  inflation?: number | null;
  unemployment?: number | null;
  gdpGrowth?: number | null;
  debtPctGdp?: number | null;
  policyRate?: number | null;
}

export interface MmaiResult {
  /** Sign-aligned, standardised dimension scores. Published beside the
   *  composite — not optional presentation. Equal thirds is a convention
   *  the ranking is sensitive to, so a reader has to be able to see the
   *  components and disagree with it. */
  dimensions: Dimensions | null;
  /** The raw, un-standardised dimension scores, for anyone checking. */
  rawDimensions: Dimensions | null;
  composite: number | null;
  percentile: number | null;
  /** Which indicators were missing, if any. */
  missing: IndicatorKey[];
  publishable: boolean;
}

/** MISSING DATA IS NOT INTERPOLATED AND NOT REWEIGHTED.
 *
 *  The specification does not define a partial composite, so this does not
 *  invent one. If any of the five indicators is absent the composite is
 *  withheld and the dimensions that CAN be computed are still returned, so
 *  the site can show what it knows and say plainly what it does not.
 *
 *  The five-pillar engine this replaces reweighted around gaps and
 *  published anything with 70% coverage. That let a country be scored on
 *  a different basis from its neighbour while the headline looked
 *  identical, which is exactly the comparison an index is supposed to make
 *  safe. If a partial composite is ever wanted it needs its own rule,
 *  written down and tested, not a silent fallback here. */
export function computeMmai(input: CompositeInput, market: string): MmaiResult {
  const missing: IndicatorKey[] = [];
  const target = inflationTargetFor(market);

  const infGap = input.inflation != null ? Math.abs(input.inflation - target) : null;
  if (infGap == null) missing.push("infGap");
  if (input.unemployment == null) missing.push("une");
  if (input.gdpGrowth == null) missing.push("gdp");
  if (input.debtPctGdp == null) missing.push("debt");
  if (input.policyRate == null) missing.push("rate");

  if (missing.length > 0) {
    return { dimensions: null, rawDimensions: null, composite: null, percentile: null, missing, publishable: false };
  }

  const raw = rawDimensions({
    infGap: infGap as number,
    une: input.unemployment as number,
    gdp: input.gdpGrowth as number,
    debt: input.debtPctGdp as number,
    rate: input.policyRate as number,
  });
  const standardised = standardiseDimensions(raw);
  const z = compositeZ(standardised);

  return {
    dimensions: standardised,
    rawDimensions: raw,
    composite: z,
    percentile: percentileOf(z),
    missing,
    publishable: true,
  };
}

// ------------------------------------------------------------------
//  WHAT THE SITE MUST SAY ALONGSIDE A SCORE
// ------------------------------------------------------------------

/** Measured in the source-break test: rebuilding the whole reference panel
 *  on a single source moves any published score by at most this much, with
 *  the ranking unaffected. Published as a band rather than buried. */
export const SOURCE_BREAK_UNCERTAINTY_PTS = 2.3;

/** Two markets whose scores differ by less than the measured uncertainty
 *  are reported as tied, because an ordering between them would claim a
 *  precision the method does not have. */
export function areTied(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < SOURCE_BREAK_UNCERTAINTY_PTS;
}

/** The sentence that has to travel with the number. */
export const UNCERTAINTY_NOTE =
  `Scores carry an uncertainty of about ±${SOURCE_BREAK_UNCERTAINTY_PTS} percentile points, ` +
  `measured by rebuilding the reference history on a single data source. Countries closer ` +
  `together than that are shown as tied.`;

export const CONVENTION_NOTE =
  "Conditions, Direction and Capacity are weighted equally. That is a stated methodological " +
  "convention, not an empirical finding — there is no evidence that the three matter equally. " +
  "All three are published beside the composite so you can weigh them differently if you disagree.";

// ------------------------------------------------------------------
//  PER-DIMENSION PERCENTILES
// ------------------------------------------------------------------

/** Each dimension gets its own ladder, built the same way as the headline.
 *
 *  WHY. C', D' and K' are z-scores — roughly -3 to +3, centred on zero.
 *  Published raw they would be a second scale a reader has to learn, sitting
 *  next to a headline on 0-100. Ranking each dimension against its own
 *  history puts all four numbers on one scale and makes them directly
 *  comparable: "Capacity sits above 92% of the last 26 years" reads without
 *  a legend, and it is the same operation the headline already performs.
 *
 *  These are RANKS WITHIN A DIMENSION, not shares of the composite. A
 *  dimension in the 90th percentile is not contributing 90% of anything. */
const DIMENSION_LADDERS: Record<DimensionKey, readonly number[]> = (() => {
  const std = REFERENCE_SET.map((r) => standardiseDimensions(rawDimensions(r)));
  const sortNum = (v: number[]) => v.sort((a, b) => a - b);
  return {
    C: sortNum(std.map((d) => d.C)),
    D: sortNum(std.map((d) => d.D)),
    K: sortNum(std.map((d) => d.K)),
  };
})();

function rankIn(ladder: readonly number[], value: number): number {
  let lo = 0;
  let hi = ladder.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ladder[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return (100 * lo) / ladder.length;
}

export function dimensionPercentiles(standardised: Dimensions): Record<DimensionKey, number> {
  return {
    C: rankIn(DIMENSION_LADDERS.C, standardised.C),
    D: rankIn(DIMENSION_LADDERS.D, standardised.D),
    K: rankIn(DIMENSION_LADDERS.K, standardised.K),
  };
}

// ------------------------------------------------------------------
//  BANDS
// ------------------------------------------------------------------

/** A percentile is a rank, so the labels say where a reading sits in the
 *  historical distribution rather than passing judgement on the economy.
 *  "Better than most of the last 26 years" is a claim the method can
 *  actually support; "Strongly Supportive" is an editorial verdict the old
 *  0-100 composite was never entitled to make. */
export const PERCENTILE_BANDS = [
  { min: 80, label: "Top fifth" },
  { min: 60, label: "Above average" },
  { min: 40, label: "Middle of the range" },
  { min: 20, label: "Below average" },
  { min: 0, label: "Bottom fifth" },
];

export function percentileBandLabel(percentile: number | null): string {
  if (percentile == null) return "Not published";
  return (PERCENTILE_BANDS.find((b) => percentile >= b.min) ?? PERCENTILE_BANDS[PERCENTILE_BANDS.length - 1]).label;
}

/** How a percentile should be read, in one sentence, for a tooltip or a
 *  caption. The reference window is a fact about the data, not a flourish. */
export function percentileReading(percentile: number | null): string {
  if (percentile == null) return "Not published — an indicator is missing.";
  return (
    `Better than ${percentile.toFixed(1)}% of the 148 market-years the six economies ` +
    `produced between 2000 and 2025.`
  );
}

// ------------------------------------------------------------------
//  WHEN THE HEADLINE HIDES SOMETHING
// ------------------------------------------------------------------

export interface MaskedDimension {
  key: DimensionKey;
  percentile: number;
  /** How far below the headline it sits, in percentile points. */
  gap: number;
}

/** Averaging three dimensions is FULLY COMPENSATORY: a collapse in one can
 *  be offset without limit by strength in the others. Publishing all three
 *  makes that visible rather than hidden, which is most of the fix — but a
 *  reader who takes in only the headline still deserves to be told.
 *
 *  Japan is the live case. Conditions in the 100th percentile, Capacity in
 *  the 9th, and a composite near the middle that describes neither.
 *
 *  Thresholds carried over from the five-pillar rule they replace: a weak
 *  dimension is not itself the problem, a weak dimension the headline
 *  CONCEALS is, so the test measures the concealment directly. */
export const MASK_GAP_THRESHOLD = 40;
export const MASK_DIMENSION_THRESHOLD = 30;

export function maskedDimension(
  percentiles: Record<DimensionKey, number> | null,
  headline: number | null
): MaskedDimension | null {
  if (percentiles == null || headline == null) return null;
  let worst: DimensionKey = "C";
  for (const k of ["C", "D", "K"] as DimensionKey[]) {
    if (percentiles[k] < percentiles[worst]) worst = k;
  }
  const value = percentiles[worst];
  const gap = headline - value;
  if (gap > MASK_GAP_THRESHOLD && value < MASK_DIMENSION_THRESHOLD) {
    return { key: worst, percentile: value, gap };
  }
  return null;
}

/** The strongest and weakest dimensions, for the auto-generated narrative.
 *  Returns null when they cannot be distinguished. */
export function dimensionDrivers(
  percentiles: Record<DimensionKey, number> | null
): { best: DimensionKey; worst: DimensionKey } | null {
  if (percentiles == null) return null;
  const keys = ["C", "D", "K"] as DimensionKey[];
  const sorted = [...keys].sort((a, b) => percentiles[b] - percentiles[a]);
  if (percentiles[sorted[0]] === percentiles[sorted[2]]) return null;
  return { best: sorted[0], worst: sorted[2] };
}

// ------------------------------------------------------------------
//  WHAT THE WEIGHTS ACTUALLY DO
// ------------------------------------------------------------------

/** Share of the composite's movement each dimension accounts for, %.
 *
 *  MEASURED, not declared. Equal thirds is what the method says; this is
 *  what it does. They differ because the dimensions are correlated with
 *  each other -- Direction and Capacity move together (r = 0.34) while
 *  Conditions is nearly independent of both -- so the composite tracks the
 *  first two more closely than the third.
 *
 *  This is the same nominal-versus-effective gap one level up. Group-level
 *  standardisation equalised the dimensions' SPREAD, which is what it was
 *  introduced to fix. It does not equalise their INFLUENCE, and nothing
 *  can while they remain correlated.
 *
 *  Re-measured by scripts/measure-dimension-influence.ts, which runs in CI
 *  and fails if these drift. */
export const DIMENSION_EFFECTIVE_INFLUENCE: Record<DimensionKey, number> = {
  C: 25.5,
  D: 39.6,
  K: 34.9,
};

/** How far each dimension spreads today's EIGHT markets apart, in
 *  percentile points. A dimension every country scores alike cannot
 *  distinguish them whatever weight it carries -- the question that
 *  retired the oil pillar, asked of the replacement.
 *
 *  THESE MOVE WHENEVER THE MARKET LIST DOES, and that is not a defect.
 *  Unlike the influence figures above -- which are measured against the
 *  fixed 148-row reference set and are unaffected by who is scored --
 *  these describe the spread of the markets actually published today.
 *  Sweden, Norway and Korea each moved them within days of each other:
 *
 *    Sweden   ->  C 27.5  D 22.9  K 22.0
 *    Norway   ->  C 26.5  D 21.6  K 22.5
 *    Korea    ->  C 27.2  D 25.7  K 21.8
 *
 *  Korea widened Direction most, from 21.6 to 25.7, because it arrived
 *  with the strongest growth reading in the set. A market does not have
 *  to be an outlier to move these -- it only has to be somewhere the
 *  others are not.
 *
 *  So a market cannot be added without re-running
 *  scripts/measure-dimension-influence.ts and republishing these. CI
 *  fails if they drift, which is how both additions were caught rather
 *  than shipped with a stale claim on the Learn page. */
export const DIMENSION_CROSS_MARKET_SD: Record<DimensionKey, number> = {
  C: 27.2,
  D: 25.7,
  K: 21.8,
};

export const DIMENSION_INFLUENCE_MEASURED = "13 September 2026";

/** The exact transform applied to one indicator, written out with the
 *  constants the engine actually holds.
 *
 *  GENERATED rather than typed, for the reason the Learn page already
 *  learned the hard way: a formula written by hand drifts from the engine
 *  the first time a constant moves, and the page promises a reader can
 *  reproduce any published score. One generated from the engine cannot
 *  disagree with it. */
export function indicatorFormula(key: IndicatorKey): string {
  const { mean, sd } = INDICATOR_STATS[key];
  const sign = HIGHER_IS_BETTER[key] ? "" : "−";
  return `${sign}( X − ${mean.toFixed(6)} ) ÷ ${sd.toFixed(6)}`;
}

/** How each indicator's score should be read in one line, since a z-score
 *  is not self-explanatory the way a 0-100 pillar score pretended to be. */
export const INDICATOR_READING: Record<IndicatorKey, string> = {
  infGap: "0 is average distance from target across the record; positive is closer to target than average.",
  une: "0 is average unemployment across the record; positive is lower than average.",
  gdp: "0 is average growth across the record; positive is faster than average.",
  debt: "0 is average debt across the record; positive is lower than average.",
  rate: "0 is average policy rate across the record; positive is a higher rate, meaning more room to cut.",
};

// ------------------------------------------------------------------
//  WHAT SITS BEHIND EACH DIMENSION
// ------------------------------------------------------------------

/** Which indicators build each dimension, in the order they are weighted.
 *  Direction holds one; the other two hold a pair. Anything that renders
 *  "the raw figures behind X" has to cope with both cases rather than
 *  assuming one indicator per dimension the way the pillar layout could. */
export const DIMENSION_INDICATORS: Record<DimensionKey, readonly IndicatorKey[]> = {
  C: ["infGap", "une"],
  D: ["gdp"],
  K: ["debt", "rate"],
};

/** The raw field each indicator reads, with how to label it. Mirrors
 *  RAW_FIELD in lib/indicators.ts, which is keyed by source code and
 *  cannot be
 *  reused once pillars are gone. */
export const INDICATOR_FIELD: Record<
  IndicatorKey,
  { key: "inflation" | "unemployment" | "gdpGrowth" | "debtPctGdp" | "policyRate"; label: string; unit: string; decimals: number }
> = {
  infGap: { key: "inflation", label: "Inflation", unit: "% YoY", decimals: 1 },
  une: { key: "unemployment", label: "Unemployment", unit: "%", decimals: 1 },
  gdp: { key: "gdpGrowth", label: "GDP growth", unit: "% YoY", decimals: 1 },
  debt: { key: "debtPctGdp", label: "Government debt", unit: "% of GDP", decimals: 1 },
  rate: { key: "policyRate", label: "Policy rate", unit: "%", decimals: 2 },
};

/** The old pillar keys each dimension absorbed, so the source registry can
 *  still be queried. The registry is keyed by pillar and there is no
 *  reason to rewrite it: which institution publishes a country's
 *  unemployment figure did not change when the scoring did. */
export const DIMENSION_PILLARS: Record<DimensionKey, readonly ("PS" | "GM" | "LM" | "MC" | "FR")[]> = {
  C: ["PS", "LM"],
  D: ["GM"],
  K: ["FR", "MC"],
};

/** The declared weight on one dimension, for display. Always a third --
 *  written as a function so a page cannot hard-code 33.3% and then be
 *  wrong if the convention is ever revisited. */
export function formatDimensionWeight(): string {
  return `${(W_DIMENSION * 100).toFixed(1)}%`;
}

/** What the dimension actually does, against what it is declared to do.
 *  Published together because the point is that they differ. */
export function formatDimensionInfluence(key: DimensionKey): string {
  return `${DIMENSION_EFFECTIVE_INFLUENCE[key].toFixed(1)}%`;
}

/** The weight each indicator carries inside its own dimension. Direction
 *  holds one indicator, so its weight is 1 -- not a third of anything. A
 *  reader shown "GDP growth 33%" would reasonably conclude two more
 *  indicators were hiding somewhere. */
export const INDICATOR_WEIGHT: Record<IndicatorKey, number> = {
  infGap: W_INFLATION,
  une: W_UNEMPLOYMENT,
  gdp: 1,
  debt: W_DEBT,
  rate: W_RATE,
};

/** One indicator's full working, for a page that wants to show the
 *  arithmetic rather than assert the result. */
export interface IndicatorContribution {
  key: IndicatorKey;
  label: string;
  /** The published figure, as it appears on the source's own site. */
  raw: number | null;
  unit: string;
  decimals: number;
  /** Sign-aligned z-score: positive is better, always. */
  q: number | null;
  weight: number;
  /** weight x q -- what this indicator adds to its dimension. */
  contribution: number | null;
}

/** Break one dimension into the indicators behind it, with the arithmetic
 *  visible. The dimension score is the sum of the contributions. */
export function explainDimension(
  key: DimensionKey,
  input: CompositeInput,
  market: string
): { total: number | null; parts: IndicatorContribution[] } {
  const target = inflationTargetFor(market);
  const rawOf = (k: IndicatorKey): number | null => {
    switch (k) {
      case "infGap": return input.inflation ?? null;
      case "une": return input.unemployment ?? null;
      case "gdp": return input.gdpGrowth ?? null;
      case "debt": return input.debtPctGdp ?? null;
      case "rate": return input.policyRate ?? null;
    }
  };
  // The scored value differs from the published one for inflation only:
  // the score uses distance from that market's target, not the rate.
  const scoredOf = (k: IndicatorKey): number | null => {
    const v = rawOf(k);
    if (v == null) return null;
    return k === "infGap" ? Math.abs(v - target) : v;
  };

  const parts = DIMENSION_INDICATORS[key].map((k) => {
    const scored = scoredOf(k);
    const field = INDICATOR_FIELD[k];
    const qv = scored == null ? null : q(k, scored);
    return {
      key: k,
      label: field.label,
      raw: rawOf(k),
      unit: field.unit,
      decimals: field.decimals,
      q: qv,
      weight: INDICATOR_WEIGHT[k],
      contribution: qv == null ? null : INDICATOR_WEIGHT[k] * qv,
    };
  });

  const total = parts.every((p) => p.contribution != null)
    ? parts.reduce((s, p) => s + (p.contribution as number), 0)
    : null;
  return { total, parts };
}

// ------------------------------------------------------------------
//  HOW THE INDICATORS RELATE TO EACH OTHER
// ------------------------------------------------------------------

function pearson(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

const INDICATOR_KEYS: IndicatorKey[] = ["infGap", "une", "gdp", "debt", "rate"];

/** Correlation between every pair of indicators across the reference set,
 *  computed on the SIGN-ALIGNED values -- so a positive number means the
 *  two tend to be good together, which is the question a reader is
 *  actually asking. On the raw values the signs would flip for the three
 *  where lower is better, and the matrix would read backwards.
 *
 *  Derived at load, so it cannot drift from the data and needs no pinning. */
export const INDICATOR_CORRELATIONS: Record<IndicatorKey, Record<IndicatorKey, number>> = (() => {
  const cols: Record<IndicatorKey, number[]> = {
    infGap: [], une: [], gdp: [], debt: [], rate: [],
  };
  for (const r of REFERENCE_SET) for (const k of INDICATOR_KEYS) cols[k].push(q(k, r[k]));
  const out = {} as Record<IndicatorKey, Record<IndicatorKey, number>>;
  for (const a of INDICATOR_KEYS) {
    out[a] = {} as Record<IndicatorKey, number>;
    for (const b of INDICATOR_KEYS) out[a][b] = a === b ? 1 : pearson(cols[a], cols[b]);
  }
  return out;
})();

/** The same for the three dimensions.
 *
 *  This is the matrix that explains why equal thirds does not produce equal
 *  influence: Direction and Capacity move together while Conditions is
 *  nearly independent of both, so the composite tracks the pair more
 *  closely than the loner. Standardising fixed the spread; it cannot fix
 *  this. */
export const DIMENSION_CORRELATIONS: Record<DimensionKey, Record<DimensionKey, number>> = (() => {
  const dims = REFERENCE_SET.map((r) => rawDimensions(r));
  const cols: Record<DimensionKey, number[]> = {
    C: dims.map((d) => d.C), D: dims.map((d) => d.D), K: dims.map((d) => d.K),
  };
  const keys: DimensionKey[] = ["C", "D", "K"];
  const out = {} as Record<DimensionKey, Record<DimensionKey, number>>;
  for (const a of keys) {
    out[a] = {} as Record<DimensionKey, number>;
    for (const b of keys) out[a][b] = a === b ? 1 : pearson(cols[a], cols[b]);
  }
  return out;
})();

/** Which dimension an indicator belongs to — for marking the pairs that
 *  are SUPPOSED to be related. */
export const INDICATOR_DIMENSION: Record<IndicatorKey, DimensionKey> = {
  infGap: "C", une: "C", gdp: "D", debt: "K", rate: "K",
};
