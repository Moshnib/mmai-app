"use client";

import { useEffect, useState } from "react";

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
//  it, and returned as a boolean so components can read it too. Both
//  come from the same place, which is the point: before this, the
//  ticker, the score and the chart each decided for themselves.
// ============================================================

export type MotionSetting = "auto" | "play" | "still";
const STORE_KEY = "mmai.motion";

function read(): MotionSetting {
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return v === "play" || v === "still" ? v : "auto";
  } catch {
    // A private window, or storage blocked. Following the system is the
    // right answer when the reader's own choice cannot be read.
    return "auto";
  }
}

export function useMotion(): { setting: MotionSetting; running: boolean; toggle: () => void } {
  // Starts "still" on the server and on the first client render: a page
  // that has not yet read the system setting must not start moving and
  // then stop, and a hydration mismatch is worse than a beat of delay.
  const [setting, setSetting] = useState<MotionSetting>("auto");
  const [systemStill, setSystemStill] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setSystemStill(mq.matches);
      setSetting(read());
      setReady(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const running = ready && (setting === "play" || (setting === "auto" && !systemStill));

  // Published for the stylesheet. Written on every change, including the
  // first, so CSS and components can never disagree about the state.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.motion = running ? "play" : "still";
  }, [ready, running]);

  function toggle() {
    const next: MotionSetting = running ? "still" : "play";
    setSetting(next);
    try {
      window.localStorage.setItem(STORE_KEY, next);
    } catch {
      // The choice applies to this visit; it just will not be remembered.
    }
  }

  return { setting, running, toggle };
}
