import type { Metadata } from "next";
import GulfWatchPageInner from "./GulfWatchPageInner";

// No Suspense boundary here, unlike app/compare/page.tsx -- that one
// needs it because ComparePageInner uses useSearchParams(), which
// requires one. GulfWatchPageInner uses neither useSearchParams() nor
// any other hook that needs it, so it was copied over unnecessarily
// from the Compare pattern -- removed after it turned out to be
// implicated in a real bug where this page's client-side effect never
// fired in production (confirmed: the rest of the page hydrated fine,
// but this specific Suspense-wrapped subtree's useEffect never ran).
export const metadata: Metadata = {
  title: "Gulf Watch",
  description:
    "Cost of living, investment activity and currency stability across the six GCC economies — the figures their own governments publish, fetched daily, and deliberately not compressed into a score.",
};

export default function GulfWatchPage() {
  return <GulfWatchPageInner />;
}
