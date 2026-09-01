// ============================================================
// MMAI SCORING ENGINE — v2.0 (five-pillar specification)
// Market Momentum was removed as a structural pillar on 2026-08-19:
// no licensed equity data source exists, and none is planned near-term.
// Its 20% weight was redistributed proportionally across the remaining
// five pillars (new_weight = old_weight / 0.80), which is mathematically
// identical to the reweighting v1.0 already performed at runtime for any
// market missing that pillar — so every historical score computed under
// v1.0 is numerically unchanged under this specification.
// Direct implementation of Equations 1-7 from
// "MMAI — Methodology, Statistical Properties, and Empirical Validation"
// (v1.0 document; Equations 1-5 and 7 unchanged, Equation 6's six-term
// sum is now a five-term sum with the weights below).
// ============================================================

export type PillarKey = "PS" | "GM" | "LM" | "MC" | "EC";

export interface RawIndicators {
  inflation?: number | null; // % YoY
  gdpGrowth?: number | null; // % (convention varies by market — see notes)
  unemployment?: number | null; // %
  policyRate?: number | null; // %
  brentYoY?: number | null; // % YoY change, shared across markets
}

export interface PillarScores {
  PS: number | null;
  GM: number | null;
  LM: number | null;
  MC: number | null;
  EC: number | null;
}

export const TOTAL_PILLARS = 5;

export const PILLAR_WEIGHTS: Record<PillarKey, number> = {
  PS: 0.25,
  GM: 0.25,
  LM: 0.1875,
  MC: 0.1875,
  EC: 0.125,
};

export const PILLAR_NAMES: Record<PillarKey, string> = {
  PS: "Price Stability",
  GM: "Growth Momentum",
  LM: "Labour Market",
  MC: "Monetary Conditions",
  EC: "External & Commodities",
};

/** The one way pillar weights are ever rendered as text, used by the Overview
 *  rings, the Trends cards, and the Learn page's published formula.
 *
 *  Exact, not rounded: 18.75% and 12.5% are the real weights, and rounding
 *  them for display (to "19%" or even "18.8%") makes the five visibly sum to
 *  101% or 100.1% and stops a reader reproducing the composite by hand --
 *  which the Learn page explicitly invites them to do. Trailing zeros are
 *  trimmed so 25.00 reads as "25". */
