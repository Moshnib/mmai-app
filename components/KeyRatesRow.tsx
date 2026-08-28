import { RAW_FIELD, type PillarKey, type RawIndicators } from "@/lib/scoring";

// Same three colors used on the Trends page's "How They Move Together"
// chart (app/trends/TrendsPageInner.tsx) -- kept identical here so a
// reader recognizes Inflation/Policy Rate/Unemployment as the same three
// things wherever they appear on the site. Pulled from the existing
// Ember-to-Ice palette in lib/scoring.ts, so nothing new is introduced
// and green is still never used.
//
// Keyed by PillarKey (not a reverse-scan over RAW_FIELD by field name) so
// a renamed RawIndicators key is a compile error here, not a runtime one.
// Decimals are per-field: policy rates are genuinely set to the nearest
// quarter-point (e.g. 2.25%), but CPI/unemployment are published to one
// decimal -- showing a second decimal there implies precision the source
// release doesn't have.
// Exported so every place that prints a raw indicator uses ONE
// definition of this rule. Printing a policy rate at 1 decimal is not a
// rounding nicety -- it invents rates no central bank ever set (4.35
// becomes "4.3", 2.25 becomes "2.3"), so a second copy of this map that
// drifted would put wrong numbers on the page.
export const RAW_DECIMALS: Record<PillarKey, number> = {
  PS: 1, // inflation
  GM: 1, // GDP growth
  LM: 1, // unemployment
  MC: 2, // policy rate -- set to the nearest quarter-point
  EC: 1, // Brent YoY
};

const STATS: Array<{ pillar: PillarKey; color: string }> = [
  { pillar: "PS", color: "#E14B4B" }, // inflation
  { pillar: "MC", color: "#8B5CF6" }, // policy rate
  { pillar: "LM", color: "#22D3EE" }, // unemployment
];

// A short descriptor under each value, matching the design reference's
// card structure. Deliberately describes the CURRENT LEVEL against the
// thresholds MMAI already publishes (Equation 1's 2% target, Equation
// 4's 2.5% neutral) -- never a direction like "easing" or "trending",
// which would need a previous reading this component doesn't have.
function descriptorFor(pillar: PillarKey, value: number): string {
  if (pillar === "PS") {
    const gap = value - 2.0;
    if (Math.abs(gap) <= 0.5) return "Near the 2% target";
    return gap > 0 ? "Above the 2% target" : "Below the 2% target";
  }
  if (pillar === "MC") {
    const gap = value - 2.5;
    if (Math.abs(gap) <= 0.5) return "Near neutral";
    return gap > 0 ? "Restrictive vs neutral" : "Accommodative vs neutral";
  }
  if (value <= 4) return "Tight labour market";
  return value <= 6 ? "Steady labour market" : "Loose labour market";
}

export default function KeyRatesRow({ raw }: { raw: RawIndicators }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "20px 0 10px" }}>
      {STATS.map(({ pillar, color }) => {
        const decimals = RAW_DECIMALS[pillar];
        const { key, label, unit } = RAW_FIELD[pillar];
        const value = raw[key];
        return (
          <div
            key={pillar}
            style={{
              background: "var(--glass)",
              border: "1px solid var(--hair)",
              borderLeft: `3px solid ${color}`,
              borderRadius: 12,
              padding: "14px 16px",
              backdropFilter: "blur(10px)",
            }}
          >
            <dt style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
              {label}
            </dt>
            <dd style={{ margin: 0, fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 28, color: "var(--ink)", lineHeight: 1.15 }}>
              {value != null ? `${value.toFixed(decimals)}${unit}` : "—"}
            </dd>
            {value != null && (
              <div style={{ marginTop: 5, fontSize: 11, color: "var(--slate)" }}>
                {descriptorFor(pillar, value)}
              </div>
            )}
          </div>
        );
      })}
    </dl>
  );
}
