// ============================================================
// REJECTED APPROACH — kept in the research record, not proposed.
//
// Charter section 4 requires that equations under investigation be
// preserved including REJECTED ones and the reason for rejection. This
// is that record.
//
// PROPOSED: stretch the composite so the observed historical floor (30.5,
// UK 1990) maps to 10 and the ceiling (87.4, Australia 2012) maps to 90.
//
// REJECTED for four reasons, any one of which is sufficient:
//
// 1. IT IS DYNAMIC MIN-MAX, WHICH THE CHARTER EXPLICITLY REJECTS.
//    Section 9.1: "Pure percentile scoring and dynamic min-max are not
//    preferred as the core solution because they can make scores
//    excessively sample-relative or unstable when extremes change."
//    This was proposed before that line was re-read. It should not have
//    been.
//
// 2. THE WHOLE SCALE HANGS ON ONE OBSERVATION. The floor is UK 1990 and
//    nothing else. A single worse year in future would move the anchor
//    and RETROACTIVELY change every score MMAI has ever published. An
//    index whose history rewrites itself is not a benchmark.
//
// 3. IT BREAKS REPRODUCIBILITY BY HAND. The Learn page promises a reader
//    can recompute any score from published figures. This adds two magic
//    numbers derived from a dataset the reader does not have. That
//    property is MMAI's single strongest claim and is not worth trading.
//
// 4. IT ADDS TWO UNSOURCED PARAMETERS. The parameter audit currently
//    stands at two sourced and nine unjustified. This would make it two
//    of fourteen. It moves the wrong way.
//
// WHAT WAS DONE INSTEAD: changing only the band thresholds fixes the
// actual defect -- 2009 labelled "Balanced" -- while touching no score,
// adding no parameter, and changing none of the six current labels.
// Strictly better on every dimension. See research/README.md.
// ============================================================

import { computePillarScores, computeComposite } from "../lib/scoring";
import panel from "./historical-panel.json";

type Row = { year: number; inflation: number|null; gdpGrowth: number|null; unemployment: number|null; policyRate: number|null; brentYoY: number|null };
const P = panel as unknown as { panel: Record<string, Row[]>; markets: Array<{code:string;name:string}> };
const CODES = P.markets.map(m=>m.code);

const OBS: {code:string;year:number;s:number}[] = [];
for (const c of CODES) for (const r of P.panel[c] ?? []) {
  const { composite } = computeComposite(computePillarScores(r, c));
  if (composite != null) OBS.push({ code:c, year:r.year, s:composite });
}
const lo = Math.min(...OBS.map(o=>o.s));
const hi = Math.max(...OBS.map(o=>o.s));

// Map the observed historical floor to 10 and the ceiling to 90, leaving
// headroom at both ends for conditions worse or better than anything in
// the record. Linear, so ordering is untouched.
const LO_T = 10, HI_T = 90;
const k = (HI_T - LO_T) / (hi - lo);
const rescale = (s:number) => Math.max(0, Math.min(100, LO_T + k * (s - lo)));

console.log(`Observed historical range: ${lo.toFixed(1)} to ${hi.toFixed(1)}  (uses ${(hi-lo).toFixed(0)} of 100 points)`);
console.log(`Stretched to:              ${LO_T} to ${HI_T}   multiplier ${k.toFixed(3)}\n`);

// Bands recalibrated on the NEW scale, same 10 anchors as before.
const ORDER=["Highly Challenging","Challenging","Balanced","Supportive","Strongly Supportive"];
const NEW_BANDS=[20,35,60,80];
const OLD_BANDS=[30,45,65,80];
const cls=(s:number,t:number[])=>s<t[0]?ORDER[0]:s<t[1]?ORDER[1]:s<t[2]?ORDER[2]:s<t[3]?ORDER[3]:ORDER[4];

const KEY: Array<[string,number,string]> = [
  ["UK",1990,"UK recession, inflation ~9.5%"],
  ["CA",1991,"Canadian recession"],
  ["JP",2009,"Japan, exports down ~35%"],
  ["EA",2009,"euro-area GFC trough"],
  ["US",2009,"WORST US YEAR SINCE THE 1930s"],
  ["US",2008,"crisis underway"],
  ["AU",2009,"Australia dodged recession"],
  ["US",2007,"normal year before the crash"],
  ["US",2018,"normal good year"],
  ["AU",2012,"mining-boom peak"],
];

console.log("HISTORICAL EPISODES\n");
console.log("  " + "episode".padEnd(34) + "  now          would become");
for (const [c,y,why] of KEY) {
  const o = OBS.find(x=>x.code===c&&x.year===y)!;
  const n = rescale(o.s);
  console.log(
    `  ${(c+" "+y).padEnd(9)}${why.padEnd(25)}  ${o.s.toFixed(1).padStart(5)} ${cls(o.s,OLD_BANDS).padEnd(20)}` +
    `${n.toFixed(1).padStart(5)} ${cls(n,NEW_BANDS)}`
  );
}

console.log("\n\nTODAY'S SIX MARKETS (live scores, 31 Aug 2026)\n");
const LIVE: Array<[string,string,number]> = [
  ["EA","Euro Area",79.1885],["JP","Japan",79.1269],["US","United States",77.2085],
  ["UK","United Kingdom",76.6596],["CA","Canada",76.4952],["AU","Australia",75.8486],
];
console.log("  " + "market".padEnd(18) + "now          would become");
for (const [,name,s] of LIVE) {
  const n = rescale(s);
  console.log(`  ${name.padEnd(18)}${s.toFixed(1).padStart(5)} ${cls(s,OLD_BANDS).padEnd(13)}${n.toFixed(1).padStart(5)} ${cls(n,NEW_BANDS)}`);
}
console.log("\n  Order is IDENTICAL. A straight-line stretch cannot reorder anything.");

console.log("\n\nHOW THE 173 HISTORICAL YEARS SPREAD ACROSS THE LABELS\n");
for (const [label,bands,name] of [[OLD_BANDS,"now"],[NEW_BANDS,"after"]].map(([b,n])=>[n,b,n]) as Array<[string,number[],string]>) {
  const scores = OBS.map(o => name==="now" ? o.s : rescale(o.s));
  const cnt:Record<string,number>={};
  for (const s of scores) cnt[cls(s,bands)]=(cnt[cls(s,bands)]??0)+1;
  console.log(`  ${name.toUpperCase()}`);
  for (const l of ORDER) {
    const c=cnt[l]??0;
    console.log(`    ${l.padEnd(20)}${String(c).padStart(3)}  ${((c/scores.length)*100).toFixed(0).padStart(3)}%  ${"#".repeat(Math.round(c/scores.length*40))}`);
  }
  console.log();
}
