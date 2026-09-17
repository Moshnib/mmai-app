"use client";

import { useEffect } from "react";

// ============================================================
//  WHEN THE WHOLE SITE FAILS
//
//  app/error.tsx catches a page that throws. This catches the one case it
//  cannot: the root layout itself failing. It replaces the entire document,
//  and per the Next 16 docs it gets none of globals.css -- so its colours
//  are written out here as literals, the site's own values, and measured:
//  ink #F2F5FA on #0A0F1A is 17.5:1, and navy #0A0F1A text on the gold
//  #FFD166 button is 13.3:1.
//
//  No error text is shown or logged beyond the digest: a stack trace is no
//  help to a reader and should not be printed in a visitor's console.
// ============================================================

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Logged once per error, in an effect rather than during render. A
  // fixed message, plus the digest when the server supplied one -- a
  // browser-side error has no digest, and still deserves a line.
  useEffect(() => {
    console.error(`Site failed to render${error.digest ? ` (digest ${error.digest})` : ""}`);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0A0F1A", color: "#F2F5FA", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <title>MMAI — something went wrong</title>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "72px 20px" }}>
          <p style={{ color: "#FFD166", fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: 2, margin: "0 0 14px" }}>
            SOMETHING WENT WRONG
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 34, lineHeight: 1.15, margin: "0 0 16px" }}>
            MMAI didn&apos;t load
          </h1>
          <p style={{ color: "#DCE3EC", fontSize: 15, lineHeight: 1.7, margin: "0 0 26px" }}>
            Trying again usually fixes it. If it keeps happening, please come back in a few minutes.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#FFD166", color: "#0A0F1A", border: 0, borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer", minHeight: 44 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
