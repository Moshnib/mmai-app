// ============================================================
//  THE ANNOUNCED RANGE IS RIGHT, OR IT IS NOT SHOWN
//
//  The US card shows two numbers about the same day: the rate banks
//  actually paid (3.88%, the scored figure) and the range the Fed
//  announced (3.75-4.00%, the one the news quotes). Showing both exists to
//  remove a discrepancy a reader would otherwise read as an error, so a
//  WRONG range here is worse than no range at all -- it would be the same
//  fault, harder to spot.
//
//  WHAT KEEPS THE PAIR HONEST IS STRUCTURAL: the rate and the range are
//  two fields of one NY Fed row for one effective date, stored together,
//  read back together, and both rewritten (null included) every run.
//  readTargetRange() is the belt to that braces -- it refuses a range the
//  rate could not plausibly have sat in, which catches a source answering
//  nonsense and catches most of a range left a full decision behind. It is
//  NOT a staleness detector: a rate near the top of its range sits within
//  ten basis points of a range one cut stale, and no tolerance separates
//  those. The tests below pin where the line actually falls rather than
//  crediting it with more.
//
//  Run: npx tsx scripts/test-policy-target.ts
// ============================================================

import { readTargetRange } from "../lib/fetchers/nyfed";
import { targetFromRow, formatTarget, targetPrefix, spokenTarget } from "../lib/policyTarget";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const NONE = { targetLow: null, targetHigh: null };

// ---- at the source: what the NY Fed row actually said -------------------

// The real row on 25 September 2026, the day this was written.
check("the live row: EFFR 3.88 inside 3.75-4.00 is kept",
  readTargetRange({ percentRate: 3.88, targetRateFrom: 3.75, targetRateTo: 4 }),
  { targetLow: 3.75, targetHigh: 4 });

check("a row with no range at all stores nothing",
  readTargetRange({ percentRate: 3.88 }), NONE);

check("half a range is not a range",
  readTargetRange({ percentRate: 3.88, targetRateFrom: 3.75 }), NONE);

// THE STALENESS CASE. A rate of 3.88 against the range that ended in
// September 2026 -- the shape a carried-over range would take. Nothing is
// stored, so the card falls back to the rate alone rather than telling a
// reader the Fed is still at 5.25-5.50%.
check("a range the rate could not have sat in is refused",
  readTargetRange({ percentRate: 3.88, targetRateFrom: 5.25, targetRateTo: 5.5 }), NONE);

// ONE DECISION STALE, which is the case that would really happen. The
// tolerance was 0.5 at first and accepted this, which made the check
// decorative -- 3.88 is only 12 basis points under a 4.00 floor.
check("a range one 25bp cut out of date is refused",
  readTargetRange({ percentRate: 3.88, targetRateFrom: 4, targetRateTo: 4.25 }), NONE);
check("a range one 25bp hike out of date is refused",
  readTargetRange({ percentRate: 4.13, targetRateFrom: 3.75, targetRateTo: 4 }), NONE);

// WHERE THE LINE ACTUALLY FALLS: ten basis points outside, either side.
// September 2019's repo squeeze put EFFR 5 basis points above the ceiling
// and that is a real reading, not a fault.
check("the 2019 repo squeeze, 5bp above the ceiling, is kept",
  readTargetRange({ percentRate: 2.3, targetRateFrom: 2, targetRateTo: 2.25 }),
  { targetLow: 2, targetHigh: 2.25 });
check("exactly ten basis points outside is still kept",
  readTargetRange({ percentRate: 4.1, targetRateFrom: 3.75, targetRateTo: 4 }),
  { targetLow: 3.75, targetHigh: 4 });
check("eleven basis points outside is refused",
  readTargetRange({ percentRate: 4.11, targetRateFrom: 3.75, targetRateTo: 4 }), NONE);

check("an inverted range is refused",
  readTargetRange({ percentRate: 3.88, targetRateFrom: 4, targetRateTo: 3.75 }), NONE);

check("an absurd upper bound is refused",
  readTargetRange({ percentRate: 3.88, targetRateFrom: 3.75, targetRateTo: 400 }), NONE);

check("a non-number is refused",
  readTargetRange({ percentRate: 3.88, targetRateFrom: Number.NaN, targetRateTo: 4 }), NONE);

// A rate a little OUTSIDE the range is normal and must survive: EFFR is a
// market average and has printed a basis point or two under the floor.
check("a rate just below the floor is still a match",
  readTargetRange({ percentRate: 3.74, targetRateFrom: 3.75, targetRateTo: 4 }),
  { targetLow: 3.75, targetHigh: 4 });

// A zero floor is a real Fed range (0-0.25%), not a missing value.
check("the zero lower bound is a range, not an absent one",
  readTargetRange({ percentRate: 0.08, targetRateFrom: 0, targetRateTo: 0.25 }),
  { targetLow: 0, targetHigh: 0.25 });

// ---- reading it back out of the database --------------------------------

check("both columns present: a range", targetFromRow(3.75, 4), { low: 3.75, high: 4 });
check("both columns null: nothing", targetFromRow(null, null), null);
check("one column null: nothing, never half a range", targetFromRow(3.75, null), null);
check("a string from a loose driver is refused", targetFromRow("3.75", 4), null);
check("an inverted stored pair is refused", targetFromRow(4, 3.75), null);
check("a zero floor survives the round trip", targetFromRow(0, 0.25), { low: 0, high: 0.25 });

// ---- how it is printed ---------------------------------------------------

// TWO DECIMALS. A policy rate is set to the nearest quarter-point, and one
// decimal prints 3.75 as "3.8" -- a rate no committee ever voted for.
check("printed to the quarter-point, with an en dash",
  formatTarget({ low: 3.75, high: 4 }), { shown: "3.75–4.00%", spoken: "3.75 to 4.00 percent" });

check("a screen reader is given the word, not the dash",
  formatTarget({ low: 0, high: 0.25 }).spoken, "0.00 to 0.25 percent");

// WHICH FIGURE IS SCORED has to be said, or showing both just moves the
// confusion. The US names the Fed because that is the phrase the news uses.
check("the US line names the Fed", targetPrefix("US"), "effective rate · Fed target");
check("any other market gets neutral wording", targetPrefix("EA"), "rate paid · announced target");

// A SCREEN READER GETS THE WHOLE LINE AS A SENTENCE. The visible line is
// hidden from it, because the middot and the en dash holding that line
// together are announced as nothing -- four numbers and no grammar.
check("the spoken line is a sentence, and names the Fed for the US",
  spokenTarget("US", { low: 3.75, high: 4 }),
  "The figure above is the effective rate; the Fed's target range is 3.75 to 4.00 percent");
check("the spoken line for any other market",
  spokenTarget("EA", { low: 2, high: 2.25 }),
  "The figure above is the rate actually paid; the announced target range is 2.00 to 2.25 percent");
// The guard against somebody later handing the VISIBLE string to the
// screen reader again: neither of these characters may appear in it.
check("the spoken line contains no middot and no en dash",
  /[·–]/.test(spokenTarget("US", { low: 3.75, high: 4 })), false);

console.log(failures === 0 ? "\nAll policy-target checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
