// ============================================================
//  THE OBSERVATORY RETRIES A MISSED FIGURE, AND NEVER LOSES ONE
//
//  19 September 2026: the 03:03 run got no answer from the ECB for
//  Denmark's inflation, and the page showed N/A all day, because later
//  runs stopped before the Observatory step. Every run now retries
//  incomplete countries (lib/observatory.ts). What must hold:
//
//    a complete country is left alone     (no needless fetches or rows)
//    an incomplete one is fetched again   (the whole point)
//    a figure that fails AGAIN keeps today's earlier value, with ITS date
//    a euro member is complete without a policy rate
//
//    npx tsx scripts/test-observatory-retry.ts
// ============================================================

import { OBSERVATORY, needsObservatoryFetch, fillFromEarlier, type ObservatoryRow } from "@/lib/observatory";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const country = (code: string) => {
  const c = OBSERVATORY.find((x) => x.code === code);
  if (!c) throw new Error(`no ${code} in the Observatory`);
  return c;
};
const DK = country("DK");
const FI = country("FI");

const full: Partial<ObservatoryRow> = {
  country_code: "DK",
  inflation: 2, unemployment: 6.7, gdp_growth: 4.6, yield_10y: 3.03, debt_pct_gdp: 25.1, policy_rate: 2.1,
  inflation_observation_date: "2026-08-01", unemployment_observation_date: "2026-07-01", gdp_observation_date: "2026-06-01",
  yield_observation_date: "2026-08-01", debt_observation_period: "2026-Q1", policy_rate_observation_date: "2026-09-15",
};

// ---------- who gets fetched ----------
if (!needsObservatoryFetch(undefined, DK)) fail("a country with no row today is not fetched");
else ok("no row today: fetched");

if (needsObservatoryFetch(full, DK)) fail("a complete country is fetched again");
else ok("complete today: left alone");

if (!needsObservatoryFetch({ ...full, inflation: null, inflation_observation_date: null }, DK)) fail("Denmark with no inflation (19 September) is not retried");
else ok("one missing figure: retried (Denmark's inflation, 19 September)");

if (!needsObservatoryFetch({ ...full, policy_rate: null }, DK)) fail("a country that sets its own rate is complete without one");
else ok("a missing policy rate counts where the country sets one");

if (needsObservatoryFetch({ ...full, country_code: "FI", policy_rate: null, policy_rate_observation_date: null }, FI)) fail("Finland is retried forever for a rate it does not have");
else ok("a euro member is complete without a policy rate");

// ---------- what gets written ----------
{
  const fresh: Partial<ObservatoryRow> = { ...full, inflation: 2.2, inflation_observation_date: "2026-08-01", yield_10y: null, yield_observation_date: null };
  const earlier: Partial<ObservatoryRow> = { ...full, inflation: null, inflation_observation_date: null, yield_10y: 3.03, yield_observation_date: "2026-07-01" };
  const out = fillFromEarlier(fresh, earlier);
  if (out.inflation !== 2.2) fail(`the figure the retry did get was replaced: ${out.inflation}`);
  else if (out.yield_10y !== 3.03 || out.yield_observation_date !== "2026-07-01") fail(`a figure that failed again was lost, or kept without its own date: ${out.yield_10y} ${out.yield_observation_date}`);
  else ok("the retry adds what it got and keeps, with its own date, what failed again");
}
{
  // A release landed between runs: this morning 6.7% for June, now 6.8%
  // for July. The new figure wins; the morning's is history, not a fill.
  const fresh: Partial<ObservatoryRow> = { ...full, unemployment: 6.8, unemployment_observation_date: "2026-08-01" };
  const out = fillFromEarlier(fresh, full);
  if (out.unemployment !== 6.8 || out.unemployment_observation_date !== "2026-08-01") fail(`this morning's figure overwrote a newer one: ${out.unemployment} ${out.unemployment_observation_date}`);
  else ok("a figure that moved since this morning keeps its new value and date");
}
{
  const fresh: Partial<ObservatoryRow> = { ...full, debt_pct_gdp: null, debt_observation_period: null };
  const out = fillFromEarlier(fresh, undefined);
  if (out.debt_pct_gdp !== null) fail("a first run of the day invented a figure");
  else ok("with nothing earlier today, a gap stays a gap");
}

console.log("");
if (failed) {
  console.error("The Observatory would show N/A all day, or lose a figure it had.\n");
  process.exit(1);
}
console.log("Missed figures are retried every run; nothing already shown is lost.\n");
