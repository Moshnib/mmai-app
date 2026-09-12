import type { Metadata } from "next";
import DashboardInner from "./DashboardInner";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Where the macro environment is supportive right now, what has moved, and what money costs — the markets MMAI scores, on one screen.",
};

export default function DashboardPage() {
  return <DashboardInner />;
}
