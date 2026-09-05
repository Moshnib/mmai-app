"use client";

import Link from "next/link";
import { colorForScore } from "@/lib/indicators";
import {
  DIMENSION_NAMES, DIMENSION_QUESTIONS, DIMENSION_INDICATORS, INDICATOR_FIELD,
  type DimensionKey, type Dimensions,
} from "@/lib/composite";

const ORDER: DimensionKey[] = ["C", "D", "K"];

/** Everything in the record sits inside about two and a half standard
 *  deviations of the average, so that is the axis. Fixed rather than
 *  fitted per country: an axis that rescaled itself would make every
 *  market look equally extreme. */
const LIMIT = 2.5;

/**
 * The three dimensions on ONE axis.
 *
 * WHY THIS REPLACED THREE SEPARATE CARDS.
 *
 * The section above it asks what is holding a country up and what is
 * dragging. That is a question about the three dimensions RELATIVE TO
 * EACH OTHER, and the layout it was asked in — three cards side by side,
 * each with its own centred track — is the one layout that cannot answer
 * it. Every card centred its own average, so every dimension looked like
 * it was being measured on its own terms, and comparing them meant
 * comparing three bars across two card borders.
 *
 * Japan is the proof. Conditions 100, Direction 15, Capacity 9 — the
 * widest disagreement in the record, and a composite of 50.7 that means
 * nothing at all unless you can see the spread behind it. On three cards
 * that spread is three separate facts. On one axis it is a single
 * picture: one dot hard right, two dots left, and the eye does the
 * subtraction for free.
 *
 * WHAT WAS KEPT. The rank, the standard-deviation reading, the question
 * each dimension asks, what it is made of, and the link through to the
 * arithmetic on Trends. Nothing was dropped to make room; the axis is
 * drawn once instead of three times, which is where the space came from.
 *
 * WHAT WAS NOT BUILT, and why. A sparkline per dimension would have been
 * the stronger chart — Direction is momentum drawn as a static dot, which
 * is a real weakness — but Capacity needs the debt figure, and debt has
 * only been collected since 2 September 2026. A sparkline would be three
 * points pretending to be a trend. Worth revisiting once there is a year
 * of history; not worth faking now.
 */
export default function DimensionAxis({
  standardised,
  percentiles,
  market,
}: {
  standardised: Dimensions | null;
  percentiles: Record<DimensionKey, number> | null;
  market: string;
}) {
  return (
    <div className="dim-axis">
      {/* The axis is labelled once, at the top, because there is only one
          of it now. */}
      <div className="dim-axis-head" aria-hidden="true">
        <span className="dim-axis-lab">historical average</span>
      </div>

      {ORDER.map((key) => {
        const pct = percentiles ? percentiles[key] : null;
        const sd = standardised ? standardised[key] : null;
        const missing = pct == null || sd == null;
        const color = missing ? "var(--slate)" : colorForScore(pct);

        // Position on an axis centred on the historical average.
        const at = missing ? 50 : 50 + (Math.max(-LIMIT, Math.min(LIMIT, sd)) / LIMIT) * 50;
        const from = Math.min(50, at);
        const width = Math.abs(at - 50);

        const body = (
          <>
            <div className="dim-axis-name">
              <span className="dim-axis-title">{DIMENSION_NAMES[key]}</span>
              <span className="dim-axis-of">
                {DIMENSION_INDICATORS[key].map((i) => INDICATOR_FIELD[i].label).join(", ")}
              </span>
            </div>

            {/* The connector back to centre is what makes three rows read
                as one comparison: the eye follows length from a shared
                origin rather than judging three unanchored dots. */}
            <div className="dim-axis-track" aria-hidden="true">
              <span className="dim-axis-rule" />
              <span className="dim-axis-mid" />
              {!missing && (
                <>
                  <span
                    className="dim-axis-stem"
                    style={{ left: `${from}%`, width: `${width}%`, background: color }}
                  />
                  <span className="dim-axis-dot" style={{ left: `${at}%`, background: color }} />
                </>
              )}
            </div>

            <div className="dim-axis-read">
              <span className="dim-axis-pct" style={{ color }}>{missing ? "—" : pct.toFixed(0)}</span>
              <span className="dim-axis-sd">
                {missing ? "no score" : `${sd >= 0 ? "+" : "−"}${Math.abs(sd).toFixed(2)} sd`}
              </span>
            </div>
          </>
        );

        // A dimension with no score is not a link — href="#" is a real
        // navigation that throws the reader back to the top of the page.
        return missing ? (
          <div key={key} className="dim-axis-row" title={DIMENSION_QUESTIONS[key]}>{body}</div>
        ) : (
          <Link
            key={key}
            href={`/trends?market=${market}&dimension=${key}`}
            className="dim-axis-row"
            title={DIMENSION_QUESTIONS[key]}
          >
            {body}
          </Link>
        );
      })}

      <div className="dim-axis-foot" aria-hidden="true">
        <span>&minus;2.5 sd</span>
        <span>+2.5 sd</span>
      </div>

      {/* The questions each dimension asks. On three cards these sat
          inside the cards; there is no room on a row, and they read
          better as a set anyway — three questions one after another are
          a description of the method, which is what they always were. */}
      <dl className="dim-axis-qs">
        {ORDER.map((key) => (
          <div key={key}>
            <dt>{DIMENSION_NAMES[key]}</dt>
            <dd>{DIMENSION_QUESTIONS[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
