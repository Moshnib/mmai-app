import type { StablecoinChain } from "@/lib/fetchers/stablecoins";

export type TokenRow = {
  symbol: string;
  name: string;
  issuer: string;
  backing: string;
  total: number;
  chains: Array<{ chain: StablecoinChain; supply: number }>;
};

/**
 * ON THE QUESTION OF OFFICIAL LOGOS.
 *
 * Every token here has an issuer logo, and every one of those logos is a
 * registered trademark. Two ways to put them on the page and neither is
 * free: hotlink them from the issuers' own servers, which sends a request
 * to nine third parties on every page view and breaks silently whenever
 * one of them moves a file; or redraw them, which means reproducing a
 * trademark from memory and getting it subtly wrong on a page whose whole
 * argument is that its numbers are exact.
 *
 * This site refuses data sources over licensing terms -- FRED was removed
 * for exactly that reason. It would be strange to apply a stricter bar to
 * a number than to a logo.
 *
 * So the mark is a monogram, and the colour carries information the
 * logos never could: what the token is actually backed by. A reader
 * learns more from "this one is synthetic" than from a correctly drawn
 * roundel. If the real logos are wanted later they need sourcing from
 * each issuer's published brand pack, with its terms read -- a separate
 * job with a licensing answer per issuer, not a styling change.
 */
const BACKING_TONE: Record<string, { fill: string; ring: string; label: string }> = {
  "fiat-backed": { fill: "rgba(34,211,238,0.14)", ring: "#22D3EE", label: "Cash-backed" },
  "crypto-backed": { fill: "rgba(185,140,255,0.16)", ring: "#B98CFF", label: "Crypto-backed" },
  synthetic: { fill: "rgba(240,151,91,0.16)", ring: "#F0975B", label: "Synthetic" },
};
const FALLBACK_TONE = { fill: "rgba(255,255,255,0.06)", ring: "#8A8EA3", label: "Other" };

/** The site's own palette rather than each network's brand colours: three
 *  hues that are already load-bearing elsewhere here, so the page stays
 *  one design instead of three borrowed ones. */
const CHAIN_TONE: Record<StablecoinChain, string> = {
  ethereum: "#22D3EE",
  tron: "#B98CFF",
  solana: "#F0975B",
};
const CHAIN_LABEL: Record<StablecoinChain, string> = {
  ethereum: "Ethereum",
  tron: "Tron",
  solana: "Solana",
};

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * The tokens as ranked rows rather than a table of dollar figures.
 *
 * The table this replaces was accurate and told you almost nothing at a
 * glance. Nine rows of nine-figure numbers do not convey that one token
 * is most of the market -- the reader has to divide. And the split across
 * networks was a run-on string, "Ethereum $60.1B · Tron $22.4B", which is
 * a chart written out in words.
 *
 * A bar answers both at once: length is the share of the largest token,
 * and the segments are the networks. The proportion that had to be
 * calculated is now the first thing seen.
 */
export default function StablecoinTokens({ coins }: { coins: TokenRow[] }) {
  const total = coins.reduce((s, c) => s + c.total, 0);
  // Scaled against the largest token, not the total: scaled against the
  // total, everything below the leader would be a sliver and the ranking
  // among the rest -- which is most of the list -- would be unreadable.
  const largest = Math.max(...coins.map((c) => c.total), 1);

  return (
    <div className="coin-rows">
      {coins.map((c) => {
        const tone = BACKING_TONE[c.backing] ?? FALLBACK_TONE;
        const share = total > 0 ? (c.total / total) * 100 : 0;
        const chains = [...c.chains].sort((a, b) => b.supply - a.supply);

        return (
          <div key={c.symbol} className="coin-row">
            <div className="coin-row-head">
              <span
                className="coin-mark"
                style={{ background: tone.fill, borderColor: tone.ring, color: tone.ring }}
                aria-hidden="true"
              >
                {/* Four characters is the longest ticker here (PYUSD is
                    five and gets trimmed to fit the circle). */}
                {c.symbol.length > 4 ? c.symbol.slice(0, 4) : c.symbol}
              </span>

              <div className="coin-id">
                <div className="coin-sym">{c.symbol}</div>
                <div className="coin-name">
                  {c.name} · issued by {c.issuer}
                </div>
              </div>

              <div className="coin-figs">
                <div className="coin-total">{money(c.total)}</div>
                <div className="coin-share">
                  {share < 1 ? "under 1%" : `${share.toFixed(0)}%`} of all tokens here
                </div>
              </div>
            </div>

            {/* Length against the biggest token, segments by network. */}
            <div
              className="coin-bar"
              role="img"
              aria-label={
                `${c.symbol}: ${money(c.total)} in total, ` +
                chains.map((s) => `${money(s.supply)} on ${CHAIN_LABEL[s.chain]}`).join(", ") + "."
              }
            >
              <div className="coin-bar-fill" style={{ width: `${(c.total / largest) * 100}%` }}>
                {chains.map((s) => (
                  <span
                    key={s.chain}
                    style={{
                      width: `${(s.supply / c.total) * 100}%`,
                      background: CHAIN_TONE[s.chain],
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="coin-foot">
              {chains.map((s) => (
                <span key={s.chain} className="coin-chip">
                  <i style={{ background: CHAIN_TONE[s.chain] }} />
                  {CHAIN_LABEL[s.chain]} {money(s.supply)}
                </span>
              ))}
              <span className="coin-chip coin-chip-backing" style={{ color: tone.ring }}>
                {tone.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
