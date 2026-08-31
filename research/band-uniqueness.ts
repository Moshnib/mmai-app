// Skeptical check: is the 10/10 threshold set UNIQUE, or did the search
// simply find one of many? If many sets satisfy every anchor, the anchors
// do not pin the bands down and the chosen numbers are still arbitrary
// within a range -- which must be reported, not hidden behind a 10/10.
import { computePillarScores, computeComposite } from "../lib/scoring";
import panel from "./historical-panel.json";

const P = panel as unknown as { panel: Record<string, Array<{ year: number; inflation: number | null; gdpGrowth: number | null; unemployment: number | null; policyRate: number | null; brentYoY: number | null }>>; markets: Array<{code:string}> };
const OBS: {code:string;year:number;score:number}[] = [];
for (const m of P.markets) for (const r of P.panel[m.code] ?? []) {
  const { composite } = computeComposite(computePillarScores(r, m.code));
  if (composite != null) OBS.push({ code: m.code, year: r.year, score: composite });
}
const at = (c:string,y:number) => OBS.find(o=>o.code===c&&o.year===y)?.score ?? null;
const ORDER = ["Highly Challenging","Challenging","Balanced","Supportive","Strongly Supportive"];
const cls = (s:number,t:number[]) => s<t[0]?ORDER[0]:s<t[1]?ORDER[1]:s<t[2]?ORDER[2]:s<t[3]?ORDER[3]:ORDER[4];
const ANCHORS = [
  ["UK",1990,"Highly Challenging"],["CA",1991,"Highly Challenging"],
  ["US",2009,"Challenging"],["EA",2009,"Challenging"],["JP",2009,"Challenging"],
  ["US",2008,"Balanced"],["JP",1999,"Balanced"],
  ["AU",2009,"Supportive"],["US",2018,"Supportive"],["AU",2012,"Strongly Supportive"],
] as Array<[string,number,string]>;

const perfect: number[][] = [];
for (let t1=32;t1<=48;t1++) for (let t2=t1+3;t2<=62;t2++) for (let t3=t2+3;t3<=78;t3++) for (let t4=t3+3;t4<=90;t4++) {
  const th=[t1,t2,t3,t4];
  let h=0; for (const [c,y,e] of ANCHORS) { const s=at(c,y); if (s!=null && cls(s,th)===e) h++; }
  if (h===ANCHORS.length) perfect.push(th);
}
console.log(`Threshold sets satisfying ALL ${ANCHORS.length} anchors: ${perfect.length}`);
if (perfect.length) {
  for (let i=0;i<4;i++) {
    const vs=perfect.map(p=>p[i]);
    console.log(`  t${i+1}: ${Math.min(...vs)} to ${Math.max(...vs)}   (width ${Math.max(...vs)-Math.min(...vs)})`);
  }
  console.log("\n  The anchors CONSTRAIN each threshold to a range, they do not fix a point.");
  console.log("  Any set inside those ranges is equally defensible on this evidence.");
}
