import { computePillarScores, computeComposite, bandFor } from "../lib/scoring";

const cases: Array<{
  name: string;
  code: string;
  raw: { inflation: number; gdpGrowth: number; unemployment: number; policyRate: number | null; brentYoY: number; debtPctGdp: number };
  expectedComposite: number | null;
  expectedBand: string;
}> = [
  { name: "US", code: "US", raw: { inflation: 3.4, gdpGrowth: 1.5, unemployment: 4.2, policyRate: 3.63, brentYoY: -5, debtPctGdp: 111.0 }, expectedComposite: 78.6, expectedBand: "Supportive" },
  { name: "Euro Area", code: "EA", raw: { inflation: 2.9, gdpGrowth: 1.0, unemployment: 6.3, policyRate: 2.25, brentYoY: -5, debtPctGdp: 85.3 }, expectedComposite: 77.3, expectedBand: "Supportive" },
  { name: "Canada", code: "CA", raw: { inflation: 2.8, gdpGrowth: 3.4, unemployment: 6.4, policyRate: 2.25, brentYoY: -5, debtPctGdp: 96.1 }, expectedComposite: 80, expectedBand: "Supportive" },
  { name: "UK", code: "UK", raw: { inflation: 2.8, gdpGrowth: 0.4, unemployment: 4.9, policyRate: 3.75, brentYoY: -5, debtPctGdp: 88.8 }, expectedComposite: 77.3, expectedBand: "Supportive" },
];
// Note: expected values are UNCHANGED from the six-pillar specification.
// Proportional weight redistribution (new_weight = old_weight / 0.80) is
// mathematically identical to the runtime reweighting v1.0 already applied
// whenever Market Momentum was missing — which was every market, every time.
// UAE case removed 2026-08-19 (market discontinued — see lib/markets.ts).
// All four expected composites changed on 2026-09-01 when the neutral
// policy rate became PER-MARKET (audit H-2). MMAI had applied a single
// 2.5% to every economy; each market now uses a published estimate --
// US 3.01, Canada 3.76, Euro Area 2.09, UK 3.00.
//
// Canada moves the most (83.4 -> 80.6) because its policy rate of 2.25%
// is 1.5 points BELOW a 3.76% neutral, where against 2.5% it looked
// almost exactly neutral. Nothing about Canada changed; the benchmark
// it is measured against became the right one.
//
// No BAND changed in these four cases.
//
// All four expected composites changed AGAIN on 2026-09-01 when Fiscal
// Resilience replaced External & Commodities (audit M-4 / rec 8). The old
// fifth pillar scored Brent crude -- one global price written identically
// to all six markets -- so it added the SAME 9.81 points to every
// composite and could not affect the ranking. The new pillar scores each
// market's own government debt against the Maastricht 60% reference.
//
// The debt figures here are the real BIS 2025-Q4 readings, not invented
// fixtures: US 111.0, Euro Area 85.3, Canada 96.1, UK 88.8. A fixture
// carrying a plausible-looking number nobody can trace is a fixture that
// stops meaning anything the first time someone asks where it came from.
//
// Canada moves most (80.6 -> 80.0) and no BAND changed in these four.
//
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
