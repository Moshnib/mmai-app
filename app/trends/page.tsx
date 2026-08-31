import type { Metadata } from "next";
import TrendsPageInner from "./TrendsPageInner";
import BondYieldPanel from "@/components/BondYieldPanel";
import { readBondYields } from "@/lib/bondYieldsRead";
import { FALLBACK_MARKETS } from "@/lib/markets";
import type { PillarKey } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Data Over Time",
  description:
    "How each market's MMAI score and its five underlying pillars have moved since 2019 — with the raw inflation, growth, unemployment, and policy-rate figures behind them.",
};

const VALID_PILLARS: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

// searchParams is read here on the server and passed down as props, rather
// than via useSearchParams() inside the client component. That keeps the page
// fully server-rendered, so crawlers and link-preview bots receive real HTML
// instead of an empty Suspense fallback.
export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; pillar?: string }>;
}) {
  const { market, pillar } = await searchParams;

  // Validate against the real market/pillar lists -- these come straight from
  // the URL, so a junk value shouldn't reach the chart logic.
  const validMarket = FALLBACK_MARKETS.some((m) => m.code === market) ? market! : "US";
  const validPillar = VALID_PILLARS.includes(pillar as PillarKey) ? (pillar as PillarKey) : null;

 // Read on the SERVER and passed down as plain objects. The bond table
  // is the one genuinely daily series on the site, and reading it here
  // rather than calling six government sites at render time is the
  // reason it was stored in the first place.
  const bondPoints = await readBondYields(365);

  return (
    <>
      <TrendsPageInner initialMarket={validMarket} initialPillar={validPillar} />
      <BondYieldPanel points={bondPoints} />
    </>
  );
}
