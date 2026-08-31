// ============================================================
// CANDIDATE V2 SCORING — RESEARCH ONLY. NOT PRODUCTION.
//
// This file exists to be COMPARED against V1, not to replace it. Per the
// charter section 4, V1 remains the read-only benchmark until a
// replacement is validated, and per section 14 production equations are
// never edited in place during testing.
//
// EVERY PARAMETER BELOW IS LABELLED. The charter forbids inventing a
// coefficient, target, threshold, neutral rate or weight and calling it
// scientific, so each one carries its status:
//
//   [SOURCED]      traceable to an authoritative published figure
//   [DESIGN]       an explicit MMAI design choice, defensible but chosen
//   [PLACEHOLDER]  a number put here ONLY so the harness runs. Must be
//                  replaced by researched values before this candidate
//                  is considered for release. Do not cite these.
//
// This candidate changes exactly TWO things relative to V1, chosen
// because they are the only parts of V1 that are arguably indefensible
// rather than merely unproven:
//
//   1. The neutral rate is per-market, not a single 2.5% for all six.
//      r* genuinely differs across Japan, the euro area and the US and
//      drifts over time; one constant across six economies cannot be
//      defended under scrutiny.
//
//   2. Price Stability and Monetary Conditions become ASYMMETRIC.
//      V1 scores inflation 1pp below target identically to 1pp above.
//      Economically those are not the same harm: sustained undershoot
//      carries deflation risk with a policy rate already near its floor,
//      while a modest overshoot is ordinarily the easier problem.
//
// Everything else -- the coefficients, the weights, the bands, the
// coverage gate -- is deliberately held IDENTICAL to V1 so the
// comparison isolates these two changes. Changing more at once would
// make the diff uninterpretable, which is the whole failure mode
// section 13's "remove one indicator and one pillar at a time" guards
// against.
// ============================================================

import { PILLAR_WEIGHTS, type PillarKey, type RawIndicators } from "@/lib/scoring";

