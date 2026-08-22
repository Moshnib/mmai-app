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
const STATS: Array<{ pillar: PillarKey; color: string; decimals: number }> = [
  { pillar: "PS", color: "#E14B4B", decimals: 1 }, // inflation
  { pillar: "MC", color: "#8B5CF6", decimals: 2 }, // policy rate
  { pillar: "LM", color: "#22D3EE", decimals: 1 }, // unemployment
];

export default function KeyRatesRow({ raw }: { raw: RawIndicators }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "20px 0" }}>
      {STATS.map(({ pillar, color, decimals }) => {
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
            <dd style={{ margin: 0, fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, color: "var(--ink)" }}>
              {value != null ? `${value.toFixed(decimals)}${unit}` : "—"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
