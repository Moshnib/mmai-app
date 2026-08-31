// Measures what sourced HLW neutral rates would do to the live composites.
// RESEARCH ONLY -- see research/README.md for why this must not ship
// piecemeal. Run: npx tsx research/rstar-impact.ts
import { monetaryConditionsScore, bandFor } from "@/lib/scoring";
// Live composites read from Supabase, 31 Aug 2026
const LIVE: Record<string,{name:string;composite:number;policy:number}> = {
  EA:{name:"Euro Area",composite:79.1885,policy:2.25},
  JP:{name:"Japan",composite:79.1269,policy:0.977},
  US:{name:"United States",composite:77.2085,policy:3.63},
  UK:{name:"United Kingdom",composite:76.6596,policy:3.75},
  CA:{name:"Canada",composite:76.4952,policy:2.25},
  AU:{name:"Australia",composite:75.8486,policy:4.35},
};
// HLW 2026Q2, NY Fed, released 27 Aug 2026. Nominal = real r* + 2% target.
const NEUTRAL: Record<string,number|null> = { US:1.009+2, CA:1.759+2, EA:0.086+2, UK:null, JP:null, AU:null };

console.log("  market            policy   neutral   MC old    MC new     composite         band");
const out: {code:string;c:number}[] = [];
for (const [code,m] of Object.entries(LIVE)) {
  const n = NEUTRAL[code];
  if (n == null) { console.log(`  ${m.name.padEnd(16)}  ${m.policy.toFixed(2).padStart(5)}   NOT COVERED BY HLW — needs a documented alternative`); out.push({code,c:m.composite}); continue; }
  const mcOld = monetaryConditionsScore(m.policy, 2.5);
  const mcNew = monetaryConditionsScore(m.policy, n);
  const d = (mcNew - mcOld) * 0.1875;
  const cNew = m.composite + d;
  out.push({code,c:cNew});
  const b1=bandFor(m.composite).label, b2=bandFor(cNew).label;
  console.log(`  ${m.name.padEnd(16)}  ${m.policy.toFixed(2).padStart(5)}   ${n.toFixed(2).padStart(5)}   ${mcOld.toFixed(2).padStart(6)}  ${mcNew.toFixed(2).padStart(6)}   ${m.composite.toFixed(2)} -> ${cNew.toFixed(2)}  ${((d>=0?"+":"")+d.toFixed(2)).padStart(6)}  ${b1===b2?b2:b1+" -> "+b2+" ***"}`);
}
out.sort((a,b)=>b.c-a.c);
console.log("\n  rank now  : " + Object.entries(LIVE).sort((a,b)=>b[1].composite-a[1].composite).map(x=>x[0]).join(" > "));
console.log("  rank after: " + out.map(o=>o.code).join(" > ") + "   (3 of 6 unchanged — no sourced neutral rate)");
