import { Suspense } from "react";
import type { Metadata } from "next";
import ComparePageInner from "./ComparePageInner";

export const metadata: Metadata = {
  title: "Compare Markets",
  description:
    "Every tracked market side by side over any year range — composite scores, individual pillar scores, and the raw underlying rates, on one chart.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#9296AB" }}>Loading…</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
