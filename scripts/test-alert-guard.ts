// The alert-comparability guard, exercised directly. Getting this wrong
// means either spamming every subscriber at cutover or silently swallowing
// real alerts for weeks, and neither is visible until it has happened.

const ALERT_ENGINE_V1 = "v1.0";
const ALERT_ENGINE_V2 = "v2.0";

function engineBehindBand(version: string | null, alertEngine: string) {
  if (version === null) return null;
  return version.includes(alertEngine) ? alertEngine : version;
}
function comparable(prev: string | null, cur: string, alertEngine: string) {
  return prev === null || engineBehindBand(prev, alertEngine) === engineBehindBand(cur, alertEngine);
}

let fails = 0;
const ok = (label: string, cond: boolean) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`); };

console.log("\nDURING MIGRATION — band still comes from v1.0\n");
ok("both rows carry v2 — comparable", comparable("v1.0+v2.0", "v1.0+v2.0", ALERT_ENGINE_V1));
ok("v2 dropped out this run — STILL comparable, band is v1 either way",
   comparable("v1.0+v2.0", "v1.0", ALERT_ENGINE_V1));
ok("v2 came back this run — still comparable",
   comparable("v1.0", "v1.0+v2.0", ALERT_ENGINE_V1));
ok("first ever row — comparable (nothing to compare)", comparable(null, "v1.0+v2.0", ALERT_ENGINE_V1));

console.log("\nAT CUTOVER — ALERT_ENGINE flips to v2.0\n");
ok("yesterday v1-only, today v2 headline — NOT comparable, alert suppressed",
   !comparable("v1.0", "v1.0+v2.0", ALERT_ENGINE_V2));

console.log("\nAFTER CUTOVER\n");
ok("both rows carry v2 — comparable again", comparable("v1.0+v2.0", "v1.0+v2.0", ALERT_ENGINE_V2));
ok("v2 could not be computed today — NOT comparable, correctly suppressed",
   !comparable("v1.0+v2.0", "v1.0", ALERT_ENGINE_V2));

console.log("\n" + (fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`));
if (fails) process.exit(1);

// No imports, so TypeScript would treat this as a global script and its
// top-level names would collide with every other script. This makes it a
// module.
export {};
