// ============================================================
//  THE INDICATORS, AND HOW THEY ARE LABELLED AND COLOURED
//
//  THIS FILE DOES NOT SCORE ANYTHING. It used to: it was lib/scoring.ts,
//  and it held the five-pillar engine -- Price Stability, Growth Momentum,
//  Labour Market, Monetary Conditions, Fiscal Resilience, their weights,
//  their bands, and the arithmetic that combined them.
//
//  That engine was retired on 5 September 2026 and replaced by the
//  three-dimension composite in lib/composite.ts, which is now the only
//  scorer on the site. Everything the old engine consisted of is gone from
//  here; what survived is the handful of things that were never really
//  part of it:
//
//    PillarKey / PILLAR_CODES   the SOURCE taxonomy. lib/sources.ts files
//                               every source by pillar code, and that
//                               mapping is still how a stale figure is
//                               traced back to the institution behind it.
//    RawIndicators              the shape of a market's readings.
//    RAW_FIELD                  how each reading is labelled and united.
//    INFLATION_TARGET           each central bank's own published target.
//    colorForScore              the one colour ramp used site-wide.
//
//  The file is named for what it holds now. Keeping "scoring" on it would
//  have sent the next person looking for the engine to a colour function.
//  The retired engine is in git history and at the tag v1.0-five-pillar.
// ============================================================

/** Kept as the SOURCE taxonomy, not a scoring concept. lib/sources.ts
 *  keys every data source by one of these five codes. */
export type PillarKey = "PS" | "GM" | "LM" | "MC" | "FR";

/** The five codes, in reading order. This replaces PILLAR_WEIGHTS, which
 *  the one remaining caller used only via Object.keys() -- it never read a
 *  single weight. Enumerating them honestly is better than keeping a table
 *  of retired numbers alive just to be counted. */
export const PILLAR_CODES: readonly PillarKey[] = ["PS", "GM", "LM", "MC", "FR"];

export interface RawIndicators {
  inflation?: number | null; // % YoY
  gdpGrowth?: number | null; // % (convention varies by market — see notes)
  unemployment?: number | null; // %
  policyRate?: number | null; // %
  /** NO LONGER SCORED as of 2026-09-01. Still fetched and still shown
   *  in the daily feed, because the oil price is genuine information --
   *  it is just not a valid basis for comparing one country with
   *  another, which is what a scored indicator has to do. */
  brentYoY?: number | null; // % YoY change, shared across markets
  /** Credit to general government from all sectors at market value, as a
   *  % of GDP. BIS dataflow WS_TC, quarterly. Market-specific, which is
   *  the whole point of the change. */
  debtPctGdp?: number | null;
}

/** Which reading each source code refers to, and how to label it. */
export const RAW_FIELD: Record<PillarKey, { key: keyof RawIndicators; label: string; unit: string }> = {
  PS: { key: "inflation", label: "Inflation (YoY)", unit: "%" },
  GM: { key: "gdpGrowth", label: "GDP Growth", unit: "%" },
  LM: { key: "unemployment", label: "Unemployment Rate", unit: "%" },
  MC: { key: "policyRate", label: "Policy Interest Rate", unit: "%" },
  FR: { key: "debtPctGdp", label: "Government Debt (% of GDP)", unit: "%" },
};

/** EACH CENTRAL BANK'S OWN PUBLISHED TARGET, not one number applied to
 *  everyone. Five aim at 2%. Australia is the exception: the Reserve Bank
 *  targets a 2-3% range and sets policy so inflation returns to the
 *  midpoint, so MMAI scores Australia against 2.5%.
 *
 *  Read from here everywhere rather than typed into copy. On 2026-08-31
 *  Australia's target moved and the Learn page still said 2% for every
 *  market, which quietly broke the promise that a reader can reproduce
 *  any published score by hand. */
