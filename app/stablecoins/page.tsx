import type { Metadata } from "next";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import { fetchAllStablecoinSupplies, STABLECOINS, type StablecoinSupply, type StablecoinChain } from "@/lib/fetchers/stablecoins";
import { ETHEREUM_STABLECOIN_HISTORY, ethereumSupplySeriesPoints, ethereumCompositionSeries } from "@/lib/stablecoinHistory";
import StablecoinTokens from "@/components/StablecoinTokens";
import StablecoinMacroLink from "@/components/StablecoinMacroLink";
import { measureMacroLink, type YieldPoint } from "@/lib/stablecoinMacro";
import { getPublicSupabaseClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Stablecoins",
  description:
    "How many dollars exist as stablecoins on Ethereum, Tron and Solana — read straight from each blockchain, with no composite score.",
};

// Read live on the server and cached, rather than stored in a database.
//
// A supply is a CURRENT LEVEL, not a series, so there is nothing to
// accumulate until we want a trend -- and there would be no history to
// chart for months anyway. Caching server-side means visitor traffic
// never reaches the public endpoints: the page rebuilds at most once
// every ten minutes no matter how many people read it, which keeps this
// comfortably inside ordinary fair use.
export const revalidate = 600;

const CHAIN_LABEL: Record<StablecoinChain, string> = {
  ethereum: "Ethereum",
  tron: "Tron",
  solana: "Solana",
};

// Plain-language note per chain. These describe what the chain IS, not
// how it is performing -- no direction, no forecast.
const CHAIN_NOTE: Record<StablecoinChain, string> = {
  ethereum: "The largest smart-contract network, and where most dollar-backed tokens were first issued.",
  tron: "Holds more Tether than any other chain, driven largely by remittances and dollar access in emerging markets.",
  solana: "A faster, lower-cost network that has taken a growing share of stablecoin activity.",
};


function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

const CHAIN_ORDER: StablecoinChain[] = ["ethereum", "tron", "solana"];

/** The US 10-year, from the same bond_yields table the rest of the site
 *  reads. Long enough to cover the supply history, and the only macro
 *  series the project holds that does.
 *
 *  Failure is not fatal: the macro panel renders "not enough history to
 *  measure", which is a different statement from "measured, found
 *  nothing", and the rest of the page is unaffected. */
async function fetchUsYields(): Promise<YieldPoint[]> {
  try {
    const { data, error } = await getPublicSupabaseClient()
      .from("bond_yields")
      .select("observation_date, yield_10y")
      .eq("market", "US")
      .gte("observation_date", "2023-01-01")
      .order("observation_date", { ascending: true });
    if (error || !data) return [];
    return data
      .filter((r) => r.yield_10y != null)
      .map((r) => ({ date: r.observation_date as string, yield10y: Number(r.yield_10y) }));
  } catch {
    return [];
  }
}

