import type { Metadata } from "next";
import TrendsPageInner from "./TrendsPageInner";
import BondYieldPanel from "@/components/BondYieldPanel";
import OilPricePanel from "@/components/OilPricePanel";
import { readBondYields } from "@/lib/bondYieldsRead";
import { readCommoditySeries, BRENT_SPOT_DAILY } from "@/lib/commodityPricesRead";
import type { DimensionKey } from "@/lib/composite";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Trends",
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
  searchParams: Promise<{ market?: string; dimension?: string; range?: string; raw?: string }>;
}) {
  const { market, dimension, range, raw } = await searchParams;

  // Validate against the real market/pillar lists -- these come straight from
  // the URL, so a junk value shouldn't reach the chart logic.
  const validDimension = VALID_DIMENSIONS.includes(dimension as DimensionKey) ? (dimension as DimensionKey) : null;
  // What the server rendered with, so the first paint matches the address
  // and the client picks up from there (lib/urlState.ts). The component
  // validates every param again, because the client reads the raw address.
  const serverQuery = new URLSearchParams(
    Object.entries({ market, dimension, range, raw }).filter((e): e is [string, string] => typeof e[1] === "string")
  ).toString();

 // Read on the SERVER and passed down as plain objects. The bond table
  // is the one genuinely daily series on the site, and reading it here
  // rather than calling six government sites at render time is the
  // reason it was stored in the first place.
  const bondPoints = await readBondYields(365);
  // The daily oil price, read here for the same reason as the yields:
  // stored once by the refresh, not fetched from the EIA on every visit.
  const oilPoints = await readCommoditySeries(BRENT_SPOT_DAILY, 120);

  return (
    <>
      <TrendsPageInner initialDimension={validDimension} serverQuery={serverQuery} />
      <OilPricePanel points={oilPoints} />
      <BondYieldPanel points={bondPoints} />
    </>
  );
}
