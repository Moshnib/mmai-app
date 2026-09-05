// ============================================================
//  A BLINKING SOURCE MUST NOT WIPE A GOOD NUMBER
//
//  Bahrain's inflation vanished from Gulf Watch on roughly four days in
//  ten. The data was fine -- data.gov.bh publishes monthly and it was
//  the freshest inflation figure of the six -- but the endpoint is
//  intermittent, and a failed fetch wrote null over yesterday's value.
//
//  These pin the two rules that make carrying a value forward honest
//  rather than a quiet fabrication: the reporting date travels with the
//  value, and the whole thing expires.
//
//    npx tsx scripts/test-gulf-carry-forward.ts
// ============================================================

import {
  carryForwardGulf, carryNote, MAX_GULF_CARRY_DAYS, CARRIED_FIELDS, type StoredGulfRow,
} from "@/lib/gulfCarryForward";

let fails = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

const NOW = new Date("2026-09-06T06:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

/** Bahrain as actually stored on a good day. */
const goodRow = (fetchedAt: string): StoredGulfRow => ({
  cpi_yoy: 3, cpi_observation_date: "2026-07-01",
  fx_reserves_months_imports: 1.4165, fx_reserves_observation_date: "2024-01-01",
  current_account_pct_gdp: 4.8335, current_account_observation_date: "2024-01-01",
  real_estate_value: null, real_estate_metric_label: null, real_estate_observation_date: null,
  policy_rate: null, policy_rate_label: null, policy_rate_observation_date: null,
  fetched_at: fetchedAt,
});

/** What the refresh produces on a day data.gov.bh does not answer. */
const failedFetch = () => ({
  cpiYoy: null as number | null, cpiObservationDate: null as string | null,
  fxReservesMonths: 1.4165, fxReservesObservationDate: "2024-01-01",
  currentAccountPctGdp: 4.8335, currentAccountObservationDate: "2024-01-01",
  realEstateValue: null as number | null, realEstateMetricLabel: null as string | null,
  realEstateObservationDate: null as string | null,
  policyRate: null as number | null, policyRateLabel: null as string | null,
  policyRateObservationDate: null as string | null,
  observationDate: "2026-09-06",
});

console.log("\nBAHRAIN, the case this was built for\n");
{
  const r = carryForwardGulf(failedFetch(), goodRow(daysAgo(1)), NOW);
  ok("inflation survives a failed fetch", r.merged.cpiYoy === 3, `got ${r.merged.cpiYoy}`);
  ok("the reporting date comes with it", r.merged.cpiObservationDate === "2026-07-01",
     `got ${r.merged.cpiObservationDate}`);
  ok("only inflation is named as carried", r.carried.join() === "inflation", r.carried.join() || "(none)");
  ok("not reported as expired", !r.expired);
}

console.log("\nTHE DATE IS NEVER REFRESHED — the rule that keeps this honest\n");
{
  // Stamping a carried value with today would invent a reporting period
  // that never existed, and a reader would read a 2026-07 figure as
  // current. This is the single most important assertion in the file.
  const r = carryForwardGulf(failedFetch(), goodRow(daysAgo(3)), NOW);
  ok("does NOT stamp the carried value with today", r.merged.cpiObservationDate !== "2026-09-06");
  ok("keeps the original period exactly", r.merged.cpiObservationDate === "2026-07-01");
}

console.log("\nA LIVE FETCH IS NEVER OVERWRITTEN\n");
{
  const fresh = { ...failedFetch(), cpiYoy: 3.4, cpiObservationDate: "2026-08-01" };
  const r = carryForwardGulf(fresh, goodRow(daysAgo(1)), NOW);
  ok("today's value wins", r.merged.cpiYoy === 3.4, `got ${r.merged.cpiYoy}`);
  ok("today's date wins", r.merged.cpiObservationDate === "2026-08-01");
  ok("nothing reported as carried", r.carried.length === 0);
}

console.log(`\nIT EXPIRES AFTER ${MAX_GULF_CARRY_DAYS} DAYS\n`);
{
  const justInside = carryForwardGulf(failedFetch(), goodRow(daysAgo(MAX_GULF_CARRY_DAYS - 1)), NOW);
  ok("carries at the edge of the window", justInside.merged.cpiYoy === 3);

  const tooOld = carryForwardGulf(failedFetch(), goodRow(daysAgo(MAX_GULF_CARRY_DAYS + 1)), NOW);
  ok("a dead source shows the gap instead", tooOld.merged.cpiYoy === null);
  ok("and says so", tooOld.expired);
  ok("nothing claimed as carried", tooOld.carried.length === 0);
}

console.log("\nNO PREVIOUS ROW AT ALL\n");
{
  const r = carryForwardGulf(failedFetch(), null, NOW);
  ok("passes straight through", r.merged.cpiYoy === null);
  ok("not an expiry", !r.expired);
}

console.log("\nA LABEL TRAVELS WITH ITS VALUE\n");
{
  // Saudi's repo rate and Kuwait's discount rate are different
  // instruments, so a rate carried without its label would be a number
  // under the wrong heading.
  const prev: StoredGulfRow = {
    ...goodRow(daysAgo(1)),
    policy_rate: 4.25, policy_rate_label: "Policy rate (repo)", policy_rate_observation_date: "2026-08-30",
  };
  const r = carryForwardGulf(failedFetch(), prev, NOW);
  ok("the rate carries", r.merged.policyRate === 4.25);
  ok("the label carries with it", r.merged.policyRateLabel === "Policy rate (repo)");
  ok("and its date", r.merged.policyRateObservationDate === "2026-08-30");
}

console.log("\nA COUNTRY WITH NO SOURCE IS NOT GIVEN ONE\n");
{
  // Four of six have no policy-rate source. Carry-forward must not
  // invent one from a previous row that also had none.
  const r = carryForwardGulf(failedFetch(), goodRow(daysAgo(1)), NOW);
  ok("policy rate stays absent", r.merged.policyRate === null);
  ok("real estate stays absent", r.merged.realEstateValue === null);
  ok("neither is claimed as carried", !r.carried.includes("policy rate") && !r.carried.includes("real estate"));
}

console.log("\nEVERY CARRIED FIELD HAS A DATE TO CARRY\n");
{
  // A value field wired without its date field would carry a number
  // with no period -- the defect this whole design exists to avoid.
  for (const f of CARRIED_FIELDS) {
    ok(`${f.name} declares a date field`, typeof f.date === "string" && f.date.length > 0);
  }
}

console.log("\nTHE NOTE READS LIKE ENGLISH\n");
{
  ok("empty when nothing carried", carryNote([]) === "");
  ok("one item", carryNote(["inflation"]).includes("inflation carried forward"));
  ok("two items joined with and", carryNote(["inflation", "FX reserves"]).includes("inflation and FX reserves"));
  ok("three items use commas then and",
     carryNote(["inflation", "FX reserves", "policy rate"]).includes("inflation, FX reserves and policy rate"));
  ok("says the date is unchanged", carryNote(["inflation"]).includes("reporting date shown is unchanged"));
}

console.log("");
if (fails > 0) {
  console.error(`${fails} assertion(s) failed.\n`);
  process.exit(1);
}
console.log("Carry-forward holds: a blinking source keeps its number, a dead one shows the gap.\n");
export {};
