"use client";

import { useEffect, useSyncExternalStore } from "react";

// ============================================================
//  ONE SWITCH FOR EVERYTHING THAT MOVES
//
//  The site honours prefers-reduced-motion, and on 16 September the
//  owner reported the desktop as "horrible, nothing is working" while
//  the phone was fine. Nothing was broken: Windows had animation effects
//  switched off, Chrome reported prefers-reduced-motion, and the site
//  correctly stopped the ticker, the counting score and the chart that
//  draws itself in -- every sign of life at once, with no way to ask for
//  it back. The phone had no such setting, so the phone looked alive.
//
//  Respecting the system by DEFAULT is right. Refusing a reader who
//  asks is not. So: one preference, three states, remembered.
//
//    auto   follow the system (the default)
//    play   the reader asked for movement
//    still  the reader asked for none
//
//  It is published as data-motion on <html> so CSS animations can read
//  it, and returned as a boolean so components can read it too.
//
//  ONE STORE, NOT ONE STATE PER CALLER. The first version kept the
//  setting in each component's own useState, so pressing play on the
//  ticker updated the ticker and nothing else: the score on the same page
//  went on appearing instantly. Every caller now reads the same store,
//  and a toggle anywhere notifies all of them.
//
//  Scope, honestly: this drives the ticker, the counting score, the trend
//  line and the live dot. A few smaller transitions elsewhere in
//  globals.css still follow the system setting alone.
// ============================================================

export type MotionSetting = "auto" | "play" | "still";
const STORE_KEY = "mmai.motion";
const QUERY = "(prefers-reduced-motion: reduce)";

function readSetting(): MotionSetting {
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return v === "play" || v === "still" ? v : "auto";
  } catch {
    // A private window, or storage blocked. Following the system is the
    // right answer when the reader's own choice cannot be read.
    return "auto";
  }
}

// The reader's choice for this visit. Kept in memory as well as in
// storage, so a blocked localStorage still toggles for the whole page.
let current: MotionSetting | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
  };
}

/** "play" | "still" | "auto-play" | "auto-still": a string, so the
 *  snapshot compares equal between renders. */
function getSnapshot(): string {
  if (current === null) current = readSetting();
  const systemStill = window.matchMedia(QUERY).matches;
  return current === "auto" ? (systemStill ? "auto-still" : "auto-play") : current;
}

// The server, and the first client render, see "server" (not ready, so
// nothing runs): a page that has
// not yet read the system setting must not start moving and then stop,
// and a hydration mismatch is worse than a beat of delay.
function getServerSnapshot(): string {
  return "server";
}

export function useMotion(): { setting: MotionSetting; running: boolean; toggle: () => void } {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = snap !== "server";
  const running = snap === "play" || snap === "auto-play";
  const setting: MotionSetting = snap.startsWith("auto") || !ready ? "auto" : (snap as MotionSetting);

  // Published for the stylesheet. Written on every change, including the
  // first, so CSS and components can never disagree about the state.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.motion = running ? "play" : "still";
  }, [ready, running]);

  function toggle() {
    const next: MotionSetting = running ? "still" : "play";
    current = next;
    try {
      window.localStorage.setItem(STORE_KEY, next);
    } catch {
      // The choice applies to this visit; it just will not be remembered.
    }
    notify();
  }

  return { setting, running, toggle };
}
