import { Suspense } from "react";
import ComparePageInner from "./ComparePageInner";

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#9296AB" }}>Loading…</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
