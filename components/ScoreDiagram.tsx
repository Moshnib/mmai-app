import {
  DIMENSION_NAMES, DIMENSION_QUESTIONS, DIMENSION_INDICATORS, INDICATOR_FIELD,
  INDICATOR_WEIGHT, computeMmai, dimensionPercentiles, standardiseDimensions,
  rawDimensions, type DimensionKey, type IndicatorKey,
} from "@/lib/composite";
import { inflationTargetFor } from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { REFERENCE_SET } from "@/lib/referenceSet";

const ORDER: DimensionKey[] = ["C", "D", "K"];
const TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };
const FINAL = "#8B5CF6";
const N = REFERENCE_SET.length;

/** A real worked example rather than an abstract one. Australia because it
 *  is the current top scorer, so every dimension reads positive and a first
 *  encounter with the method is not spent parsing three minus signs. */
const EXAMPLE = FALLBACK_MARKETS.find((m) => m.code === "AU")!;
const EXAMPLE_TARGET = inflationTargetFor(EXAMPLE.code);

/**
 * How five published figures become one rank.
 *
 * NESTED BOXES, NOT A FLOW CHART. The one thing this has to communicate is
 * which figure belongs to which group, and containment says that by
 * position — there is nothing to trace. The version this replaces drew
 * five curved connectors into three boxes: it looked more like a diagram
 * and made a reader do more work to learn less.
 *
 * AND HTML, NOT SVG. Boxes inside boxes is what HTML is for. It reflows on
 * a phone instead of scrolling sideways, the text is real text that can be
 * selected and that a screen reader walks in order, and there is no viewBox
 * arithmetic to get wrong. The SVG version needed a 680px minimum width and
 * scrolled horizontally on any narrow screen.
 *
 * Every number is computed from the engine, so the illustration cannot
 * drift from the arithmetic it illustrates.
 */
export default function ScoreDiagram() {
  const result = computeMmai(EXAMPLE.raw, EXAMPLE.code);
  const std = standardiseDimensions(rawDimensions({
    infGap: Math.abs((EXAMPLE.raw.inflation as number) - EXAMPLE_TARGET),
    une: EXAMPLE.raw.unemployment as number,
    gdp: EXAMPLE.raw.gdpGrowth as number,
    debt: EXAMPLE.raw.debtPctGdp as number,
    rate: EXAMPLE.raw.policyRate as number,
  }));
  const pct = dimensionPercentiles(std);

  const valueOf = (k: IndicatorKey) => {
    const f = INDICATOR_FIELD[k];
    const v = EXAMPLE.raw[f.key] as number;
    const shown = `${v.toFixed(f.decimals)}${f.unit.includes("%") ? "%" : ""}`;
    // Inflation is the one figure not scored as published: what counts is
    // its distance from that market's own target. Without the target here
    // a reader is guessing at the only step that is not obvious.
    return k === "infGap"
      ? `${shown} — ${Math.abs(v - EXAMPLE_TARGET).toFixed(2)} from its ${EXAMPLE_TARGET}% target`
      : shown;
  };

  return (
    <figure style={{ margin: 0 }}>
      <div className="recipe">
        <div className="recipe-groups">
          {ORDER.map((d) => (
            <div key={d} className="recipe-card" style={{ borderLeftColor: TONE[d] }}>
              <div className="recipe-head">
                <div>
                  <div className="recipe-name">{DIMENSION_NAMES[d]}</div>
                  <div className="recipe-q">{DIMENSION_QUESTIONS[d]}</div>
                </div>
                <div className="recipe-rank" style={{ color: TONE[d] }}>
                  {pct[d].toFixed(0)}
                  <span>percentile</span>
                </div>
              </div>

              {DIMENSION_INDICATORS[d].map((k) => (
                <div key={k} className="recipe-row">
                  <span className="recipe-label">{INDICATOR_FIELD[k].label}</span>
                  {/* Direction holds one indicator, so it carries no weight
                      of its own — printing "100%" there would imply two more
                      were hiding somewhere. */}
                  {INDICATOR_WEIGHT[k] !== 1 && (
                    <span className="recipe-weight" style={{ color: TONE[d], borderColor: `${TONE[d]}55` }}>
                      {(INDICATOR_WEIGHT[k] * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="recipe-value">{valueOf(k)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="recipe-out">
          <div className="recipe-out-label">Average the three, then rank</div>
          <div className="recipe-out-num" style={{ color: FINAL }}>
            {result.percentile?.toFixed(1)}
          </div>
          <div className="recipe-out-sub">
            better than {result.percentile?.toFixed(0)}% of the {N} market-years these six
            economies produced since 2000
          </div>
          <div className="recipe-out-market">{EXAMPLE.name}, as a worked example</div>
        </div>
      </div>

      <ol className="recipe-steps">
        {[
          ["Start with what is published", "Five official figures, each from a named national source, plus each country’s own inflation target."],
          ["Compare with history", `Not “is 4.35% high?” but “where does it sit among ${N} readings from these six economies since 2000?”`],
          ["Group into three", "Prices and jobs. Which way it is moving. What is left in reserve."],
          ["Put the three level", "Each is divided by its own spread, so one cannot shout over the others."],
          ["Rank it", "The average becomes a place in the historical record. That is the score."],
        ].map(([head, body], i) => (
          <li key={head}>
            <span className="recipe-step-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="recipe-step-h">{head}</span>
            <span className="recipe-step-b">{body}</span>
          </li>
        ))}
      </ol>

      <figcaption className="recipe-cap">
        <b>Step four is the one that is easy to miss.</b> Conditions varies about a third less across history than
        Direction does. Without dividing each by its own spread, averaging them would hand Direction the loudest
        voice whatever the weights said — the difference between a weight on paper and a weight in effect.
      </figcaption>
    </figure>
  );
}
