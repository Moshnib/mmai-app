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
    const [scored, gulf, obs, commodities] = await Promise.all([
      newestBy("raw_indicators", "market", FALLBACK_MARKETS.map((m) => m.code)),
      newestBy("gulf_indicators", "country_code", GULF_COUNTRIES.map((c) => c.code)),
      newestBy("observatory_indicators", "country_code", OBSERVATORY.map((c) => c.code)),
      // WATCHED ON fetched_at, NOT ON ITS OBSERVATION DATE, and that is
      // the whole reason it is here. The EIA publishes Brent two to four
      // days in arrears, so "the newest price is from three days ago" is
      // a healthy Thursday and a dead series in a fortnight -- the
      // observation date cannot tell those apart, and when MMAI last
      // wrote the row can.
      newestBy("commodity_prices", "series", [BRENT_SPOT_DAILY]),
    ]);
    watched = [
      ...FALLBACK_MARKETS.map((m) => ({ name: m.name, group: "scored", newest: scored.get(m.code) ?? null })),
      ...GULF_COUNTRIES.map((c) => ({ name: c.name, group: "Gulf Watch", newest: gulf.get(c.code) ?? null })),
      ...OBSERVATORY.map((c) => ({ name: c.name, group: "Observatory", newest: obs.get(c.code) ?? null })),
      { name: "Brent crude (daily)", group: "commodities", newest: commodities.get(BRENT_SPOT_DAILY) ?? null },
    ];
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
