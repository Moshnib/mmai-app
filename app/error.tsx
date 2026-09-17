"use client";

import { useEffect } from "react";

import Link from "next/link";

// ============================================================
//  WHEN A PAGE FAILS
//
//  Before this file a page that threw showed the framework's bare error
//  text. This keeps the site's own header and footer (it renders inside
//  the root layout), says what happened in plain words, and offers the
//  two things a reader can actually do: try again, or go somewhere else.
//
//  Nothing from the error is shown. In production Next hands the page a
//  generic message and a digest, never the stack, and a digest means
//  nothing to a reader; it is logged for whoever reads the console.
//  `retry` is this Next version's name for the recovery function.
// ============================================================

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Logged once per error, in an effect rather than during render. A
  // fixed message, plus the digest when the server supplied one -- a
  // browser-side error has no digest, and still deserves a line.
  useEffect(() => {
    console.error(`Page failed to render${error.digest ? ` (digest ${error.digest})` : ""}`);
  }, [error]);

  return (
    <div className="hero">
      <div className="wrap">
        <p className="eyebrow">SOMETHING WENT WRONG</p>
        <h1 className="headline" style={{ maxWidth: "20ch" }}>This page didn&apos;t load</h1>
        <p className="sub">
          Usually that is a figure that did not arrive in time, and trying again fixes it. If it keeps happening,
          tell us which page, and we will look at it.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
          <button type="button" className="tap btn-primary" onClick={() => retry()}>
            Try again
          </button>
          <Link className="tap btn-secondary" href="/">
            Go to the homepage
          </Link>
          <Link className="tap btn-secondary" href="/contact">
            Report it
          </Link>
        </div>
      </div>
    </div>
  );
}
