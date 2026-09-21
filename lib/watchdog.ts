// ============================================================
//  IS THE DATA STILL ARRIVING?
//
//  From 16 to 19 September 2026 nothing was written to the database, and
//  nobody knew for three days. The refresh runs on GitHub Actions, which
//  had stopped running anything at all -- so the one system that could
//  have raised the alarm was the one that had stopped. Every run was red,
//  and red in a tab nobody was looking at is silence.
//
//  So this runs somewhere else (a Vercel cron at 23:30 UTC, app/api/watchdog) and asks
//  the only question that catches every cause at once: how old is the
//  newest reading for each thing the site publishes? It does not care WHY
//  -- a billing block, a moved address, a dead source, an expired key --
//  only that a reader is being shown figures that are no longer being
//  refreshed.
//
//  PER MARKET AND PER COUNTRY, NOT PER TABLE. A table's newest row is
//  fresh as long as ANY market in it still writes, so one dead source
//  (the Euro Area's retired Eurostat dataset, §18) hides behind the rest.
//  And only what the site actually shows: a retired market that stopped
//  writing on purpose is not an outage.
//
//  Pure: the route fetches, this judges, scripts/test-watchdog.ts pins it.
// ============================================================

/** Tighter than the site's own 30-hour warning (REFRESH_OVERDUE_MS), on
 *  purpose. This runs ONCE a day, at 23:30 UTC (vercel.json).
 *
 *  23:30, NOT 15:30 (moved 21 September). GitHub starts the scheduled
 *  refresh hours late -- the "06:10" run began at 10:54–11:18 from 16 to 20
 *  September, and on the 19th the morning run never started -- and only
 *  the first run that lands each day writes rows (the freshness guard
 *  makes the rest no-ops). At 15:30 a day whose morning run was dropped
 *  would read as ~28 hours stale and send a false alarm; at 23:30 the day's
 *  four runs have all had their chance. On a healthy day the newest reading
 *  is ~12–18 hours old at 23:30. Past 20 hours, nothing landed since about
 *  03:30 UTC: a whole day's runs have failed, and it is reported the same
 *  night rather than the next day. */
export const WATCHDOG_OVERDUE_MS = 20 * 60 * 60 * 1000;

export const ACTIONS_URL = "https://github.com/Moshnib/mmai-app/actions/workflows/refresh.yml";

export interface Watched {
  /** What the site calls it: "United States", "Oman", "Denmark". */
  name: string;
  /** Which part of the site, for the message: scored / Gulf Watch / Observatory. */
  group: string;
  /** Newest fetched_at seen for it, or null when there is none at all. */
  newest: string | null;
}

export interface Verdict {
  overdue: Array<Watched & { hours: number | null }>;
  checked: number;
}

export function assess(watched: Watched[], now: number, overdueMs = WATCHDOG_OVERDUE_MS): Verdict {
  const overdue: Verdict["overdue"] = [];
  for (const w of watched) {
    const t = w.newest ? Date.parse(w.newest) : NaN;
    // No reading at all is the worst case, not a skip: a market missing
    // entirely would otherwise make the site look healthier than it is.
    if (!Number.isFinite(t)) overdue.push({ ...w, hours: null });
    else if (now - t > overdueMs) overdue.push({ ...w, hours: Math.floor((now - t) / 3_600_000) });
  }
  return { overdue, checked: watched.length };
}

export function message(verdict: Verdict, now: number): { subject: string; text: string } {
  const when = new Date(now).toUTCString();
  if (verdict.overdue.length === 0) {
    return {
      subject: "MMAI watchdog: all data is current (test)",
      text:
        `Test message from the MMAI watchdog, ${when}.\n\n` +
        `All ${verdict.checked} markets and countries have a reading from the last ` +
        `${WATCHDOG_OVERDUE_MS / 3_600_000} hours. If the data ever stops updating, an email like this ` +
        `one will say so, naming what is late.\n`,
    };
  }
  const lines = verdict.overdue.map((o) =>
    `  - ${o.name} (${o.group}): ${o.hours == null ? "no reading at all" : `last reading ${o.hours} hours ago`}`
  );
  return {
    subject: `MMAI data has stopped updating: ${verdict.overdue.length} of ${verdict.checked} late`,
    text:
      `The MMAI watchdog checked at ${when}.\n\n` +
      `These have had no new reading for more than ${WATCHDOG_OVERDUE_MS / 3_600_000} hours. ` +
      `The refresh runs four times a day, so none of today's runs has landed:\n\n` +
      `${lines.join("\n")}\n\n` +
      `The site is still up and showing the last figures it has.\n\n` +
      `Where to look first: the refresh runs on GitHub, here:\n${ACTIONS_URL}\n` +
      `A run that fails within seconds usually means GitHub has stopped running jobs ` +
      `(billing or budget). A run that fails later names the step that failed.\n\n` +
      `Open a Claude session in the project folder and paste this email.\n`,
  };
}
