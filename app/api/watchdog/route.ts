// ============================================================
//  THE WATCHDOG: EMAILS THE OWNER IF THE DATA STOPS UPDATING
//
//  Scheduled by vercel.json, once a day. It runs on Vercel on purpose:
//  the refresh runs on GitHub, and a check that runs on the same system
//  as the thing it checks goes quiet at the same moment. See
//  lib/watchdog.ts for what it judges and why.
//
//  READ-ONLY. It never writes a row, so it cannot race the refresh the way
//  the old Vercel refresh crons did (§19.10) -- which is also why it is
//  the ONLY cron vercel.json may carry (scripts/verify-security.ts).
//
//  ?test=1 sends a "watchdog OK" message even when nothing is late, so
//  the owner can prove the whole chain -- schedule, secret, database,
//  email -- once, after it is deployed. Same secret as everything else.
// ============================================================

import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { BRENT_SPOT_DAILY } from "@/lib/commodityPricesRead";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import { OBSERVATORY } from "@/lib/observatory";
import { assess, message, type Watched } from "@/lib/watchdog";
import { sendOwnerAlert } from "@/lib/notify";

// Never cached: a cached "all fine" is exactly the silence this exists to end.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Newest fetched_at per code, from the last ten days of one table. */
async function newestBy(table: string, column: string, codes: string[]): Promise<Map<string, string>> {
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const { data, error } = await getPublicSupabaseClient()
    .from(table)
    .select(`${column}, fetched_at`)
    .in(column, codes)
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`${table}: ${error.message}`);
  const out = new Map<string, string>();
  for (const row of (data ?? []) as unknown as Array<Record<string, string>>) {
    if (!out.has(row[column])) out.set(row[column], row.fetched_at);
  }
  return out;
}

export async function GET(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  // Misconfigured is loud, not quiet: a watchdog with nowhere to bark is
  // the failure this route exists to prevent. A 500 shows in Vercel's logs.
  const to = process.env.OWNER_ALERT_EMAIL;
  if (!to) return NextResponse.json({ error: "OWNER_ALERT_EMAIL is not set" }, { status: 500 });

  const test = new URL(request.url).searchParams.get("test") === "1";
  const now = Date.now();

  let watched: Watched[];
  try {
    const [scored, gulf, obs] = await Promise.all([
      newestBy("raw_indicators", "market", FALLBACK_MARKETS.map((m) => m.code)),
      newestBy("gulf_indicators", "country_code", GULF_COUNTRIES.map((c) => c.code)),
      newestBy("observatory_indicators", "country_code", OBSERVATORY.map((c) => c.code)),
    ]);
    watched = [
      ...FALLBACK_MARKETS.map((m) => ({ name: m.name, group: "scored", newest: scored.get(m.code) ?? null })),
      ...GULF_COUNTRIES.map((c) => ({ name: c.name, group: "Gulf Watch", newest: gulf.get(c.code) ?? null })),
      ...OBSERVATORY.map((c) => ({ name: c.name, group: "Observatory", newest: obs.get(c.code) ?? null })),
    ];

    // THE COMMODITY SERIES IS WATCHED SEPARATELY, AND MUST NEVER TAKE THE
    // REST DOWN WITH IT.
    //
    // It was in the Promise.all above, and a reviewer caught what that
    // meant: commodity_prices is created by a HAND-RUN migration, so
    // between a deploy and the owner pasting the SQL every query in that
    // group rejects, the catch below collapses all twenty-odd markets
    // into one "the database is unreachable" row, and the watchdog emails
    // an outage every night while nothing is wrong. A new check that can
    // blind the alarm to everything else is a bad trade for a figure
    // shown beside the score rather than inside it.
    //
    // WATCHED ON fetched_at, NOT ON THE OBSERVATION DATE. The EIA
    // publishes Brent two to four days in arrears, so "the newest price
    // is three days old" is a healthy Thursday and a dead fetcher three
    // weeks later; only when MMAI last wrote the row separates them.
    //
    // A series that has NEVER been written is left out entirely rather
    // than reported late: assess() treats a null as the worst case, so
    // including it would raise a nightly alarm for a table that is simply
    // waiting for its first run.
    //
    // ASKED WITHOUT A TIME WINDOW, unlike newestBy above, and that is
    // deliberate. newestBy only looks back ten days, so a series written
    // once and then dead would alarm for ten nights and then fall out of
    // the window and go quiet -- the markets never do that, because a
    // missing one yields null and assess() calls null the worst case.
    // Here the question is only "has this ever been written": if it has,
    // the row goes in with whatever date it has and assess() judges it;
    // if it never has, it is left out, because a table waiting on a
    // hand-run migration must not email an outage every night.
    try {
      const { data, error } = await getPublicSupabaseClient()
        .from("commodity_prices")
        .select("fetched_at")
        .eq("series", BRENT_SPOT_DAILY)
        .order("fetched_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const newest = (data ?? [])[0]?.fetched_at as string | undefined;
      if (newest) watched.push({ name: "Brent crude (daily)", group: "commodities", newest });
    } catch {
      // The table does not exist yet, or is unreadable. Everything above
      // still gets reported, which is the point.
    }
  } catch (e) {
    // Could not even look. That is worth a message too: the database
    // being unreachable is an outage from a reader's side as well.
    watched = [{ name: `the database (${e instanceof Error ? e.message : "unreachable"})`, group: "all", newest: null }];
  }

  const verdict = assess(watched, now);
  const late = verdict.overdue.length > 0;

  if (late || test) {
    const { subject, text } = message(verdict, now);
    try {
      await sendOwnerAlert(to, subject, text);
    } catch (e) {
      return NextResponse.json(
        { error: `alert could not be sent: ${e instanceof Error ? e.message : String(e)}`, verdict },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: !late, emailed: late || test, verdict });
}
