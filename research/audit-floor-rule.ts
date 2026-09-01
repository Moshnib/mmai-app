// ============================================================
// Calibrating the minimum-pillar rule (audit finding H-1).
//
// lib/scoring.ts cites this file as the calibration record for
// MASK_GAP_THRESHOLD and MASK_PILLAR_THRESHOLD, so it must stay runnable.
//
// A floor must fire often enough to be useful and rarely enough to mean
// something. Picking a round number would repeat the error the audit
// criticises, so candidates are tested against the panel.
//
//   npx tsx research/audit-floor-rule.ts
// ============================================================
import { computePillarScores, computeComposite, bandFor, type PillarKey } from "../lib/scoring";
import panel from "./historical-panel.json";

type Row = { year: number; inflation: number | null; gdpGrowth: number | null; unemployment: number | null; policyRate: number | null; brentYoY: number | null };
const P = panel as unknown as { panel: Record<string, Row[]>; markets: Array<{ code: string }> };
const KEYS: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

const obs: { code: string; year: number; comp: number; min: number; minK: PillarKey; band: string }[] = [];
for (const m of P.markets) for (const r of P.panel[m.code] ?? []) {
  const p = computePillarScores(r, m.code);
  const { composite } = computeComposite(p);
  if (composite == null) continue;
  let min = Infinity, minK: PillarKey = "PS";
  for (const k of KEYS) { const v = p[k]; if (v != null && v < min) { min = v; minK = k; } }
  obs.push({ code: m.code, year: r.year, comp: composite, min, minK, band: bandFor(composite).label });
}

const SOFT = ["Balanced", "Supportive", "Strongly Supportive"];

console.log(`${obs.length} observations, 1990-2018\n`);
console.log("  floor   fires   %      of those, how many are published as Balanced or better?");
for (const f of [20, 25, 30, 35, 40, 45, 50]) {
  const fired = obs.filter((o) => o.min < f);
  const masked = fired.filter((o) => SOFT.includes(o.band));
  console.log(`  ${String(f).padStart(5)}   ${String(fired.length).padStart(5)}  ${((fired.length / obs.length) * 100).toFixed(1).padStart(5)}%   ${String(masked.length).padStart(3)}`);
}

// ---------------------------------------------------------------
// A simple floor fires far too often to be meaningful: even at 20 it
// catches 15.6% of all history. The reason is that a weak pillar is not
// itself the problem -- a weak pillar the composite CONCEALS is. So
// measure the concealment directly: the distance between the headline
// and its worst component.
console.log("\n\nMASKING GAP = composite - weakest pillar\n");
const gaps = obs.map((o) => o.comp - o.min).sort((a, b) => a - b);
const q = (p: number) => gaps[Math.floor(p * (gaps.length - 1))];
console.log(`  min ${gaps[0].toFixed(1)}   p25 ${q(.25).toFixed(1)}   median ${q(.5).toFixed(1)}   p75 ${q(.75).toFixed(1)}   p90 ${q(.9).toFixed(1)}   max ${gaps[gaps.length - 1].toFixed(1)}`);

console.log("\n  Rule: flag when the weakest pillar is more than G points below");
console.log("  the composite AND itself below L.\n");
console.log("   G    L    fires    %      worst case caught");
for (const [G, L] of [[30, 40], [35, 40], [40, 40], [30, 30], [35, 30], [40, 30], [45, 30]] as Array<[number, number]>) {
  const f = obs.filter((o) => (o.comp - o.min) > G && o.min < L).sort((a, b) => a.min - b.min);
  const worst = f[0];
  console.log(`  ${String(G).padStart(3)}  ${String(L).padStart(3)}   ${String(f.length).padStart(4)}   ${((f.length / obs.length) * 100).toFixed(1).padStart(5)}%   ${worst ? `${worst.code} ${worst.year}  ${worst.minK}=${worst.min.toFixed(1)} vs composite ${worst.comp.toFixed(1)}` : "none"}`);
}

// The four cases the rule exists to catch: a pillar at absolute zero,
// published as a middling score.
console.log("\n  Does the SHIPPED rule (gap>40, floor<30) catch every total failure?");
let allCaught = true;
for (const [c, y] of [["EA", 2013], ["JP", 2009], ["AU", 1990], ["CA", 1990]] as Array<[string, number]>) {
  const o = obs.find((x) => x.code === c && x.year === y);
  if (!o) { console.log(`    ${c} ${y}  not in panel`); allCaught = false; continue; }
  const caught = (o.comp - o.min) > 40 && o.min < 30;
  if (!caught) allCaught = false;
  console.log(`    ${c} ${y}  ${o.minK}=${o.min.toFixed(1)}  composite ${o.comp.toFixed(1)}  gap ${(o.comp - o.min).toFixed(1)}  ${caught ? "CAUGHT" : "MISSED"}`);
}
console.log(`\n  ${allCaught ? "All four caught." : "NOT all caught -- the shipped thresholds need revisiting."}`);
console.log("  A gap threshold of 45 would fire less often but MISS Canada 1990,");
console.log("  whose gap is 43.8. 40 is the loosest value that catches every case.");
