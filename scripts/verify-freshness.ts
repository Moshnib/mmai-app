// ============================================================
// THE CHECK THAT WOULD HAVE CAUGHT THE EUROSTAT FAILURE
//
// On 4 February 2026 Eurostat retired the euro area HICP dataset. It kept
// answering instantly and kept returning December 2025. MMAI published a
// nine-month-old inflation figure as live, and the Euro Area was shown as
// "Supportive" when it was "Balanced". Nothing alerted, because every
// check in the project measured `fetched_at` -- when we last ASKED.
//
// This verifies the rules in lib/freshness.ts, which the refresh route
// applies to every figure it writes.
//
// NO NETWORK, NO API KEYS, NO DATABASE. It runs in CI, where none of
// those exist. It tests the LOGIC against fixtures, plus one structural
// guarantee that matters more than it looks: that every live source in
// the registry has a cadence this module knows how to judge. A source
// whose cadence falls through the map would be silently unchecked --
// exactly the hole being closed.
//
//   npx tsx scripts/verify-freshness.ts
// ============================================================

import { MAX_AGE_DAYS, stalenessOf, quarterToDate, ageInDays } from "../lib/freshness";
import { SOURCES, type SourceCadence } from "../lib/sources";

const NOW = Date.parse("2026-09-02T00:00:00Z");
const dayFmt = (daysAgo: number) =>
  new Date(NOW - daysAgo * 86_400_000).toISOString().slice(0, 10);

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

console.log("Freshness rules\n");

// ---------- the real case, replayed ----------
// Eurostat's last euro area HICP observation was 2025-12-01. On the day
// it was found, that was 275 days old against a 100-day monthly limit.
const eurostat = stalenessOf({ cadence: "monthly" }, "2025-12-01", NOW);
check("THE EUROSTAT CASE: Dec 2025 HICP is caught as stale", eurostat?.stale, true);
check("  ...and reports the real age", eurostat?.ageDays, 275);

// It would have fired 175 days sooner, in mid-May rather than September.
const wouldHaveFiredOn = new Date(Date.parse("2025-12-01") + 101 * 86_400_000)
  .toISOString()
  .slice(0, 10);
check("  ...would have fired on 2026-03-12, not 2026-09-02", wouldHaveFiredOn, "2026-03-12");

// The replacement passes.
check("The ECB replacement (Aug 2026) passes", stalenessOf({ cadence: "monthly" }, "2026-08-01", NOW)?.stale, false);

// ---------- boundaries ----------
console.log("");
for (const [cadence, limit] of Object.entries(MAX_AGE_DAYS) as Array<[SourceCadence, number | null]>) {
  if (limit == null) {
    check(`${cadence}: not age-checked (a rate that has not moved is not stale)`,
      stalenessOf({ cadence }, dayFmt(5000), NOW), null);
    continue;
  }
  check(`${cadence}: ${limit - 1}d old passes`, stalenessOf({ cadence }, dayFmt(limit - 1), NOW)?.stale, false);
  check(`${cadence}: ${limit}d old passes (limit is inclusive)`, stalenessOf({ cadence }, dayFmt(limit), NOW)?.stale, false);
  check(`${cadence}: ${limit + 1}d old FAILS`, stalenessOf({ cadence }, dayFmt(limit + 1), NOW)?.stale, true);
}

// ---------- things that legitimately lag must NOT fire ----------
console.log("");
// UK GDP is genuinely ~6 months behind: the ONS national accounts lag two
// quarters. Verified against the ONS directly on 2026-09-02 -- IHYR ends
// at 2026 Q1. If this ever fails, the limit is too tight, NOT the ONS.
check("UK GDP at 2026-03-01 (real ONS lag) does not fire",
  stalenessOf({ cadence: "quarterly" }, "2026-03-01", NOW)?.stale, false);
// Gulf Watch runs on World Bank annual data 1-2 years behind by design.
check("Gulf annual data from 2025-01-01 does not fire",
  stalenessOf({ cadence: "annual" }, "2025-01-01", NOW)?.stale, false);
// BIS debt, published as a quarter label.
check("BIS 2025-Q4 converts to a date", quarterToDate("2025-Q4"), "2025-12-31");
check("A malformed quarter returns null, not a wrong date", quarterToDate("2025-Q9"), null);

