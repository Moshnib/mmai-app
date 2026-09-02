// ============================================================
// MMAI SCORING ENGINE — v2.0 (five-pillar specification)
// Market Momentum was removed as a structural pillar on 2026-08-19:
// no licensed equity data source exists, and none is planned near-term.
// Its 20% weight was redistributed proportionally across the remaining
// five pillars (new_weight = old_weight / 0.80), which is mathematically
// identical to the reweighting v1.0 already performed at runtime for any
// market missing that pillar — so every historical score computed under
// v1.0 is numerically unchanged under this specification.
// External & Commodities was replaced by Fiscal Resilience on
// 2026-09-01, closing audit finding M-4 / recommendation 8. The old
// pillar scored Brent crude, which is a SINGLE GLOBAL PRICE: the
// refresh route wrote the identical figure to all six markets, so the
// pillar's cross-market standard deviation was exactly 0.0000. It
// carried 12.5% of the published weight and could not, arithmetically,
// affect the ranking of one country against another. It moved all six
// composites up and down together and nothing else.
// The key is FR, not EC, deliberately: renaming forced the compiler
// through every call site rather than letting a redefined "EC" pass
// silently.
// Direct implementation of Equations 1-7 from
// "MMAI — Methodology, Statistical Properties, and Empirical Validation"
// (v1.0 document; Equations 1-5 and 7 unchanged, Equation 6's six-term
// sum is now a five-term sum with the weights below).
// ============================================================

export type PillarKey = "PS" | "GM" | "LM" | "MC" | "FR";

export interface RawIndicators {
  inflation?: number | null; // % YoY
  gdpGrowth?: number | null; // % (convention varies by market — see notes)
  unemployment?: number | null; // %
  policyRate?: number | null; // %
  /** NO LONGER SCORED as of 2026-09-01. Still fetched and still shown
   *  in the weekly feed, because the oil price is genuine information --
   *  it is just not a valid basis for comparing one country with
   *  another, which is what a pillar has to do. */
  brentYoY?: number | null; // % YoY change, shared across markets
  /** Credit to general government from all sectors at market value, as a
   *  % of GDP. BIS dataflow WS_TC, quarterly. Market-specific, which is
   *  the whole point of the change. */
  debtPctGdp?: number | null;
}

export interface PillarScores {
  PS: number | null;
  GM: number | null;
  LM: number | null;
  MC: number | null;
  FR: number | null;
}

export const TOTAL_PILLARS = 5;

export const PILLAR_WEIGHTS: Record<PillarKey, number> = {
  PS: 0.25,
  GM: 0.25,
  LM: 0.1875,
  MC: 0.1875,
  FR: 0.125,
};

