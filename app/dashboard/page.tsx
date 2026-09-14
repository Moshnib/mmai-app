import type { Metadata } from "next";
import DashboardInner from "./DashboardInner";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Dashboard",
  description:
    "Where the macro environment is supportive right now, what has moved, and what money costs — the markets MMAI scores, on one screen.",
  path: "/dashboard",
});

export default function DashboardPage() {
  return <DashboardInner />;
}
