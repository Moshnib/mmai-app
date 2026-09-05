// ============================================================
//  VERIFY THE COMPOSITE ENGINE
//
//  Recomputes every published constant INDEPENDENTLY of lib/composite.ts —
//  its own arithmetic, reading only the reference rows — and fails if any
//  of them drifts from the value the specification publishes.
//
//  This exists because the previous engine shipped a defect that made two
//  of six rankings wrong, and it survived because constants were copied by
//  hand and never re-checked. A number in a document that nothing verifies
//  is a number that will eventually stop being true.
//
//  It also reproduces the published acceptance case end to end. That case
//  was reproduced blind by a third party from the published files alone;
//  if this check ever fails, the engine has moved away from the thing that
//  was verified.
//
//    npx tsx scripts/verify-composite.ts
// ============================================================

import { REFERENCE_SET, REFERENCE_SET_SHA256 } from "../lib/referenceSet";
import {
  INDICATOR_STATS, DIMENSION_STATS, LADDER, LADDER_STEP,
  W_INFLATION, W_UNEMPLOYMENT, computeMmai, percentileOf,
  type IndicatorKey, type DimensionKey,
} from "../lib/composite";

let failures = 0;
function check(label: string, actual: number, expected: number, tol = 5e-9) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(34)} ${actual.toFixed(9).padStart(18)}` +
    (ok ? "" : `   expected ${expected.toFixed(9)}`)
  );
}

// ---- independent arithmetic, deliberately not importing the helpers ----
function mean(v: number[]) { return v.reduce((a, b) => a + b, 0) / v.length; }
function popSd(v: number[]) { const m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); }

console.log("\nREFERENCE SET\n");
console.log(`  rows: ${REFERENCE_SET.length}`);
if (REFERENCE_SET.length !== 148) { console.log("  FAIL  expected 148 rows"); failures += 1; }
console.log(`  sha:  ${REFERENCE_SET_SHA256}`);
if (REFERENCE_SET_SHA256 !== "ca37d6edf9174d211b4669c86ef0f3a437048d66e2da1694dad6cd88a423b256") {
  console.log("  FAIL  the reference CSV checksum has changed — the published file and the code have diverged");
  failures += 1;
}

// per-market coverage, so Japan's eight absent years stay a stated fact
const byMarket: Record<string, number> = {};
for (const r of REFERENCE_SET) byMarket[r.m] = (byMarket[r.m] ?? 0) + 1;
console.log("  coverage: " + Object.entries(byMarket).map(([m, n]) => `${m} ${n}`).join("  "));
if (byMarket.JP !== 18) { console.log("  FAIL  Japan should carry 18 rows"); failures += 1; }

// ---- the five indicator constants, as published in the specification ----
console.log("\nINDICATOR CONSTANTS  (specification section 4)\n");
const EXPECTED_INDICATORS: Record<IndicatorKey, { mean: number; sd: number }> = {
  infGap: { mean: 1.132785, sd: 1.195077 },
  une: { mean: 6.076032, sd: 2.064427 },
  gdp: { mean: 1.764678, sd: 2.324543 },
  debt: { mean: 83.170270, sd: 46.452128 },
  rate: { mean: 2.039696, sd: 1.955668 },
};
for (const key of Object.keys(EXPECTED_INDICATORS) as IndicatorKey[]) {
  const col = REFERENCE_SET.map((r) => r[key]);
  check(`${key} mean`, mean(col), EXPECTED_INDICATORS[key].mean, 5e-6);
  check(`${key} sd`, popSd(col), EXPECTED_INDICATORS[key].sd, 5e-6);
  // and the engine must agree with this independent computation
  check(`${key} mean (engine)`, INDICATOR_STATS[key].mean, mean(col));
  check(`${key} sd (engine)`, INDICATOR_STATS[key].sd, popSd(col));
}

// ---- the weights ----
console.log("\nWEIGHTS  (specification section 6)\n");
check("w_inflation", W_INFLATION, 0.0090 / 0.0236);
check("w_unemployment", W_UNEMPLOYMENT, 0.0146 / 0.0236);
check("weights sum to one", W_INFLATION + W_UNEMPLOYMENT, 1);

// ---- the three dimension standard deviations ----
console.log("\nDIMENSION CONSTANTS  (specification section 5)\n");
const EXPECTED_DIMENSIONS: Record<DimensionKey, number> = {
  C: 0.664366863,
  D: 1.000000000,
  K: 0.887783748,
};
for (const key of Object.keys(EXPECTED_DIMENSIONS) as DimensionKey[]) {
  check(`sd(${key})`, DIMENSION_STATS[key].sd, EXPECTED_DIMENSIONS[key]);
  check(`mean(${key}) is zero`, DIMENSION_STATS[key].mean, 0, 1e-12);
}
// Direction is a single z-score, so its sd is 1 by construction. If this
// ever fails, something has been weighted into Direction that should not be.
check("sd(D) is exactly one", DIMENSION_STATS.D.sd, 1, 1e-12);

// ---- the ladder ----
console.log("\nTHE LADDER  (specification section 7)\n");
console.log(`  length ${LADDER.length}, step ${LADDER_STEP.toFixed(9)} percentile points`);
if (LADDER.length !== 148) { console.log("  FAIL  ladder should hold 148 values"); failures += 1; }
let sorted = true;
for (let i = 1; i < LADDER.length; i++) if (LADDER[i] < LADDER[i - 1]) sorted = false;
console.log(`  ${sorted ? "ok  " : "FAIL"}  sorted ascending`);
if (!sorted) failures += 1;
check("ladder minimum", LADDER[0], -1.816552, 5e-6);
check("ladder maximum", LADDER[LADDER.length - 1], 1.450886, 5e-6);
// ties must resolve downward
check("percentile of the minimum", percentileOf(LADDER[0]), 0, 1e-12);

// ---- the acceptance case, reproduced blind by a third party ----
console.log("\nACCEPTANCE CASE  —  Australia 2026  (specification section 10)\n");
const au = computeMmai(
  { inflation: 3.45, unemployment: 4.46, gdpGrowth: 2.14, debtPctGdp: 50.7, policyRate: 4.35 },
  "AU"
);
if (!au.publishable || au.dimensions == null || au.composite == null || au.percentile == null) {
  console.log("  FAIL  Australia 2026 did not produce a publishable result");
  failures += 1;
} else {
  check("C'", au.dimensions.C, 0.816720200, 5e-9);
  check("D'", au.dimensions.D, 0.161460719, 5e-9);
  check("K'", au.dimensions.K, 1.059009438, 5e-9);
  check("MMAI_Z", au.composite, 0.679063453, 5e-9);
  check("percentile", au.percentile, 85.135135135135, 1e-9);
}

// ---- missing data must withhold, never guess ----
console.log("\nMISSING-DATA RULE\n");
const partial = computeMmai(
  { inflation: 3.45, unemployment: 4.46, gdpGrowth: 2.14, debtPctGdp: 50.7, policyRate: null },
  "AU"
);
const withheld = partial.composite === null && partial.percentile === null && !partial.publishable;
console.log(`  ${withheld ? "ok  " : "FAIL"}  a missing indicator withholds the composite rather than reweighting`);
if (!withheld) failures += 1;
console.log(`  ${partial.missing.join(", ") === "rate" ? "ok  " : "FAIL"}  the missing indicator is named: [${partial.missing.join(", ")}]`);
if (partial.missing.join(", ") !== "rate") failures += 1;

// ---- verdict ----
console.log("\n" + "=".repeat(60));
if (failures === 0) {
  console.log("PASS — every published constant reproduces from the reference set.");
} else {
  console.log(`FAIL — ${failures} check(s) did not reproduce.`);
  console.log("A published constant has drifted from the reference data. Do not deploy.");
  process.exit(1);
}
