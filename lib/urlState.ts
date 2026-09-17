"use client";

import { useMemo, useSyncExternalStore } from "react";

// ============================================================
//  WHAT THE READER PICKED, KEPT IN THE ADDRESS
//
//  Choosing Japan on Trends used to leave the address unchanged. A link
//  sent to someone opened on the default market, and the browser's Back
//  button left the page rather than undoing the choice. Data sites the
//  owner compared MMAI with keep the choice in the address, so a link is
//  the view and Back behaves.
//
//  Two ways to write, deliberately:
//    push     a new place to go back to -- choosing a MARKET
//    replace  a fine adjustment of the same view -- a year range, a
//             dimension, a chart toggle. Pushing those would make Back
//             step through every click.
//
//  READ THROUGH useSyncExternalStore, not an effect or requestAnimationFrame.
//  rAF never fires in a tab that is not painting (recorded in
//  TrendsPageInner and ScoreDisplay), so an address read that way silently
//  fails to open the shared view; and state copied in from an effect trips
//  the set-state-in-effect rule and renders the wrong view for a frame.
//  The server snapshot is whatever the server could see (an empty query
//  for a static page), and React re-renders with the real address once
//  hydrated.
// ============================================================

const EVENT = "mmai:urlchange";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(EVENT, listener);
  };
}

function getSnapshot() {
  return window.location.search;
}

/** The current query. `serverQuery` is what the server rendered with --
 *  "" for a static page, or the validated params a dynamic page read. */
export function useQuery(serverQuery = ""): URLSearchParams {
  const search = useSyncExternalStore(subscribe, getSnapshot, () => serverQuery);
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** Set or clear params (null clears). A param at its default should be
 *  passed as null, so an untouched page keeps a clean address. */
export function setQuery(changes: Record<string, string | null>, mode: "push" | "replace") {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === now) return;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
  window.dispatchEvent(new Event(EVENT));
}
