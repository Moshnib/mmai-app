"use client";

import Link from "next/link";
import { colorForScore } from "@/lib/indicators";
import {
  DIMENSION_NAMES, DIMENSION_QUESTIONS, DIMENSION_INDICATORS, INDICATOR_FIELD,
  type DimensionKey, type Dimensions,
} from "@/lib/composite";

const ORDER: DimensionKey[] = ["C", "D", "K"];

/** Everything in the record sits inside about two and a half standard
 *  deviations of the average, so that is the track. Fixed rather than
 *  fitted per country: an axis that rescaled itself would make every
 *  market look equally extreme. */
const LIMIT = 2.5;

/**
 * One card per dimension: the rank, where it sits against history, and
 * what it is made of.
 *
 * REPLACES TWO COMPONENTS, NOT ONE. The page previously showed a ring grid
 * and a diverging bar chart — the same three numbers drawn twice, one
 * after the other. Each was defensible alone; together they made the
 * reader work out that they were looking at one thing rendered two ways.
 *
 * The ring showed the rank but not the direction: a ring at 9 and a ring
 * at 100 are both just arcs, and nothing said one was far below the
 * historical average and the other far above. The bar showed direction but
 * not the rank. This shows both, once.
 */
export default function DimensionCards({
  standardised,
  percentiles,
  market,
}: {
  standardised: Dimensions | null;
  percentiles: Record<DimensionKey, number> | null;
  market: string;
}) {
  return (
    <div className="dim-cards">
      {ORDER.map((key) => {
        const pct = percentiles ? percentiles[key] : null;
        const sd = standardised ? standardised[key] : null;
        const missing = pct == null || sd == null;
        const color = missing ? "var(--slate)" : colorForScore(pct);

        // Position on a track centred on the historical average.
        const at = missing ? 50 : 50 + (Math.max(-LIMIT, Math.min(LIMIT, sd)) / LIMIT) * 50;
        const from = Math.min(50, at);
        const width = Math.abs(at - 50);

        const body = (
          <>
            <div className="dim-card-top">
              <div>
                <div className="dim-card-name">{DIMENSION_NAMES[key]}</div>
                <div className="dim-card-q">{DIMENSION_QUESTIONS[key]}</div>
              </div>
              <div className="dim-card-num" style={{ color }}>
                {missing ? "—" : pct.toFixed(0)}
              </div>
            </div>

            {/* One track, two readings: the fill says which side of the
                historical average this sits on and by how far, the number
                above says where that lands as a rank. */}
            <div className="dim-track" aria-hidden="true">
              <span className="dim-track-mid" />
              {!missing && (
                <span
                  className="dim-track-fill"
                  style={{
                    left: `${from}%`, width: `${Math.max(width, 0.8)}%`, background: color,
                    borderRadius: sd >= 0 ? "0 3px 3px 0" : "3px 0 0 3px",
                  }}
                />
              )}
            </div>
            <div className="dim-track-labels">
              <span>below average</span>
              <span className="dim-track-sd" style={{ color: missing ? undefined : color }}>
                {missing ? "no score" : `${sd >= 0 ? "+" : ""}${sd.toFixed(2)} sd`}
              </span>
              <span>above</span>
            </div>

            <div className="dim-card-of">
              {DIMENSION_INDICATORS[key].map((i) => INDICATOR_FIELD[i].label).join(" · ")}
            </div>
          </>
        );

        // A dimension with no score is not a link — href="#" is a real
        // navigation that throws the reader back to the top of the page.
        return missing ? (
          <div key={key} className="dim-card">{body}</div>
        ) : (
          <Link key={key} href={`/trends?market=${market}&dimension=${key}`} className="dim-card">
            {body}
          </Link>
        );
      })}
    </div>
  );
}
