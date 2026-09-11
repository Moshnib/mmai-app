// ============================================================
//  DAILY: DOES WHAT WE PUBLISH STILL AGREE WITH ITS SOURCE?
//
//  The comparison itself lives in lib/sourceAudit.ts, which explains
//  what it catches and — just as important — what it does not. This
//  file is only the door.
//
//  WHY A ROUTE AND NOT A GITHUB ACTIONS STEP. The obvious place for a
//  daily check is beside the refresh in .github/workflows/refresh.yml,
//  and that was tried first. It cannot work: the fetchers need BEA, BLS
//  and e-Stat keys plus the Supabase credentials, and GitHub holds
//  exactly one secret for this project (CRON_SECRET) while the other
//  five live in Vercel. A step referencing secrets that do not exist
//  does not skip — it runs with empty strings and fails, every morning,
//  for a reason that has nothing to do with the data. A daily false
//  alarm is worse than no check at all, because it is the alarm people
//  learn to ignore, and then the real one goes unread too.
//
//  So the check runs where the keys already are. The workflow calls this
//  with the one secret it does have, exactly as it calls the two refresh
//  routes, and nothing has to be copied into a second system.
//
//  ORDER MATTERS. The workflow calls this AFTER both refreshes, so a
//  disagreement here means the refresh genuinely could not put things
//  right — not merely that it had not run yet.
// ============================================================

import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { runSourceAudit, newestScoreableByMarket, PROBES } from "@/lib/sourceAudit";

// Twenty external APIs. They run concurrently (see PROBE_TIMEOUT_MS in
// lib/sourceAudit.ts), so this is bounded by the slowest single source
// rather than by their sum -- but it is still the whole budget, because
// the slowest of twenty is not the typical one.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  // The ANON key, deliberately, not the service role. This route only
  // ever reads what the public site already shows, so it has no business
  // holding a key that bypasses row-level security.
  let published;
  try {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("raw_indicators")
      .select("*")
      // THE SAME QUERY THE PAGES RUN, deliberately, down to the ordering
      // and the limit. This ordered by fetched_at alone and took 120 rows;
      // app/page.tsx orders by observation_date then fetched_at and takes
      // 200. Both differences matter. The ordering decides which row wins a
      // same-day re-run, and a force-refresh writes every market at once --
      // 2026-09-01 wrote 60 rows in a single day -- so 120 rows can be two
      // days of reach rather than twenty, leaving the audit with nothing to
      // compare against precisely after somebody has been fixing something.
      .order("observation_date", { ascending: false })
      .order("fetched_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("no rows returned");
    published = newestScoreableByMarket(data as Record<string, unknown>[]);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read what the site publishes: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  const { rows, problems, unreachable, behind, checked } = await runSourceAudit(published);

  // Logged as well as returned. The workflow prints the body, but a
  // manual visit to this URL leaves a trace in the Vercel logs too.
  for (const r of rows) {
    console.log(
      `${r.verdict.padEnd(20)} ${r.name.padEnd(24)} site ${String(r.storedValue).padStart(7)} ${r.storedDate}  ` +
      `source ${String(r.liveValue ?? "?").padStart(7)} ${r.liveDate}`,
    );
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    checked,
    // The number the workflow reads to decide whether to fail the run.
    // Deliberately does NOT count sources that failed to answer: those
    // are reported beside it and are a different kind of bad news. See
    // the note on runSourceAudit.
    disagreements: problems.length,
    problems,
    sourcesDown: unreachable.length,
    unreachable,
    // Exactly one release behind: the source has published and the next
    // refresh has not run yet. Reported, never failed on.
    oneReleaseBehind: behind.length,
    behind,
    rows,
    probes: PROBES.length,
  });
}
