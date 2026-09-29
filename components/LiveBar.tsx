"use client";

import { formatAgo, formatWhen, useNow } from "@/lib/liveTime";
import { REFRESH_OVERDUE_MS } from "@/lib/constants";

/**
 * "This is running right now."
 *
 * A dot that breathes, the word LIVE, and whatever facts belong beside
 * it — ending in the last refresh and how long ago that was, ticking.
 * Used on the homepage and the Sources page so both say it the same way.
 *
 * Pass `live={false}` where the figures are the last known ones rather
 * than a live read; the bar then says so instead of claiming otherwise.
 *
 * AND IT STOPS SAYING LIVE WHEN THE REFRESH IS LATE. From 16 to 19
 * September nothing was written, and this bar said LIVE the whole time,
 * with "2 days 21 h ago" beside it. Reachable is not the same as current:
 * past REFRESH_OVERDUE_MS the bar reads UPDATE DELAYED, whatever `live`
 * says.
 */
export default function LiveBar({
  live = true,
  facts = [],
  stamp,
  staleLabel = "SHOWING LAST KNOWN FIGURES",
}: {
  live?: boolean;
  facts?: string[];
  stamp?: string | null;
  staleLabel?: string;
}) {
  const now = useNow();
  const overdue = live && !!stamp && now !== null && now - Date.parse(stamp) > REFRESH_OVERDUE_MS;
  const showLive = live && !overdue;

  return (
    <div className={`live-bar${showLive ? "" : " is-stale"}`} role="status">
      <span className="live-dot" aria-hidden="true" />
      <span className="live-word">{overdue ? "UPDATE DELAYED" : live ? "LIVE" : staleLabel}</span>
      {facts.map((f) => (
        <span key={f}>
          <span className="live-sep" aria-hidden="true">·</span>
          {f}
        </span>
      ))}
      {stamp && (
        <span>
          <span className="live-sep" aria-hidden="true">·</span>
          last refresh <b className="live-when">{formatWhen(stamp, now !== null)}</b>
          {now !== null && <span className="live-ago"> ({formatAgo(stamp, now)})</span>}
        </span>
      )}
    </div>
  );
}
