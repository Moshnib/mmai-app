// ============================================================
// Does the site publish the formula it actually uses?
//
// The Learn page promises a reader can reproduce any published score by
// hand from the formulas shown. On 2026-08-31 that promise broke for two
// hours: Australia's inflation target moved to 2.5% while the page still
// read "|inflation − 2%|". Nothing caught it, because prose in a page and
// code in a module can only agree by accident.
//
// This closes that. It PARSES the published strings, EXECUTES them, and
// compares against lib/scoring.ts across a sweep of inputs and every
// market. String comparison would not do -- the two must MEAN the same
// thing, not look alike.
//
// Run:  npx tsx scripts/verify-published-formulas.ts
// ============================================================

import {
  priceStabilityScore,
  growthMomentumScore,
  labourMarketScore,
  monetaryConditionsScore,
  externalCommoditiesScore,
  inflationTargetFor,
  INFLATION_TARGET,
  PILLAR_NAMES,
  type PillarKey,
} from "../lib/scoring";
import { PUBLISHED_FORMULAS } from "../lib/publishedFormulas";
import { FALLBACK_MARKETS } from "../lib/markets";

// The published strings are typeset for a HUMAN, so variable names carry
// spaces and percent signs ("GDP growth %", "policy rate"). The parser
// accommodates that rather than forcing the page to use code identifiers:
// the reader's version is the one that matters, and degrading it to suit
// a test would be the wrong trade.
const NUM = String.raw`-?[\d.]+%?`;
const VAR = String.raw`[^|()−,]+?`;
const num = (s: string) => parseFloat(s.replace("%", ""));

/** Builds an executable function from a published formula string.
 *  An unparseable formula THROWS rather than being skipped -- a formula
 *  the verifier cannot read is an unchecked formula, which is exactly the
 *  condition this script exists to prevent. */
function compile(expression: string): (v: number, target: number) => number {
  const norm = expression.replace(/\s+/g, " ").trim();

  const outer = norm.match(
    new RegExp(String.raw`^clamp\(\s*(${NUM})\s*([+−-])\s*(${NUM})\s*×\s*(.+?)\s*,\s*0\s*,\s*100\s*\)$`)
  );
  if (!outer) throw new Error(`Cannot parse published formula: "${expression}"`);

  const base = num(outer[1]);
  const sign = outer[2] === "+" ? 1 : -1;
  const coeff = num(outer[3]);
  const term = outer[4].trim();

  const shapes: Array<[RegExp, (m: RegExpMatchArray) => (v: number, t: number) => number]> = [
    // |var − target|   deviation from the market's own benchmark
    [new RegExp(String.raw`^\|\s*${VAR}\s*−\s*target\s*\|$`), () => (v, t) => Math.abs(v - t)],
    // |var − 2.5%|     deviation from a fixed constant
    [
      new RegExp(String.raw`^\|\s*${VAR}\s*−\s*(${NUM})\s*\|$`),
      (m) => { const c = num(m[1]); return (v: number) => Math.abs(v - c); },
    ],
    // |var|            plain absolute value
    [new RegExp(String.raw`^\|\s*${VAR}\s*\|$`), () => (v) => Math.abs(v)],
    // (var − 2%)       shifted, not absolute
    [
      new RegExp(String.raw`^\(\s*${VAR}\s*−\s*(${NUM})\s*\)$`),
      (m) => { const c = num(m[1]); return (v: number) => v - c; },
    ],
    // (var) or var     bare
    [new RegExp(String.raw`^\(?\s*${VAR}\s*\)?$`), () => (v) => v],
  ];

  for (const [re, build] of shapes) {
    const m = term.match(re);
    if (m) {
      const evalTerm = build(m);
      return (v, target) => {
        const raw = base + sign * coeff * evalTerm(v, target);
        return Math.max(0, Math.min(100, raw));
      };
    }
  }
  throw new Error(`Unrecognised term "${term}" in formula: "${expression}"`);
}

/** The engine, keyed the same way. `target` is used only by PS. */
const ENGINE: Record<PillarKey, (v: number, target: number) => number> = {
  PS: (v, target) => priceStabilityScore(v, target),
  GM: (v) => growthMomentumScore(v),
  LM: (v) => labourMarketScore(v),
  MC: (v) => monetaryConditionsScore(v),
  EC: (v) => externalCommoditiesScore(v),
};

// Wide enough to cross both clamp boundaries for every pillar, fine
// enough that a small coefficient change cannot slip between samples.
const SWEEP: number[] = [];
for (let v = -40; v <= 40; v += 0.25) SWEEP.push(Math.round(v * 100) / 100);

const MARKETS = FALLBACK_MARKETS.map((m) => m.code);
const EPS = 1e-9;
let failures = 0;
let comparisons = 0;

