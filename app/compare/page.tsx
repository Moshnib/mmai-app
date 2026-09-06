import { REFERENCE_COUNT } from "@/lib/composite";
import type { Metadata } from "next";
import Link from "next/link";
import ComparePageInner from "./ComparePageInner";
import GovernmentDebtRow from "@/components/GovernmentDebtRow";

export const metadata: Metadata = {
  title: "Compare Markets",
  description:
    "Every tracked market side by side over any year range — composite scores, the three dimension rankings, and the raw underlying rates, on one chart.",
};

// The methodology footer lives HERE rather than inside ComparePageInner
// so that page order is decided on the server: comparison sections, then
// government debt, then the disclaimer last.
//
// Two arrangements were tried and rejected first, both verified in the
// browser rather than assumed:
//  1. <GovernmentDebtRow /> rendered AFTER <ComparePageInner /> put the
//     debt section below the "not investment advice" footer, at the very
//     bottom of the page, where the site owner could not find it.
//  2. Passing it INTO ComparePageInner as a prop fixed the order but
//     hung the page: at the time ComparePageInner called useSearchParams()
//     and so sat behind a Suspense boundary, and an async server component
//     handed to it left the whole Compare page showing only "Loading…".
// Moving the footer out avoids passing a server component into a client
// component at all, which is what made both earlier attempts fragile.
//
// ComparePageInner no longer calls useSearchParams(), the boundary is
// gone with it, and the "Loading…" failure described above turned out to
// be happening anyway -- see the note at the render below.
export default function ComparePage() {
  return (
    <>
      {/* NO SUSPENSE BOUNDARY, and that is the fix.
          This page was serving nothing but "Loading…" in production. The
          server rendered the whole thing correctly -- the markup was in
          the response, 54KB of it -- but React streams a suspended
          boundary's content into a hidden container and swaps it in with
          a script, and that swap never completed here. The page sat on
          its fallback forever, so a visitor saw a spinner, and a crawler
          or a link-preview bot saw an empty page.

          The boundary was only ever here because ComparePageInner called
          useSearchParams(). It stopped calling it, and the wrapper stayed
          behind -- costing the page its content in exchange for nothing.
          A client component with no async work suspends on nothing and
          needs no boundary.

          Trends hit this same problem and solved it the same way; the
          comment in app/trends/page.tsx records that reasoning. This page
          was simply missed. */}
      <ComparePageInner />

      {/* Server component: the BIS call happens once per cache window on
          the server, never in a visitor's browser. Renders nothing at all
          if BIS is unreachable -- a supplementary indicator must never
          put an error block on a page whose main content is fine. */}
      <GovernmentDebtRow />

      <div className="section">
        <div className="wrap">
          {/* Short methodology footer (brief §13, item 5) */}
          <div
            className="mmai-card"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
          >
            <span style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6, maxWidth: "70ch" }}>
              MMAI is a percentile rank (0–100) against {REFERENCE_COUNT} market-years of the same six economies, built from three equally weighted dimensions. A higher score means a more supportive
              macro backdrop. Not investment advice.
            </span>
            <Link
              href="/learn#topic-mmai"
              className="tap"
              style={{
                fontFamily: "IBM Plex Mono, monospace", fontSize: 12, fontWeight: 700,
                color: "var(--accent-2)", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              How MMAI is calculated →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
