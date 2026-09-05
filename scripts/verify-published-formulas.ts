// ============================================================
//  CAN A READER REPRODUCE THE SCORE FROM THE PAGE ALONE?
//
//  The Learn page prints, in its own words: "You can take the raw numbers
//  for any market, run them through the formulas shown here, and get the
//  exact score shown on the Overview page — no hidden adjustments."
//
//  That is the strongest claim the site makes about itself, and until this
//  script existed nothing tested it. The five-pillar engine had a
//  verify-published-formulas check; it was deleted at the cutover on
//  5 September 2026 along with the engine it tested, and the replacement
//  was never written. verify-composite checks the ENGINE against its own
//  constants, which is a different question — it would stay green while
//  the page printed something else entirely.
//
//  So this reads the PUBLISHED STRINGS, parses the numbers back out of
//  them, and rebuilds Australia's score from those alone. If the page
//  rounds a constant to the point where a reader following it lands on a
//  different percentile, that is a broken promise and this fails.
//
//    npx tsx scripts/verify-published-formulas.ts
// ============================================================

import {
  indicatorFormula, computeMmai, LADDER, percentileOf,
  W_DEBT, W_RATE, COND_WEIGHT_FRACTION,
  type IndicatorKey,
} from "@/lib/composite";
import { REFERENCE_SET } from "@/lib/referenceSet";
import { inflationTargetFor } from "@/lib/indicators";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

// ---------- 1. Parse the five published indicator formulas ----------
// The page renders exactly this string, so this is what a reader reads.
const KEYS: IndicatorKey[] = ["infGap", "une", "gdp", "debt", "rate"];
const parsed: Record<string, { sign: number; mean: number; sd: number }> = {};

for (const k of KEYS) {
  const text = indicatorFormula(k);
  // −( X − 1.234567 ) ÷ 2.345678
  const m = text.match(/^(−?)\(\s*X\s*−\s*(-?[\d.]+)\s*\)\s*÷\s*(-?[\d.]+)$/);
  if (!m) { fail(`${k}: published formula is not in the documented shape: "${text}"`); continue; }
  parsed[k] = { sign: m[1] === "−" ? -1 : 1, mean: Number(m[2]), sd: Number(m[3]) };
  if (!Number.isFinite(parsed[k].mean) || !Number.isFinite(parsed[k].sd) || parsed[k].sd === 0) {
    fail(`${k}: published constants do not parse to usable numbers`);
  }
}
if (!failed) ok(`all ${KEYS.length} published indicator formulas parse`);

// A reader applying the printed formula, digit for digit.
const qPublished = (k: IndicatorKey, x: number) =>
  parsed[k].sign * ((x - parsed[k].mean) / parsed[k].sd);

// ---------- 2. Parse the published weights ----------
// The page prints these ROUNDED — inflation to one decimal, the Capacity
// pair to none. A reader cannot use more precision than is shown, so the
// reproduction has to survive the rounding or the claim is overstated.
// The page now prints the Conditions split as an exact fraction beside
// the rounded percentage, so this parses the FRACTION -- the thing a
// reader doing the arithmetic would actually use. Parsing the rounded
// percentage instead is what this script did first, and it failed: the
// error was fifteen times the tightest rung of the ladder.
const asFraction = (t: string): number => {
  // Split rather than matched: a fraction is two integers and a slash,
  // and a regex for that is harder to read than the thing it checks.
  const parts = t.split("/");
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(num) || !Number.isInteger(den) || den === 0) {
    fail(`published Conditions weight is not an exact fraction: "${t}"`);
    return NaN;
  }
  return num / den;
};
const pubWInf = asFraction(COND_WEIGHT_FRACTION.inflation);
const pubWUne = asFraction(COND_WEIGHT_FRACTION.unemployment);
const pubWDebt = Number((W_DEBT * 100).toFixed(0)) / 100;
const pubWRate = Number((W_RATE * 100).toFixed(0)) / 100;

