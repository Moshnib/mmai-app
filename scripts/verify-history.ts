import { HISTORY } from "../lib/history";
import { computePillarScores, computeComposite } from "../lib/scoring";

// Every value below was RE-PINNED on 2026-09-01 when the neutral policy
// rate became per-market (audit H-2). MMAI had scored all six economies
// against a single 2.5%; each now uses a published estimate, so every
// historical Monetary Conditions score -- and therefore every composite --
// moved.
//
// Directions differ and that is the point:
//   US   mostly DOWN pre-2023, UP after -- neutral rose 2.5 -> 3.01, so
//        the low-rate years now look further from neutral and the
//        high-rate years closer.
//   EA   small moves either way -- neutral barely changed, 2.5 -> 2.09.
//   CA   the largest moves -- neutral 2.5 -> 3.76, so Canada's low-rate
//        years score markedly worse and its 2023 tightening better.
//
// These are NOT a correction of an error in the history. The inputs are
// unchanged; the benchmark they are measured against became the right one.
//
// This test failing is what caught the omission when the neutral-rate
// change shipped without updating it -- which is exactly what it is for.
const expected: Record<string, Record<string, number | null>> = {
  US: { "2019": 86.4, "2020": 55.1, "2021": 66.6, "2022": 58, "2023": 75.5, "2024": 81.5 },
  EA: { "2019": 70.9, "2020": 46.6, "2021": 70.9, "2022": 54.2, "2023": 60.4, "2024": 76.3 },
  CA: { "2019": 78.9, "2020": 42.9, "2021": 66.2, "2022": 63.7, "2023": 71.4, "2024": 80.2 },
};

let allPass = true;
for (const market of Object.keys(expected)) {
  for (const point of HISTORY[market]) {
    if (!(point.year in expected[market])) continue;
    const pillars = computePillarScores(point.indicators, market);
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
