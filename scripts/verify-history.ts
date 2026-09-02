import { HISTORY } from "../lib/history";
import { computePillarScores, computeComposite } from "../lib/scoring";

// RE-PINNED TWICE ON 2026-09-01. Read both notes; they describe two
// separate methodology changes that landed the same day.
//
// ---- SECOND RE-PIN: Fiscal Resilience replaced External & Commodities
// (audit M-4 / recommendation 8). The old fifth pillar scored Brent
// crude, a single global price applied identically to all six markets.
// The new one scores each market's own government debt.
//
// EVERY YEAR ROSE, AND 2021 ROSE MOST -- roughly 8 points for all three
// markets at once. That is the clearest possible demonstration of what
// was wrong with the old pillar. Brent rose 69% in 2021 as oil recovered
// from the pandemic collapse, which scored 17.2 out of 100 and dragged
// the US, the Euro Area and Canada down TOGETHER, by the same amount, in
// a year when their actual macro positions were diverging sharply. The
// index was reporting the oil market and calling it the economy.
//
// 2020 also rose everywhere, for the mirror reason: oil COLLAPSED 34%
// that year, which the old pillar rewarded. It was scoring absolute
// price change, so a crash and a boom both counted as instability --
// giving the pandemic year an artificially decent fifth pillar.
//
// ---- FIRST RE-PIN: the neutral policy rate became per-market
// (audit H-2). MMAI had scored all six economies
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
  US: { "2019": 86.3, "2020": 57.6, "2021": 74.7, "2022": 62.7, "2023": 76.7, "2024": 80.1 },
  EA: { "2019": 71.1, "2020": 49.8, "2021": 79.5, "2022": 59.6, "2023": 62.3, "2024": 75.6 },
  CA: { "2019": 79.4, "2020": 45.9, "2021": 74.8, "2022": 69, "2023": 73.1, "2024": 79.2 },
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
