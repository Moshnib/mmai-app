// ============================================================
//  THE BROWSER CHECKS, A FEW AT A TIME
//
//  Eight suites load every page in a real browser against one already
//  running `next start`. Run one after another they take about fifteen
//  minutes of a CI runner; run two at a time, about nine. On 22 September
//  2026 the month's Actions minutes ran out and GitHub refused every job
//  for two days -- the data refresh with them -- so this is not
//  housekeeping.
//
//  TWO AT A TIME, NOT MORE. A GitHub runner has two cores, and these
//  suites measure real layout: check-layout and check-text-legibility read
//  rendered sizes, which a starved CPU can change. Raise MMAI_CHECK_JOBS
//  only with evidence that a run of twenty stays clean.
//
//  Each child's output is buffered and printed in one block under its own
//  name, so a parallel run still reads like a sequential one, and the
//  summary names every suite that failed.
//
//  A SUITE THAT HANGS IS KILLED AT TWELVE MINUTES and reported with
//  whatever it had printed. Without that, a hung browser gives no output
//  at all until the job's own 20-minute limit ends the run.
//
//    npx tsx scripts/run-browser-checks.ts            # all of them
//    MMAI_CHECK_JOBS=1 npx tsx scripts/run-browser-checks.ts
// ============================================================

import { spawn, spawnSync } from "node:child_process";

const IS_WINDOWS = process.platform === "win32";

/** Killing the spawned process is not enough: it is npx, which runs tsx,
 *  which runs the suite, which runs a browser. On Windows that whole tree
 *  needs taskkill; elsewhere the child leads its own process group and the
 *  negative pid kills the group. Without this a hung suite survives its
 *  own timeout and the runner waits for a child that never closes. */
function killTree(pid: number) {
  if (IS_WINDOWS) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  else { try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } } }
}

/** In the order they were written. check-layout is much the longest, so it
 *  starts first and the rest fill in around it. */
const CHECKS = [
  "check-layout",
  "check-runtime-errors",
  "check-accessibility",
  "check-nav",
  "check-ticker",
  "check-text-legibility",
  "check-site-functions",
  "check-seo",
];

const JOBS = Math.max(1, Number(process.env.MMAI_CHECK_JOBS ?? 2));
/** TWELVE, NOT EIGHT. check-layout loads thirteen pages at three widths and
 *  took 8.5 minutes on the machine this was written on -- eight killed it,
 *  which is a false alarm, the worst kind of check. Twelve leaves room and
 *  still lands inside the job's own 20-minute limit, so a genuine hang is
 *  reported here, by name, with its output. */
const PER_CHECK_MS = Number(process.env.MMAI_CHECK_TIMEOUT_MS ?? 12 * 60_000);

export interface CheckResult { name: string; ok: boolean; output: string; seconds: number; timedOut: boolean }

export function runCheck(name: string, timeoutMs = PER_CHECK_MS): Promise<CheckResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    // Windows will not spawn npx.cmd directly (Node refuses .cmd without a
    // shell, EINVAL), so it goes through cmd.exe and taskkill ends the tree.
    // Everywhere else npx is spawned as its own process-group leader, which
    // is what makes a hung suite killable. The arguments are fixed strings
    // from CHECKS, never input.
    const child = IS_WINDOWS
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx", "tsx", `scripts/${name}.ts`], { windowsVerbatimArguments: false })
      : spawn("npx", ["tsx", `scripts/${name}.ts`], { detached: true });
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; if (child.pid) killTree(child.pid); }, timeoutMs);
    child.stdout.on("data", (d) => { output += d; });
    child.stderr.on("data", (d) => { output += d; });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) output += `\n[killed after ${(timeoutMs / 60_000).toFixed(0)} minutes — this suite hung]\n`;
      resolve({ name, ok: code === 0 && !timedOut, output, seconds: (Date.now() - started) / 1000, timedOut });
    });
  });
}

/** Runs the named suites `jobs` at a time, printing each one's output whole
 *  as it finishes. Returns every result, in finishing order. */
export async function runChecks(names: string[], jobs = JOBS, timeoutMs = PER_CHECK_MS, log = console.log): Promise<CheckResult[]> {
  const queue = [...names];
  const results: CheckResult[] = [];
  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      const r = await runCheck(name, timeoutMs);
      results.push(r);
      log(`${"=".repeat(60)}\n${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.seconds.toFixed(0)}s)${r.timedOut ? "  TIMED OUT" : ""}\n${"=".repeat(60)}`);
      log(r.output.trimEnd());
      log("");
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, names.length) }, worker));
  return results;
}

async function main() {
  console.log(`Running ${CHECKS.length} browser checks, ${JOBS} at a time\n`);
  const results = await runChecks(CHECKS);
  const failed = results.filter((r) => !r.ok).map((r) => r.name + (r.timedOut ? " (timed out)" : ""));
  const total = results.reduce((a, r) => a + r.seconds, 0);
  console.log(`${results.length} checks, ${total.toFixed(0)}s of work${failed.length ? "" : ", all passed"}`);
  if (failed.length) {
    console.error(`\nFAILED: ${failed.join(", ")}`);
    process.exit(1);
  }
}

// Only when run directly, so the test can import runChecks.
if (process.argv[1]?.includes("run-browser-checks")) main();
