import { Suspense } from "react";
import type { Metadata } from "next";
import ComparePageInner from "./ComparePageInner";
import GovernmentDebtRow from "@/components/GovernmentDebtRow";

export const metadata: Metadata = {
  title: "Compare Markets",
  description:
    "Every tracked market side by side over any year range — composite scores, individual pillar scores, and the raw underlying rates, on one chart.",
};

export default function ComparePage() {
  return (
    <>
      <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#9296AB" }}>Loading…</div>}>
        <ComparePageInner />
      </Suspense>
      {/* Server-rendered and read live from BIS, so the call happens once
          per cache window on the server rather than in every visitor's
          browser. Renders nothing at all if BIS is unreachable -- a
          supplementary indicator should never put an error block on a
          page whose main content is fine. */}
      <GovernmentDebtRow />
    </>
  );
}
