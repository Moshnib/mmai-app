import { HISTORY } from "../lib/history";
import { computePillarScores, computeComposite } from "../lib/scoring";

const expected: Record<string, Record<string, number | null>> = {
  US: { "2019": 87.6, "2020": 56.2, "2021": 67.8, "2022": 59.2, "2023": 74.4, "2024": 80.4 },
  EA: { "2019": 70.0, "2020": 45.7, "2021": 70.0, "2022": 53.3, "2023": 61.3, "2024": 77.2 },
  CA: { "2019": 81.8, "2020": 45.7, "2021": 69.0, "2022": 66.5, "2023": 68.5, "2024": 77.3 },
};

let allPass = true;
for (const market of Object.keys(expected)) {
  for (const point of HISTORY[market]) {
    if (!(point.year in expected[market])) continue;
    const pillars = computePillarScores(point.indicators);
    const { composite } = computeComposite(pillars);
    const rounded = composite === null ? null : Math.round(composite * 10) / 10;
    const exp = expected[market][point.year];
    const pass = rounded === exp;
    allPass = allPass && pass;
    console.log(`${pass ? "PASS" : "FAIL"}  ${market} ${point.year}: ${rounded} (expected ${exp})`);
  }
}
console.log(allPass ? "\nALL HISTORY POINTS STILL MATCH UNDER 5-PILLAR SPEC" : "\nMISMATCH — DO NOT SHIP");
process.exit(allPass ? 0 : 1);