export const PILLAR_NAMES: Record<PillarKey, string> = {
  PS: "Price Stability",
  GM: "Growth Momentum",
  LM: "Labour Market",
  MC: "Monetary Conditions",
  FR: "Fiscal Resilience",
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
 *    - Fiscal Resilience is weighted 12.5% and operates at 9.0%.
 *
 *  RE-MEASURED 1 September 2026 after Fiscal Resilience replaced External
 *  & Commodities, by scripts/measure-pillar-influence.ts, which now runs
 *  in CI and fails if these constants drift from the panel.
 *
 *  THE NEW PILLAR SCORES WORSE HERE THAN THE OLD ONE, AND THAT IS THE
 *  POINT. External & Commodities measured 15.0% -- third of five, more
 *  than its weight -- and was arithmetically incapable of changing any
 *  ranking. All 15.0% was TIME variance: a single global oil price
 *  moving six markets in lockstep. Fiscal Resilience measures 9.0%, less
 *  than its 12.5% weight, but its variance is the kind that separates
 *  one country from another.
 *
 *  So this figure alone is not a quality measure, and treating it as one
 *  is what let the defect hide. Read it with PILLAR_CROSS_MARKET_SD.
 *
 *  These are OBSERVATIONS about the current panel, not parameters. Nothing
 *  reads them to compute a score; they exist so the Learn page can publish
 *  what the weights actually do. They will drift as history accumulates and
 *  should be re-measured, not trusted indefinitely. */
export const PILLAR_EFFECTIVE_INFLUENCE: Record<PillarKey, number> = {
  PS: 32.1,
  GM: 31.3,
  LM: 16.6,
  MC: 11.0,
  FR: 9.0,
};

/** Date the figures above were measured, shown wherever they are published
 *  so a reader can tell how stale they are. */
export const PILLAR_INFLUENCE_MEASURED = "2 September 2026";

/** Cross-market standard deviation of each pillar on the live snapshot --
 *  how much a pillar separates one country from another RIGHT NOW.
 *
 *  This exists because PILLAR_EFFECTIVE_INFLUENCE alone hid a real defect
 *  for months. A pillar fed by a single global price varies a great deal
 *  over TIME and not at all ACROSS markets, and an influence figure that
 *  blends the two reported it as the third most influential pillar while
 *  it was incapable of changing any ranking.
 *
 *  Measured 1 September 2026 on the latest six-market reading. The old
 *  External & Commodities pillar scored 0.0000 here, exactly, by
 *  construction rather than by coincidence. Any future pillar that
 *  measures near zero on this line is decoration.
 *
 *  THE UNCOMFORTABLE RESULT, AND A CORRECTION TO IT.
 *
 *  Monetary Conditions is the pillar that separates the six markets
 *  least: SD 4.8 against an 18.75% weight. Growth Momentum is next at
 *  6.0, on the joint-largest weight of 25%. Labour Market does the most
 *  work at 13.8, on a smaller weight than either. On the current
 *  reading the ranking is driven mostly by unemployment and debt.
 *
 *  ON 1 SEPTEMBER THIS FILE SAID GROWTH MOMENTUM WAS THE LEAST
 *  SEPARATING PILLAR, AT 3.3. That was wrong, and the way it was wrong
 *  is worth keeping. These figures are measured from the final point of
 *  lib/history.ts -- which was then a HARDCODED snapshot that had
 *  drifted from live data, still carrying euro area inflation of 2.0
 *  from Eurostat's retired dataset. A stale input produced a wrong
 *  published statistic, and the Learn page repeated it in prose.
 *  lib/history.ts now derives that point from FALLBACK_MARKETS so the
 *  duplication cannot drift again.
 *
 *  Neither figure is the oil pillar's defect: growth and policy rates
 *  are genuinely market-specific and will spread as cycles diverge.
 *  But NEITHER HAS BEEN INVESTIGATED, and both should be before anyone
 *  claims these weights are calibrated rather than merely chosen. */
export const PILLAR_CROSS_MARKET_SD: Record<PillarKey, number> = {
  PS: 7.7,
  GM: 6.0,
  LM: 13.8,
  MC: 4.8,
  FR: 11.1,
};

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
  FR: { key: "debtPctGdp", label: "Government Debt (% of GDP)", unit: "%" },
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

/** The neutral nominal policy rate each central bank's own economy is
 *  judged against.
 *
 *  Until 2026-09-01 MMAI applied a single 2.5% to all six markets. That
 *  was the least defensible number in the methodology: the natural rate
 *  of interest is economy-specific and time-varying, and one constant
 *  spanning Japan and the United States cannot be defended.
 *
 *  It was also WRONG, not merely unjustified -- published estimates put
 *  Canada near 3.8% and the euro area near 2.1%.
 *
 *  NOMINAL = real r* + the market's inflation target. Every value below
 *  traces to a published estimate:
 *
 *   US 3.01  NY Fed Holston-Laubach-Williams, 2026Q2: real r* 1.009
 *   CA 3.76  NY Fed HLW, 2026Q2: real r* 1.759
 *   EA 2.09  NY Fed HLW, 2026Q2: real r* 0.086
 *   JP 1.64  Bank of Japan Review 2026-E-4, MEDIAN of the six models it
 *            publishes for 2025Q3. They span -0.94 to +0.53 and the BoJ
 *            says so explicitly; the median is a choice, not a reading.
 *   UK 3.00  Bank of England: the Governor used ~3% as a starting point
 *            for the nominal neutral rate, February 2026. Stated in
 *            prose, not published as a series.
 *   AU 3.50  RBA Bulletin, September 2017: ~1% real, plus the 2.5%
 *            Australian target.
 *
 *            THIS IS THE WEAKEST OF THE SIX AND IS NINE YEARS OLD. The
 *            RBA's March 2026 speech describes its current method but
 *            publishes the estimates in charts rather than text. Global
 *            r* estimates have generally RISEN post-COVID, so 3.50 most
 *            likely UNDERSTATES Australia's neutral rate -- which makes
 *            Australia look further from neutral than it is, and scores
 *            it conservatively rather than flatteringly. Refresh this
 *            first when a newer figure appears.
 *
 *  ALL SIX OR NONE. Correcting three markets and leaving three on 2.5%
 *  would make the cross-country comparison incoherent -- one country
 *  measured properly against another measured by assumption. A uniform
 *  error is at least a COMPARABLE error. That is why this waited until
 *  every market had a source.
 */
export const NEUTRAL_RATE: Record<string, number> = {
  US: 3.01,
  CA: 3.76,
  EA: 2.09,
  JP: 1.64,
  UK: 3.00,
  AU: 3.50,
};

/** Falls back to 2.5 for any market not listed -- the old universal
 *  constant. Deliberately a soft fallback: Gulf markets are unscored and
 *  Norway is dormant. A market that becomes SCORED must be added here
 *  with a source, exactly as INFLATION_TARGET requires. */
export function neutralRateFor(market: string): number {
  return NEUTRAL_RATE[market] ?? 2.5;
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

/** Equation 4 — Monetary Conditions. `neutral` is per-market and
 *  required; see NEUTRAL_RATE. */
export function monetaryConditionsScore(policyRate: number, neutral: number): number {
  return clip(100 - 12 * Math.abs(policyRate - neutral));
}

/** Equation 5 — Fiscal Resilience.
 *
 *  Scores general government debt as a share of GDP against the
 *  MAASTRICHT 60% REFERENCE VALUE (Treaty on the Functioning of the
 *  European Union, Protocol No 12, Article 1). 60 is used because it is
 *  a PUBLISHED threshold that already governs six of the economies
 *  scored here through the euro area, not because it is the level at
 *  which debt becomes dangerous -- no such universal level exists in the
 *  literature, and claiming one would repeat the mistake this project
 *  made with a single 2.5% neutral rate.
 *
 *  THE SLOPE IS A CHOICE AND IS DELIBERATELY GENTLE. At 0.3 the pillar
 *  reaches zero only at 393% of GDP, which no scored market approaches,
 *  so it grades rather than cliffs. Steeper slopes were tested and
 *  rejected: at 0.8 or above, this one indicator alone decides the
 *  headline ranking, and Japan -- whose debt is overwhelmingly held
 *  domestically, in its own currency, at near-zero rates -- is pushed
 *  from first to fifth on a ratio that means something different there
 *  than it does elsewhere. The sensitivity across slopes 0.3 to 1.0 is
 *  recorded in the change log. Australia ranks first and Canada last
 *  under EVERY slope tested; only Japan's position moves.
 *
 *  Debt at or below 60% scores 100. This compresses the top -- four of
 *  six markets currently sit between 89 and 100 -- and that is accepted
 *  rather than tuned away: a threshold means nothing if the score keeps
 *  improving below it. */
export const FISCAL_REFERENCE_PCT_GDP = 60;
export const FISCAL_SLOPE = 0.3;

export function fiscalResilienceScore(debtPctGdp: number): number {
  return clip(100 - FISCAL_SLOPE * Math.max(0, debtPctGdp - FISCAL_REFERENCE_PCT_GDP));
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
    MC: raw.policyRate != null ? monetaryConditionsScore(raw.policyRate, neutralRateFor(market)) : null,
    FR: raw.debtPctGdp != null ? fiscalResilienceScore(raw.debtPctGdp) : null,
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
