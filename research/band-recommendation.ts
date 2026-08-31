import { computePillarScores, computeComposite } from "../lib/scoring";
import panel from "./historical-panel.json";
const P = panel as unknown as { panel: Record<string, Array<{ year: number; inflation: number | null; gdpGrowth: number | null; unemployment: number | null; policyRate: number | null; brentYoY: number | null }>>; markets: Array<{code:string}> };
const OBS: {code:string;year:number;score:number}[] = [];
for (const m of P.markets) for (const r of P.panel[m.code] ?? []) {
  const { composite } = computeComposite(computePillarScores(r, m.code));
  if (composite != null) OBS.push({ code:m.code, year:r.year, score:composite });
}
const at=(c:string,y:number)=>OBS.find(o=>o.code===c&&o.year===y)?.score??null;
const ORDER=["Highly Challenging","Challenging","Balanced","Supportive","Strongly Supportive"];
const cls=(s:number,t:number[])=>s<t[0]?ORDER[0]:s<t[1]?ORDER[1]:s<t[2]?ORDER[2]:s<t[3]?ORDER[3]:ORDER[4];
const ANCHORS=[["UK",1990,"Highly Challenging"],["CA",1991,"Highly Challenging"],["US",2009,"Challenging"],["EA",2009,"Challenging"],["JP",2009,"Challenging"],["US",2008,"Balanced"],["JP",1999,"Balanced"],["AU",2009,"Supportive"],["US",2018,"Supportive"],["AU",2012,"Strongly Supportive"]] as Array<[string,number,string]>;

let best={th:[0,0,0,0],spread:1e9,round:-1};
for(let t1=40;t1<=45;t1++)for(let t2=48;t2<=59;t2++)for(let t3=64;t3<=74;t3++)for(let t4=85;t4<=87;t4++){
  const th=[t1,t2,t3,t4];
  let h=0;for(const[c,y,e]of ANCHORS){const s=at(c,y);if(s!=null&&cls(s,th)===e)h++;}
  if(h<ANCHORS.length)continue;
  const cnt:Record<string,number>={};for(const o of OBS)cnt[cls(o.score,th)]=(cnt[cls(o.score,th)]??0)+1;
  const shares=ORDER.map(l=>((cnt[l]??0)/OBS.length)*100);
  const spread=Math.max(...shares)-Math.min(...shares);
  const round=th.filter(v=>v%5===0).length;
  // most even distribution first; tie-break toward round, legible numbers
  if(spread<best.spread-0.01||(Math.abs(spread-best.spread)<=0.01&&round>best.round)) best={th,spread,round};
}
const th=best.th;
console.log("RECOMMENDED: "+th.join(" / ")+"   (round thresholds: "+best.round+"/4)");
const cnt:Record<string,number>={};for(const o of OBS)cnt[cls(o.score,th)]=(cnt[cls(o.score,th)]??0)+1;
console.log("\n  distribution over "+OBS.length+" market-years:");
for(const l of ORDER){const n=cnt[l]??0;console.log("    "+l.padEnd(20)+String(n).padStart(3)+"  "+((n/OBS.length)*100).toFixed(1).padStart(5)+"%  "+"#".repeat(Math.round(n/OBS.length*50)));}
console.log("\n  vs CURRENT 30/45/65/80: largest band was 63.0%, only 4 of 5 bands ever used.");
console.log("\n  Which CURRENT thresholds survive the evidence?");
const R=[[40,45],[48,59],[64,74],[85,87]];const cur=[30,45,65,80];
cur.forEach((v,i)=>console.log("    "+String(v).padStart(3)+"  defensible range "+R[i][0]+"-"+R[i][1]+"   "+(v>=R[i][0]&&v<=R[i][1]?"SURVIVES":"OUTSIDE — not defensible")));