if (Math.abs(pubWInf + pubWUne - 1) > 1e-9) fail(`published Conditions weights sum to ${pubWInf + pubWUne}, not 1`);
else ok(`published Conditions weights sum to 1 (${(pubWInf * 100).toFixed(1)}% + ${(pubWUne * 100).toFixed(1)}%)`);
if (Math.abs(pubWDebt + pubWRate - 1) > 1e-9) fail(`published Capacity weights sum to ${pubWDebt + pubWRate}, not 1`);
else ok(`published Capacity weights sum to 1 (${(pubWDebt * 100).toFixed(0)}% + ${(pubWRate * 100).toFixed(0)}%)`);

// ---------- 3. Rebuild the dimension moments from the published table ----------
// The reference table is published in full, so a reader can compute these
// rather than being told them. This is the step the page does NOT print
// constants for, and it is the step the whole claim rests on.
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

const dimsPub = REFERENCE_SET.map((r) => ({
  C: pubWInf * qPublished("infGap", r.infGap) + pubWUne * qPublished("une", r.une),
  D: qPublished("gdp", r.gdp),
  K: pubWDebt * qPublished("debt", r.debt) + pubWRate * qPublished("rate", r.rate),
}));

const MOM = {
  C: { mean: mean(dimsPub.map((d) => d.C)), sd: sd(dimsPub.map((d) => d.C)) },
  D: { mean: mean(dimsPub.map((d) => d.D)), sd: sd(dimsPub.map((d) => d.D)) },
  K: { mean: mean(dimsPub.map((d) => d.K)), sd: sd(dimsPub.map((d) => d.K)) },
};

// ---------- 4. Reproduce the acceptance case, published-material only ----------
// Australia 2026: the case a third party reproduced blind from the
// published files. Its raw inputs are printed on the page.
const AU = { inflation: 3.45, gdp: 2.14, une: 4.46182469, rate: 4.35, debt: 50.7 };
const auInfGap = Math.abs(AU.inflation - inflationTargetFor("AU"));

const rawC = pubWInf * qPublished("infGap", auInfGap) + pubWUne * qPublished("une", AU.une);
const rawD = qPublished("gdp", AU.gdp);
const rawK = pubWDebt * qPublished("debt", AU.debt) + pubWRate * qPublished("rate", AU.rate);

// "MMAI = percentile of ( C′ + D′ + K′ ) ÷ 3" — the one hand-written
// formula on the page. Applied exactly as printed.
const z = ((rawC - MOM.C.mean) / MOM.C.sd
         + (rawD - MOM.D.mean) / MOM.D.sd
         + (rawK - MOM.K.mean) / MOM.K.sd) / 3;
const fromPage = percentileOf(z);

const engine = computeMmai(
  { inflation: AU.inflation, gdpGrowth: AU.gdp, unemployment: AU.une, policyRate: AU.rate, debtPctGdp: AU.debt },
  "AU",
);

console.log("");
console.log(`  from the published page : ${fromPage}`);
console.log(`  from the engine         : ${engine.percentile}`);
console.log("");

if (engine.percentile == null) {
  fail("the engine declined to score the acceptance case");
} else if (fromPage !== engine.percentile) {
  fail(
    `a reader following the page lands on ${fromPage}, the site publishes ${engine.percentile}. ` +
    `The page claims "the exact score ... no hidden adjustments".`,
  );
} else {
  ok(`the page reproduces the engine exactly: ${fromPage}`);
}