export function formatWeightPct(key: PillarKey): string {
  return `${(PILLAR_WEIGHTS[key] * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** MEASURED influence of each pillar on the composite, as a percentage.
 *
 *  A pillar's real influence is not its weight. It is its weight TIMES how
 *  much that pillar actually varies: a heavily weighted pillar that barely
 *  moves does little work, and a lightly weighted one that swings widely
 *  does more than its share. This is a standard property of composite
 *  indicators, covered in the OECD/JRC Handbook -- not a defect -- but it
 *  means PILLAR_WEIGHTS alone describes intent rather than behaviour.
 *
 *  Measured 31 August 2026 across MMAI's full stored panel (48 market-years,
 *  six markets, 2019-2026) as weight x pillar standard deviation, normalised
 *  to 100. Two results are worth stating plainly:
 *
 *    - Monetary Conditions is weighted 18.75% and operates at 9.2%. The
 *      policy rate does not vary enough, once passed through its equation,
 *      to earn its stated share.
 *    - External & Commodities is weighted 12.5% and operates at 15.0% --
 *      MORE than Monetary Conditions.
 *
 *  These are OBSERVATIONS about the current panel, not parameters. Nothing
 *  reads them to compute a score; they exist so the Learn page can publish
 *  what the weights actually do. They will drift as history accumulates and
 *  should be re-measured, not trusted indefinitely. */
export const PILLAR_EFFECTIVE_INFLUENCE: Record<PillarKey, number> = {
  PS: 30.6,
  GM: 29.4,
  LM: 15.8,
  MC: 9.2,
  EC: 15.0,
};

/** Date the figures above were measured, shown wherever they are published
 *  so a reader can tell how stale they are. */
export const PILLAR_INFLUENCE_MEASURED = "31 August 2026";

/** Renders a measured influence figure the same way everywhere. */
export function formatInfluencePct(key: PillarKey): string {
  return `${PILLAR_EFFECTIVE_INFLUENCE[key].toFixed(1)}%`;
}

/** Which raw indicator each pillar is derived from, plus display info.
 *  Shared by the Trends page (single-market detail view) and the Compare
 *  page (cross-market view), so both stay in sync automatically. */
export const RAW_FIELD: Record<PillarKey, { key: keyof RawIndicators; label: string; unit: string }> = {
  PS: { key: "inflation", label: "Inflation (YoY)", unit: "%" },
  GM: { key: "gdpGrowth", label: "GDP Growth", unit: "%" },
  LM: { key: "unemployment", label: "Unemployment Rate", unit: "%" },
  MC: { key: "policyRate", label: "Policy Interest Rate", unit: "%" },
  EC: { key: "brentYoY", label: "Brent Crude, Year-over-Year Change", unit: "%" },
};

function clip(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

/** The official price-stability benchmark each central bank actually
 *  states, per market.
 *
 *  Every value below was read from the issuing institution's own page on
 *  31 August 2026, not from memory:
 *
 *   US 2.0  Federal Reserve. Stated on the PCE price index -- which is why
 *           lib/fetchers/bea.ts fetches PCE rather than CPI.
 *   EA 2.0  ECB, symmetric 2% medium-term target on HICP.
 *   UK 2.0  Bank of England: "The Government has set us a target of
 *           keeping inflation at 2%."
 *   CA 2.0  Bank of Canada: "the inflation-control target, which is the
 *           2% midpoint of the 1%-3% control range." The 2% is the
 *           TARGET; the range is a control band around it.
 *   JP 2.0  Bank of Japan, the "Price Stability Target" of 2 per cent.
 *   AU 2.5  Reserve Bank of Australia. Australia is the ONLY one of the
 *           six whose target is a RANGE -- "keep annual consumer price
 *           inflation between 2 and 3 per cent". 2.5 is not MMAI rounding
 *           that band to a convenient midpoint: the RBA's own explainer
 *           states that "the Statement on the Conduct of Monetary Policy
 *           specifies that the Reserve Bank sets monetary policy such
 *           that inflation is expected to return to the MIDPOINT of the
 *           target". The midpoint of 2-3% is 2.5%.
 *
 *  Australia was previously scored against 2.0 like everyone else, which
 *  penalised it for inflation its own central bank considers on target.
 *
 *  The charter (section 10) requires exactly this shape: "common scoring
 *  function, economy-appropriate official measure and benchmark". The
 *  FUNCTION is identical for all six; only the benchmark differs, and
 *  only where the issuing central bank differs. */
export const INFLATION_TARGET: Record<string, number> = {
  US: 2.0,
  EA: 2.0,
  UK: 2.0,
  CA: 2.0,
  JP: 2.0,
  AU: 2.5,
};

/** Falls back to 2.0 for any market not listed above.
 *
 *  Deliberately a soft fallback rather than a throw: Gulf Watch markets
 *  are unscored, and Norway's row is dormant. But a market that becomes
 *  SCORED must be added to INFLATION_TARGET with a verified source --
 *  inheriting 2.0 silently is the exact error this map exists to fix. */
export function inflationTargetFor(market: string): number {
  return INFLATION_TARGET[market] ?? 2.0;
}

/** Equation 1 — Price Stability. Target is the market's own official
 *  benchmark; see INFLATION_TARGET. */
export function priceStabilityScore(inflation: number, target = 2.0): number {
  return clip(100 - 15 * Math.abs(inflation - target));
}

/** Equation 2 — Growth Momentum. */
export function growthMomentumScore(gdpGrowth: number): number {
  return clip(50 + 10 * gdpGrowth);
}

/** Equation 3 — Labour Market. */
export function labourMarketScore(unemployment: number): number {
  return clip(100 - 10 * (unemployment - 2));
}

/** Equation 4 — Monetary Conditions. Default neutral rate = 2.5%. */
export function monetaryConditionsScore(policyRate: number, neutral = 2.5): number {
  return clip(100 - 12 * Math.abs(policyRate - neutral));
}

/** Equation 5 — External & Commodities. */
export function externalCommoditiesScore(brentYoY: number): number {
  return clip(100 - 1.2 * Math.abs(brentYoY));
}

/** Runs all five pillar transformations. */
/** `market` is REQUIRED, not optional with a default.
 *
 *  An optional parameter would let a call site silently score Australia
 *  against 2.0 while the refresh route scored it against 2.5 -- the stored
 *  score and the displayed score would then disagree, which is a class of
 *  bug this project has already been bitten by. Making it required turns
 *  the compiler into the guard: every call site had to be visited. */
export function computePillarScores(raw: RawIndicators, market: string): PillarScores {
  return {
    PS: raw.inflation != null ? priceStabilityScore(raw.inflation, inflationTargetFor(market)) : null,
    GM: raw.gdpGrowth != null ? growthMomentumScore(raw.gdpGrowth) : null,
    LM: raw.unemployment != null ? labourMarketScore(raw.unemployment) : null,
    MC: raw.policyRate != null ? monetaryConditionsScore(raw.policyRate) : null,
    EC: raw.brentYoY != null ? externalCommoditiesScore(raw.brentYoY) : null,
  };
}

export interface CompositeResult {
  composite: number | null;
  coverage: number; // 0..1, fraction of 5 pillars populated
  coveragePillars: number; // count out of 5
  publishable: boolean;
}

/** Equations 6 & 7 — weighted composite with missing-pillar reweighting,
 *  gated by the 70% coverage publication threshold. */
export function computeComposite(pillars: PillarScores): CompositeResult {
  let sum = 0;
  let activeWeight = 0;
  let coveragePillars = 0;

  (Object.keys(PILLAR_WEIGHTS) as PillarKey[]).forEach((key) => {
    const val = pillars[key];
    if (val != null) {
      sum += val * PILLAR_WEIGHTS[key];
      activeWeight += PILLAR_WEIGHTS[key];
      coveragePillars += 1;
    }
  });

  const coverage = coveragePillars / TOTAL_PILLARS;
  const publishable = coverage >= 0.70;
  const composite = publishable && activeWeight > 0 ? sum / activeWeight : null;

  return { composite, coverage, coveragePillars, publishable };
}

/** MINIMUM-PILLAR RULE — audit finding H-1.
 *
 *  MMAI aggregates linearly, which is FULLY COMPENSATORY: a collapse in
 *  one pillar can be offset entirely by strength in the others, without
 *  limit. That is a real property of the chosen aggregation, not a bug,
 *  but left undisclosed it lets the headline conceal a total failure.
 *
 *  It is not hypothetical. Measured over 1990-2018:
 *
 *    EA 2013  Labour Market = 0.0  -> composite published 59.9 'Balanced'
 *    JP 2009  Growth        = 0.0  -> composite published 45.8
 *    AU 1990  Monetary      = 0.0  -> composite published 44.7
 *    CA 1990  Monetary      = 0.0  -> composite published 43.8
 *
 *  Euro-area unemployment reached 12.02% in 2013, the pillar registered
 *  EXACTLY ZERO, and the index said Balanced.
 *
 *  The UNDP changed the Human Development Index from arithmetic to
 *  geometric aggregation in 2010 for precisely this reason. Changing
 *  MMAI's aggregation would move every historical score and needs its own
 *  evidence; DISCLOSING the masking costs nothing and is owed to a reader
 *  now.
 *
 *  THRESHOLDS ARE CALIBRATED, NOT CHOSEN. A weak pillar is not itself a
 *  problem -- a weak pillar the composite CONCEALS is. So the rule
 *  measures the concealment directly: the gap between the headline and
 *  its worst component. Tested across 173 market-years:
 *
 *    gap > 40 AND weakest < 30   fires on 21% of history
 *                                and catches all four total failures above
 *
 *  A wider gap threshold (45) would fire less often but MISS Canada 1990,
 *  whose gap is 43.8. 40 is the loosest value that catches every case of
 *  a pillar at zero. See research/audit-floor-rule.ts.
 */
export const MASK_GAP_THRESHOLD = 40;
export const MASK_PILLAR_THRESHOLD = 30;

export interface MaskedPillar {
  pillar: PillarKey;
  score: number;
  composite: number;
  gap: number;
}

/** Returns the pillar the composite is masking, or null when none is.
 *  Callers should surface this next to the score -- it is the honest
 *  counterpart to a compensatory aggregation rule. */
export function maskedPillar(
  pillars: PillarScores,
  composite: number | null
): MaskedPillar | null {
  if (composite == null) return null;
  let worst: { key: PillarKey; value: number } | null = null;
  for (const key of Object.keys(PILLAR_WEIGHTS) as PillarKey[]) {
    const v = pillars[key];
    if (v == null) continue;
    if (worst === null || v < worst.value) worst = { key, value: v };
  }
  if (worst === null) return null;
  const gap = composite - worst.value;
  if (gap <= MASK_GAP_THRESHOLD || worst.value >= MASK_PILLAR_THRESHOLD) return null;
  return { pillar: worst.key, score: worst.value, composite, gap };
}

export interface Band {
  label: string;
  color: string;
  bg: string;
}

// "Ember to Ice" continuous gradient: Red -> Orange -> Violet -> Cyan.
// Interpolated smoothly across the full 0-100 range, weather-map style —
// two scores 0.1 apart always produce two colors 0.1 apart, unlike a
// discrete band system where a score can jump color entirely at a threshold.
// NOTE: Gold was deliberately removed from this gradient — a direct
// gold-to-cyan interpolation in RGB space passes through green as a
// mathematical side effect (verified: scores 60-65 rendered visibly green
// before this fix), which defeats the whole point of avoiding green.
const COLOR_STOPS = ["#E14B4B", "#F0975B", "#8B5CF6", "#22D3EE"];
const NA_COLOR = "#6B7086";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Continuous color for any 0-100 score. Used everywhere a score needs a
 *  color: the gauge, pillar rings, heatmap cells, the world map, sparklines,
 *  and the Trends page charts — one function, one gradient, no fixed
 *  per-pillar or per-market identity colors anywhere in the app. */
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

// Band thresholds, calibrated 2026-08-31 against 173 market-years of
// history (1990-2018) rather than chosen for appearance.
//
// The previous thresholds (80/65/45/30) were invented. Charter section 15
// requires that verbal bands "must themselves be researched and
// documented. They should not be invented merely for visual appeal."
// Scored over the historical panel they put 63% of ALL observations in a
// single band, and "Highly Challenging" was never reached ONCE in 29
// years -- not in 2009. The United States in 2009, the worst year since
// the 1930s, was labelled "Balanced".
//
// METHOD. Thresholds were required to classify ten NAMED macroeconomic
// episodes the way an economist would: the UK 1990 and Canada 1991
// recessions, the 2009 GFC trough in the US, euro area and Japan, US 2008
// as crisis-underway, Japan 1999 post-Asian-crisis, Australia 2009
// avoiding recession, US 2018 mature expansion, Australia 2012 mining
// peak. A pure-quantile alternative was tested FIRST and failed (3/10) --
// it labels US 2008 "Highly Challenging", which is wrong. Charter section
// 9.1 independently cautions against percentile approaches.
//
// HONEST CAVEAT. 2,376 threshold sets satisfy all ten anchors, so the
// evidence CONSTRAINS each threshold to a range rather than fixing a
// point: 40-45, 48-59, 64-74, 85-87. The values below sit inside those
// ranges, chosen for the most even distribution and legible numbers.
// Three of the four OLD thresholds sat outside any defensible range;
// only the 65 survived, by coincidence rather than design.
//
// A rescale of the composite itself was proposed and REJECTED: it was
// dynamic min-max, which charter 9.1 rejects by name, and would have
// retroactively changed every score ever published. Full rejection
// record in research/rescale-demo.ts.
//
// These are LABELS ONLY. No score changes, and none of the six current
// market labels changes under these thresholds.
const BAND_LABELS = [
  { min: 85, label: "Strongly Supportive" },
  { min: 74, label: "Supportive" },
  { min: 55, label: "Balanced" },
  { min: 40, label: "Challenging" },
  { min: 0, label: "Highly Challenging" },
];

/** The text label is still categorical (five discrete bands, matching the
 *  methodology paper) — only the color is now continuous. */
export function bandFor(score: number | null): Band {
  const color = colorForScore(score);
  if (score === null) {
    return { label: "Not Publishable", color, bg: `${color}22` };
  }
  const label = (BAND_LABELS.find((b) => score >= b.min) ?? BAND_LABELS[BAND_LABELS.length - 1]).label;
  return { label, color, bg: `${color}22` };
}

/** Identifies the strongest and weakest populated pillars — used for the
 *  auto-generated "why" narrative on the Overview page. */
export function narrativeDrivers(pillars: PillarScores): { best: PillarKey; worst: PillarKey } | null {
  const entries = (Object.keys(pillars) as PillarKey[])
    .map((k) => [k, pillars[k]] as const)
    .filter((e): e is [PillarKey, number] => e[1] != null);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { best: entries[0][0], worst: entries[entries.length - 1][0] };
}
