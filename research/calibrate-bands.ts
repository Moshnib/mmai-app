// ============================================================
// BAND CALIBRATION — evidence, not visual appeal.
//
// Charter §15: verbal bands "must themselves be researched and
// documented. They should not be invented merely for visual appeal."
// The current thresholds (80/65/45/30) were invented. Scored over the
// 1990-2018 panel they put 63% of ALL observations in a single band and
// never once reached the bottom label -- not even in 2009.
//
//   npx tsx research/calibrate-bands.ts
//
// METHOD. Two candidate schemes are derived and compared against the
// same evidence, because neither is obviously right:
//
//   A. QUANTILE. Thresholds at percentiles of the observed distribution.
//      Charter §9.1 warns against pure percentile approaches -- they are
//      sample-relative and move as data accumulates. Included as the
//      naive baseline that has to be beaten, not as a recommendation.
//
//   B. EPISODE-ANCHORED. Thresholds chosen so that economically
//      IDENTIFIED episodes land in the label an economist would give
//      them, then checked for a sane distribution. Anchors are named
//      below and are falsifiable.
//
// The anchors are the argument. If someone disputes the bands, they must
// dispute a specific historical claim, not a preference.
// ============================================================

import { computePillarScores, computeComposite } from "../lib/scoring";
import panel from "./historical-panel.json";

const P = panel as unknown as {
  panel: Record<string, Array<Record<string, number | null> & { year: number }>>;
  markets: Array<{ code: string; name: string }>;
};
const CODES = P.markets.map((m) => m.code);

interface Obs { code: string; year: number; score: number }
const OBS: Obs[] = [];
for (const code of CODES) {
  for (const row of P.panel[code] ?? []) {
    const { composite } = computeComposite(computePillarScores(row, code));
    if (composite != null) OBS.push({ code, year: row.year, score: composite });
  }
}
const scores = OBS.map((o) => o.score).sort((a, b) => a - b);
const at = (code: string, year: number) => OBS.find((o) => o.code === code && o.year === year)?.score ?? null;
const quantile = (p: number) => scores[Math.floor(p * (scores.length - 1))];

// ---------- ANCHORS ----------
// Each is a documented macroeconomic episode with a label an economist
// would not seriously argue with. These are the falsifiable claims the
// calibration rests on.
const ANCHORS: Array<{ code: string; year: number; expect: string; why: string }> = [
  { code: "UK", year: 1990, expect: "Highly Challenging", why: "UK recession; inflation near 10%, unemployment climbing" },
  { code: "CA", year: 1991, expect: "Highly Challenging", why: "Canadian recession, unemployment above 10%" },
  { code: "US", year: 2009, expect: "Challenging", why: "deepest post-war US contraction" },
  { code: "EA", year: 2009, expect: "Challenging", why: "euro-area GFC trough" },
  { code: "JP", year: 2009, expect: "Challenging", why: "Japanese output collapse, exports down ~35%" },
  { code: "US", year: 2008, expect: "Balanced", why: "crisis underway but the worst is 2009" },
  { code: "JP", year: 1999, expect: "Balanced", why: "post-Asian-crisis deflation, zero rates" },
  { code: "AU", year: 2009, expect: "Supportive", why: "Australia avoided a technical recession" },
  { code: "US", year: 2018, expect: "Supportive", why: "mature expansion, near full employment" },
  { code: "AU", year: 2012, expect: "Strongly Supportive", why: "peak of the mining boom" },
];

const ORDER = ["Highly Challenging", "Challenging", "Balanced", "Supportive", "Strongly Supportive"];

function classify(score: number, th: number[]): string {
  // th = [t1,t2,t3,t4] ascending; below t1 = Highly Challenging
  if (score < th[0]) return ORDER[0];
  if (score < th[1]) return ORDER[1];
  if (score < th[2]) return ORDER[2];
  if (score < th[3]) return ORDER[3];
  return ORDER[4];
}

