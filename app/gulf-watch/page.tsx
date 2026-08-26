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
    "Live cost-of-living, investment-confidence, and currency-stability data for six Gulf countries — shown honestly, with no composite score where the data doesn't support one.",
};

export default function GulfWatchPage() {
  return <GulfWatchPageInner />;
}
