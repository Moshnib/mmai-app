import { Suspense } from "react";
import TrendsPageInner from "./TrendsPageInner";

export default function TrendsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#5B6472" }}>Loading…</div>}>
      <TrendsPageInner />
    </Suspense>
  );
}
