import { Suspense } from "react";
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
//     hung the page: ComparePageInner needs a Suspense boundary because
//     it calls useSearchParams(), and an async server component handed
//     to it left the whole Compare page showing only "Loading…".
// Moving the footer out avoids passing a server component into a client
// component at all, which is what made both earlier attempts fragile.
export default function ComparePage() {
  return (
    <>
      <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "var(--slate)" }}>Loading…</div>}>
        <ComparePageInner />
      </Suspense>

      {/* Server component: the BIS call happens once per cache window on
          the server, never in a visitor's browser. Renders nothing at all
          if BIS is unreachable -- a supplementary indicator must never
          put an error block on a page whose main content is fine. */}
      <GovernmentDebtRow />

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {/* Short methodology footer (brief §13, item 5) */}
          <div
            className="mmai-card"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
          >
            <span style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6, maxWidth: "70ch" }}>
              MMAI is a percentile rank (0–100) against 148 market-years of the same six economies, built from three equally weighted dimensions. A higher score means a more supportive
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