function clip(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

// ---------- Parameters ----------

/** Inflation target. [SOURCED] 2% is the stated target of the Fed, ECB,
 *  BoE, BoC, RBA (midpoint of 2-3%) and BoJ. The one genuine caveat is
 *  Australia, whose target is a 2-3% BAND rather than a point -- treated
 *  here as its midpoint, which is itself a [DESIGN] choice. */
const INFLATION_TARGET: Record<string, number> = {
  US: 2.0, EA: 2.0, CA: 2.0, UK: 2.0, JP: 2.0, AU: 2.5,
};

/** Neutral nominal policy rate per market.
 *
 *  [PLACEHOLDER] -- THIS IS THE POINT OF THE EXERCISE AND THESE NUMBERS
 *  ARE NOT RESEARCHED. They are ordered plausibly (Japan lowest, the US
 *  and Australia highest) purely so the harness produces a runnable
 *  comparison. They must be replaced with sourced estimates before any
 *  release -- the New York Fed publishes Holston-Laubach-Williams r*
 *  for the US, euro area, Canada and the UK, updated quarterly, and a
 *  nominal neutral rate is that real r* plus the inflation target.
 *
 *  Japan and Australia have no HLW series and will need either a
 *  documented alternative estimate or an explicit design choice. */
const NEUTRAL_RATE: Record<string, number> = {
  US: 3.0, EA: 2.0, CA: 2.75, UK: 3.0, JP: 1.0, AU: 3.25,
};

/** Asymmetry multiplier: how much more heavily an UNDERSHOOT is
 *  penalised than an equal overshoot.
 *
 *  [PLACEHOLDER] 1.5 is a round number chosen to make the asymmetry
 *  visible in the comparison, not an estimate. The defensible routes to
 *  a real value are an expert-elicitation procedure or calibration
 *  against an explicit loss function -- both of which are research, and
 *  neither of which has been done. */
const UNDERSHOOT_PENALTY = 1.5;

// ---------- Equations ----------

/** V2 Price Stability. Same 15x slope as V1, applied asymmetrically. */
export function priceStabilityScoreV2(inflation: number, market: string): number {
  const target = INFLATION_TARGET[market] ?? 2.0;
  const gap = inflation - target;
  const penalty = gap < 0 ? UNDERSHOOT_PENALTY : 1;
  return clip(100 - 15 * Math.abs(gap) * penalty);
}

/** V2 Monetary Conditions. Same 12x slope, per-market neutral rate, and
 *  asymmetric: policy meaningfully BELOW neutral while inflation is at
 *  or above target is a different condition from being above it. */
export function monetaryConditionsScoreV2(policyRate: number, market: string): number {
  const neutral = NEUTRAL_RATE[market] ?? 2.5;
  const gap = policyRate - neutral;
  const penalty = gap < 0 ? UNDERSHOOT_PENALTY : 1;
  return clip(100 - 12 * Math.abs(gap) * penalty);
}

// Unchanged from V1, restated here only so the candidate is complete and
// self-contained. Any edit to these belongs in a separate candidate.
export const growthMomentumScoreV2 = (g: number) => clip(50 + 10 * g);
export const labourMarketScoreV2 = (u: number) => clip(120 - 10 * u);
export const externalCommoditiesScoreV2 = (b: number) => clip(100 - 1.2 * Math.abs(b));

export function computePillarScoresV2(raw: RawIndicators, market: string): Record<PillarKey, number | null> {
  return {
    PS: raw.inflation != null ? priceStabilityScoreV2(raw.inflation, market) : null,
    GM: raw.gdpGrowth != null ? growthMomentumScoreV2(raw.gdpGrowth) : null,
    LM: raw.unemployment != null ? labourMarketScoreV2(raw.unemployment) : null,
    MC: raw.policyRate != null ? monetaryConditionsScoreV2(raw.policyRate, market) : null,
    EC: raw.brentYoY != null ? externalCommoditiesScoreV2(raw.brentYoY) : null,
  };
}

/** Identical aggregation to V1: same weights, same renormalisation, same
 *  0.70 coverage gate. Held constant deliberately so the comparison
 *  isolates the two equation changes. */
export function computeCompositeV2(pillars: Record<PillarKey, number | null>): {
  composite: number | null;
  coverage: number;
} {
  let sum = 0;
  let activeWeight = 0;
  let populated = 0;
  for (const key of Object.keys(PILLAR_WEIGHTS) as PillarKey[]) {
    const v = pillars[key];
    if (v == null) continue;
    sum += v * PILLAR_WEIGHTS[key];
    activeWeight += PILLAR_WEIGHTS[key];
    populated += 1;
  }
  const coverage = populated / 5;
  const composite = coverage >= 0.7 && activeWeight > 0 ? sum / activeWeight : null;
  return { composite, coverage };
}

/** Every parameter in this candidate, for the audit trail the charter
 *  section 18 requires. Printed by the comparison harness so no run can
 *  report results without also reporting what produced them. */
export const V2_PARAMETERS = [
  { name: "Inflation target (US/EA/CA/UK/JP)", value: "2.0%", status: "SOURCED" },
  { name: "Inflation target (AU)", value: "2.5%", status: "DESIGN — midpoint of RBA's 2-3% band" },
  { name: "Neutral rate, per market", value: "US 3.0 / EA 2.0 / CA 2.75 / UK 3.0 / JP 1.0 / AU 3.25", status: "PLACEHOLDER — NOT RESEARCHED" },
  { name: "Undershoot penalty multiplier", value: String(UNDERSHOOT_PENALTY), status: "PLACEHOLDER — NOT RESEARCHED" },
  { name: "PS slope", value: "15", status: "DESIGN — unchanged from V1, itself unjustified" },
  { name: "MC slope", value: "12", status: "DESIGN — unchanged from V1, itself unjustified" },
  { name: "Weights, coverage gate, bands", value: "identical to V1", status: "HELD CONSTANT" },
];

// ============================================================
// BOND YIELDS — the charter's section 6 pillar 6 question.
//
// Section 6 lists a possible sixth pillar, "Financial Conditions /
// Stability", with the status: "Test as separate pillar vs part of
// Monetary Conditions". Section 7 cites BIS Working Paper No. 1272,
// which identifies separate factors for SAFE YIELDS and FINANCIAL RISK.
//
// The 10-year government bond yield is the safe-yields factor. So the
// charter does not ask "should bonds be added" -- it asks whether they
// are DISTINCT ENOUGH from the policy rate to justify their own pillar,
// and it requires that question be settled empirically before either
// answer is adopted.
//
// Both variants are therefore defined here and NEITHER is preferred.
// Choosing between them is the empirical task, not a design preference.
// ============================================================

/** VARIANT A — bonds folded INTO Monetary Conditions.
 *  Financing conditions are treated as one dimension: what the central
 *  bank sets and what the market charges, blended.
 *  [PLACEHOLDER] The 0.5/0.5 blend is a neutral starting point, not an
 *  estimate. Any released weighting must be researched. */
export function monetaryConditionsWithBondsV2(
  policyRate: number,
  bondYield10y: number,
  market: string
): number {
  const policyScore = monetaryConditionsScoreV2(policyRate, market);
  const NEUTRAL_LONG: Record<string, number> = {
    // [PLACEHOLDER] A neutral 10-year yield is not the same quantity as
    // a neutral policy rate -- it embeds a term premium. These are
    // placeholders purely so the variant runs.
    US: 4.0, EA: 3.0, CA: 3.5, UK: 4.0, JP: 1.5, AU: 4.25,
  };
  const neutral = NEUTRAL_LONG[market] ?? 3.5;
  const bondScore = clip(100 - 12 * Math.abs(bondYield10y - neutral));
  return 0.5 * policyScore + 0.5 * bondScore;
}

/** VARIANT B — bonds as a SEPARATE sixth pillar.
 *  Requires re-weighting all six pillars, which the charter warns
 *  against doing casually: section 4 forbids letting a pillar gain
 *  weight merely by existing, and adding a sixth changes every other
 *  pillar's share and therefore every historical score.
 *  [PLACEHOLDER] Weights below are illustrative only. */
export const SIX_PILLAR_WEIGHTS_PLACEHOLDER = {
  PS: 0.2222, GM: 0.2222, LM: 0.1667, MC: 0.1667, EC: 0.1111, FC: 0.1111,
};

/** The redundancy test that decides between A and B.
 *  If the 10-year yield and the policy rate move together closely, the
 *  bond adds little beyond MC and variant A is the honest choice. If
 *  they diverge materially, variant B has a case. This cannot be
 *  answered by preference. */
export function redundancyVerdict(correlation: number | null, n: number): string {
  if (n < 250) return `INSUFFICIENT DATA (n=${n}) — needs multiple rate cycles, not days`;
  if (correlation == null) return "UNDEFINED — the policy rate did not vary in this window";
  if (Math.abs(correlation) > 0.85) return `REDUNDANT (r=${correlation.toFixed(2)}) — favours variant A`;
  if (Math.abs(correlation) < 0.5) return `DISTINCT (r=${correlation.toFixed(2)}) — supports variant B`;
  return `AMBIGUOUS (r=${correlation.toFixed(2)}) — no clear verdict`;
}
