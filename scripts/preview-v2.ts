// Prints what the new engine produces for the six published markets,
// beside what the old one says. Not a verifier -- a look before wiring.
import { FALLBACK_MARKETS, scoreMarket, scoreMarketV2 } from "../lib/markets";
import { percentileBandLabel, areTied, DIMENSION_NAMES } from "../lib/composite";

const rows = FALLBACK_MARKETS.map((m) => {
  const v1 = scoreMarket(m);
  const v2 = scoreMarketV2(m);
  return { m, v1, v2 };
}).sort((a, b) => (b.v2.percentile ?? -1) - (a.v2.percentile ?? -1));

console.log("\nmarket            old    new    band                    Conditions  Direction  Capacity");
console.log("-".repeat(94));
for (const { m, v1, v2 } of rows) {
  const p = v2.percentile, dp = v2.dimensionPercentiles;
  console.log(
    `${m.name.padEnd(16)}${(v1.composite?.toFixed(1) ?? "n/a").padStart(6)}` +
    `${(p?.toFixed(1) ?? "n/a").padStart(7)}   ${percentileBandLabel(p).padEnd(22)}` +
    `${(dp ? dp.C.toFixed(1) : "-").padStart(9)}${(dp ? dp.D.toFixed(1) : "-").padStart(11)}${(dp ? dp.K.toFixed(1) : "-").padStart(10)}`
  );
}

console.log("\nties (closer together than the measured uncertainty):");
let found = false;
for (let i = 0; i < rows.length - 1; i++) {
  if (areTied(rows[i].v2.percentile, rows[i + 1].v2.percentile)) {
    console.log(`  ${rows[i].m.name} and ${rows[i + 1].m.name}` +
      ` — ${Math.abs((rows[i].v2.percentile ?? 0) - (rows[i + 1].v2.percentile ?? 0)).toFixed(1)} points apart`);
    found = true;
  }
}
if (!found) console.log("  none");

console.log("\ndimension keys: " + Object.entries(DIMENSION_NAMES).map(([k, v]) => `${k}=${v}`).join("  "));
