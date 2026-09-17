"use client";

import { useRef, useState } from "react";

/**
 * SHARE THIS VIEW.
 *
 * The address now carries what the reader picked (lib/urlState.ts), so the
 * link IS the view: Japan on Trends opens on Japan for whoever receives it.
 *
 * On a phone it opens the phone's own share sheet -- WhatsApp, Mail,
 * Messages -- because that is where a phone reader shares from. On a
 * desktop there is no useful share sheet, so it copies the link and says
 * so. If copying is refused (an older browser, a locked-down page), the
 * link is shown selected, so it can still be copied by hand.
 *
 * The status line is in the page from the start and only its TEXT changes:
 * a live region that appears at the moment it speaks is not announced.
 */
export default function ShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(text: string) {
    setStatus(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 2500);
  }

  async function share() {
    const url = window.location.href;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        // Closing the share sheet is not an error worth telling anyone about.
        if ((e as Error)?.name !== "AbortError") setFallbackUrl(url);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setFallbackUrl(null);
      say("Link copied");
    } catch {
      setFallbackUrl(url);
    }
  }

  return (
    <span className="share">
      <button type="button" className="share-btn" onClick={share}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4.5h10V9" />
        </svg>
        Share this view
      </button>
      <span className="share-status" role="status" aria-live="polite">{status}</span>
      {fallbackUrl && (
        <input
          className="share-fallback"
          readOnly
          value={fallbackUrl}
          aria-label="Link to this view"
          onFocus={(e) => e.currentTarget.select()}
          ref={(el) => el?.select()}
        />
      )}
    </span>
  );
}
