import { computePillarScores, computeComposite, bandFor } from "../lib/scoring";

const cases: Array<{
  name: string;
  code: string;
  raw: { inflation: number; gdpGrowth: number; unemployment: number; policyRate: number | null; brentYoY: number };
  expectedComposite: number | null;
  expectedBand: string;
}> = [
  { name: "US", code: "US", raw: { inflation: 3.4, gdpGrowth: 1.5, unemployment: 4.2, policyRate: 3.63, brentYoY: -5 }, expectedComposite: 78.6, expectedBand: "Supportive" },
  { name: "Euro Area", code: "EA", raw: { inflation: 2.9, gdpGrowth: 1.0, unemployment: 6.3, policyRate: 2.25, brentYoY: -5 }, expectedComposite: 77.3, expectedBand: "Supportive" },
  { name: "Canada", code: "CA", raw: { inflation: 2.8, gdpGrowth: 3.4, unemployment: 6.4, policyRate: 2.25, brentYoY: -5 }, expectedComposite: 83.4, expectedBand: "Supportive" },
  { name: "UK", code: "UK", raw: { inflation: 2.8, gdpGrowth: 0.4, unemployment: 4.9, policyRate: 3.75, brentYoY: -5 }, expectedComposite: 76.5, expectedBand: "Supportive" },
];
// Note: expected values are UNCHANGED from the six-pillar specification.
// Proportional weight redistribution (new_weight = old_weight / 0.80) is
// mathematically identical to the runtime reweighting v1.0 already applied
// whenever Market Momentum was missing — which was every market, every time.
// UAE case removed 2026-08-19 (market discontinued — see lib/markets.ts).
// Canada's expected BAND changed on 2026-08-31 when the thresholds were
// recalibrated against 173 market-years (85/74/55/40, was 80/65/45/30).
// Its composite is UNCHANGED at 83.4 -- only the label moved, because
// "Strongly Supportive" now begins at 85 rather than 80. Intended, not
// a regression.
//
// A code was added to each case on 2026-08-31 when inflation targets became
// per-market. Expected values are UNCHANGED: all four of these markets score
// against 2.0. Australia, the only market with a different benchmark (2.5,
// the midpoint of the RBA band), has never had a case here.

let allPass = true;

for (const c of cases) {
  const pillars = computePillarScores(c.raw, c.code);
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
