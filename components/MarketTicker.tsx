"use client";

import { useEffect, useRef, useState } from "react";
import Flag from "@/components/Flag";
import { colorForScore } from "@/lib/indicators";
import { scoreMarketV2, type MarketData } from "@/lib/markets";
import { HISTORY } from "@/lib/history";
import { computeMmai } from "@/lib/composite";
import { fetchAllWeeklyChanges } from "@/lib/weeklyChanges";
import { buildTickerEvents, type TickerEvent } from "@/lib/tickerEvents";
import { useMotion } from "@/lib/motion";
import type { FeedItem } from "@/lib/fetchers/newsFeeds";
import { pickTickerFeed, feedKey } from "@/lib/newsGroups";

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
 * a reader whose system asks for less motion -- then it wraps onto two
 * lines and reads as a list. Every item is a real button: this is also
 * the fastest way to switch market from the top of the page.
 *
 * IT MOVES AT A READING SPEED, NOT A FIXED DURATION. The animation used
 * to take 40 seconds whatever the strip held, and the strip grew: nine
 * markets, their weekly changes and three announcements make a row about 4,700px
 * wide, so it ran at 118 pixels a second at every screen size. The owner
 * reported it as rushed and unusable on a phone -- and a test could not
 * even tap a market button, because the button never holds still. The
 * duration is now measured from the row itself, so the strip travels at
 * about 55 pixels a second on a mouse-driven screen and 45 on a touch
 * one, whatever it happens to be carrying.
 *
 * AND A FINGER STOPS IT. Resting a pointer paused it already, but that
 * was written for a mouse: a phone reports a lingering hover after a tap,
 * which could leave the strip frozen. Now a hover only pauses where hover
 * is real, and a touch pauses it while the finger is down and for three
 * seconds after, which is what makes a moving button tappable.
 *
 * AND IT CAN BE STARTED BY HAND. The owner reported the strip as "not
 * moving" twice, from a desktop with Windows animation effects switched
 * off -- which is exactly what prefers-reduced-motion reports, and the
 * site was honouring it. That setting is right to respect for anything
 * that moves WITHOUT being asked; it is not a reason to refuse a reader
 * who asks. So there is a button, it says which state it is in, and the
 * choice is remembered.
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
  const { running, toggle } = useMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  // What the site's own figures have done lately. Five at most: a
  // quarterly source can move every market at once, and eight lines of
  // the same indicator turn the strip into a list rather than a feed. Its own query rather
  // than a prop: the strip renders above everything and should not wait
  // on the page's market load, and an empty result is a perfectly good
  // answer -- then the strip is just the scores, as before.
  // BOTH QUERIES LAND AT ONCE, and the strip only starts moving after
  // they have. The two used to arrive separately and each one widened the
  // row mid-scroll; the animation's progress is a percentage of that
  // width, so the strip jumped sideways as each landed. One state, set
  // once, and nothing moves until the strip is what it will be.
  //
  // The second feed is served by this site's own route because none of
  // the nine institutions sends the CORS header a browser would need.
  // When that route's cache is cold it can take ~3.5s to read them all,
  // so now and then the deadline below wins and the strip starts without
  // announcements. That is the intended trade: scores never wait on news.
  const [extras, setExtras] = useState<{ events: TickerEvent[]; feed: FeedItem[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchAllWeeklyChanges().then((r) => buildTickerEvents(r, Date.now(), 5)),
      fetch("/api/announcements")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j) => (Array.isArray(j.items) ? pickTickerFeed(j.items as FeedItem[], Date.now()) : [])),
    ]).then(([e, f]) => {
      if (cancelled) return;
      // A failed query means the strip carries that much less, never that
      // it waits: an empty list is a perfectly good answer. And whatever
      // arrives after the deadline below is dropped rather than inserted
      // into a strip that is already moving.
      setExtras((prev) => prev ?? {
        events: e.status === "fulfilled" ? e.value : [],
        feed: f.status === "fulfilled" ? f.value : [],
      });
    });
    // AND A DEADLINE. Waiting on both queries is what stops the strip
    // jumping -- but a route that hangs would then leave it stopped for
    // good, which is the very fault this is fixing. After four seconds
    // the strip starts with what it has, which is always the scores.
    const deadline = setTimeout(() => {
      if (!cancelled) setExtras((prev) => prev ?? { events: [], feed: [] });
    }, 4000);
    return () => { cancelled = true; clearTimeout(deadline); };
  }, []);
  const events = extras?.events ?? [];
  const feed = extras?.feed ?? [];

  // How long one row takes to pass, from its own width. Measured when the
  // strip is about to move and left alone after that: changing
  // animation-duration keeps the elapsed time, so a later change would
  // jump. A wide change of width -- turning a phone sideways -- is worth
  // the one jump it costs.
  const playing = running && extras !== null;
  useEffect(() => {
    if (!playing) return;
    const row = rowRef.current;
    if (!row) return;
    const speed = window.matchMedia("(pointer: coarse)").matches ? 45 : 55; // px per second
    const measure = () => {
      const width = row.getBoundingClientRect().width;
      if (width < 100) return;
      setSeconds((prev) => {
        const next = Math.round(width / speed);
        if (prev !== null && Math.abs(next - prev) / prev < 0.25) return prev;
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [playing]);

  // A finger holds the strip still, so a moving button can be hit. Three
  // seconds after the finger lifts it carries on; a cancelled gesture --
  // the page scrolling away under the touch -- releases it at once.
  function holdStill() {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    setPaused(true);
    // A ceiling, because a gesture the system takes over -- an edge swipe,
    // the notification shade, switching apps mid-touch -- delivers neither
    // pointerup nor pointercancel, and the strip would stay held.
    pauseTimer.current = setTimeout(() => setPaused(false), 10000);
  }
  function releaseSoon() {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => setPaused(false), 3000);
  }
  function releaseNow() {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    setPaused(false);
  }
  useEffect(() => () => { if (pauseTimer.current) clearTimeout(pauseTimer.current); }, []);

  const items = markets.map((m) => {
    const { percentile } = scoreMarketV2(m);
    const prev = lastFullYear(m.code);
    const delta = percentile != null && prev ? percentile - prev.value : null;
    return { m, percentile, delta, prevYear: prev?.year ?? null };
  });

  // SCORES FIRST, AND NEVER FAR APART. The strip used to run every
  // announcement, then every weekly change, then the scores -- and a
  // headline is wide: measured live, the first three were 656, 361 and
  // 721 pixels, nearly two phone screens each. A reader on a phone met
  // about 2,400px of news before the first score, which at a readable
  // speed is the best part of a minute of watching a strip that never
  // shows a number. So the scores lead, and one other line is dealt in
  // after every three of them.
  const extraNodes = [
    ...events.map((e) => (
      <span className={`ticker-event${e.kind === "band" ? " is-band" : ""}`} key={`${e.marketCode}-${e.text}`}>
        <Flag code={e.marketCode} size={15} />
        {e.text}
      </span>
    )),
    ...feed.map((f) => (
      <span className="ticker-event is-feed" key={feedKey(f)} title={f.institution}>
        {f.kind === "upcoming" ? `NEXT · ${f.source}` : f.source}
        <span className="ticker-feed-title">{f.title}</span>
      </span>
    )),
  ];

  const row = (key: string, ariaHidden: boolean) => {
    const marketNodes = items.map(({ m, percentile, delta, prevYear }) => {
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
    });

    // Three scores, then one of the other lines, until both run out.
    const mixed: React.ReactNode[] = [];
    let extra = 0;
    marketNodes.forEach((node, i) => {
      mixed.push(node);
      if ((i + 1) % 3 === 0 && extra < extraNodes.length) mixed.push(extraNodes[extra++]);
    });
    while (extra < extraNodes.length) mixed.push(extraNodes[extra++]);

    return (
      <div className="ticker-row" key={key} ref={ariaHidden ? undefined : rowRef} aria-hidden={ariaHidden || undefined}>
        {mixed}
      </div>
    );
  };

  return (
    <div
      className={`ticker${running ? (playing ? " is-playing" : " is-waiting") : " is-still"}${paused ? " is-paused" : ""}`}
      role="region"
      aria-label="Every market's score"
      style={seconds ? ({ "--ticker-seconds": `${seconds}s` } as React.CSSProperties) : undefined}
      onPointerDown={(e) => { if (e.pointerType !== "mouse") holdStill(); }}
      onPointerUp={(e) => { if (e.pointerType !== "mouse") releaseSoon(); }}
      onPointerCancel={releaseNow}
    >
      <button
        type="button"
        className="ticker-motion"
        onClick={toggle}
        aria-pressed={running}
        aria-label={running ? "Stop the scrolling strip" : "Scroll the strip of market scores"}
        title={running ? "Stop scrolling" : "Scroll the market strip"}
      >
        <span aria-hidden="true">{running ? "❙❙" : "▶"}</span>
      </button>
      <div className="ticker-track" ref={trackRef}>
        {row("a", false)}
        {/* A second copy, hidden from screen readers: the loop is seamless
            only because the strip is exactly twice as wide as it needs to
            be and resets when the first copy has passed. */}
        {row("b", true)}
      </div>
    </div>
  );
}
