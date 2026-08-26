import { Suspense } from "react";
import type { Metadata } from "next";
import GulfWatchPageInner from "./GulfWatchPageInner";

export const metadata: Metadata = {
  title: "Gulf Watch",
  description:
    "Live cost-of-living, investment-confidence, and currency-stability data for six Gulf countries — shown honestly, with no composite score where the data doesn't support one.",
};

export default function GulfWatchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#9296AB" }}>Loading…</div>}>
      <GulfWatchPageInner />
    </Suspense>
  );
}
