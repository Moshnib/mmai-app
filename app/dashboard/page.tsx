import type { Metadata } from "next";
import DashboardInner from "./DashboardInner";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Where the macro environment is supportive right now, what has moved, and what money costs — the seven markets MMAI scores, on one screen.",
};

export default function DashboardPage() {
  // Read on the server so the key never reaches the browser. Without it
  // the question box is not rendered at all -- a box that always answers
  // "not configured" is worse than no box.
  return <DashboardInner assistantEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />;
}
