"use client";

import { colorForScore } from "@/lib/indicators";
import {
  DIMENSION_NAMES, DIMENSION_INDICATORS, INDICATOR_FIELD,
  type DimensionKey, type Dimensions,
} from "@/lib/composite";

const ORDER: DimensionKey[] = ["C", "D", "K"];

/** Everything sits inside about two and a half standard deviations of the
 *  historical average, so that is the axis. Fixed rather than fitted to
 *  the data on screen: an axis that rescales per country would make every
 *  market's chart look equally dramatic. */
const LIMIT = 2.5;

/**
 * The three dimensions as diverging bars from the historical average, with
 * the composite marked where their average falls.
 *
 * WHY THIS SHAPE. The composite genuinely IS the mean of these three
 * standardised scores, so a bar chart around zero with a marker at the
 * mean is not an illustration of the arithmetic -- it is the arithmetic.
 * A reader can see which dimension pulled the score up, which pulled it
 * down, and roughly where it landed, without being shown a single formula.
 *
 * What it deliberately does NOT do is draw the percentile as a bar. The
 * composite is an average in standard-deviation space and only becomes a
 * rank at the last step; a waterfall in percentile points would imply the
 * dimensions add up in percentile terms, and they do not.
 */
export default function DimensionBars({
  standardised,
  percentile,
}: {
  standardised: Dimensions | null;
  percentile: number | null;
}) {
  if (!standardised) {
    return (
      <p style={{ fontSize: 13, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", margin: 0 }}>
        No score to break down — an indicator is missing.
      </p>
    );
  }

  const mean = (standardised.C + standardised.D + standardised.K) / 3;
  const pos = (v: number) => 50 + (Math.max(-LIMIT, Math.min(LIMIT, v)) / LIMIT) * 50;

  return (
    <div>
      <div style={{ display: "grid", gap: 12 }}>
        {ORDER.map((key) => {
          const v = standardised[key];
          const from = Math.min(50, pos(v));
          const width = Math.abs(pos(v) - 50);
          const good = v >= 0;
          const color = good ? "#22D3EE" : "#E14B4B";

          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(96px,120px) 1fr auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{DIMENSION_NAMES[key]}</div>
                {/* The indicators behind it, named but not explained. The
                    front page should say WHAT a dimension is made of; the
                    arithmetic lives on the Trends page. */}
                <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.4, marginTop: 2 }}>
                  {DIMENSION_INDICATORS[key].map((i) => INDICATOR_FIELD[i].label).join(" + ")}
                </div>
              </div>

              <div style={{ position: "relative", height: 26 }}>
                {/* the historical average */}
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.28)" }} />
                <div
                  style={{
                    position: "absolute", top: 5, height: 16,
                    left: `${from}%`, width: `${Math.max(width, 0.6)}%`,
                    background: color, opacity: 0.85,
                    borderRadius: good ? "0 4px 4px 0" : "4px 0 0 4px",
                    boxShadow: `0 0 12px ${color}66`,
                    transition: "left 0.7s cubic-bezier(0.22,1,0.36,1), width 0.7s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>

              <div
                style={{
                  fontFamily: "IBM Plex Mono, monospace", fontSize: 12,
                  color, minWidth: 54, textAlign: "right", fontVariantNumeric: "tabular-nums",
                }}
              >
                {v >= 0 ? "+" : ""}{v.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* where the three average out, and what that becomes */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(96px,120px) 1fr auto", gap: 12, alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--hair)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          MMAI
          <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", fontWeight: 400, marginTop: 2 }}>
            average of the three
          </div>
        </div>
        <div style={{ position: "relative", height: 26 }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.28)" }} />
          <div
            style={{
              position: "absolute", top: 2, bottom: 2, width: 3, left: `calc(${pos(mean)}% - 1.5px)`,
              background: colorForScore(percentile), borderRadius: 2,
              boxShadow: `0 0 14px ${colorForScore(percentile)}`,
              transition: "left 0.7s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: "IBM Plex Mono, monospace", fontSize: 13, fontWeight: 700,
            color: colorForScore(percentile), minWidth: 54, textAlign: "right", fontVariantNumeric: "tabular-nums",
          }}
        >
          {mean >= 0 ? "+" : ""}{mean.toFixed(2)}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", marginTop: 8 }}>
        <span>worse than usual</span>
        <span>average of the last 26 years</span>
        <span>better than usual</span>
      </div>

      <p style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.6, margin: "12px 0 0", maxWidth: "70ch" }}>
        Distance from the middle is how far that dimension sits from its own historical average, in standard
        deviations. The three average out to the marker on the bottom row, and that average is what becomes the
        published rank of <b style={{ color: colorForScore(percentile) }}>{percentile == null ? "—" : percentile.toFixed(1)}</b>.
      </p>
    </div>
  );
}
