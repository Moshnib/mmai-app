"use client";

import { useSyncExternalStore } from "react";

/** How often anything on the site that says "3 h ago" moves. 30s costs
 *  nothing and is fast enough that a page reads as running rather than
 *  printed. */
export const TICK_MS = 30_000;

/** The current time, ticking, safe to render on the server.
 *
 *  useSyncExternalStore rather than an effect that sets state: the server
 *  snapshot is null, so the server and the hydrating client agree and no
 *  relative time is rendered until the browser has one. The client
 *  snapshot is bucketed to the tick so it is stable between ticks --
 *  returning a fresh Date.now() on every read would re-render forever.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, TICK_MS);
      // Browsers slow timers in background tabs to a crawl; a tab brought
      // back after an hour should not show an hour-old "live" state.
      document.addEventListener("visibilitychange", onChange);
      return () => { clearInterval(id); document.removeEventListener("visibilitychange", onChange); };
    },
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => null as number | null,
  );
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

/** The refresh stamp, written the way every other timestamp on the site
 *  is written: UTC, because that is the clock the refresh job runs on. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "UTC", timeZoneName: "short",
  });
}
