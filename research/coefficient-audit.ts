// ============================================================
// What do the five coefficients actually CLAIM?
//
// 15, 10, 10, 12, 1.2 have never been justified -- but they are not
// meaningless. Each one fixes an implicit economic assertion: the value
// at which a pillar hits zero, and the value at which it saturates at
// 100. Nobody has ever written those assertions down.
//
// This does that first. You cannot calibrate a number until you know
// what claim it is making.
//
//   npx tsx research/coefficient-audit.ts
// ============================================================
import panel from "./historical-panel.json";
import { computePillarScores } from "../lib/scoring";

type Row = { year:number; inflation:number|null; gdpGrowth:number|null; unemployment:number|null; policyRate:number|null; brentYoY:number|null };
const P = panel as unknown as { panel: Record<string, Row[]>; markets: Array<{code:string;name:string}> };

console.log("WHAT EACH COEFFICIENT IMPLICITLY CLAIMS\n");
const claims = [
  ["PS", "15", "inflation", "scores 0 when inflation is 6.67pp from target",  "i.e. 8.67% or -4.67% against a 2% target"],
  ["GM", "10", "GDP growth", "scores 0 at -5% growth, 100 at +5%",            "growth above 5% is invisible"],
  ["LM", "10", "unemployment","scores 100 at 2% or below, 0 at 12%",           "unemployment above 12% is invisible"],
  ["MC", "12", "policy rate", "scores 0 when the rate is 8.33pp from neutral", "i.e. 10.83% or -5.83% against 2.5%"],
  ["EC", "1.2","Brent YoY",   "scores 0 at a +/-83% move",                     "larger oil moves are invisible"],
];
for (const [k,c,v,zero,note] of claims)
  console.log(`  ${k}  coefficient ${c.padEnd(4)} on ${v.padEnd(12)} -> ${zero}\n${" ".repeat(6)}${note}`);

console.log("\n\nARE THOSE CLAIMS TESTED BY HISTORY? (1990-2018, 6 markets)\n");
const ext: Record<string,{min:number;max:number;minAt:string;maxAt:string}> = {};
for (const m of P.markets) for (const r of P.panel[m.code] ?? []) {
  for (const [f,v] of [["inflation",r.inflation],["gdpGrowth",r.gdpGrowth],["unemployment",r.unemployment],["policyRate",r.policyRate],["brentYoY",r.brentYoY]] as Array<[string,number|null]>) {
    if (v==null) continue;
    const e = ext[f] ??= {min:Infinity,max:-Infinity,minAt:"",maxAt:""};
    if (v<e.min){e.min=v;e.minAt=`${m.code} ${r.year}`;}
    if (v>e.max){e.max=v;e.maxAt=`${m.code} ${r.year}`;}
  }
}
console.log("  indicator      observed min            observed max          coefficient implies 0 at");
const implied: Record<string,string> = {
  inflation:"-4.67% or 8.67%", gdpGrowth:"-5.0%", unemployment:"12.0%",
  policyRate:"-5.83% or 10.83%", brentYoY:"+/-83%",
};
for (const [f,e] of Object.entries(ext))
  console.log(`  ${f.padEnd(14)} ${e.min.toFixed(2).padStart(7)} (${e.minAt.padEnd(8)})  ${e.max.toFixed(2).padStart(7)} (${e.maxAt.padEnd(8)})   ${implied[f]}`);

console.log("\n\nHOW OFTEN DOES A PILLAR SATURATE? (hits 0 or 100, losing information)\n");
const hits: Record<string,{zero:number;hundred:number;n:number}> = {};
for (const m of P.markets) for (const r of P.panel[m.code] ?? []) {
  const p = computePillarScores(r, m.code);
  for (const k of ["PS","GM","LM","MC","EC"] as const) {
    const v = p[k]; if (v==null) continue;
    const h = hits[k] ??= {zero:0,hundred:0,n:0};
    h.n++; if (v<=0) h.zero++; if (v>=100) h.hundred++;
  }
}
for (const [k,h] of Object.entries(hits))
  console.log(`  ${k}  ${String(h.n).padStart(3)} obs   at 0: ${String(h.zero).padStart(2)}   at 100: ${String(h.hundred).padStart(2)}   ${((h.zero+h.hundred)/h.n*100).toFixed(1)}% saturated`);
