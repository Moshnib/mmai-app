// ============================================================
// AUDIT TEST 2 — are the pillars measuring the right QUANTITY?
//
// MMAI reads LEVELS: GDP growth level, unemployment level. Macroeconomic
// theory generally relates GAPS and CHANGES, not levels:
//
//   Okun's law relates the CHANGE in unemployment to the deviation of
//   output growth from trend. It does NOT say "3% growth implies 5%
//   unemployment" -- that depends on each economy's structure.
//
// Section 8.1 reported GM and LM correlating at only 0.17, and read that
// as evidence of pillar independence. An auditor should ask the harder
// question: is that independence REAL, or an artefact of comparing a
// rate of change (growth) against a level (unemployment)?
//
// If the Okun relationship appears once both are expressed as changes,
// then MMAI's low correlation is a measurement choice, not an economic
// fact -- and the claim of independence is weaker than stated.
//
//   npx tsx research/audit-okun.ts
// ============================================================
import panel from "./historical-panel.json";

type Row={year:number;inflation:number|null;gdpGrowth:number|null;unemployment:number|null;policyRate:number|null;brentYoY:number|null};
const P=panel as unknown as {panel:Record<string,Row[]>;markets:Array<{code:string;name:string}>};

const corr=(a:number[],b:number[])=>{
  const n=a.length; if(n<3) return NaN;
  const ma=a.reduce((x,y)=>x+y,0)/n, mb=b.reduce((x,y)=>x+y,0)/n;
  const num=a.reduce((s,_,i)=>s+(a[i]-ma)*(b[i]-mb),0);
  const den=Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)*b.reduce((s,v)=>s+(v-mb)**2,0));
  return den===0?NaN:num/den;
};

console.log("OKUN'S LAW TEST — growth vs the CHANGE in unemployment\n");
console.log("  Theory: faster growth should coincide with FALLING unemployment,");
console.log("  so the expected correlation is NEGATIVE and material.\n");
console.log("  market   n    corr(growth, unemployment LEVEL)   corr(growth, CHANGE in unemployment)");

const allG:number[]=[], allU:number[]=[], allDU:number[]=[], allGforDU:number[]=[];
for(const m of P.markets){
  const rs=(P.panel[m.code]??[]).filter(r=>r.gdpGrowth!=null&&r.unemployment!=null).sort((a,b)=>a.year-b.year);
  const g=rs.map(r=>r.gdpGrowth as number), u=rs.map(r=>r.unemployment as number);
  const du:number[]=[], gd:number[]=[];
  for(let i=1;i<rs.length;i++){ if(rs[i].year-rs[i-1].year!==1) continue; du.push(u[i]-u[i-1]); gd.push(g[i]); }
  allG.push(...g); allU.push(...u); allDU.push(...du); allGforDU.push(...gd);
  console.log(`  ${m.code.padEnd(8)} ${String(rs.length).padStart(2)}   ${corr(g,u).toFixed(3).padStart(10)}                     ${corr(gd,du).toFixed(3).padStart(10)}`);
}
console.log(`\n  POOLED   ${String(allG.length).padStart(2)}   ${corr(allG,allU).toFixed(3).padStart(10)}                     ${corr(allGforDU,allDU).toFixed(3).padStart(10)}`);

const levelR=corr(allG,allU), changeR=corr(allGforDU,allDU);
console.log("\n  READING");
console.log(`  Growth vs unemployment LEVEL:   r = ${levelR.toFixed(3)}  -- weak, which is what MMAI measures`);
console.log(`  Growth vs unemployment CHANGE:  r = ${changeR.toFixed(3)}  -- this is Okun's law`);
if (Math.abs(changeR) > Math.abs(levelR) * 1.5) {
  console.log("\n  The relationship IS present in the data. MMAI does not see it,");
  console.log("  because it compares a rate of change against a level.");
  console.log("  The low GM-LM correlation is therefore partly a MEASUREMENT");
  console.log("  artefact, not purely evidence of economic independence.");
}
