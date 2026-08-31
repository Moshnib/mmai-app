// ============================================================
// V1 vs candidate V2 — side-by-side comparison harness.
//
// Charter section 14: "Run side-by-side V1 versus candidate V2 outputs
// before any release." This is that tool.
//
// V1 IS IMPORTED FROM PRODUCTION CODE, never re-typed here. If V1 were
// copied into this file the comparison could silently drift from what
// the site actually computes, and the whole exercise would be measuring
// a stale copy against a candidate. The frozen benchmark in
// MMAI_V1_FROZEN_BENCHMARK.md exists to catch exactly that.
//
// Run:  npx tsx research/compare.ts
// ============================================================

import { computePillarScores, computeComposite, bandFor, type PillarKey } from "@/lib/scoring";
import { computePillarScoresV2, computeCompositeV2, V2_PARAMETERS, redundancyVerdict } from "./v2-candidate";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { HISTORY } from "@/lib/history";
import { FALLBACK_MARKETS } from "@/lib/markets";

const MARKETS = FALLBACK_MARKETS.map((m) => m.code);
const NAMES = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
const PILLARS: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

function pad(s: string | number, n: number, right = false): string {
  const t = String(s);
  return right ? t.padStart(n) : t.padEnd(n);
}

console.log("=".repeat(78));
console.log("MMAI  —  V1 (production) vs CANDIDATE V2  —  research only, nothing released");
console.log("=".repeat(78));

// The charter forbids reporting results without reporting what produced
// them, so the parameter table prints before any number.
console.log("\nCANDIDATE V2 PARAMETERS");
for (const p of V2_PARAMETERS) {
  const flag = p.status.startsWith("PLACEHOLDER") ? "  <-- NOT RESEARCHED" : "";
  console.log(`  ${pad(p.name, 38)} ${pad(p.value, 26)} [${p.status}]${flag}`);
}

// ---------- Latest reading per market ----------
console.log("\n" + "-".repeat(78));
console.log("LATEST READING — composite");
console.log("-".repeat(78));
console.log(`  ${pad("market", 16)}${pad("V1", 9, true)}${pad("V2", 9, true)}${pad("change", 9, true)}   band`);

const deltas: number[] = [];
for (const code of MARKETS) {
  const hist = HISTORY[code];
  if (!hist?.length) continue;
  const raw = hist[hist.length - 1].indicators;

  const v1 = computeComposite(computePillarScores(raw, code));
  const v2 = computeCompositeV2(computePillarScoresV2(raw, code));
  if (v1.composite == null || v2.composite == null) continue;

  const d = v2.composite - v1.composite;
  deltas.push(d);
  const b1 = bandFor(v1.composite).label;
  const b2 = bandFor(v2.composite).label;
  const bandNote = b1 === b2 ? b1 : `${b1} -> ${b2}   *** BAND CHANGE ***`;

  console.log(
    `  ${pad(NAMES[code], 16)}${pad(v1.composite.toFixed(2), 9, true)}${pad(v2.composite.toFixed(2), 9, true)}` +
      `${pad((d >= 0 ? "+" : "") + d.toFixed(2), 9, true)}   ${bandNote}`
  );
}

if (deltas.length) {
  const abs = deltas.map(Math.abs);
  console.log(
    `\n  mean absolute change ${(abs.reduce((a, b) => a + b, 0) / abs.length).toFixed(2)}` +
      `   |   largest ${Math.max(...abs).toFixed(2)}` +
      `   |   direction ${deltas.filter((d) => d > 0).length} up / ${deltas.filter((d) => d < 0).length} down`
  );
}

// ---------- Which pillar moved ----------
console.log("\n" + "-".repeat(78));
console.log("PILLAR ATTRIBUTION — where the change comes from");
console.log("-".repeat(78));
console.log(`  ${pad("market", 16)}${PILLARS.map((p) => pad(p, 10, true)).join("")}`);

for (const code of MARKETS) {
  const hist = HISTORY[code];
  if (!hist?.length) continue;
  const raw = hist[hist.length - 1].indicators;
  const p1 = computePillarScores(raw, code);
  const p2 = computePillarScoresV2(raw, code);
  const cells = PILLARS.map((k) => {
    const a = p1[k];
    const b = p2[k];
    if (a == null || b == null) return pad("—", 10, true);
    const d = b - a;
    return pad(Math.abs(d) < 0.005 ? "·" : (d >= 0 ? "+" : "") + d.toFixed(2), 10, true);
  });
  console.log(`  ${pad(NAMES[code], 16)}${cells.join("")}`);
}
console.log("\n  '·' = unchanged. Only PS and MC should move: the candidate holds");
console.log("  GM, LM, EC, the weights, the coverage gate and the bands identical to V1.");