// THE CASE THAT FORCED maxAgeDays TO EXIST. The BIS publishes credit
// statistics about three quarters behind, so 2025-Q4 was still the newest
// on 2026-09-02 -- 245 days old, past the 240-day quarterly default. The
// first version of this file flagged it, correctly by its own rules and
// wrongly in fact. Loosening ALL quarterly checks to fit the slowest
// source would have let a dead ONS series run for over a year, so the
// allowance is attached to the BIS rows instead.
check("BIS 2025-Q4 WOULD fail the quarterly default",
  stalenessOf({ cadence: "quarterly" }, quarterToDate("2025-Q4"), NOW)?.stale, true);
check("  ...and passes with its own documented allowance",
  stalenessOf({ cadence: "quarterly", maxAgeDays: 420 }, quarterToDate("2025-Q4"), NOW)?.stale, false);

// The allowance must actually be on the rows, not just possible.
const debtRows = SOURCES.filter((s) => s.indicator.startsWith("Government Debt"));
check("Every BIS debt row carries the allowance",
  debtRows.filter((s) => s.maxAgeDays == null).map((s) => s.market), []);
check("  ...and there are seven of them", debtRows.length, 7);

// THE SECOND FALSE POSITIVE THIS FILE CAUGHT BEFORE SHIPPING. ONS
// labour-market data runs about four months behind: verified against the
// ONS on 2026-09-02, series MGSX ended at 2026 MAY, so the live figure
// was 124 days old against a 100-day monthly default. Genuinely the
// newest published, so the check -- not the ONS -- was wrong.
check("UK unemployment at 2026-05-01 WOULD fail the monthly default",
  stalenessOf({ cadence: "monthly" }, "2026-05-01", NOW)?.stale, true);
const ukUnemp = SOURCES.find((s) => s.market === "United Kingdom" && s.indicator === "Unemployment");
check("  ...and passes with the ONS allowance on its row",
  ukUnemp ? stalenessOf(ukUnemp, "2026-05-01", NOW)?.stale : "row missing", false);

// Every relaxation must say why. An undocumented override is how a
// limit quietly becomes meaningless.
const undocumented = SOURCES.filter((s) => s.maxAgeDays != null && !s.note);
check("Every maxAgeDays override explains itself in `note`",
  undocumented.map((s) => `${s.market}/${s.indicator}`), []);

// ---------- null means "no opinion", never "fine" ----------
console.log("");
check("Missing date -> null", stalenessOf({ cadence: "monthly" }, null, NOW), null);
check("Unparseable date -> null", stalenessOf({ cadence: "monthly" }, "not-a-date", NOW), null);

// A FUTURE date is a parser reading a field it does not understand. It
// must not sail through as "very fresh".
check("A date 30 days in the future is flagged", stalenessOf({ cadence: "monthly" }, dayFmt(-30), NOW)?.stale, true);
check("A date 1 day ahead is tolerated (timezone slack)", stalenessOf({ cadence: "monthly" }, dayFmt(-1), NOW)?.stale, false);

check("ageInDays is signed", ageInDays(dayFmt(10), NOW), 10);

// ---------- structural: nothing may be silently unchecked ----------
console.log("");
const known = new Set(Object.keys(MAX_AGE_DAYS));
const unknown = SOURCES.filter((s) => !known.has(s.cadence));
check("Every source's cadence is one this module knows", unknown.map((s) => `${s.market}/${s.indicator}`), []);

// A live source that SCORES a pillar and is not age-checked is the exact
// blind spot this file exists to close. Policy rates are the intended and
// only exemption; anything else appearing here needs a decision, not a
// shrug.
const unchecked = SOURCES.filter(
  (s) => s.status === "live" && s.pillar != null && MAX_AGE_DAYS[s.cadence] == null
);
const nonPolicy = unchecked.filter((s) => s.pillar !== "MC");
check("No scored pillar is unchecked except policy rates",
  nonPolicy.map((s) => `${s.market}/${s.indicator} (${s.cadence})`), []);

console.log("");
if (failures > 0) {
  console.log(`${failures} FAILED — DO NOT SHIP`);
  process.exit(1);
}
console.log("All freshness rules hold.");