console.log("Checking the PUBLISHED formulas against the ENGINE\n");

for (const key of Object.keys(PUBLISHED_FORMULAS) as PillarKey[]) {
  const published = PUBLISHED_FORMULAS[key];
  let compiled: (v: number, target: number) => number;
  try {
    compiled = compile(published.expression);
  } catch (err) {
    console.log(`FAIL  ${key}  ${(err as Error).message}`);
    failures++;
    continue;
  }

  const engine = ENGINE[key];
  const worst = { diff: 0, v: 0, market: "", pub: 0, eng: 0 };

  // PS depends on the market's target, so it is checked against EVERY
  // market. The others are market-independent but are still swept per
  // market -- it costs nothing and catches a pillar quietly becoming
  // market-dependent without the page saying so.
  for (const market of MARKETS) {
    const target = inflationTargetFor(market);
    for (const v of SWEEP) {
      const a = compiled(v, target);
      const b = engine(v, target);
      comparisons++;
      const d = Math.abs(a - b);
      if (d > worst.diff) Object.assign(worst, { diff: d, v, market, pub: a, eng: b });
    }
  }

  if (worst.diff > EPS) {
    failures++;
    console.log(`FAIL  ${key} — ${PILLAR_NAMES[key]}`);
    console.log(`        published: ${published.expression}`);
    console.log(
      `        worst disagreement at ${published.variable}=${worst.v} (${worst.market}): ` +
        `page says ${worst.pub.toFixed(6)}, engine says ${worst.eng.toFixed(6)}`
    );
  } else {
    console.log(`PASS  ${key.padEnd(3)} ${PILLAR_NAMES[key].padEnd(24)} ${published.expression}`);
  }
}

// ---------- Inflation targets, pinned to their SOURCES ----------
//
// An earlier version of this block compared INFLATION_TARGET against
// inflationTargetFor() -- which READS INFLATION_TARGET. It was checking
// the map against itself and could never fail. Recorded deliberately: a
// test that cannot fail is worse than no test, because it reports
// confidence it has not earned.
//
// These are the values verified against each issuing central bank on
// 2026-08-31. Changing a target now requires changing this table too,
// and that second edit is where someone has to state a source.
const SOURCED_TARGETS: Record<string, { target: number; source: string }> = {
  US: { target: 2.0, source: "Federal Reserve — 2% on the PCE price index" },
  EA: { target: 2.0, source: "ECB — symmetric 2% medium-term, HICP" },
  UK: { target: 2.0, source: "Bank of England — 'a target of keeping inflation at 2%'" },
  CA: { target: 2.0, source: "Bank of Canada — '2% midpoint of the 1%-3% control range'" },
  JP: { target: 2.0, source: "Bank of Japan — 'Price Stability Target' of 2 Percent" },
  AU: { target: 2.5, source: "RBA — midpoint of the 2-3% band, per the Statement on the Conduct of Monetary Policy" },
};

console.log("\nChecking inflation targets against their VERIFIED SOURCES\n");
for (const m of FALLBACK_MARKETS) {
  const engineTarget = inflationTargetFor(m.code);
  const mapTarget = INFLATION_TARGET[m.code];
  const sourced = SOURCED_TARGETS[m.code];
  comparisons++;

  if (mapTarget === undefined) {
    failures++;
    console.log(`FAIL  ${m.code} (${m.name}) is a SCORED market with no INFLATION_TARGET entry —`);
    console.log(`        it silently inherits the 2.0% fallback. Add it with a verified source.`);
    continue;
  }
  if (!sourced) {
    failures++;
    console.log(`FAIL  ${m.code} (${m.name}) has a target of ${mapTarget}% with NO recorded source.`);
    console.log(`        Add it to SOURCED_TARGETS naming the issuing central bank.`);
    continue;
  }
  if (Math.abs(engineTarget - sourced.target) > EPS) {
    failures++;
    console.log(`FAIL  ${m.code} (${m.name}) — engine uses ${engineTarget}%, source says ${sourced.target}%`);
    console.log(`        ${sourced.source}`);
    console.log(`        If the bank genuinely changed its target, update SOURCED_TARGETS and cite it.`);
    continue;
  }
  console.log(`PASS  ${m.code.padEnd(3)} ${m.name.padEnd(18)} ${engineTarget.toFixed(1)}%   ${sourced.source}`);
}

console.log(`\n${comparisons.toLocaleString()} comparisons across ${MARKETS.length} markets.`);

if (failures > 0) {
  console.log(`\n${failures} FAILURE(S) — the site is publishing a formula it does not use.`);
  process.exit(1);
}
console.log("\nALL PUBLISHED FORMULAS MATCH THE ENGINE");
