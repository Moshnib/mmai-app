// ============================================================
//  A HUNG BROWSER SUITE IS KILLED, AND SAYS SO
//
//  scripts/run-browser-checks.ts runs the browser suites two at a time and
//  prints each one's output when it finishes. A suite that hangs would
//  otherwise print nothing at all until GitHub ends the whole job at its
//  own limit, and the log would show no reason. So each child has its own
//  limit; this pins that it is enforced, reported, and that the child's
//  earlier output survives.
//
//  Run: npx tsx scripts/test-browser-runner.ts
// ============================================================

import { runChecks } from "./run-browser-checks";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

async function main() {
  const quiet = () => {};
  const [hung] = await runChecks(["fixtures/hang"], 1, 4000, quiet);
  check("a hung suite is killed, not left running", hung.timedOut, true);
  check("...and reported as a failure", hung.ok, false);
  check("...with what it had printed before it hung", hung.output.includes("started, and will now hang"), true);
  check("...and a line saying why", hung.output.includes("hung"), true);
  check("...within its limit, not the job's", hung.seconds < 20, true);

  console.log(failures === 0 ? "\nAll browser-runner checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
