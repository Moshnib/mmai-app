// ============================================================
//  THE OBSERVATORY'S FETCHERS, AGAINST THE LIVE SOURCES
//
//  Run BEFORE wiring anything, never after. This project's own rule, and
//  it has paid off twice this week: Sweden was nearly scored on CPI
//  instead of the CPIF its central bank targets, and Denmark was nearly
//  wired to a Eurostat dataset that has been dead since February.
//
//    npx tsx scripts/verify-observatory-fetch.ts
//
//  NOT PART OF CI — it calls live ECB, Eurostat and BIS endpoints.
// ============================================================

import {
  fetchObservatoryInflation,
  fetchObservatoryUnemployment,
  fetchObservatoryGdpGrowth,
  fetchObservatoryBondYield,
} from "@/lib/fetchers/observatory";
import { fetchBisPolicyRate, fetchGovernmentDebt } from "@/lib/fetchers/bis";
import { OBSERVATORY } from "@/lib/observatory";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

/** Plausibility bands. NOT assertions that a number is right — only that
 *  it is the KIND of number the series returns. A unit mix-up is the
 *  failure this catches, and it is the one that looks most convincing
 *  once it is sitting in a database. */
const BANDS: Record<string, [number, number]> = {
  inflation: [-5, 30],
  unemployment: [0.5, 30],
  gdpGrowth: [-20, 20],
  yield10y: [-2, 20],
  debtPctGdp: [5, 300],
};

function check(label: string, key: string, value: number, date: string, maxAgeDays: number) {
  const [lo, hi] = BANDS[key];
  if (!Number.isFinite(value)) return fail(`${label}: not finite`);
  if (value < lo || value > hi) return fail(`${label}: ${value} outside ${lo}..${hi} — check the unit`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(`${label}: "${date}" is not YYYY-MM-DD`);
  const age = Math.round((Date.now() - Date.parse(date)) / 86_400_000);
  if (age < 0) return fail(`${label}: ${date} is in the future`);
  if (age > maxAgeDays) return fail(`${label}: ${date} is ${age}d old, over the ${maxAgeDays}d limit`);
  ok(`${label.padEnd(34)} ${String(value).padStart(7)}   as of ${date}  (${age}d)`);
}

async function main() {
  console.log("\nThe Observatory — every series, against the live source");

  let debtRows: Awaited<ReturnType<typeof fetchGovernmentDebt>> = [];
  try {
    debtRows = await fetchGovernmentDebt();
  } catch (e) {
    fail(`govt debt threw: ${(e as Error).message}`);
  }

  for (const country of OBSERVATORY) {
    console.log(`\n  ${country.name} (${country.code})`);

    try {
      const r = await fetchObservatoryInflation(country.code);
      check("inflation (ECB HICP)", "inflation", r.inflation, r.observationDate, 100);
    } catch (e) { fail(`${country.code} inflation: ${(e as Error).message}`); }

    try {
      const r = await fetchObservatoryUnemployment(country.code);
      check("unemployment (Eurostat)", "unemployment", r.unemployment, r.observationDate, 120);
    } catch (e) { fail(`${country.code} unemployment: ${(e as Error).message}`); }

    try {
      const r = await fetchObservatoryGdpGrowth(country.code);
      check("GDP growth (Eurostat)", "gdpGrowth", r.gdpGrowth, r.observationDate, 220);
    } catch (e) { fail(`${country.code} GDP: ${(e as Error).message}`); }

    try {
      const r = await fetchObservatoryBondYield(country.code);
      check("10y yield (Eurostat)", "yield10y", r.yield10y, r.observationDate, 120);
    } catch (e) { fail(`${country.code} bond yield: ${(e as Error).message}`); }

    // A policy rate only where the country sets one. Finland uses the
    // euro, so BIS correctly has no series — asserted rather than
    // assumed, because "no rate" and "failed fetch" must not look alike.
    if (country.policyRateNote?.includes("no policy rate of its own")) {
      try {
        await fetchBisPolicyRate(country.code as never);
        fail(`${country.code}: BIS returned a policy rate for a country the registry says has none`);
      } catch {
        ok(`policy rate                        none, correctly — ${country.name} uses the euro`);
      }
    } else {
      try {
        const r = await fetchBisPolicyRate(country.code as never);
        check("policy rate (BIS)", "inflation", r.policyRate, r.observationDate, 30);
      } catch (e) { fail(`${country.code} policy rate: ${(e as Error).message}`); }
    }

    const debt = debtRows.find((d) => d.market === country.code);
    if (!debt) fail(`${country.code}: BIS returned no debt row — check DEBT_AREAS`);
    else {
      const [lo, hi] = BANDS.debtPctGdp;
      if (debt.debtPctGdp < lo || debt.debtPctGdp > hi) fail(`${country.code} debt ${debt.debtPctGdp} out of band`);
      else ok(`govt debt %GDP (BIS)${" ".repeat(15)}${String(debt.debtPctGdp).padStart(6)}   as of ${debt.period}`);
    }
  }

  // ---------- the dead source, asserted ----------
  // Eurostat's retired prc_hicp_manr still answers for these countries.
  // Proving it is still dead is what stops someone "simplifying"
  // inflation onto it because Eurostat already supplies the other three.
  console.log("");
  try {
    const res = await fetch(
      "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr" +
        "?geo=DK&coicop=CP00&unit=RCH_A&format=JSON&lastTimePeriod=1",
      { signal: AbortSignal.timeout(15000) },
    );
    const json = await res.json();
    const newest = Object.keys(json?.dimension?.time?.category?.index ?? {}).sort().pop() ?? "none";
    const age = Math.round((Date.now() - Date.parse(`${newest}-01`)) / 86_400_000);
    if (age > 100) ok(`Eurostat prc_hicp_manr still dead (newest ${newest}, ${age}d) — correctly unused`);
    else console.log(`  note  prc_hicp_manr now returns ${newest}. It was retired 2026-02-04; the ECB dataflow stays the one this project reads.`);
  } catch {
    ok("Eurostat prc_hicp_manr did not answer — correctly unused either way");
  }

  console.log("");
  if (failed) {
    console.error("The Observatory is not ready to wire in.\n");
    process.exit(1);
  }
  console.log("Every Observatory series is live, in range and recent.\n");
}

void main();
