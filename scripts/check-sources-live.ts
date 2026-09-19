// ============================================================
//  ASK EVERY SOURCE WHAT IT HAS, AND COMPARE IT TO WHAT WE PUBLISH
//
//  The comparison itself lives in lib/sourceAudit.ts, along with a full
//  account of what it catches, what it deliberately does not, and why a
//  source that did not answer is reported separately from a figure that
//  disagrees. This file is the local way in; app/api/source-audit is the
//  daily one.
//
//    npx tsx --env-file=.env.local scripts/check-sources-live.ts
//
//  Hits thirteen external APIs and needs the same keys the refresh uses,
//  which is why it is not in CI. On the daily schedule it runs as the
//  route instead — the keys are already in Vercel, and GitHub holds only
//  CRON_SECRET.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { runSourceAudit, newestScoreableByMarket, PROBES } from "@/lib/sourceAudit";
import { MAX_FALLBACK_DAYS } from "@/lib/latestComplete";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("\nNo Supabase credentials — cannot read what the site publishes.\n");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("raw_indicators")
    .select("*")
    // The same query the pages run -- see the note in the route.
    .order("observation_date", { ascending: false })
    .order("fetched_at", { ascending: false })
    .limit(200);
  if (error || !data) {
    console.error(`\nCould not read raw_indicators: ${error?.message ?? "no rows"}\n`);
    process.exit(1);
  }

  console.log(`\nAsking ${PROBES.length} sources what they have, against what the site publishes\n`);

  const { rows, problems, unreachable, behind } = await runSourceAudit(
    newestScoreableByMarket(data as Record<string, unknown>[]),
  );

  console.log("        indicator             published            live                 verdict");
  for (const r of rows) {
    const ok = r.verdict === "matches" || r.verdict === "one release behind";
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${r.name.padEnd(19)} ${String(r.storedValue).padStart(7)} ${r.storedDate.padEnd(12)} ` +
      `${String(r.liveValue ?? "?").padStart(7)} ${r.liveDate.padEnd(12)} ${r.verdict}` +
      (r.detail ? `  ${r.detail}` : ""),
    );
  }
  console.log("");

  // A SOURCE HAVING A BAD DAY IS NOT THE SITE BEING WRONG. Reported in
  // full, and deliberately does not fail the run — see the note on
  // runSourceAudit for what does catch a source that stays down.
  if (unreachable.length > 0) {
    console.log(`${unreachable.length} source(s) did not answer, after two attempts each:\n`);
    for (const u of unreachable) console.log(`  ${u}`);
    console.log("\nThat is the source, not the stored figure — it says nothing about whether");
    console.log("what the site publishes is correct, only that it could not be confirmed");
    console.log("today. A source that stays down leaves its indicator null, the composite");
    console.log(`is withheld rather than reweighted, and after ${MAX_FALLBACK_DAYS} days the page shows N/A.\n`);
  }

  if (behind.length > 0) {
    console.log(`${behind.length} figure(s) are one release behind the source:\n`);
    for (const b of behind) console.log(`  ${b}`);
    console.log("\nThat is the ordinary gap between a source publishing and the next");
    console.log("morning's refresh picking it up. A missed release fails instead: two for monthly and quarterly figures, three trading days for daily ones.\n");
  }

  if (problems.length > 0) {
    console.error(`${problems.length} published figure(s) disagree with their source:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error("\nA failed fetch is served from the previous reading, so the pages look");
    console.error("healthy either way — this is the only check that opens the box.\n");
    console.error("::error::MMAI: a published figure disagrees with its source");
    process.exit(1);
  }

  // Counted honestly. A figure one release behind has NOT been confirmed
  // to agree -- the site is showing last month's while the source shows
  // this month's -- and a source that did not answer confirms nothing at
  // all. Saying "all 20 agree" when two of them are behind is the kind of
  // reassuring summary that makes a check worth less than no check.
  const confirmed = PROBES.length - unreachable.length - behind.length;
  const caveats = [
    behind.length > 0 ? `${behind.length} one release behind` : "",
    unreachable.length > 0 ? `${unreachable.length} source(s) unreachable` : "",
  ].filter(Boolean);
  console.log(
    caveats.length === 0
      ? `All ${PROBES.length} published figures match their live sources exactly.\n`
      : `${confirmed} of ${PROBES.length} published figures match their live sources exactly ` +
        `(${caveats.join(", ")}).\n`,
  );
}

main();
export {};
