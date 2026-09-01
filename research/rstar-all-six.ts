// ============================================================
// Neutral rates for ALL SIX markets — audit finding H-2 revisited.
//
// I stated repeatedly that no published r* estimate exists for the UK,
// Japan or Australia. THAT WAS WRONG, and it was never checked. All
// three central banks publish estimates.
//
// What differs is not existence but MACHINE-READABILITY:
//
//   US, CA, EA   NY Fed HLW spreadsheet, quarterly, automatable
//   JP           BoJ publishes an XLSX of SIX model estimates, quarterly
//                (rev26e04b.xlsx, 27 Mar 2026) -- automatable
//   UK           BoE: Monetary Policy Report and speeches. Prose only.
//   AU           RBA: Bulletin and speeches, nine models. Prose only.
//
// So four of six can be fetched; two must be transcribed with a citation
// and a review date -- exactly the pattern INFLATION_TARGET already uses,
// where hardcoded values are pinned to sources by a test.
//
//   npx tsx research/rstar-all-six.ts
// ============================================================
import { monetaryConditionsScore, bandFor, inflationTargetFor } from "../lib/scoring";

interface Est { code:string; name:string; real:number|null; nominal:number; source:string; auto:boolean; note?:string }

// BoJ 2025Q3, median of the six published models:
//   Del Negro -0.396 | Goy-Iwasaki -0.935 | HLW -0.469
//   Imakubo -0.317   | Nakajima +0.530    | Okazaki-Sudo +0.424
const BOJ = [-0.396,-0.935,-0.469,-0.317,0.530,0.424].sort((a,b)=>a-b);
const bojMedian = (BOJ[2]+BOJ[3])/2;

const EST: Est[] = [
  { code:"US", name:"United States", real:1.009, nominal:1.009+2.0, auto:true,
    source:"NY Fed HLW 2026Q2" },
  { code:"CA", name:"Canada", real:1.759, nominal:1.759+2.0, auto:true,
    source:"NY Fed HLW 2026Q2" },
  { code:"EA", name:"Euro Area", real:0.086, nominal:0.086+2.0, auto:true,
    source:"NY Fed HLW 2026Q2" },
  { code:"JP", name:"Japan", real:bojMedian, nominal:bojMedian+2.0, auto:true,
    source:"BoJ Review 2026-E-4, median of 6 models, 2025Q3",
    note:`models span ${BOJ[0].toFixed(2)} to ${BOJ[5].toFixed(2)} -- wide, and the BoJ says so` },
  { code:"UK", name:"United Kingdom", real:null, nominal:3.0, auto:false,
    source:"BoE Governor, February 2026 -- nominal, stated directly",
    note:"prose, not a data file; needs periodic manual review" },
  { code:"AU", name:"Australia", real:1.0, nominal:1.0+2.5, auto:false,
    source:"RBA Bulletin Sep 2017, ~1% real",
    note:"NINE YEARS OLD -- the weakest of the six and must be refreshed" },
];

const LIVE: Record<string,{comp:number;policy:number}> = {
  EA:{comp:79.1885,policy:2.25}, JP:{comp:79.1269,policy:0.977},
  US:{comp:77.2085,policy:3.63}, UK:{comp:76.6596,policy:3.75},
  CA:{comp:76.4952,policy:2.25}, AU:{comp:75.8486,policy:4.35},
};

console.log("NEUTRAL RATE, ALL SIX MARKETS\n");
console.log("  market            r* real   nominal   MMAI uses   automatable   source");
for(const e of EST)
  console.log(`  ${e.name.padEnd(16)} ${(e.real==null?"  n/a":e.real.toFixed(2).padStart(6))}   ${e.nominal.toFixed(2).padStart(6)}      2.50        ${e.auto?"yes":"NO "}       ${e.source}`);

console.log("\n\nIMPACT IF ALL SIX WERE SOURCED\n");
console.log("  market            policy   neutral   MC old   MC new   composite            band");
const after:{code:string;c:number}[]=[];
for(const e of EST){
  const l=LIVE[e.code];
  const mcOld=monetaryConditionsScore(l.policy,2.5);
  const mcNew=monetaryConditionsScore(l.policy,e.nominal);
  const c=l.comp+(mcNew-mcOld)*0.1875;
  after.push({code:e.code,c});
  const b1=bandFor(l.comp).label,b2=bandFor(c).label;
  console.log(`  ${e.name.padEnd(16)} ${l.policy.toFixed(2).padStart(5)}    ${e.nominal.toFixed(2).padStart(5)}   ${mcOld.toFixed(1).padStart(6)}  ${mcNew.toFixed(1).padStart(6)}   ${l.comp.toFixed(2)} -> ${c.toFixed(2)}   ${b1===b2?b2:b1+" -> "+b2+" ***"}`);
}
after.sort((a,b)=>b.c-a.c);
console.log("\n  rank now  : " + Object.entries(LIVE).sort((a,b)=>b[1].comp-a[1].comp).map(x=>x[0]).join(" > "));
console.log("  rank after: " + after.map(a=>a.code).join(" > "));

console.log("\n\nCAVEATS THAT MUST TRAVEL WITH THIS");
for(const e of EST) if(e.note) console.log(`  ${e.code}  ${e.note}`);
