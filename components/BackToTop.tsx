"use client";

import { useEffect, useState } from "react";
import { useMotion } from "@/lib/motion";

/**
 * BACK TO TOP.
 *
 * Measured before it was built: on a phone, Sources is 32 screens long and
 * Learn 19; Home, Trends, Gulf Watch and Stablecoins are eight or nine.
 * The top bar stays pinned, but getting back to the start of a long page
 * still meant a long swipe.
 *
 * It is not in the page at all until the reader is two screens down, so it
 * never covers anything on a short page and is never a stray tab stop.
 * Going up moves keyboard focus to the start of the content too --
 * otherwise the next Tab would jump back down to wherever the reader was.
 */
export default function BackToTop() {
  const [shown, setShown] = useState(false);
  const { running } = useMotion();

  useEffect(() => {
    // Only a crossing of the line changes state, so scrolling does not
    // re-render anything on every frame.
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 2;
      setShown((prev) => (prev === past ? prev : past));
    };
    // No call here on mount: a restored scroll position arrives as a
    // scroll event, and setting state directly in an effect is a lint error.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!shown) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: running ? "smooth" : "auto" });
        document.getElementById("main-content")?.focus({ preventScroll: true });
      }}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
      </svg>
    </button>
  );
}
