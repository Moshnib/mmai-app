// ============================================================
//  KOREA'S FETCHERS, AGAINST THE LIVE SOURCES
//
//  Run BEFORE wiring a market in, never after. A fetcher that is wrong in
//  the refresh route fails at 06:10 against a database, where the only
//  evidence is a null.
//
//    npx tsx scripts/verify-korea-fetch.ts
//
//  NOT PART OF CI: it calls live OECD and BIS endpoints.
// ============================================================

import { fetchKoreaReadings } from "@/lib/fetchers/korea";
import { fetchBisPolicyRate, fetchGovernmentDebt } from "@/lib/fetchers/bis";
import { INDICATOR_STATS, q } from "@/lib/composite";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const BANDS: Record<string, [number, number]> = {
  inflation: [-3, 15],
  unemployment: [1, 20],
  gdpGrowth: [-15, 15],
  policyRate: [-2, 15],
  debtPctGdp: [5, 300],
};

function check(label: string, key: string, value: number, date: string, maxAgeDays: number) {
  const [lo, hi] = BANDS[key];
  if (!Number.isFinite(value)) return fail(`${label}: not finite (${value})`);
  if (value < lo || value > hi) return fail(`${label}: ${value} outside ${lo}..${hi} — check the unit`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(`${label}: date "${date}" is not YYYY-MM-DD`);
  const age = Math.round((Date.now() - Date.parse(date)) / 86_400_000);
  if (age < 0) return fail(`${label}: observation date ${date} is in the future`);
  if (age > maxAgeDays) return fail(`${label}: ${date} is ${age}d old, over the ${maxAgeDays}d limit`);
  ok(`${label.padEnd(34)} ${String(value).padStart(7)}   as of ${date}  (${age}d)`);
  return value;
}

async function main() {
  console.log("\nKorea — every series, against the live source\n");

  const r = await fetchKoreaReadings();
  for (const e of r.errors) fail(e);

  let inflation: number | null = null;
  let unemployment: number | null = null;
  let gdpGrowth: number | null = null;

  if (r.inflation) inflation = check("inflation (OECD CPI)", "inflation", r.inflation.inflation, r.inflation.observationDate, 100) ?? null;
  if (r.unemployment) unemployment = check("unemployment (OECD)", "unemployment", r.unemployment.unemployment, r.unemployment.observationDate, 120) ?? null;
  if (r.gdpGrowth) gdpGrowth = check("GDP growth YoY (OECD)", "gdpGrowth", r.gdpGrowth.gdpGrowth, r.gdpGrowth.observationDate, 220) ?? null;

  let policyRate: number | null = null;
  let debt: number | null = null;

  try {
    const p = await fetchBisPolicyRate("KR");
    policyRate = check("policy rate (BIS)", "policyRate", p.policyRate, p.observationDate, 30) ?? null;
  } catch (e) { fail(`policy rate threw: ${(e as Error).message}`); }

  try {
    const rows = await fetchGovernmentDebt();
    const kr = rows.find((x) => x.market === "KR");
    if (!kr) fail("govt debt: BIS returned no KR row — check DEBT_AREAS");
    else {
      debt = kr.debtPctGdp;
      ok(`govt debt %GDP (BIS)${" ".repeat(15)}${String(kr.debtPctGdp).padStart(7)}   as of ${kr.period}`);
    }
  } catch (e) { fail(`govt debt threw: ${(e as Error).message}`); }

  // ---------- THE TEST THAT REJECTED FIVE OTHER COUNTRIES ----------
  //
  // A reading outside the reference distribution does not produce a bad
  // score, it produces a MEANINGLESS one: Brazil's 14% policy rate pegged
  // Capacity at 100 and ranked it first; South Africa's 32.4%
  // unemployment pegged Conditions at 0 and a seven-point improvement
  // would not have moved it. Korea was chosen because nothing pegs, so
  // this asserts that rather than trusting it to stay true.
  console.log("");
  const checks: [string, Parameters<typeof q>[0], number | null][] = [
    ["inflation gap", "infGap", inflation != null ? Math.abs(inflation - 2.0) : null],
    ["unemployment", "une", unemployment],
    ["gdp growth", "gdp", gdpGrowth],
    ["policy rate", "rate", policyRate],
    ["govt debt", "debt", debt],
  ];
  for (const [label, key, v] of checks) {
    if (v == null) continue;
    const z = q(key, v);
    if (Math.abs(z) > 3) {
      fail(
        `${label} is ${z > 0 ? "+" : ""}${z.toFixed(1)} SD from the reference mean ` +
          `(${INDICATOR_STATS[key].mean.toFixed(2)}). Beyond 3 SD the dimension pegs and the score stops responding.`,
      );
    } else {
      ok(`${label.padEnd(34)} ${z >= 0 ? "+" : ""}${z.toFixed(2)} SD — inside the reference distribution`);
    }
  }

  console.log("");
  if (failed) {
    console.error("Korea is not ready to wire in.\n");
    process.exit(1);
  }
  console.log("Every Korean series is live, in range, recent, and inside the distribution.\n");
}

void main();
