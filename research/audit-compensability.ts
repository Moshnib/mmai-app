// ============================================================
// AUDIT TEST 1 — is the aggregation rule too forgiving?
//
// MMAI aggregates linearly: MMAI = sum(w_j * S_j). Linear aggregation is
// FULLY COMPENSATORY -- a collapse in one pillar can be entirely offset
// by strength in another, at a constant exchange rate.
//
// This is a known and consequential choice. The OECD/JRC Handbook treats
// compensability as a decision requiring explicit justification, and the
// UNDP changed the Human Development Index from arithmetic to GEOMETRIC
// aggregation in 2010 for exactly this reason: to stop a very low score
// in one dimension being masked by high scores elsewhere.
//
// Geometric aggregation, MMAI_geo = product(S_j ^ w_j), is only PARTIALLY
// compensatory: the marginal cost of losing a point rises as a pillar
// falls, so a near-zero pillar drags the composite down hard.
//
// This measures how much the choice actually matters on MMAI's data.
//
//   npx tsx research/audit-compensability.ts
// ============================================================
import { computePillarScores, computeComposite, PILLAR_WEIGHTS, bandFor, type PillarKey } from "../lib/scoring";
import panel from "./historical-panel.json";

type Row={year:number;inflation:number|null;gdpGrowth:number|null;unemployment:number|null;policyRate:number|null;brentYoY:number|null};
const P=panel as unknown as {panel:Record<string,Row[]>;markets:Array<{code:string;name:string}>};
const KEYS:PillarKey[]=["PS","GM","LM","MC","EC"];

/** Geometric mean with the same weights. Undefined if any pillar is 0,
 *  which is itself informative: geometric aggregation refuses to score an
 *  economy that has completely failed on any single dimension. */
function geometric(p: Record<PillarKey, number|null>): number|null {
  let logSum=0, wSum=0;
  for (const k of KEYS){ const v=p[k]; if(v==null) continue;
    if(v<=0) return 0;                       // total failure on a dimension
    logSum += PILLAR_WEIGHTS[k]*Math.log(v); wSum += PILLAR_WEIGHTS[k]; }
  if(wSum===0) return null;
  return Math.exp(logSum/wSum);
}

const rows:{code:string;year:number;lin:number;geo:number;min:number;minK:PillarKey}[]=[];
for(const m of P.markets)for(const r of P.panel[m.code]??[]){
  const p=computePillarScores(r,m.code);
  const {composite}=computeComposite(p);
  const g=geometric(p);
  if(composite==null||g==null)continue;
  let min=Infinity,minK:PillarKey="PS";
  for(const k of KEYS){const v=p[k]; if(v!=null&&v<min){min=v;minK=k;}}
  rows.push({code:m.code,year:r.year,lin:composite,geo:g,min,minK});
}

const gaps=rows.map(r=>r.lin-r.geo);
const mean=gaps.reduce((a,b)=>a+b,0)/gaps.length;
console.log(`Observations: ${rows.length}`);
console.log(`Linear minus geometric:  mean +${mean.toFixed(2)}   max +${Math.max(...gaps).toFixed(2)}\n`);
console.log("Linear aggregation is HIGHER in " + gaps.filter(g=>g>0).length + " of " + gaps.length + " cases.");
console.log("That difference IS the compensation being granted.\n");

console.log("WHERE IT MATTERS MOST — the 12 observations with the widest gap\n");
console.log("  market year   weakest pillar        linear   geometric   difference   band change");
for(const r of [...rows].sort((a,b)=>(b.lin-b.geo)-(a.lin-a.geo)).slice(0,12)){
  const b1=bandFor(r.lin).label,b2=bandFor(r.geo).label;
  console.log(`  ${r.code} ${r.year}    ${r.minK} = ${r.min.toFixed(1).padStart(5)}        ` +
    `${r.lin.toFixed(1).padStart(5)}   ${r.geo.toFixed(1).padStart(6)}      ${(r.lin-r.geo).toFixed(1).padStart(5)}    ${b1===b2?"—":b1+" -> "+b2}`);
}

const flips=rows.filter(r=>bandFor(r.lin).label!==bandFor(r.geo).label).length;
console.log(`\nBand differs under geometric aggregation in ${flips} of ${rows.length} observations (${(flips/rows.length*100).toFixed(0)}%).`);

// The clean illustration: what does one collapsed pillar cost?
console.log("\n\nTHE EXCHANGE RATE, MADE EXPLICIT\n");
console.log("  A market with four pillars at 80 and one collapsing:");
console.log("  weakest    linear   geometric");
for(const weak of [80,60,40,20,10,5]){
  const p={PS:weak,GM:80,LM:80,MC:80,EC:80} as Record<PillarKey,number>;
  const lin=computeComposite(p).composite!;
  const geo=geometric(p)!;
  console.log(`  ${String(weak).padStart(5)}      ${lin.toFixed(1).padStart(5)}     ${geo.toFixed(1).padStart(5)}`);
}
console.log("\n  Under linear aggregation a pillar falling 80 -> 5 costs only");
console.log("  18.8 composite points, because the other four pay for it.");