export default async function StablecoinsPage() {
  const [results, usYields] = await Promise.all([fetchAllStablecoinSupplies(), fetchUsYields()]);
  const macroLink = measureMacroLink(usYields);
  const rows = results.filter((r): r is StablecoinSupply => r !== null);

  const total = rows.reduce((sum, r) => sum + r.supply, 0);
  const missing = STABLECOINS.length - rows.length;

  // Same coin across several chains is the same coin -- group by symbol
  // for the headline table, and keep the per-chain split visible
  // underneath, because "USDT" is not one pool of money.
  const bySymbol = new Map<string, { symbol: string; name: string; issuer: string; backing: string; total: number; chains: Array<{ chain: StablecoinChain; supply: number }> }>();
  for (const r of rows) {
    const entry = bySymbol.get(r.symbol) ?? { symbol: r.symbol, name: r.name, issuer: r.issuer, backing: r.backing, total: 0, chains: [] };
    entry.total += r.supply;
    entry.chains.push({ chain: r.chain, supply: r.supply });
    bySymbol.set(r.symbol, entry);
  }
  const coins = [...bySymbol.values()].sort((a, b) => b.total - a.total);

  // History is the committed backfill, charted in BILLIONS -- raw dollar
  // values would put 12-digit numbers on the axis. Labelled "Sep '23"
  // style from each point's own real block date.
  const history = ETHEREUM_STABLECOIN_HISTORY;
  const peak = history.reduce((a, b) => (b.total > a.total ? b : a));
  const historySeries: Series[] = [
    {
      key: "ethereum-total",
      name: "Ethereum stablecoin supply",
      color: "#22D3EE",
      // Built in lib/stablecoinHistory.ts, which explains why the label
      // carries the day and why the ISO sortKey is not optional: without
      // it this chart sorted its months alphabetically and drew noise.
      data: ethereumSupplySeriesPoints(),
    },
  ];
  // COMPOSITION, not size. Every figure quoted in the caption below is
  // derived here rather than typed, so the prose cannot go stale the way
  // a hardcoded "USDe reached 8%" would the next time the backfill grows.
  const composition = ethereumCompositionSeries();
  const shareSeries = (name: string) => composition.find((s) => s.name === name)!.data;
  const usdtShare = shareSeries("USDT");
  const usdtFirstShare = usdtShare[0].value;
  const usdtLastShare = usdtShare[usdtShare.length - 1].value;
  const usdeReal = shareSeries("USDe").filter(
    (d): d is { year: string; value: number; sortKey: string } => d.value != null
  );
  const usdePeakShare = usdeReal.reduce((a, b) => (b.value > a.value ? b : a));
  const usdeNowShare = usdeReal[usdeReal.length - 1];

  const tronTotal = rows.filter((r) => r.chain === "tron").reduce((s, r) => s + r.supply, 0);

  const chainTotals = CHAIN_ORDER.map((chain) => ({
    chain,
    total: rows.filter((r) => r.chain === chain).reduce((s, r) => s + r.supply, 0),
    count: rows.filter((r) => r.chain === chain).length,
  }));

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">STABLECOINS</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>How many dollars exist on a blockchain</h1>
          <p className="sub">
            Stablecoins are tokens designed to hold a value of one US dollar. Their combined supply is a
            read on demand for dollars outside the banking system — and it is published continuously, by
            the networks themselves.
          </p>

          <div className="snapshot-card" style={{ marginTop: 26 }}>
            <div className="meta-label">Tokens in existence across Ethereum, Tron and Solana</div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1.05,
                margin: "10px 0 6px", color: "var(--status-live)", fontVariantNumeric: "tabular-nums",
                textShadow: "0 0 26px rgba(34,211,238,0.35)",
              }}
            >
              {money(total)}
            </div>
            <p style={{ fontSize: 13, color: "var(--slate)", margin: 0, lineHeight: 1.6, maxWidth: "70ch" }}>
              Counting {rows.length} dollar-pegged tokens across three networks. Read directly from each
              blockchain when this page was last built, and refreshed at most every ten minutes.
              {missing > 0 && ` ${missing} of ${STABLECOINS.length} could not be read on this build and are excluded rather than estimated.`}
            </p>
          </div>

          {/* auto-fit, not a fixed repeat(3): .gulf-strip is built for
              six columns, and hardcoding three here overrode its
              responsive rules so the cards never collapsed on a phone --
              measured 131px of sideways page scroll before this. */}
          <div className="gulf-strip" style={{ marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            {chainTotals.map((c) => (
              <div key={c.chain} className="mmai-card">
                <div className="meta-label">{CHAIN_LABEL[c.chain]}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 27, margin: "6px 0 4px", fontVariantNumeric: "tabular-nums" }}>
                  {money(c.total)}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.5 }}>{CHAIN_NOTE[c.chain]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">BY TOKEN</p>
            <h2>Each stablecoin, and where it lives</h2>
            <p>
              Bar length is each token&apos;s size against the largest one, and the coloured segments are the
              networks it lives on. The same token runs on several at once, holding a separate supply on each,
              shown split out rather than merged because they are not one pool of money.
            </p>
          </div>

          <StablecoinTokens coins={coins} />
        </div>
      </div>

      {/* Deliberately BELOW the all-chain totals above. Ethereum's supply
          peaked and has fallen while Tron's grew past it, so a reader who
          met this line first would conclude stablecoins are shrinking.
          They are not -- the supply moved chains. Context first, then the
          chart, and the heading names the chain rather than saying
          "stablecoin supply". */}
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">OVER TIME · ETHEREUM ONLY</p>
            <h2>Stablecoin supply on Ethereum, three years</h2>
            <p>
              Read from Ethereum&apos;s own archive, one point roughly every thirty days, each dated by the
              block it came from.
            </p>
          </div>

          <div className="chart-card" style={{ marginTop: 20 }}>
            <div className="chart-card-label">
              <span>Total supply on Ethereum</span>
              <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {money(history[0].total)} in {history[0].date.slice(0, 4)} → {money(history[history.length - 1].total)} today
              </span>
            </div>
            <TrendChart series={historySeries} height={320} yLabel="$B" showLegend={false} showDots={false} />
            <p style={{ fontSize: 12, color: "var(--slate)", margin: "14px 0 0", paddingTop: 12, borderTop: "1px dashed var(--hair)", lineHeight: 1.7 }}>
              <b style={{ color: "var(--ink-soft)" }}>Read this line carefully.</b> Ethereum&apos;s stablecoin
              supply peaked near {money(peak.total)} in {peak.date.slice(0, 7)} and has fallen since. That is not
              stablecoins shrinking — over the same stretch Tron grew past Ethereum to become the largest home for
              Tether, at {money(tronTotal)} today. The supply moved chains rather than leaving. Tron and Solana
              publish no comparable history, so this chart covers Ethereum alone.
            </p>
          </div>

          {/* WHO IS WINNING, which the total above cannot show.
              Shares rather than dollars on purpose: USDT sits near $100bn
              and PYUSD near $2bn, so in dollars five of the six tokens
              would lie flat against the axis and the composition -- the
              entire point -- would be invisible. A gap is a token that did
              not exist yet; see ethereumCompositionSeries(). */}
          <div className="chart-card" style={{ marginTop: 20 }}>
            <div className="chart-card-label">
              <span>Share of Ethereum supply, by token</span>
              <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                Tether {usdtFirstShare}% → {usdtLastShare}% over the period
              </span>
            </div>
            <TrendChart series={composition} height={320} yLabel="%" showLegend showDots={false} />
            <p style={{ fontSize: 12, color: "var(--slate)", margin: "14px 0 0", paddingTop: 12, borderTop: "1px dashed var(--hair)", lineHeight: 1.7 }}>
              <b style={{ color: "var(--ink-soft)" }}>What the total cannot show.</b> Tether and USD Coin
              still hold most of Ethereum&apos;s stablecoin supply between them, but the newer tokens are
              where the movement is. USDe — a synthetic dollar, backed by a hedged crypto position rather
              than cash in a bank — reached {usdePeakShare.value}% of the chain&apos;s supply in{" "}
              {usdePeakShare.sortKey.slice(0, 7)} and is {usdeNowShare.value}% today. On the total above that
              whole arc is a small wobble. A line that starts partway across is a token that did not exist
              before then, not one that sat at zero.
            </p>
          </div>

          {/* THE ANSWER TO "WHAT HAS THIS GOT TO DO WITH THE ECONOMY?"
              The page showed a total, three chain cards and this line,
              none of which connected to anything the rest of MMAI
              measures — on a site whose entire premise is the macro
              level. The hero calls the total "a read on demand for
              dollars outside the banking system", which implies a
              relationship without testing one.
              This tests it against the US 10-year and prints the result
              whichever way it falls. It currently falls null, and that is
              the more useful thing to tell a reader. */}
          <StablecoinMacroLink link={macroLink} />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">WHY THIS IS HERE</p>
            <h2>What this number is actually telling you</h2>
          </div>

          <div className="signal-grid" style={{ marginTop: 18 }}>
            <div className="mmai-card">
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, margin: "0 0 8px" }}>What it signals</h3>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.65 }}>
                A stablecoin is a dollar claim someone chose to hold outside the banking system. A rising total
                means more people want dollars they can move without a bank — often in economies where dollars
                are hard to get or expensive to send. Tron holding more Tether than any other network is that
                story in one number.
              </p>
            </div>
            <div className="mmai-card">
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, margin: "0 0 8px" }}>What it doesn&apos;t</h3>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.65 }}>
                Supply is not a measure of anyone&apos;s reserves, solvency, or trustworthiness. It says how many
                tokens exist, nothing about what stands behind them. It is also not part of the MMAI score, and
                these figures never influence any market&apos;s rating.
              </p>
            </div>
          </div>

          <div className="mmai-card" style={{ marginTop: 12 }}>
            <div className="meta-label">Where these numbers come from</div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
              Each figure is read from the token&apos;s own contract on the network named — Ethereum and Tron are
              asked directly for their total supply, Solana for its mint supply. This is public ledger data, not a
              data provider&apos;s product, so there is no estimate and no intermediary between the chain and this
              page. Backing type is the one hand-maintained field here, and describes the kind of asset an issuer
              says stands behind the token, not an audit of it.
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "10px 0 0", lineHeight: 1.7 }}>
              <b>Why these figures differ from a crypto data site.</b> This page counts every token that{" "}
              <b style={{ color: "var(--ink)" }}>exists</b> on each chain. Most aggregators publish{" "}
              <b style={{ color: "var(--ink)" }}>circulating</b> supply, which subtracts tokens an issuer has
              created but not yet sold — Tether&apos;s own treasury holds about $1.9B of unissued USDT on Ethereum
              alone. Neither measure is wrong; they answer different questions, and this one is the question a
              blockchain can answer without anybody&apos;s estimate. Coverage differs too: the tokens listed above
              are the ones tracked here, and euro-pegged coins are excluded because this page counts dollars.
            </p>
            <p style={{ fontSize: 13, color: "var(--slate)", margin: "10px 0 0", lineHeight: 1.7 }}>
              Deliberately absent: the live peg price. It is readable, but no source for it has cleared this
              site&apos;s licensing bar yet, and MMAI would rather show nothing than publish a number it cannot
              republish cleanly. The same rule is applied on the{" "}
              <Link href="/sources" style={{ color: "var(--accent-2)" }}>Sources</Link> page for every market.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
