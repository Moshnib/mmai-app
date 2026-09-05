import {
  explainDimension, DIMENSION_NAMES, DIMENSION_QUESTIONS,
  type DimensionKey, type IndicatorKey,
} from "@/lib/composite";
import { type PillarKey, type RawIndicators, inflationTargetFor } from "@/lib/indicators";

// Per-field decimals. Exported so every place that prints a raw indicator
// uses ONE definition of this rule. Printing a policy rate at 1 decimal is
// not a rounding nicety -- it invents rates no central bank ever set (4.35
// becomes "4.3", 2.25 becomes "2.3"), so a second copy of this map that
// drifted would put wrong numbers on the page.
export const RAW_DECIMALS: Record<PillarKey, number> = {
  PS: 1, // inflation
  GM: 1, // GDP growth
  LM: 1, // unemployment
  MC: 2, // policy rate -- set to the nearest quarter-point
  FR: 1, // government debt, % of GDP -- BIS publishes one decimal
};

const ORDER: DimensionKey[] = ["C", "D", "K"];

/** The same three colours the dimension cards and the diagram use. */
const TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };

/** Everything in the record sits inside about two and a half standard
 *  deviations of the average, so that is the track -- the same limit the
 *  dimension cards use, so the two read as one system rather than two
 *  charts that happen to sit near each other. */
const LIMIT = 2.5;

/**
 * A short descriptor under each value.
 *
 * Describes the CURRENT LEVEL against a threshold MMAI already publishes,
 * never a direction like "easing" or "trending" -- this component sees one
 * reading and cannot know which way anything is moving.
 *
 * THE POLICY RATE READS AS ROOM, NOT AS TIGHTNESS. It used to say
 * "Restrictive vs neutral", which is the old Monetary Conditions framing
 * and is actively misleading now: inside Capacity a higher rate scores
 * BETTER, because a central bank at 4% can cut and one at 0.5% cannot.
 * lib/composite.ts states that the Capacity framing must travel with the
 * number wherever it appears, or a reader will reasonably read a high rate
 * as stress. On this card it now does.
 */
function descriptorFor(key: IndicatorKey, value: number, market: string): string {
  if (key === "infGap") {
    const target = inflationTargetFor(market);
    const gap = value - target;
    if (Math.abs(gap) <= 0.5) return `Near the ${target}% target`;
    return gap > 0 ? `Above the ${target}% target` : `Below the ${target}% target`;
  }
  if (key === "une") {
    if (value <= 4) return "Tight labour market";
    return value <= 6 ? "Steady labour market" : "Loose labour market";
  }
  if (key === "rate") {
    if (value >= 3) return "Room to cut if needed";
    return value >= 1.5 ? "Some room to cut" : "Little room to cut";
  }
  if (key === "gdp") return value < 0 ? "Output shrinking" : value < 1 ? "Barely growing" : "Growing";
  // debt
  return value >= 100 ? "Above a year of output" : "Below a year of output";
}

/**
 * THE FIVE SCORED INDICATORS, GROUPED UNDER THE DIMENSION EACH FEEDS.
 *
 * This showed three of the five -- inflation, policy rate, unemployment --
 * in that order. Mapped onto the dimensions that is Conditions, Capacity,
 * Conditions, interleaved, with the whole of Direction and half of Capacity
 * simply absent. Worse, it coloured unemployment with Capacity's colour
 * while unemployment belongs to Conditions.
 *
 * So the page showed the same underlying numbers twice under two
 * incompatible groupings: an arbitrary three here, then all three
 * dimensions immediately below. There was no organising idea to find,
 * which is exactly why it read as unexplainable.
 *
 * Now every indicator sits under its own dimension, in the dimension's
 * colour, and the strip and the cards below say the same thing at two
 * levels of detail.
 *
 * BUILT FROM explainDimension(), not from a local table. That function
 * already derives the scored value -- including the one case where it
 * differs from the published figure, inflation, which is scored on
 * distance from target rather than on the rate. A second copy of that
 * rule here would be a second thing to keep in step with the engine.
 */
export default function KeyRatesRow({ raw, market }: { raw: RawIndicators; market: string }) {
  return (
    <div className="ind-groups">
      {ORDER.map((dim) => {
        const { parts } = explainDimension(dim, raw, market);
        const tone = TONE[dim];

        return (
          <section key={dim} className="ind-group" aria-label={DIMENSION_NAMES[dim]}>
            <header className="ind-group-head">
              <span className="ind-group-name" style={{ color: tone }}>
                <i style={{ background: tone }} />
                {DIMENSION_NAMES[dim]}
              </span>
              <span className="ind-group-q">{DIMENSION_QUESTIONS[dim]}</span>
            </header>

            <div className="ind-cards">
              {parts.map((p) => {
                // q is the sign-aligned standardised score -- positive is
                // always better, whichever direction the raw figure runs.
                // It is the number the composite is actually built from,
                // so the marker shows where this reading sits in the
                // record rather than a decorative position.
                const q = p.q;
                const at = q == null ? 50 : 50 + (Math.max(-LIMIT, Math.min(LIMIT, q)) / LIMIT) * 50;
                const from = Math.min(50, at);
                const width = Math.abs(at - 50);

                return (
                  <div key={p.key} className="ind-card" style={{ borderLeftColor: tone }}>
                    <div className="ind-card-label">{p.label}</div>
                    <div className="ind-card-value">
                      {p.raw != null ? `${p.raw.toFixed(p.decimals)}${p.unit.startsWith("%") ? "%" : ""}` : "—"}
                      {p.raw != null && p.unit !== "%" && (
                        <span className="ind-card-unit">{p.unit.replace(/^%\s*/, "")}</span>
                      )}
                    </div>

                    {/* Same diverging track as the dimension cards, at a
                        smaller scale: centre is the historical average,
                        right is better. */}
                    <div className="ind-track" aria-hidden="true">
                      <span className="ind-track-mid" />
                      {q != null && (
                        <span
                          className="ind-track-fill"
                          style={{
                            left: `${from}%`,
                            width: `${Math.max(width, 0.8)}%`,
                            background: tone,
                            borderRadius: q >= 0 ? "0 3px 3px 0" : "3px 0 0 3px",
                          }}
                        />
                      )}
                    </div>

                    <div className="ind-card-note">
                      {p.raw != null ? descriptorFor(p.key, p.raw, market) : "Not published this run"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
