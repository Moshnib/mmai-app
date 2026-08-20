import { computePillarScores, computeComposite, bandFor } from "../lib/scoring";

const cases: Array<{
  name: string;
  raw: { inflation: number; gdpGrowth: number; unemployment: number; policyRate: number | null; brentYoY: number };
  expectedComposite: number | null;
  expectedBand: string;
}> = [
  { name: "US", raw: { inflation: 3.4, gdpGrowth: 1.5, unemployment: 4.2, policyRate: 3.63, brentYoY: -5 }, expectedComposite: 78.6, expectedBand: "Supportive" },
  { name: "Euro Area", raw: { inflation: 2.9, gdpGrowth: 1.0, unemployment: 6.3, policyRate: 2.25, brentYoY: -5 }, expectedComposite: 77.3, expectedBand: "Supportive" },
  { name: "Canada", raw: { inflation: 2.8, gdpGrowth: 3.4, unemployment: 6.4, policyRate: 2.25, brentYoY: -5 }, expectedComposite: 83.4, expectedBand: "Strongly Supportive" },
  { name: "UK", raw: { inflation: 2.8, gdpGrowth: 0.4, unemployment: 4.9, policyRate: 3.75, brentYoY: -5 }, expectedComposite: 76.5, expectedBand: "Supportive" },
];
// Note: expected values are UNCHANGED from the six-pillar specification.
// Proportional weight redistribution (new_weight = old_weight / 0.80) is
// mathematically identical to the runtime reweighting v1.0 already applied
// whenever Market Momentum was missing — which was every market, every time.
// UAE case removed 2026-08-19 (market discontinued — see lib/markets.ts).

let allPass = true;

for (const c of cases) {
  const pillars = computePillarScores(c.raw);
  const result = computeComposite(pillars);
  const band = bandFor(result.composite);

  const actualComposite = result.composite === null ? null : Math.round(result.composite * 10) / 10;
  const compositeMatch = actualComposite === c.expectedComposite;
  const bandMatch = band.label === c.expectedBand;
  const pass = compositeMatch && bandMatch;
  allPass = allPass && pass;

  console.log(
    `${pass ? "PASS" : "FAIL"}  ${c.name.padEnd(12)} composite=${actualComposite ?? "N/A"} (expected ${c.expectedComposite ?? "N/A"})  band=${band.label} (expected ${c.expectedBand})  coverage=${(result.coverage * 100).toFixed(1)}%`
  );
}

console.log("\n" + (allPass ? "ALL CASES PASSED" : "SOME CASES FAILED — DO NOT SHIP"));
process.exit(allPass ? 0 : 1);
