// ============================================================
//  WHAT THE DIMENSIONS ACTUALLY DO
//
//  Two measurements the Learn page publishes, both computed here and both
//  re-checked in CI rather than asserted in prose:
//
//    INFLUENCE   how much each dimension moves the composite across the
//                reference history. Equal thirds is the DECLARED weight;
//                this is the effective one, and they are not the same.
//
//    SEPARATION  how far each dimension spreads today's six markets apart.
//                A dimension every country scores alike cannot distinguish
//                them, whatever weight it carries -- the question that
//                retired the oil pillar.
//
//  Written for the same reason as measure-pillar-influence.ts: on
//  1 September the Learn page stated in prose which pillar separated the
//  markets least, and it was backwards, because the number behind the
//  sentence had gone stale. A generated claim cannot disagree with the
//  data; a written one silently does.
//
//    npx tsx scripts/measure-dimension-influence.ts
//    npx tsx scripts/measure-dimension-influence.ts --check
// ============================================================

import { REFERENCE_SET } from "../lib/referenceSet";
import {
  rawDimensions, standardiseDimensions, compositeZ, dimensionPercentiles,
  DIMENSION_NAMES, DIMENSION_EFFECTIVE_INFLUENCE, DIMENSION_CROSS_MARKET_SD,
  q, type DimensionKey, type IndicatorKey,
} from "../lib/composite";
import { FALLBACK_MARKETS, scoreMarketV2 } from "../lib/markets";

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v: number[]) => { const m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); };
const corr = (a: number[], b: number[]) => {
  const ma = mean(a), mb = mean(b), sa = sd(a), sb = sd(b);
  return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / a.length / (sa * sb);
};

// ---- influence: how much each dimension moves the composite ----
const std = REFERENCE_SET.map((r) => standardiseDimensions(rawDimensions(r)));
const composites = std.map(compositeZ);

const KEYS: DimensionKey[] = ["C", "D", "K"];
const r2: Record<DimensionKey, number> = { C: 0, D: 0, K: 0 };
for (const k of KEYS) r2[k] = corr(std.map((d) => d[k]), composites) ** 2;
const totalR2 = KEYS.reduce((s, k) => s + r2[k], 0);
const influence: Record<DimensionKey, number> = { C: 0, D: 0, K: 0 };
for (const k of KEYS) influence[k] = (100 * r2[k]) / totalR2;

// ---- separation: how far each dimension spreads today's six markets ----
const live = FALLBACK_MARKETS.map((m) => scoreMarketV2(m)).filter((r) => r.dimensionPercentiles != null);
const separation: Record<DimensionKey, number> = { C: 0, D: 0, K: 0 };
for (const k of KEYS) separation[k] = sd(live.map((r) => r.dimensionPercentiles![k]));

// ---- per-indicator, for the "which single number matters" question ----
const IND: { key: IndicatorKey; label: string; dim: DimensionKey }[] = [
  { key: "infGap", label: "Inflation gap", dim: "C" },
  { key: "une", label: "Unemployment", dim: "C" },
  { key: "gdp", label: "GDP growth", dim: "D" },
  { key: "debt", label: "Government debt", dim: "K" },
  { key: "rate", label: "Policy rate", dim: "K" },
];

const check = process.argv.includes("--check");

console.log("\nEFFECTIVE INFLUENCE — share of the composite's movement, %\n");
console.log("  dimension      declared    effective");
for (const k of KEYS) {
  console.log(`  ${DIMENSION_NAMES[k].padEnd(14)}${"33.3".padStart(8)}%${influence[k].toFixed(1).padStart(13)}%`);
}
console.log("\n  Equal thirds is the DECLARED weight. These are what the weights do.");

console.log("\nPER-INDICATOR CORRELATION WITH THE COMPOSITE\n");
for (const i of IND) {
  const c = corr(REFERENCE_SET.map((r) => q(i.key, r[i.key])), composites);
  console.log(`  ${i.label.padEnd(18)}${DIMENSION_NAMES[i.dim].padEnd(12)}${c.toFixed(3).padStart(7)}`);
}

console.log("\nSEPARATION — spread of today's six markets, percentile points\n");
for (const k of [...KEYS].sort((a, b) => separation[b] - separation[a])) {
  console.log(`  ${DIMENSION_NAMES[k].padEnd(14)}${separation[k].toFixed(1).padStart(6)}`);
}

if (!check) {
  console.log("\nPaste into lib/composite.ts:\n");
  console.log("export const DIMENSION_EFFECTIVE_INFLUENCE: Record<DimensionKey, number> = {");
  for (const k of KEYS) console.log(`  ${k}: ${influence[k].toFixed(1)},`);
  console.log("};");
  console.log("export const DIMENSION_CROSS_MARKET_SD: Record<DimensionKey, number> = {");
  for (const k of KEYS) console.log(`  ${k}: ${separation[k].toFixed(1)},`);
  console.log("};");
  process.exit(0);
}

// ---- CI mode: fail if the published constants have drifted ----
let failures = 0;
console.log("\nCHECKING PUBLISHED CONSTANTS\n");
for (const k of KEYS) {
  const a = Number(influence[k].toFixed(1)), b = DIMENSION_EFFECTIVE_INFLUENCE[k];
  const ok = Math.abs(a - b) < 0.05;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  influence ${DIMENSION_NAMES[k].padEnd(12)} published ${b}  measured ${a}`);
}
for (const k of KEYS) {
  const a = Number(separation[k].toFixed(1)), b = DIMENSION_CROSS_MARKET_SD[k];
  const ok = Math.abs(a - b) < 0.05;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  separation ${DIMENSION_NAMES[k].padEnd(11)} published ${b}  measured ${a}`);
}
// The whole point of the measurement: the declared weight is not the
// effective one. If that ever stops being true the Learn copy needs
// rewriting, so it is asserted rather than left to be noticed.
const spread = Math.max(...KEYS.map((k) => influence[k])) - Math.min(...KEYS.map((k) => influence[k]));
console.log(`\n  effective influence spans ${spread.toFixed(1)} points against a declared spread of 0.`);
if (spread < 1) {
  console.log("  NOTE: the dimensions have converged on equal influence. The Learn page says they have not — rewrite it.");
  failures++;
}
console.log("\n" + (failures === 0 ? "PASS" : `FAIL — ${failures} drifted`));
if (failures) process.exit(1);
