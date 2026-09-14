import type { Metadata } from "next";
import TrendsPageInner from "./TrendsPageInner";
import BondYieldPanel from "@/components/BondYieldPanel";
import { readBondYields } from "@/lib/bondYieldsRead";
import { FALLBACK_MARKETS } from "@/lib/markets";
import type { DimensionKey } from "@/lib/composite";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Data Over Time",
  description:
    "How each market's MMAI score and its three dimensions have moved since 2019 — with the raw inflation, growth, unemployment, debt and policy-rate figures behind them.",
  path: "/trends",
});

const VALID_DIMENSIONS: DimensionKey[] = ["C", "D", "K"];

// searchParams is read here on the server and passed down as props, rather
// than via useSearchParams() inside the client component. That keeps the page
// fully server-rendered, so crawlers and link-preview bots receive real HTML
// instead of an empty Suspense fallback.
export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; dimension?: string }>;
}) {
  const { market, dimension } = await searchParams;

  // Validate against the real market/pillar lists -- these come straight from
  // the URL, so a junk value shouldn't reach the chart logic.
  const validMarket = FALLBACK_MARKETS.some((m) => m.code === market) ? market! : "US";
  const validDimension = VALID_DIMENSIONS.includes(dimension as DimensionKey) ? (dimension as DimensionKey) : null;

 // Read on the SERVER and passed down as plain objects. The bond table
  // is the one genuinely daily series on the site, and reading it here
  // rather than calling six government sites at render time is the
  // reason it was stored in the first place.
  const bondPoints = await readBondYields(365);

  return (
    <>
      <TrendsPageInner initialMarket={validMarket} initialDimension={validDimension} />
      <BondYieldPanel points={bondPoints} />
    </>
  );
}