export const INFLATION_TARGET: Record<string, number> = {
  US: 2.0,
  EA: 2.0,
  UK: 2.0,
  CA: 2.0,
  JP: 2.0,
  AU: 2.5,
  // The Riksbank targets 2.0 on CPIF, which is the series lib/fetchers/scb.ts
  // reads. Stated rather than left to the 2.0 default: Australia above shows
  // targets do vary, so a market inheriting one silently is a trap.
  SE: 2.0,
  // Norges Bank targets 2.0 on Norway's own CPI, which is the series
  // lib/fetchers/ssb.ts reads -- not the HICP Eurostat also publishes for
  // Norway. Stated rather than inherited, for the same reason Sweden is.
  NO: 2.0,
  // The Bank of Korea targets 2.0 on HEADLINE CPI, stated on its own site
  // and in force since 2019. Written down rather than left to the 2.0
  // default even though the default matches: Malaysia was rejected as a
  // market precisely because Bank Negara publishes no target at all, and
  // a default that happens to be right teaches nobody that.
  KR: 2.0,
};

export function inflationTargetFor(market: string): number {
  return INFLATION_TARGET[market] ?? 2.0;
}

// ------------------------------------------------------------------
//  ONE COLOUR RAMP, USED EVERYWHERE
// ------------------------------------------------------------------

/** THE SCORE RAMP. Clay red below the historical average, neutral at it,
 *  blue above -- a diverging scale, which is what a percentile against a
 *  record actually is.
 *
 *  It used to run red → orange → violet → cyan, four hues from the neon
 *  palette the site retired in September 2026. On the navy ground those
 *  middle stops went muddy: nine countries on the homepage map came out
 *  brown and purple, which the owner reported as "not appealing".
 *
 *  Measured before it shipped, across the whole 0-100 sweep: nothing
 *  under 4.60:1 on either surface, no green anywhere (channel AND hue),
 *  and the closest point to the gold accent is 39 dE away, so a scored
 *  colour is never mistaken for "this is the one you chose".
 *  scripts/check-palette-contrast.ts sweeps it on every build. */
const COLOR_STOPS = ["#CF6660", "#A9AEBC", "#63C3E6"];
/** The colour of a figure that does not exist.
 *
 *  Was a darker grey (6B7086), which measured 3.85:1 on a card and 4.08:1 on the page --
 *  both under the 4.5:1 this site holds itself to. It went unnoticed
 *  because it only renders when something is MISSING, and on a fully
 *  populated site nothing was: scripts/check-accessibility.ts caught it
 *  the moment Norway was added and had no stored rows yet.
 *
 *  That is the uncomfortable part. The least readable text on the site
 *  was the text saying a number could not be shown -- the one a reader
 *  most needs to distinguish from a real figure.
 *
 *  #7B8096 was the same hue lifted until it cleared the bar on the old
 *  near-black ground. The navy ground (September 2026 restyle) is lighter,
 *  and #7B8096 fell to 4.32:1 on a card, so it was lifted again: #838AA0
 *  is 4.91:1 on a card and 5.17:1 on the page.
 *  scripts/check-palette-contrast.ts holds it there. */
const NA_COLOR = "#838AA0";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Continuous colour for any 0-100 score. Used everywhere a score needs a
 *  colour: the score display, dimension cards, the world map and the
 *  Trends charts -- one function, one gradient, no per-market identity
 *  colours anywhere that a score is being shown. */
export function colorForScore(score: number | null): string {
  if (score === null) return NA_COLOR;
  const t = Math.max(0, Math.min(100, score)) / 100;
  const n = COLOR_STOPS.length - 1;
  const pos = t * n;
  const i = Math.min(n - 1, Math.floor(pos));
  const localT = pos - i;
  const [r1, g1, b1] = hexToRgb(COLOR_STOPS[i]);
  const [r2, g2, b2] = hexToRgb(COLOR_STOPS[i + 1]);
  return rgbToHex(r1 + (r2 - r1) * localT, g1 + (g2 - g1) * localT, b1 + (b2 - b1) * localT);
}