// ---------- 5. And it has to hold for every LIVE market, not just one ----------
// A single matching case can be luck: the ladder has 148 rungs, so a
// small arithmetic difference often lands on the same rung anyway.
//
// NOT tested against the reference rows themselves. The ladder is built
// FROM those rows and percentileOf is strictly-less-than, so every
// reference row sits exactly on its own rung boundary and a change of
// 1e-16 flips it to the next one. An earlier version of this script did
// exactly that and reported 78 of 148 rows "moving" no matter how much
// precision the weights were given -- which was the test being unstable,
// not the site being wrong. The live markets are scored against the
// 2000-2025 ladder and are deliberately not part of it, so they are the
// honest case, and they are also the numbers actually on the page.
const LIVE: Record<string, { inflation: number; gdp: number; une: number; rate: number; debt: number }> = {
  AU: { inflation: 3.45, gdp: 2.14, une: 4.46182469, rate: 4.35, debt: 50.7 },
  CA: { inflation: 3.03, gdp: 1.13, une: 6.4, rate: 2.25, debt: 96.1 },
  EA: { inflation: 3.3, gdp: 1.0, une: 6.4, rate: 2.25, debt: 85.3 },
  JP: { inflation: 2.0, gdp: 0.55, une: 2.4, rate: 0.977, debt: 178.8 },
  UK: { inflation: 2.9, gdp: 0.9, une: 4.9, rate: 3.75, debt: 88.8 },
  US: { inflation: 3.7, gdp: 2.1, une: 4.1, rate: 3.63, debt: 111.0 },
};

let worstZ = 0;
for (const [code, v] of Object.entries(LIVE)) {
  const gap = Math.abs(v.inflation - inflationTargetFor(code));
  const c = pubWInf * qPublished("infGap", gap) + pubWUne * qPublished("une", v.une);
  const d = qPublished("gdp", v.gdp);
  const k = pubWDebt * qPublished("debt", v.debt) + pubWRate * qPublished("rate", v.rate);
  const zz = ((c - MOM.C.mean) / MOM.C.sd + (d - MOM.D.mean) / MOM.D.sd + (k - MOM.K.mean) / MOM.K.sd) / 3;
  const page = percentileOf(zz);
  const eng = computeMmai(
    { inflation: v.inflation, gdpGrowth: v.gdp, unemployment: v.une, policyRate: v.rate, debtPctGdp: v.debt },
    code,
  );
  const engZ = eng.composite;
  if (engZ != null) worstZ = Math.max(worstZ, Math.abs(zz - engZ));
  if (page !== eng.percentile) {
    fail(`${code}: page gives ${page}, engine gives ${eng.percentile}`);
  } else {
    ok(`${code}: ${page} from the page, ${eng.percentile} from the engine`);
  }
}

// The percentile is coarse -- 148 rungs -- so matching ranks alone is a
// weak check. This is the underlying quantity, and it is where the cost
// of publishing the weights rounded to one decimal actually shows up.
//
// The tolerance is DERIVED, not chosen. A difference in composite z can
// only change a published score if it is large enough to carry a market
// across a rung of the ladder, so the threshold is the tightest gap
// between two adjacent rungs. Anything smaller than that is arithmetic
// noise that no reader can observe. An arbitrary round number here (1e-4
// was the first thing this script used) fails on a rounding error that
// changes nothing, which trains someone to ignore the check.
let tightestRung = Infinity;
for (let i = 1; i < LADDER.length; i++) {
  const gap = LADDER[i] - LADDER[i - 1];
  if (gap > 0 && gap < tightestRung) tightestRung = gap;
}
console.log("");
console.log(`  largest composite-z gap, page vs engine: ${worstZ.toExponential(2)}`);
console.log(`  tightest gap between two ladder rungs  : ${tightestRung.toExponential(2)}`);
if (worstZ >= tightestRung) {
  fail(
    `publishing the weights rounded shifts the composite by ${worstZ.toExponential(2)}, which is ` +
    `as large as the tightest ladder rung (${tightestRung.toExponential(2)}) -- so it CAN change a ` +
    `published rank. Publish more decimals, or soften the reproducibility claim.`,
  );
} else {
  ok(
    `rounding costs ${worstZ.toExponential(2)} of composite z, against a tightest rung of ` +
    `${tightestRung.toExponential(2)} -- too small to move any published rank`,
  );
}

console.log("");
if (failed) {
  console.error("The page does not reproduce the engine. Either the formulas are wrong,");
  console.error("or the claim that a reader can reproduce the score needs softening.\n");
  process.exit(1);
}
console.log("The published formulas reproduce the engine exactly.\n");
export {};
