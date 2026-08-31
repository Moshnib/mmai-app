// ============================================================
// Why does the composite only span ~30-87 when every pillar uses most of
// its 0-100 range?
//
// Hypothesis: it is not a defect. It is the arithmetic signature of the
// pillars being INDEPENDENT -- the property the five-pillar structure is
// supposed to have. Averaging k weakly-correlated series shrinks the
// spread; that is what averaging DOES.
//
// Testable: if independence explains it, the composite's observed
// standard deviation should match sqrt(sum of w^2 * sigma^2), the value
// predicted for a weighted sum of uncorrelated variables.
//
//   npx tsx research/why-compressed.ts
// ============================================================
import { computePillarScores, computeComposite, PILLAR_WEIGHTS, type PillarKey } from "../lib/scoring";
import panel from "./historical-panel.json";

type Row={year:number;inflation:number|null;gdpGrowth:number|null;unemployment:number|null;policyRate:number|null;brentYoY:number|null};
const P=panel as unknown as {panel:Record<string,Row[]>;markets:Array<{code:string}>};
const KEYS:PillarKey[]=["PS","GM","LM","MC","EC"];

const cols:Record<PillarKey,number[]>={PS:[],GM:[],LM:[],MC:[],EC:[]};
const comps:number[]=[];
for(const m of P.markets)for(const r of P.panel[m.code]??[]){
  const p=computePillarScores(r,m.code); const {composite}=computeComposite(p);
  if(composite==null)continue;
  let ok=true; for(const k of KEYS) if(p[k]==null) ok=false;
  if(!ok) continue;                      // complete rows only, so the maths is comparable
  for(const k of KEYS) cols[k].push(p[k] as number);
  comps.push(composite);
}
const sd=(a:number[])=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
const rng=(a:number[])=>[Math.min(...a),Math.max(...a)];

console.log(`Complete observations: ${comps.length}\n`);
console.log("  pillar   range observed        spread (sd)   uses");
for(const k of KEYS){
  const [lo,hi]=rng(cols[k]);
  console.log(`  ${k}      ${lo.toFixed(1).padStart(6)} to ${hi.toFixed(1).padStart(6)}      ${sd(cols[k]).toFixed(2).padStart(6)}      ${(hi-lo).toFixed(0).padStart(3)} of 100 points`);
}
const [clo,chi]=rng(comps);
console.log(`\n  COMPOSITE ${clo.toFixed(1)} to ${chi.toFixed(1)}      ${sd(comps).toFixed(2)}      ${(chi-clo).toFixed(0)} of 100 points`);

// The prediction.
const predicted=Math.sqrt(KEYS.reduce((s,k)=>s+Math.pow(PILLAR_WEIGHTS[k],2)*Math.pow(sd(cols[k]),2),0));
const observed=sd(comps);
console.log(`\n  If the five pillars were perfectly INDEPENDENT, the composite's`);
console.log(`  standard deviation would be sqrt( sum of w^2 * sigma^2 ):`);
console.log(`\n     predicted  ${predicted.toFixed(2)}`);
console.log(`     observed   ${observed.toFixed(2)}`);
console.log(`     ratio      ${(observed/predicted).toFixed(3)}   (1.000 = perfectly independent)`);

// And what it WOULD be if they all moved together.
const perfect=KEYS.reduce((s,k)=>s+PILLAR_WEIGHTS[k]*sd(cols[k]),0);
console.log(`\n  If instead they moved in lockstep, it would be ${perfect.toFixed(2)}`);
console.log(`  -- roughly ${(perfect/observed).toFixed(1)}x wider. That is the range MMAI gives up`);
console.log(`  in exchange for pillars that measure different things.`);
