"use client";

import { useEffect, useState } from "react";
import Flag from "@/components/Flag";
import { colorForScore } from "@/lib/indicators";
import { scoreMarketV2, type MarketData } from "@/lib/markets";
import { HISTORY } from "@/lib/history";
import { computeMmai } from "@/lib/composite";
import { fetchAllWeeklyChanges } from "@/lib/weeklyChanges";
import { buildTickerEvents, type TickerEvent } from "@/lib/tickerEvents";
import type { FeedItem } from "@/lib/fetchers/newsFeeds";

/** Last full year's score for a market, so the strip can say which way it
 *  has moved rather than only where it stands. Computed from the same
 *  history the Trends page draws, through the same engine -- a hand-typed
 *  "last year" figure would drift the moment the history did. */
function lastFullYear(code: string): { year: string; value: number } | null {
  const rows = HISTORY[code] ?? [];
  // The newest row is the current, part-finished year; the one before it
  // is the last one that actually completed.
  for (let i = rows.length - 2; i >= 0; i--) {
    const v = computeMmai(rows[i].indicators, code).percentile;
    if (v != null) return { year: rows[i].year, value: v };
  }
  return null;
}

/**
 * THE STRIP ALONG THE TOP, MOVING.
 *
 * The owner kept saying the page felt dead, and it was not the colours:
 * nothing on it ever moved. Every score sat where it was put. This is the
 * thing a trading screen has that a report does not -- the whole market
 * passing in front of you, whether or not you asked for it.
 *
 * It scrolls by itself, pauses under the pointer, and stops entirely for
 * a reader who has asked for less motion (then it simply wraps onto two
 * lines and reads as a list). Every item is a real button: this is also
 * the fastest way to switch market from the top of the page.
 */
export default function MarketTicker({
  markets,
  current,
  onSelect,
}: {
  markets: MarketData[];
  current: string | null;
  onSelect: (code: string) => void;
}) {
  // What the site's own figures have done lately. Five at most: a
  // quarterly source can move every market at once, and eight lines of
  // the same indicator turn the strip into a list rather than a feed. Its own query rather
  // than a prop: the strip renders above everything and should not wait
  // on the page's market load, and an empty result is a perfectly good
  // answer -- then the strip is just the scores, as before.
  const [events, setEvents] = useState<TickerEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchAllWeeklyChanges()
      .then((r) => { if (!cancelled) setEvents(buildTickerEvents(r, Date.now(), 5)); })
      .catch(() => { /* the strip simply carries no events */ });
    return () => { cancelled = true; };
  }, []);

  // The same two feeds the news band shows, in one line each. Served
  // by this site's own route because neither the ECB nor the ONS sends
  // the CORS header a browser would need to read them directly.
  const [feed, setFeed] = useState<FeedItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => { if (!cancelled && Array.isArray(j.items)) setFeed(j.items.slice(0, 3)); })
      .catch(() => { /* the strip simply carries no announcements */ });
    return () => { cancelled = true; };
  }, []);

  const items = markets.map((m) => {
    const { percentile } = scoreMarketV2(m);
    const prev = lastFullYear(m.code);
    const delta = percentile != null && prev ? percentile - prev.value : null;
    return { m, percentile, delta, prevYear: prev?.year ?? null };
  });

  const row = (key: string, ariaHidden: boolean) => (
    <div className="ticker-row" key={key} aria-hidden={ariaHidden || undefined}>
      {feed.map((f) => (
        <span className="ticker-event is-feed" key={f.url}>
          {f.kind === "upcoming" ? "NEXT" : f.source}
          <span className="ticker-feed-title">{f.title}</span>
        </span>
      ))}
      {events.map((e) => (
        <span className={`ticker-event${e.kind === "band" ? " is-band" : ""}`} key={`${e.marketCode}-${e.text}`}>
          <Flag code={e.marketCode} size={15} />
          {e.text}
        </span>
      ))}
      {items.map(({ m, percentile, delta, prevYear }) => {
        const label = percentile == null ? "N/A" : percentile.toFixed(1);
        const dir = delta == null ? null : delta >= 0 ? "up" : "down";
        return (
          <button
            key={m.code}
            type="button"
            className={`ticker-item${m.code === current ? " on" : ""}`}
            onClick={() => onSelect(m.code)}
            tabIndex={ariaHidden ? -1 : 0}
            aria-label={
              percentile == null
                ? `${m.name}, no score`
                : `Show ${m.name}, score ${label}${delta != null && prevYear ? `, ${dir === "up" ? "up" : "down"} ${Math.abs(delta).toFixed(1)} against ${prevYear}` : ""}`
            }
          >
            <Flag code={m.code} size={15} />
            <span className="ticker-name">{m.code}</span>
            <span className="ticker-score" style={{ color: colorForScore(percentile) }}>{label}</span>
            {delta != null && (
              <span className={`ticker-delta ${dir}`}>
                {dir === "up" ? "▲" : "▼"}{Math.abs(delta).toFixed(1)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="ticker" role="region" aria-label="Every market's score, moving">
      <div className="ticker-track">
        {row("a", false)}
        {/* A second copy, hidden from screen readers: the loop is seamless
            only because the strip is exactly twice as wide as it needs to
            be and resets when the first copy has passed. */}
        {row("b", true)}
      </div>
    </div>
  );
}