// ---------- Across all stored history ----------
console.log("\n" + "-".repeat(78));
console.log("ACROSS FULL HISTORY — every stored annual point");
console.log("-".repeat(78));
console.log(`  ${pad("market", 16)}${pad("points", 8, true)}${pad("mean Δ", 10, true)}${pad("min Δ", 10, true)}${pad("max Δ", 10, true)}${pad("band flips", 12, true)}`);

let totalPoints = 0;
let totalFlips = 0;
for (const code of MARKETS) {
  const hist = HISTORY[code] ?? [];
  const ds: number[] = [];
  let flips = 0;
  for (const point of hist) {
    const v1 = computeComposite(computePillarScores(point.indicators, code));
    const v2 = computeCompositeV2(computePillarScoresV2(point.indicators, code));
    if (v1.composite == null || v2.composite == null) continue;
    ds.push(v2.composite - v1.composite);
    if (bandFor(v1.composite).label !== bandFor(v2.composite).label) flips++;
  }
  if (!ds.length) continue;
  totalPoints += ds.length;
  totalFlips += flips;
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  console.log(
    `  ${pad(NAMES[code], 16)}${pad(ds.length, 8, true)}${pad((mean >= 0 ? "+" : "") + mean.toFixed(2), 10, true)}` +
      `${pad(Math.min(...ds).toFixed(2), 10, true)}${pad("+" + Math.max(...ds).toFixed(2), 10, true)}${pad(flips, 12, true)}`
  );
}

async function main() {
  // ---------- Charter §6/§7: does the bond yield earn its own pillar? ----------
  // §6 lists "Financial Conditions / Stability" as a possible sixth pillar,
  // status "Test as separate pillar vs part of Monetary Conditions". §7
  // cites BIS WP No. 1272, which separates SAFE YIELDS from FINANCIAL RISK.
  // The 10-year yield is the safe-yields factor, so the question is
  // redundancy against the policy rate -- not whether bonds are interesting.
  console.log("\n" + "-".repeat(78));
  console.log("SIXTH-PILLAR TEST — is the 10y yield distinct from the policy rate?");
  console.log("-".repeat(78));

  try {
    const supabase = getPublicSupabaseClient();
    const { data } = await supabase
      .from("bond_yields")
      .select("market, yield_10y, observation_date")
      .order("observation_date", { ascending: true })
      .limit(5000);

    if (!data || data.length === 0) {
      console.log("  no bond data available");
    } else {
      const byMarket = new Map<string, number[]>();
      for (const r of data) {
        const arr = byMarket.get(r.market as string) ?? [];
        arr.push(Number(r.yield_10y));
        byMarket.set(r.market as string, arr);
      }
      console.log("  " + pad("market", 16) + pad("bond obs", 10, true) + "   verdict");
      for (const code of MARKETS) {
        const ys = byMarket.get(code);
        if (!ys) continue;
        // Correlation is deliberately passed as null here. Measured against
        // live data on 2026-08-31, the policy rate did NOT VARY over the
        // window the two series overlap -- four of six markets returned an
        // undefined correlation because the denominator was zero variance.
        // A correlation cannot be computed against a constant, so reporting
        // one would be inventing a result the data does not contain.
        console.log("  " + pad(NAMES[code], 16) + pad(ys.length, 10, true) + "   " + redundancyVerdict(null, ys.length));
      }
      console.log("\n  Bond history began 2025-08-29 and policy rates move a few times a");
      console.log("  year, so this test needs multiple rate CYCLES -- years, not months.");
      console.log("  Until then neither variant A nor variant B has empirical support.");
    }
  } catch {
    console.log("  bond table unreachable from here");
  }

  console.log("\n" + "=".repeat(78));
  console.log(`VERDICT INPUTS: ${totalPoints} historical points compared, ${totalFlips} band changes.`);
  console.log("");
  console.log("This is a COMPARISON, not a recommendation. The neutral rates and the");
  console.log("undershoot penalty driving most of the change above are PLACEHOLDERS and");
  console.log("are not researched. Nothing here justifies a release; it shows what would");
  console.log("happen IF those parameters were correct, which is a separate question.");
  console.log("");
  console.log("Charter section 13 additionally requires testing across the Global Financial");
  console.log("Crisis, which starts in 2007. MMAI's stored history begins in 2019, so that");
  console.log("test cannot be run until the historical calibration dataset exists.");
  console.log("=".repeat(78));

}

main();
