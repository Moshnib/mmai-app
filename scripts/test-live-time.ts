// ============================================================
//  THE REFRESH STAMP, IN WHOSE CLOCK?
//
//  The site said "last refresh Sep 27, 12:44 PM UTC". A reader in the Gulf
//  had to add four hours in their head before they could tell whether that
//  was this morning or yesterday -- and the site was reported as "not
//  updated today" on a day it had updated. The stamp now reads in the
//  reader's own timezone.
//
//  TWO THINGS HAVE TO HOLD AT ONCE and they pull against each other:
//
//    the server has no idea what zone the reader is in, so it must render
//    UTC -- and the browser must render the same string on its first pass,
//    or React throws the markup away with a hydration warning;
//
//    once the browser has ticked, the same moment must read in the
//    reader's own clock, and must SAY which clock, or "9:44 PM" is a
//    worse answer than "12:44 PM UTC" was.
//
//  IT ASSERTS AGAINST WHATEVER ZONE IT RUNS IN, rather than pinning one:
//  the first two checks are zone-independent by construction, and the rest
//  compare the rendered string against this machine's own clock. CI runs it
//  three times under different TZ values to get real coverage.
//
//  ON WINDOWS, `TZ=...` DOES NOTHING -- Node there reads the system zone and
//  ignores the variable, so a local run only ever covers your own zone.
//  Verified on this machine: `TZ=Asia/Tokyo node -e ...` still reported
//  Asia/Dubai. Do not read a local pass as coverage of three zones.
//
//  Run: npx tsx scripts/test-live-time.ts
// ============================================================

import { formatWhen, formatAgo } from "../lib/liveTime";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}
function checkMatch(label: string, actual: string, re: RegExp) {
  const ok = re.test(actual);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected to match ${re}`}`);
  if (!ok) failures++;
}

// The real stamp from 27 September 2026, when this was reported.
const STAMP = "2026-09-27T12:44:57.649Z";

// ---- what the server renders, and the browser's first pass ---------------

// UTC, always, whatever machine this runs on. A CI runner is UTC and a
// Vercel function is UTC, but the assertion must not depend on that: the
// default is the point.
check("the server renders UTC", formatWhen(STAMP), "Sep 27, 12:44 PM UTC");
check("no argument means the same as local=false", formatWhen(STAMP), formatWhen(STAMP, false));

// ---- what the reader sees once the browser has ticked --------------------

// This process's own zone is the reader's, for the purposes of the test.
// The harness at the bottom re-runs the whole file under several.
const local = formatWhen(STAMP, true);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// IT MUST NAME THE ZONE. "9:44 PM" alone is ambiguous in a way the UTC
// version never was, so a stamp that dropped the zone would be a
// regression dressed as an improvement.
checkMatch(`in ${zone}, the zone is named`, local, /(UTC|GMT[+-]\d|[A-Z]{2,5})$/);
checkMatch("the shape is unchanged: month, day, time", local, /^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2} (AM|PM) /);

// THE HOUR SHOWN IS ACTUALLY THE READER'S HOUR. Not "a string came back"
// -- the digits have to be the ones on the reader's clock, or the change
// is cosmetic and the Gulf reader is still doing arithmetic.
const shownHour12 = Number(/(\d{2}):\d{2}/.exec(local)?.[1]) % 12;
check(`the hour shown is this machine's own hour (${zone})`,
  shownHour12, new Date(STAMP).getHours() % 12);

// And outside UTC it must therefore DIFFER from what the server rendered.
// Skipped in UTC, where the two are the same string by definition.
if (new Date(STAMP).getTimezoneOffset() !== 0) {
  check("a reader outside UTC is not shown the server's clock",
    local === formatWhen(STAMP), false);
}

// In UTC itself the two forms must agree exactly -- there is nothing to
// convert, so any difference would be the formatter treating the two
// paths differently rather than the clock.
if (zone === "UTC" || zone === "Etc/UTC") {
  check("under UTC the local form equals the server form", local, formatWhen(STAMP));
}

// ---- the footer's form, which is the one that carries the year ----------

// THE GAP A REVIEWER FOUND: nothing exercised `withYear`, so deleting it
// outright passed the whole file -- and the footer, the copy of this
// formatter that was nearly missed altogether, is its only caller.
check("the footer's form carries the year",
  formatWhen(STAMP, false, { withYear: true }), "Sep 27, 2026, 12:44 PM UTC");
check("the year does not leak into every other caller",
  /\d{4}/.test(formatWhen(STAMP)), false);
check("the footer's form follows the reader's clock too",
  formatWhen(STAMP, true, { withYear: true }).includes(String(new Date(STAMP).getFullYear())), true);

// ---- the "ago" line, which is zone-free by construction -----------------

// Elapsed time is the same number everywhere on earth. It is asserted
// because it is rendered right beside the stamp, and a reader comparing
// the two would notice immediately if one drifted.
const at = Date.parse(STAMP);
check("ago: under a minute", formatAgo(STAMP, at + 30_000), "just now");
check("ago: minutes", formatAgo(STAMP, at + 14 * 60_000), "14 min ago");
check("ago: hours and minutes", formatAgo(STAMP, at + (3 * 60 + 12) * 60_000), "3 h 12 m ago");
check("ago: a day", formatAgo(STAMP, at + 25 * 3_600_000), "1 day ago");
check("ago: days", formatAgo(STAMP, at + 50 * 3_600_000), "2 days ago");
// A clock that is behind the stamp must not print a negative age.
check("ago: never negative", formatAgo(STAMP, at - 60_000), "just now");

console.log(failures === 0 ? `\nThe refresh stamp reads correctly in ${zone}.` : `\n${failures} check(s) failed in ${zone}.`);
process.exit(failures === 0 ? 0 : 1);
