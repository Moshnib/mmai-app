// ============================================================
// First look: run V1 scoring over the historical panel.
//
// This is the test charter §13 has been blocked on -- "include normal
// expansions, recessions, the Global Financial Crisis". It could not be
// run before because MMAI's live history begins in 2019.
//
//   npx tsx research/score-historical-panel.ts
//
// Reads the panel built by build-historical-panel.ts and scores it with
// PRODUCTION equations imported from lib/scoring.ts, never a copy.
// ============================================================

import { computePillarScores, computeComposite, bandFor } from "../lib/scoring";
import panel from "./historical-panel.json";

const P = panel as unknown as {
  panel: Record<string, Array<{
    year: number; inflation: number | null; gdpGrowth: number | null;
    unemployment: number | null; policyRate: number | null; brentYoY: number | null;
  }>>;
  markets: Array<{ code: string; name: string }>;
};

const CODES = P.markets.map((m) => m.code);
const pad = (s: string | number, n: number) => String(s).padStart(n);

console.log("MMAI v1.0 scored over the historical panel, 1990-2018\n");
console.log("  year   " + CODES.map((c) => pad(c, 7)).join("") + "     note");

const byYear: Record<number, Record<string, number | null>> = {};
for (const code of CODES) {
  for (const row of P.panel[code] ?? []) {
    const { composite } = computeComposite(computePillarScores(row, code));
    (byYear[row.year] ??= {})[code] = composite;
  }
}

const NOTES: Record<number, string> = {
  1998: "Asian financial crisis",
  2001: "dot-com recession",
  2008: "GLOBAL FINANCIAL CRISIS",
  2009: "GFC trough",
  2011: "euro sovereign debt crisis",
  2015: "oil price collapse",
};

for (const y of Object.keys(byYear).map(Number).sort((a, b) => a - b)) {
  const cells = CODES.map((c) => {
    const v = byYear[y][c];
    return pad(v == null ? "—" : v.toFixed(1), 7);
  }).join("");
  console.log(`  ${y}   ${cells}     ${NOTES[y] ?? ""}`);
}

// Does the index actually fall in the crisis?
console.log("\n--- Does MMAI drop through the GFC? ---");
for (const code of CODES) {
  const at = (y: number) => byYear[y]?.[code] ?? null;
  const pre = at(2007), trough = Math.min(...[2008, 2009].map((y) => at(y) ?? Infinity));
  if (pre == null || !Number.isFinite(trough)) { console.log(`  ${code}  insufficient data`); continue; }
  const drop = trough - pre;
  console.log(
    `  ${code}  2007 ${pad(pre.toFixed(1), 5)}  ->  2008/09 low ${pad(trough.toFixed(1), 5)}` +
    `   ${pad((drop >= 0 ? "+" : "") + drop.toFixed(1), 6)}   ${bandFor(pre).label} -> ${bandFor(trough).label}`
  );
}

// Range check: does the index use its scale, or bunch up?
console.log("\n--- Does the index use its 0-100 range? ---");
const all = Object.values(byYear).flatMap((r) => Object.values(r)).filter((v): v is number => v != null);
all.sort((a, b) => a - b);
const q = (p: number) => all[Math.floor(p * (all.length - 1))];
console.log(`  n=${all.length}   min ${all[0].toFixed(1)}   p25 ${q(0.25).toFixed(1)}   median ${q(0.5).toFixed(1)}   p75 ${q(0.75).toFixed(1)}   max ${all[all.length - 1].toFixed(1)}`);
const bands: Record<string, number> = {};
for (const v of all) bands[bandFor(v).label] = (bands[bandFor(v).label] ?? 0) + 1;
console.log("  band distribution: " + Object.entries(bands).map(([k, v]) => `${k} ${v}`).join("  ·  "));
