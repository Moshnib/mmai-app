// ============================================================
//  WHICH STEPS THE PUBLISHING WINDOW HOLDS BACK, AND WHICH IT MUST NOT
//
//  scripts/test-publish-window.sh checks that the gate answers correctly
//  for every hour. This checks the other half: that the answer is WIRED to
//  the right steps. Both are needed -- a perfect gate attached to nothing
//  is a comment.
//
//  Three ways this goes wrong, none of which fails a build or moves a
//  pixel, and all of which are silent for months:
//
//    a data step loses its gate      the 07:43 run publishes at 07:43 and
//                                    a morning's European releases go out
//                                    a day late -- the harm the window
//                                    exists to prevent
//    the audit gains no gate         a run that published nothing compares
//                                    yesterday's stored figures against
//                                    today's sources, calls that a
//                                    disagreement, and emails a red build
//                                    on a morning when nothing is wrong
//    the heartbeat GAINS a gate      the monitor stops hearing from the
//                                    early runs, and `always() && gate`
//                                    also skips it whenever the gate step
//                                    itself fails -- the alarm goes down
//                                    with the thing it reports
//
//  Read as text rather than parsed as YAML on purpose: js-yaml is only a
//  transitive dependency here, and a test that adds a dependency to check
//  a config file is a poor trade.
//
//  Run: npx tsx scripts/test-refresh-schedule.ts
// ============================================================

import { readFileSync } from "node:fs";

const FILE = ".github/workflows/refresh.yml";
const text = readFileSync(FILE, "utf8");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const GATE = "steps.gate.outputs.go == 'true'";

/** The `if:` on the step whose name starts with `nameStart`, or null when
 *  it has none. Steps are split on the two-space-indented "- name:" that
 *  every step in this file uses. */
function ifOf(nameStart: string): string | null {
  const blocks = text.split("\n      - name: ").slice(1);
  const block = blocks.find((b) => b.startsWith(nameStart));
  if (!block) return "STEP NOT FOUND";
  const line = block.split("\n").find((l) => /^\s{8}if:/.test(l));
  return line ? line.replace(/^\s*if:\s*/, "").trim() : null;
}

// ---- the steps that must wait for the window ----------------------------

// Everything that fetches or writes the day's figures. The first of these
// to run is what the site shows for the rest of the day.
for (const step of [
  "Fetch Japan unemployment from OECD",
  "Fetch Korea inflation",
  "Refresh scored markets",
  "Check out the relay script",
  "Fetch Gulf figures",
  "Refresh Gulf Watch",
]) {
  check(`"${step}" waits for the publishing window`, ifOf(step), GATE);
}

// The audit runs even after a failure -- that is the point of it -- but
// not on a run that published nothing.
check("the source audit runs after a failure, but not outside the window",
  ifOf("Published figures still agree"), `always() && ${GATE}`);

// ---- the steps that must NOT wait ---------------------------------------

// Videos have no once-a-day guard, so an early run costs nothing and puts
// them up sooner.
check("saving videos is never held back", ifOf("Save central bank videos"), "always()");

// The alarm that exists to notice GitHub not running this file at all.
check("the heartbeat is never held back", ifOf("Heartbeat"), "always()");

// ---- the schedule itself -------------------------------------------------

const crons = [...text.matchAll(/^\s*- cron: "(.+)"$/gm)].map((m) => m[1]);
check("six runs a day, two of them before the window opens", crons, [
  "43 07 * * *", "43 08 * * *", "43 10 * * *", "43 13 * * *", "43 16 * * *", "43 18 * * *",
]);
// The early pair is the whole point: GitHub has not started one of these
// on time once in the observed record, so a cron at 07:43 is really a
// request for "some time between 10:00 and 12:45".
check("the early runs were ADDED, not swapped in", crons.includes("43 10 * * *"), true);
// Nothing may be scheduled inside the hour the gate refuses, or that run
// is pure cost with no possible outcome.
check("nothing is scheduled at 23:00", crons.some((c) => c.startsWith("43 23")), false);

console.log(failures === 0 ? "\nThe publishing window is wired to the right steps." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
