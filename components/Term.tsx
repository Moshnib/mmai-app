"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * A WORD THAT EXPLAINS ITSELF.
 *
 * "Market-years", "band", "rank": the site's own vocabulary, which a first
 * visitor meets before the Learn page. The word gets a dotted underline;
 * tapping it (or pointing at it with a mouse) shows one plain sentence.
 *
 * A TOGGLETIP, NOT A TOOLTIP. A hover-only tooltip does nothing on a
 * phone and nothing for a keyboard. This is a real button:
 *   - click or tap PINS it open, and again closes it;
 *   - a mouse resting on it PREVIEWS it (only where hover is real), so the
 *     click that follows a hover pins it rather than closing it;
 *   - Escape, a click elsewhere, or a resize closes it.
 * The explanation sits in a status region that is always in the page and
 * only has its text filled in -- a live region that appears at the moment
 * it speaks is not announced.
 *
 * The bubble is placed in the click/hover handler, clamped to the screen,
 * so it never hangs off the edge of a phone.
 */
export default function Term({ k, children }: { k: GlossaryKey; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pinned || hover;

  function place() {
    const btn = btnRef.current;
    const wrap = wrapRef.current;
    if (!btn || !wrap) return;
    const vw = document.documentElement.clientWidth;
    const width = Math.min(300, vw - 32);
    const left = btn.getBoundingClientRect().left;
    const clamped = Math.max(16, Math.min(left, vw - 16 - width));
    setShift(clamped - wrap.getBoundingClientRect().left);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPinned(false);
        setHover(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Focus goes back to the word only if it was already in this term: a
      // tip opened by a resting mouse must not pull a keyboard reader's
      // focus from wherever they are.
      const hadFocus = !!wrapRef.current?.contains(document.activeElement);
      setPinned(false);
      setHover(false);
      if (hadFocus) btnRef.current?.focus();
    };
    const onResize = () => {
      setPinned(false);
      setHover(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <span
      className="term"
      ref={wrapRef}
      onMouseEnter={() => {
        if (!canHover()) return;
        place();
        setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        ref={btnRef}
        className="term-btn"
        onClick={() => {
          // Pinned -> the click closes it, hover included: toggling only
          // the pin left a hovered tip impossible to click shut. Not pinned
          // (closed, or only previewed by hover) -> the click pins it.
          if (pinned) {
            setPinned(false);
            setHover(false);
            return;
          }
          place();
          setPinned(true);
        }}
      >
        {children}
        <span className="sr-only"> — what this means</span>
      </button>
      <span role="status" className="term-status">
        {open && (
          <span className="term-bubble" style={{ left: shift }}>
            {GLOSSARY[k]}
          </span>
        )}
      </span>
    </span>
  );
}
