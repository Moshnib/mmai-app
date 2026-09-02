// ============================================================
// MEASURE WHAT THE PILLAR WEIGHTS ACTUALLY DO
//
// PILLAR_EFFECTIVE_INFLUENCE and PILLAR_CROSS_MARKET_SD in lib/scoring.ts
// are published on the Learn page as measured facts. Before 1 September
// 2026 they were computed by hand and pasted in, which meant nobody could
// check them and nobody noticed when they went stale.
//
// This script recomputes both from the same panel the site draws, and
// FAILS if the constants in lib/scoring.ts disagree with what it measures.
// It runs in CI, so the published figures cannot silently drift again.
//
// The two measures answer different questions and the difference is the
// whole reason this file exists:
//
//   EFFECTIVE INFLUENCE  weight x how much the pillar varies across the
//                        whole panel -- time and markets together.
//   CROSS-MARKET SD      how much the pillar separates one country from
//                        another on the latest reading.
//
// A pillar fed by a single global price scores well on the first and zero
// on the second. That is exactly what External & Commodities did: 15.0%
// effective influence -- third of five -- while being arithmetically
// incapable of changing any ranking. Publishing only the first number let
// that hide for months.
//
//   npx tsx scripts/measure-pillar-influence.ts
// ============================================================

import { HISTORY } from "../lib/history";
import {
  PILLAR_WEIGHTS,
  PILLAR_NAMES,
  PILLAR_EFFECTIVE_INFLUENCE,
  PILLAR_CROSS_MARKET_SD,
  computePillarScores,
  type PillarKey,
} from "../lib/scoring";

/** The six SCORED markets. Norway is in HISTORY but dormant -- absent from
 *  FALLBACK_MARKETS, so no reader ever sees it -- and including it would
 *  make the published figures describe a panel the site does not show. */
const MARKETS = ["US", "EA", "UK", "CA", "JP", "AU"];
const KEYS = Object.keys(PILLAR_WEIGHTS) as PillarKey[];

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length);
}

const panel: Record<PillarKey, number[]> = { PS: [], GM: [], LM: [], MC: [], FR: [] };
const latest: Record<PillarKey, number[]> = { PS: [], GM: [], LM: [], MC: [], FR: [] };

let points = 0;
for (const market of MARKETS) {
  const series = HISTORY[market];
  if (!series) throw new Error(`No history for ${market}`);
  series.forEach((pt, i) => {
    const p = computePillarScores(pt.indicators, market);
    points += 1;
    for (const k of KEYS) {
      if (p[k] == null) continue;
      panel[k].push(p[k]!);
      if (i === series.length - 1) latest[k].push(p[k]!);
    }
  });
}

// Effective influence: weight x SD, normalised so the five sum to 100.
const raw = KEYS.map((k) => PILLAR_WEIGHTS[k] * sd(panel[k]));
const total = raw.reduce((a, b) => a + b, 0);
const influence = Object.fromEntries(
  KEYS.map((k, i) => [k, (raw[i] / total) * 100])
) as Record<PillarKey, number>;

const crossSd = Object.fromEntries(
  KEYS.map((k) => [k, sd(latest[k])])
) as Record<PillarKey, number>;

console.log(`Panel: ${points} market-years across ${MARKETS.length} markets\n`);
console.log("pillar                     weight   panel SD   influence   cross-mkt SD");
console.log("-".repeat(74));
for (const k of KEYS) {
  console.log(
    `${k}  ${PILLAR_NAMES[k].padEnd(22)} ` +
      `${(PILLAR_WEIGHTS[k] * 100).toFixed(2).padStart(6)}% ` +
      `${sd(panel[k]).toFixed(2).padStart(10)} ` +
      `${influence[k].toFixed(1).padStart(10)}% ` +
      `${crossSd[k].toFixed(4).padStart(14)}`
  );
}

// ---- compare against what lib/scoring.ts publishes ----
const problems: string[] = [];
for (const k of KEYS) {
  const wantI = PILLAR_EFFECTIVE_INFLUENCE[k];
  const gotI = Number(influence[k].toFixed(1));
  if (Math.abs(wantI - gotI) > 0.05) {
    problems.push(`${k} effective influence: scoring.ts says ${wantI}, measured ${gotI}`);
  }
  const wantS = PILLAR_CROSS_MARKET_SD[k];
  const gotS = Number(crossSd[k].toFixed(1));
  if (Math.abs(wantS - gotS) > 0.05) {
    problems.push(`${k} cross-market SD: scoring.ts says ${wantS}, measured ${gotS}`);
  }
}

if (problems.length) {
  console.error("\nPUBLISHED FIGURES ARE STALE:");
  for (const p of problems) console.error("  " + p);
  console.error("\nUpdate PILLAR_EFFECTIVE_INFLUENCE / PILLAR_CROSS_MARKET_SD in");
  console.error("lib/scoring.ts, and PILLAR_INFLUENCE_MEASURED with today's date.");
  process.exit(1);
}

console.log("\nOK - lib/scoring.ts matches the measured panel.");
