// ============================================================
//  BEING ONE RELEASE BEHIND IS NORMAL. TWO IS A MISSED RELEASE.
//
//  This exists because the first version of the source audit asked the
//  wrong question and would have failed the daily run roughly six to
//  eight times a month.
//
//  It compared `now - liveDate` against a two-day grace. But `liveDate`
//  is the REPORTING PERIOD, not the release date. A monthly figure is
//  stamped the first of its month, so it is already ~40 days old on the
//  morning it is published; a quarterly one ~100. The grace was
//  therefore unreachable for 16 of the 20 probes -- every ordinary
//  release day would have gone red in the evening and green again at
//  06:10 the next morning.
//
//  It LOOKED correct because the only series it was ever observed on was
//  the daily UK policy rate, where period age and release age coincide.
//  One passing case was mistaken for a working design.
//
//  Counting whole releases needs no clock and no memory, and is the same
//  answer at any hour of any day.
//
//    npx tsx scripts/test-releases-behind.ts
// ============================================================

import { releasesBehind, releasesMissed } from "@/lib/sourceAudit";

type Case = {
  what: string;
  cadence: "daily" | "monthly" | "quarterly";
  stored: string;
  live: string;
  want: number;
  fails: boolean;
};

const CASES: Case[] = [
  // ---- the release-day cases the old rule got wrong ----
  { what: "US unemployment, August just published", cadence: "monthly", stored: "2026-07-01", live: "2026-08-01", want: 1, fails: false },
  { what: "UK GDP, Q2 just published", cadence: "quarterly", stored: "2026-03-01", live: "2026-06-01", want: 1, fails: false },
  { what: "UK policy rate, a new trading day", cadence: "daily", stored: "2026-09-08", live: "2026-09-09", want: 1, fails: false },

  // ---- level with the source: the ordinary state ----
  { what: "inflation, level", cadence: "monthly", stored: "2026-07-01", live: "2026-07-01", want: 0, fails: false },
  { what: "GDP, level", cadence: "quarterly", stored: "2026-06-01", live: "2026-06-01", want: 0, fails: false },

  // ---- genuinely missed, and no timing argument makes it innocent ----
  { what: "inflation stuck two months", cadence: "monthly", stored: "2026-06-01", live: "2026-08-01", want: 2, fails: true },
  { what: "GDP stuck two quarters", cadence: "quarterly", stored: "2025-12-01", live: "2026-06-01", want: 2, fails: true },
  { what: "policy rate stuck a week (5 working days)", cadence: "daily", stored: "2026-09-02", live: "2026-09-09", want: 5, fails: true },

  // ---- weekends and holidays: a daily rate is published on trading days ----
  // 15 September 2026, as it happened: the afternoon run compared Friday
  // with Monday, counted three calendar days, and went red for nothing.
  { what: "policy rate, Friday against Monday", cadence: "daily", stored: "2026-09-11", live: "2026-09-14", want: 1, fails: false },
  { what: "Friday against Tuesday after a Monday holiday", cadence: "daily", stored: "2026-09-04", live: "2026-09-08", want: 2, fails: false },
  { what: "Thursday against the next Tuesday: three trading days lost", cadence: "daily", stored: "2026-09-03", live: "2026-09-08", want: 3, fails: true },
  { what: "the Eurostat case: nine months", cadence: "monthly", stored: "2025-12-01", live: "2026-09-01", want: 9, fails: true },

  // ---- year boundaries, where a naive month subtraction goes negative ----
  { what: "December to January", cadence: "monthly", stored: "2025-12-01", live: "2026-01-01", want: 1, fails: false },
  { what: "Q4 to Q1", cadence: "quarterly", stored: "2025-09-01", live: "2025-12-01", want: 1, fails: false },
];

let failures = 0;

console.log("\n  releases  verdict           case");
for (const c of CASES) {
  const got = releasesBehind(c.cadence, c.stored, c.live);
  const wouldFail = releasesMissed(c.cadence, c.stored, c.live);
  const ok = got === c.want && wouldFail === c.fails;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  ${String(got).padStart(2)}      ${(wouldFail ? "RELEASES MISSED" : got === 0 ? "level" : "behind, fine").padEnd(16)}  ${c.what}` +
    (ok ? "" : `   -- wanted ${c.want} / ${c.fails ? "fail" : "pass"}`),
  );
}

// THE REGRESSION ITSELF. If someone reintroduces an age-of-period rule,
// these two are what it gets wrong, so assert the shape directly rather
// than trusting the table above to be read.
if (releasesMissed("monthly", "2026-07-01", "2026-08-01")) {
  console.error("\n  A figure published today must never read as a missed release.");
  failures++;
}
if (!releasesMissed("monthly", "2025-12-01", "2026-09-01")) {
  console.error("\n  Nine months behind must always read as a missed release.");
  failures++;
}

console.log("");
if (failures > 0) {
  console.error(`${failures} case(s) wrong.\n`);
  process.exit(1);
}
console.log(`All ${CASES.length} cases correct: a fresh release is never an alarm, a missed one always is.\n`);
export {};
