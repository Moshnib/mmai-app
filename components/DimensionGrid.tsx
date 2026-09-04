"use client";

import Link from "next/link";
import { colorForScore } from "@/lib/scoring";
import {
  DIMENSION_NAMES, DIMENSION_QUESTIONS, percentileReading,
  type DimensionKey, type Dimensions,
} from "@/lib/composite";

const ORDER: DimensionKey[] = ["C", "D", "K"];

/** What each dimension is built from, in the reader's language rather than
 *  the method's. The names themselves are methodology and live in
 *  lib/composite.ts; these are copy. */
const DIMENSION_DESC: Record<DimensionKey, string> = {
  C: "Inflation against target, and unemployment",
  D: "Real GDP growth, year on year",
  K: "Government debt, and room to cut rates",
};

/** Three line glyphs, matching the card structure the five pillars used.
 *  Inline SVG rather than an icon package -- three shapes don't justify a
 *  dependency, and these inherit currentColor so each follows its own
 *  card's score colour. */
const DIMENSION_ICONS: Record<DimensionKey, React.ReactNode> = {
  // scales — prices weighed against jobs
  C: (
    <>
      <path d="M8 2v12" />
      <path d="M4 14h8" />
      <path d="M2.5 5.5h11" />
      <path d="M2.5 5.5 1 9.5h3z" />
      <path d="M13.5 5.5 12 9.5h3z" />
    </>
  ),
  // arrow through a line — which way it is moving
  D: (
    <>
      <path d="M2 11.5 6 7l3 3 5-6" />
      <path d="M10.5 4h3.5v3.5" />
    </>
  ),
  // a reservoir — how much room is left
  K: (
    <>
      <path d="M3 3h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 9h10" />
      <path d="M6 12h4" />
    </>
  ),
};

export default function DimensionGrid({
  percentiles,
  standardised,
  market,
}: {
  percentiles: Record<DimensionKey, number> | null;
  standardised: Dimensions | null;
  market: string;
}) {
  return (
    <div className="pillar-grid dimension-grid">
      {ORDER.map((key) => {
        const val = percentiles ? percentiles[key] : null;
        const missing = val == null;
        const color = missing ? "var(--slate)" : colorForScore(val);
        const circumference = 2 * Math.PI * 23;
        const pct = missing ? 0 : val / 100;
        const z = standardised ? standardised[key] : null;

        const body = (
          <>
            <svg
              viewBox="0 0 16 16" width={24} height={24} aria-hidden="true"
              fill="none" stroke={missing ? "#3A3D4A" : color}
              strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"
              style={{ display: "block", margin: "0 auto 12px", opacity: missing ? 0.6 : 0.95 }}
            >
              {DIMENSION_ICONS[key]}
            </svg>

            <div style={{ width: 92, height: 92, margin: "0 auto", position: "relative" }}>
              {/* Decorative: the number this ring draws is rendered as text
                  in the middle of it, so letting a screen reader announce
                  the SVG as well would say it twice. */}
              <svg
                viewBox="0 0 56 56" width={92} height={92} aria-hidden="true"
                style={{ transform: "rotate(-90deg)", overflow: "visible" }}
              >
                <circle cx={28} cy={28} r={23} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
                <circle
                  cx={28} cy={28} r={23} fill="none"
                  stroke={missing ? "#3A3D4A" : color}
                  strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${circumference * pct} ${circumference}`}
                  style={{
                    transition: "stroke-dasharray 0.8s ease, filter 0.4s ease",
                    filter: missing ? undefined : `drop-shadow(0 0 6px ${color}) brightness(1.1)`,
                  }}
                />
              </svg>
              <div
                style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 27,
                  color: missing ? "var(--slate)" : color,
                  textShadow: missing ? undefined : `0 0 14px ${color}70`,
                  filter: missing ? undefined : "brightness(1.12) saturate(1.05)",
                }}
                title={percentileReading(val)}
              >
                {missing ? "—" : val.toFixed(0)}
              </div>
            </div>

            <div className="pillar-name">{DIMENSION_NAMES[key]}</div>
            <div className="pillar-desc">{DIMENSION_DESC[key]}</div>
            <div className="dimension-question">{DIMENSION_QUESTIONS[key]}</div>

            {/* The z-score behind the rank. Small, but present: the ring is a
                percentile, and a reader who wants the underlying standardised
                score should not have to open a methodology page to find it. */}
            <div className="pillar-weight" style={{ marginTop: 6 }}>
              {z == null ? "no score" : `${z >= 0 ? "+" : ""}${z.toFixed(2)} sd vs history`}
            </div>

            {!missing && <div className="pillar-cta">View trend →</div>}
          </>
        );

        // A dimension with no score is not a link -- href="#" is a real
        // navigation that throws the reader back to the top of the page.
        return missing ? (
          <div key={key} className="pillar-card">{body}</div>
        ) : (
          <Link
            key={key}
            href={`/trends?market=${market}&dimension=${key}`}
            className="pillar-card"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
