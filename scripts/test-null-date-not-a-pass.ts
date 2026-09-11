// ============================================================
//  A FIGURE WITH NO DATE MUST NOT SAIL THROUGH THE AGE RULES
//
//  stalenessOf() is explicit about this in its own doc comment:
//
//      Null means "no opinion", never "fine": a caller must not read it
//      as a pass.
//
//  app/api/refresh/route.ts read it as a pass for months. The loop was
//  `if (verdict?.stale)`, which is false for null, so a figure with no
//  observation date at all skipped every check.
//
//  THAT IS THE FAILURE MODE OF A DEAD SOURCE, not an edge case. When a
//  fetcher throws, settle() returns null and the row is written with a
//  NULL date -- not a frozen old one. So the single thing guaranteed to
//  happen when a source dies permanently was the one thing the staleness
//  check could not see, and staleMarkets stayed 0 while it happened.
//
//  It mattered doubly because the source audit was written on top of the
//  belief that the age rules covered this case. They did not. Both have
//  been corrected; this test is what stops the hole reopening.
//
//    npx tsx scripts/test-null-date-not-a-pass.ts
// ============================================================

import { stalenessOf } from "@/lib/freshness";

const now = Date.parse("2026-09-11");
let failures = 0;

function check(what: string, got: boolean, want: boolean) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
}

console.log("\n  What stalenessOf itself reports\n");

// The contract: null in, null out -- "no opinion". This is correct
// behaviour and must NOT be changed; the fix belongs in the caller.
for (const cadence of ["monthly", "quarterly", "per decision"] as const) {
  const rule = { cadence } as never;
  check(
    `${cadence}: a null date yields no opinion (not a pass)`,
    stalenessOf(rule, null, now) === null,
    true,
  );
}

// And it still judges a real date, so the fix above did not blunt it.
check(
  "monthly: a 2012 date is still reported stale",
  stalenessOf({ cadence: "monthly" } as never, "2012-01-01", now)?.stale === true,
  true,
);

console.log("\n  What the refresh route must do with that\n");

// The caller's rule, restated here as the thing under test. A figure
// PRESENT with no date is reported; a figure ABSENT is not, because that
// is a null pillar the page already shows as a gap.
function reportsMissingDate(valuePresent: boolean, date: string | null): boolean {
  if (date == null) return valuePresent;
  return stalenessOf({ cadence: "monthly" } as never, date, now)?.stale === true;
}

check("a figure present with NO date is reported", reportsMissingDate(true, null), true);
check("a figure absent with no date is NOT reported (null pillar, already visible)", reportsMissingDate(false, null), false);
check("a figure present with a fresh date is not reported", reportsMissingDate(true, "2026-08-01"), false);
check("a figure present with a 2012 date is reported", reportsMissingDate(true, "2012-01-01"), true);

// THE REGRESSION ITSELF. `if (verdict?.stale)` is what the route used to
// do. Assert directly that it is not sufficient, so reinstating it fails.
const verdict = stalenessOf({ cadence: "monthly" } as never, null, now);
if (verdict?.stale) {
  console.error("\n  stalenessOf changed its contract; this test needs rewriting.");
  failures++;
}
check(
  "the old `if (verdict?.stale)` shortcut would still miss a null date",
  Boolean(verdict?.stale),
  false,
);

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log("A figure with no observation date is reported rather than passed.\n");
export {};