function report(name: string, th: number[]) {
  console.log(`\n${"=".repeat(70)}\n${name}\n${"=".repeat(70)}`);
  console.log(`  thresholds: <${th[0]} · ${th[0]}-${th[1]} · ${th[1]}-${th[2]} · ${th[2]}-${th[3]} · ${th[3]}+`);

  const counts: Record<string, number> = {};
  for (const o of OBS) counts[classify(o.score, th)] = (counts[classify(o.score, th)] ?? 0) + 1;
  console.log("\n  distribution over " + OBS.length + " market-years:");
  let maxShare = 0;
  for (const label of ORDER) {
    const n = counts[label] ?? 0;
    const share = (n / OBS.length) * 100;
    maxShare = Math.max(maxShare, share);
    console.log(`    ${label.padEnd(20)} ${String(n).padStart(3)}  ${share.toFixed(1).padStart(5)}%  ${"#".repeat(Math.round(share / 2))}`);
  }
  console.log(`    largest single band: ${maxShare.toFixed(1)}%  ${maxShare > 50 ? "<-- still dominated" : ""}`);
  console.log(`    bands used: ${ORDER.filter((l) => (counts[l] ?? 0) > 0).length}/5`);

  console.log("\n  anchor check:");
  let hits = 0;
  for (const a of ANCHORS) {
    const s = at(a.code, a.year);
    if (s == null) { console.log(`    ??  ${a.code} ${a.year}  no score`); continue; }
    const got = classify(s, th);
    const ok = got === a.expect;
    if (ok) hits++;
    console.log(
      `    ${ok ? "OK " : "NO "} ${a.code} ${a.year}  ${s.toFixed(1).padStart(5)}  ` +
      `expected ${a.expect.padEnd(20)} got ${got.padEnd(20)}${ok ? "" : "  <-- " + a.why}`
    );
  }
  console.log(`\n  anchors satisfied: ${hits}/${ANCHORS.length}`);
  return { hits, maxShare, used: ORDER.filter((l) => (counts[l] ?? 0) > 0).length };
}

console.log("Scored panel: " + OBS.length + " market-years, 1990-2018");
console.log(`min ${scores[0].toFixed(1)}  p10 ${quantile(0.1).toFixed(1)}  p25 ${quantile(0.25).toFixed(1)}  median ${quantile(0.5).toFixed(1)}  p75 ${quantile(0.75).toFixed(1)}  p90 ${quantile(0.9).toFixed(1)}  max ${scores[scores.length - 1].toFixed(1)}`);

const CURRENT = [30, 45, 65, 80];
const r0 = report("CURRENT — 30 / 45 / 65 / 80  (invented, charter §15 unresearched)", CURRENT);

// Scheme A: equal-population quintiles.
const QUANTILE = [quantile(0.2), quantile(0.4), quantile(0.6), quantile(0.8)].map((v) => Math.round(v * 10) / 10);
const rA = report(`A. QUANTILE — ${QUANTILE.join(" / ")}  (equal fifths; charter §9.1 cautions against this)`, QUANTILE);

// Scheme B: episode-anchored. Chosen by searching integer thresholds for
// the set that satisfies the most anchors, tie-broken toward a less
// dominated distribution -- not hand-picked to look tidy.
let best = { th: CURRENT, hits: -1, maxShare: 100 };
for (let t1 = 34; t1 <= 46; t1++)
  for (let t2 = t1 + 4; t2 <= 60; t2++)
    for (let t3 = t2 + 4; t3 <= 74; t3++)
      for (let t4 = t3 + 4; t4 <= 86; t4++) {
        const th = [t1, t2, t3, t4];
        let hits = 0;
        for (const a of ANCHORS) {
          const s = at(a.code, a.year);
          if (s != null && classify(s, th) === a.expect) hits++;
        }
        const counts: Record<string, number> = {};
        for (const o of OBS) counts[classify(o.score, th)] = (counts[classify(o.score, th)] ?? 0) + 1;
        const maxShare = Math.max(...ORDER.map((l) => ((counts[l] ?? 0) / OBS.length) * 100));
        if (hits > best.hits || (hits === best.hits && maxShare < best.maxShare)) best = { th, hits, maxShare };
      }
const rB = report(`B. EPISODE-ANCHORED — ${best.th.join(" / ")}  (fits the most named episodes)`, best.th);

console.log(`\n${"=".repeat(70)}\nSUMMARY\n${"=".repeat(70)}`);
console.log(`  scheme            anchors   largest band   bands used`);
console.log(`  current           ${String(r0.hits).padStart(2)}/${ANCHORS.length}      ${r0.maxShare.toFixed(1).padStart(5)}%          ${r0.used}/5`);
console.log(`  A quantile        ${String(rA.hits).padStart(2)}/${ANCHORS.length}      ${rA.maxShare.toFixed(1).padStart(5)}%          ${rA.used}/5`);
console.log(`  B episode-anchored${String(rB.hits).padStart(3)}/${ANCHORS.length}      ${rB.maxShare.toFixed(1).padStart(5)}%          ${rB.used}/5`);
console.log(`\n  Nothing here is applied. Production bands are unchanged.`);
