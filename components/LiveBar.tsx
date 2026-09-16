"use client";

import { formatAgo, formatWhen, useNow } from "@/lib/liveTime";

/**
 * "This is running right now."
 *
 * A dot that breathes, the word LIVE, and whatever facts belong beside
 * it — ending in the last refresh and how long ago that was, ticking.
 * Used on the homepage and the Sources page so both say it the same way.
 *
 * Pass `live={false}` where the figures are the last known ones rather
 * than a live read; the bar then says so instead of claiming otherwise.
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

  return (
    <div className={`live-bar${live ? "" : " is-stale"}`} role="status">
      <span className="live-dot" aria-hidden="true" />
      <span className="live-word">{live ? "LIVE" : staleLabel}</span>
      {facts.map((f) => (
        <span key={f}>
          <span className="live-sep" aria-hidden="true">·</span>
          {f}
        </span>
      ))}
      {stamp && (
        <span>
          <span className="live-sep" aria-hidden="true">·</span>
          last refresh <b className="live-when">{formatWhen(stamp)}</b>
          {now !== null && <span className="live-ago"> ({formatAgo(stamp, now)})</span>}
        </span>
      )}
    </div>
  );
}
