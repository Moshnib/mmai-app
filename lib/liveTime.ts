"use client";

import { useSyncExternalStore } from "react";

/** How often anything on the site that says "3 h ago" moves. 30s costs
 *  nothing and is fast enough that a page reads as running rather than
 *  printed. */
export const TICK_MS = 30_000;

/** ALL THREE OF THESE LIVE AT MODULE SCOPE, AND THAT IS LOAD-BEARING.
 *
 *  They were inline arrows inside useNow(), which makes them a new
 *  function on every render -- and React keys its subscription effect on
 *  the identity of `subscribe`, so every render tore down the interval and
 *  started a fresh one. The 30-second countdown restarted from zero each
 *  time, and a component that re-renders more often than every 30 seconds
 *  would never have ticked at all: the "ago" line frozen, the stamp stuck
 *  on the server's clock.
 *
 *  It survived because the only callers were small, settled components. A
 *  reviewer caught it as this hook was about to be used from the homepage
 *  and the footer, which both re-render whenever their own data lands. */
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  // Browsers slow timers in background tabs to a crawl; a tab brought
  // back after an hour should not show an hour-old "live" state.
  document.addEventListener("visibilitychange", onChange);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", onChange); };
}

/** Bucketed to the tick so it is stable between ticks -- returning a fresh
 *  Date.now() on every read would re-render forever. */
const snapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/** Null on the server AND on the client's hydrating render, so the two
 *  agree and nothing time-dependent is rendered until the browser has a
 *  clock of its own. */
const serverSnapshot = (): number | null => null;

/** The current time, ticking, safe to render on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** How long ago, in the shortest form that is still exact enough to
 *  watch: "just now", "14 min ago", "3 h 12 m ago", "2 days ago". A
 *  static timestamp says the same thing whether a refresh ran an hour ago
 *  or a week ago, and leaves the reader to do the subtraction. */
export function formatAgo(iso: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ${String(mins % 60).padStart(2, "0")} m ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

/** The refresh stamp, IN THE READER'S OWN CLOCK once the browser has one.
 *
 *  It was always UTC, on the reasoning that UTC is the clock the refresh
 *  job runs on. That is true and it is the wrong audience: the job's clock
 *  matters to whoever maintains the site, and the stamp is read by
 *  visitors. A reader in the Gulf saw "Sep 27, 12:44 PM UTC" and had to
 *  add four hours in their head before they could tell whether that was
 *  this morning or yesterday -- and the site had just been reported as
 *  "not updated" on a day it had updated.
 *
 *  The zone is always named ("GMT+4", "EDT"), so the figure is never
 *  ambiguous about which clock it is on.
 *
 *  `local` COMES FROM THE CLIENT TICK, never from a constant. A server has
 *  no idea what zone the reader is in, so it would render UTC and the
 *  browser re-renders in the reader's zone once useNow() has a value --
 *  the same reason formatAgo is only rendered when `now` is non-null.
 *  Today that is belt and braces rather than the thing holding the page
 *  together: all four callers fill their stamp from an effect, so no time
 *  is in the server's HTML at all and hydration has nothing to disagree
 *  about. Pass a bare `true` and the day one of them becomes a
 *  server-fed prop, React throws the markup away with a warning.
 *
 *  ONLY FOR A MOMENT IN TIME -- never for a date-only string.
 *  `formatWhen("2026-09-27")` in the reader's zone shifts the day
 *  backwards for everyone west of UTC, which is the same bug in reverse
 *  and worse, because a wrong DATE on an economic figure is a wrong fact.
 *  The three remaining `timeZone: "UTC"` formatters on the site -- the
 *  observation note on the homepage, StablecoinMacroLink, and
 *  scripts/test-latest-complete.ts -- all format `YYYY-MM-DD` and MUST
 *  stay UTC. Do not "finish the job" by converting them. */
export function formatWhen(iso: string, local = false, { withYear = false } = {}): string {
  return new Date(iso).toLocaleString("en-US", {
    // `undefined` is how Intl spells "not specified", so both of these read
    // as values rather than as the presence or absence of a key.
    year: withYear ? "numeric" : undefined,
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: local ? undefined : "UTC", // undefined = the reader's own
    timeZoneName: "short",
  });
}

