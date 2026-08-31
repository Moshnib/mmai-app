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

/** Equation 1 — Price Stability. Default target tau = 2%. */
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
export function computePillarScores(raw: RawIndicators): PillarScores {
  return {
    PS: raw.inflation != null ? priceStabilityScore(raw.inflation) : null,
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

const BAND_LABELS = [
  { min: 80, label: "Strongly Supportive" },
  { min: 65, label: "Supportive" },
  { min: 45, label: "Balanced" },
  { min: 30, label: "Challenging" },
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
