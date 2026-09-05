// ============================================================
//  THE ALERT COMPARABILITY GUARD
//
//  A band change only earns an email if the two readings were produced by
//  the same engine. Otherwise the day MMAI changes its formula, every
//  market's band moves at once and every subscriber is emailed about an
//  economic event that did not happen.
//
//  THIS TEST EXISTS BECAUSE THE FIRST VERSION OF THE GUARD WOULD HAVE
//  FAILED AT THE ONE MOMENT IT WAS BUILT FOR.
//
//  It normalised the stamp: a row whose formula_version CONTAINED the
//  alert engine counted as that engine. That was right during the
//  migration, when the stamp flapped between "v1.0" and "v1.0+v2.0"
//  depending on whether v2 managed to compute, while the band came from v1
//  either way.
//
//  But by cutover day every recent row was stamped "v1.0+v2.0". Flipping
//  ALERT_ENGINE to "v2.0" would have made the normaliser read yesterday's
//  row AND today's as "v2.0" -- identical, therefore comparable -- and
//  emailed every subscriber about six simultaneous band changes caused by
//  the formula moving. Exactly the wave the guard exists to prevent.
//
//  With one engine the stamp cannot flap, so the comparison is now exact.
//
//    npx tsx scripts/test-alert-guard.ts
// ============================================================

/** Mirrors the guard in app/api/refresh/route.ts. */
function comparable(previousVersion: string | null, currentVersion: string): boolean {
  return previousVersion === null || previousVersion === currentVersion;
}

let fails = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
};

console.log("\nTHE CUTOVER ITSELF — the case the old guard got wrong\n");
ok("yesterday carried both engines, today is v2-only — NOT comparable, wave suppressed",
   !comparable("v1.0+v2.0", "v2.0"));
ok("a row from before v2 was written at all — NOT comparable, also suppressed",
   !comparable("v1.0", "v2.0"));

console.log("\nWHY THE OLD NORMALISING GUARD WAS UNSAFE\n");
{
  // The behaviour that shipped before this change, reproduced exactly.
  const oldGuard = (prev: string | null, cur: string, engine: string) => {
    const norm = (v: string | null) => (v === null ? null : v.includes(engine) ? engine : v);
    return prev === null || norm(prev) === norm(cur);
  };
  ok("old guard would have called cutover day comparable, and emailed everyone",
     oldGuard("v1.0+v2.0", "v1.0+v2.0", "v2.0") === true);
  ok("the new guard does not", !comparable("v1.0+v2.0", "v2.0"));
}

console.log("\nSTEADY STATE AFTER THE CUTOVER\n");
ok("both rows v2 — comparable, real alerts resume the next day",
   comparable("v2.0", "v2.0"));
ok("first ever row for a market — comparable, nothing to compare against",
   comparable(null, "v2.0"));

console.log("\nA FUTURE ENGINE CHANGE\n");
ok("v2 to a hypothetical v3 — suppressed once, without anyone remembering to",
   !comparable("v2.0", "v3.0"));

console.log("\nWHAT THE STAMP CANNOT DO ANY MORE\n");
{
  // Under v2 a run that loses an indicator withholds the score entirely,
  // so it writes no band -- there is nothing to alert on and nothing to
  // compare. The stamp stays "v2.0" either way, which is why it can no
  // longer flap and why exact comparison is safe.
  ok("a withheld score does not change the stamp", comparable("v2.0", "v2.0"));
}

console.log("\n" + (fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`));
if (fails) process.exit(1);
export {};
