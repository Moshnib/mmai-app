"use client";

import { colorForScore } from "@/lib/scoring";
import {
  explainDimension, DIMENSION_NAMES, DIMENSION_QUESTIONS, DIMENSION_STATS,
  type DimensionKey, type CompositeInput,
} from "@/lib/composite";

const ORDER: DimensionKey[] = ["C", "D", "K"];

/** What each dimension is for, in a sentence a reader can hold. The ring
 *  labels are too short to explain anything -- "Inflation against target,
 *  and unemployment" says what goes in, not what it means. */
const DIMENSION_MEANING: Record<DimensionKey, string> = {
  C: "What the economy feels like to live in right now. Prices near target and people in work.",
  D: "Whether it is getting better or worse. Growth is the only indicator here, so this dimension is one number.",
  K: "What is left in reserve. Low debt and a policy rate with somewhere to fall both mean a government can act if things turn.",
};

/**
 * The arithmetic behind one dimension, shown rather than asserted.
 *
 * WHY THIS EXISTS. The rings publish three numbers and a one-line label,
 * which tells a reader what goes in but not how it combines or why their
 * country landed where it did. Japan scoring 100 on Conditions is only
 * meaningful once you can see it is inflation exactly on target AND
 * unemployment at 2.4% -- both, at once, better than almost every reading
 * in the record.
 *
 * Every figure here is computed, never written: the raw value, its
 * sign-aligned z-score, the weight, and the product. A reader can follow
 * the sum to the dimension score and then to the published rank.
 */
export default function DimensionBreakdown({
  raw,
  market,
  percentiles,
  only,
}: {
  raw: CompositeInput;
  market: string;
  percentiles: Record<DimensionKey, number> | null;
  /** Render one dimension instead of all three. */
  only?: DimensionKey;
}) {
  const keys = only ? [only] : ORDER;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {keys.map((key) => {
        const { total, parts } = explainDimension(key, raw, market);
        const pct = percentiles ? percentiles[key] : null;
        const color = colorForScore(pct);
        const sd = DIMENSION_STATS[key].sd;

        return (
          <div
            key={key}
            style={{
              border: "1px solid var(--hair)",
              borderLeft: `3px solid ${color}`,
              borderRadius: 12,
              padding: "16px 18px",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 15, color: "#fff" }}>{DIMENSION_NAMES[key]}</b>
              <span style={{ fontSize: 12, color: "var(--gold-deep)", fontStyle: "italic" }}>
                {DIMENSION_QUESTIONS[key]}
              </span>
              <span
                style={{
                  marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 18, fontWeight: 700, color,
                }}
              >
                {pct == null ? "—" : pct.toFixed(1)}
              </span>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "8px 0 14px" }}>
              {DIMENSION_MEANING[key]}
            </p>

            {/* The components. One row per indicator, so a dimension built
                from two is visibly built from two. */}
            <div style={{ display: "grid", gap: 8 }}>
              {parts.map((p) => (
                <div
                  key={p.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px,1.4fr) auto auto auto",
                    gap: 10, alignItems: "center",
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5,
                    color: "var(--slate)",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>{p.label}</span>
                  <span style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                    {p.raw == null ? "—" : `${p.raw.toFixed(p.decimals)}${p.unit.startsWith("%") ? "%" : ""}`}
                  </span>
                  {/* The z-score, with its sign carrying the meaning: above
                      zero is better than the historical average, below is
                      worse. Not "good/bad" -- better or worse than usual. */}
                  <span
                    title="Standard deviations from the historical average, with the sign flipped where lower is better."
                    style={{ color: p.q == null ? "var(--slate)" : p.q >= 0 ? "#22D3EE" : "#E14B4B", fontVariantNumeric: "tabular-nums" }}
                  >
                    {p.q == null ? "—" : `${p.q >= 0 ? "+" : ""}${p.q.toFixed(2)} sd`}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    × {p.weight === 1 ? "1" : p.weight.toFixed(3)} ={" "}
                    <b style={{ color: "#fff" }}>
                      {p.contribution == null ? "—" : `${p.contribution >= 0 ? "+" : ""}${p.contribution.toFixed(3)}`}
                    </b>
                  </span>
                </div>
              ))}
            </div>

            {/* The sum, then the standardisation, then the rank. Three
                steps, each shown, because the gap between "two z-scores"
                and "a percentile" is where a reader loses the thread. */}
            <div
              style={{
                borderTop: "1px solid var(--hair)", marginTop: 12, paddingTop: 10,
                fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, color: "var(--slate)",
                display: "grid", gap: 4,
              }}
            >
              <div>
                {parts.length > 1 ? "sum" : "score"} = <b style={{ color: "#fff" }}>
                  {total == null ? "—" : `${total >= 0 ? "+" : ""}${total.toFixed(3)}`}
                </b>
              </div>
              <div>
                ÷ {sd.toFixed(6)} <span style={{ opacity: 0.7 }}>(this dimension&rsquo;s spread across the record)</span> ={" "}
                <b style={{ color: "#fff" }}>
                  {total == null ? "—" : `${total / sd >= 0 ? "+" : ""}${(total / sd).toFixed(3)}`}
                </b>
              </div>
              <div>
                ranked against 148 market-years ={" "}
                <b style={{ color }}>{pct == null ? "—" : `${pct.toFixed(1)} percentile`}</b>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
