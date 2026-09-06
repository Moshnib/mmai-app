// ============================================================
//  RETRYING MUST NOT COST MORE TIME THAN THE CALLER HAS
//
//  Retries were added to the Gulf refresh because data.gov.bh answers
//  four days in ten. They were added without a budget, which quietly
//  made a different failure much more likely.
//
//  The Gulf refresh runs six countries ONE AFTER ANOTHER inside a
//  60-second function, and its fetchers allow up to 15 seconds each.
//  One attempt per source is a worst case of about 90 seconds; three
//  attempts is about 277. That does not fail politely -- the function is
//  killed part-way through the list and the countries at the end are
//  never written at all, which is strictly worse than the missing-value
//  bug the retry was introduced to fix.
//
//    npx tsx scripts/test-retry-deadline.ts
// ============================================================

import { withRetry, RETRY_ATTEMPTS } from "@/lib/retryFetch";

let fails = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

async function main() {
  console.log("\nA BLINKING SOURCE IS STILL RETRIED\n");
  {
    let calls = 0;
    const value = await withRetry("flaky", async () => {
      calls++;
      if (calls < 3) throw new Error("blink");
      return "recovered";
    });
    ok("succeeds on a later attempt", value === "recovered");
    ok("took more than one go", calls === 3, `${calls} attempts`);
  }

  console.log("\nIT GIVES UP AFTER THE LIMIT\n");
  {
    let calls = 0;
    let threw = false;
    try {
      await withRetry("dead", async () => { calls++; throw new Error("always"); });
    } catch { threw = true; }
    ok("throws when every attempt fails", threw);
    ok(`stops at ${RETRY_ATTEMPTS}`, calls === RETRY_ATTEMPTS, `${calls} attempts`);
  }

  console.log("\nA SPENT DEADLINE STOPS THE RETRIES — the regression guard\n");
  {
    let calls = 0;
    let threw = false;
    const past = Date.now() - 1;   // budget already gone
    try {
      await withRetry("slow", async () => { calls++; throw new Error("timeout"); }, { deadline: past });
    } catch { threw = true; }
    ok("still reports the failure", threw);
    ok("does not retry at all", calls === 1, `${calls} attempt(s)`);
  }

  console.log("\nTIME LEFT MEANS RETRIES STILL HAPPEN\n");
  {
    let calls = 0;
    const value = await withRetry(
      "flaky-with-budget",
      async () => { calls++; if (calls < 2) throw new Error("blink"); return "ok"; },
      { deadline: Date.now() + 30_000 },
    );
    ok("retries while the budget lasts", value === "ok" && calls === 2, `${calls} attempts`);
  }

  console.log("\nA DEADLINE NEVER BLOCKS THE FIRST ATTEMPT\n");
  {
    // Even with no time left, the work must be tried once -- otherwise a
    // slow earlier country would stop later ones from being fetched at
    // all, which is the outcome the deadline exists to prevent.
    let calls = 0;
    const value = await withRetry("first", async () => { calls++; return "done"; }, { deadline: Date.now() - 5_000 });
    ok("the first attempt always runs", value === "done" && calls === 1);
  }

  console.log("\nshouldRetry STILL NARROWS WHAT IS WORTH REPEATING\n");
  {
    let calls = 0;
    let threw = false;
    try {
      await withRetry(
        "notfound",
        async () => { calls++; throw new Error("404 not found"); },
        { shouldRetry: (e) => !e.message.includes("404") },
      );
    } catch { threw = true; }
    ok("a 404 is not retried", threw && calls === 1, `${calls} attempt(s)`);
  }

  console.log("");
  if (fails > 0) {
    console.error(`${fails} assertion(s) failed.\n`);
    process.exit(1);
  }
  console.log("Retries help a blinking source without spending time the caller does not have.\n");
}

main();
export {};
