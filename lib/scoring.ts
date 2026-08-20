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
  min: number;
  label: string;
  color: string;
  bg: string;
}

export const BANDS: Band[] = [
  { min: 80, label: "Strongly Supportive", color: "#2F6F62", bg: "#E4EFEC" },
  { min: 65, label: "Supportive", color: "#4C8A6E", bg: "#E9F1E7" },
  { min: 45, label: "Balanced", color: "#B8862B", bg: "#F6EEDC" },
  { min: 30, label: "Challenging", color: "#C07A3E", bg: "#F5E9DC" },
  { min: 0, label: "Highly Challenging", color: "#8C3B2E", bg: "#F3E4E1" },
];

export function bandFor(score: number | null): Band {
  if (score === null) {
    return { min: -1, label: "Not Publishable", color: "#8A93A6", bg: "#E7E9EF" };
  }
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
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
