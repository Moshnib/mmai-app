"use client";

import { useEffect, useState } from "react";
import { colorForScore } from "@/lib/indicators";
import { percentileBandLabel, percentileReading } from "@/lib/composite";

// Replaces the old semicircle "speedometer" Gauge -- that design had a
// real geometry bug (the animated arc traced the wrong half-circle,
// confirmed live on an actual iPhone, overlapping page content below
// it) that a plain width-based bar can't reproduce: there's no arc
// direction to get backwards, no path-length normalization, nothing
// that depends on SVG arc math at all. Simpler shape, same information
// (score, band, and a sense of where it sits between 0 and 100).
export default function ScoreDisplay({ score }: { score: number | null }) {
  // The label has to come from the same place the meta row beneath it
  // reads, or the page shows two different words for one number.
  const band = { color: colorForScore(score), label: percentileBandLabel(score) };
  // THE NUMBER IS GOLD; THE BAR CARRIES THE RAMP. The figure is the one
  // thing on the page that is current and chosen, which is exactly what
  // the accent is for -- and the ramp colour on 46px text made red-to-cyan
  // the page's focal point. The meaning is not lost: the bar and the
  // swatch in the band pill are coloured by colorForScore(), and the band
  // is written out in words. A missing score stays grey, never gold.
  const numberColour = score === null ? "var(--slate)" : "var(--accent)";
  const target = score === null ? 0 : Math.min(100, Math.max(0, score));

  // Starts at 0 on every fresh mount (a page load, or navigating to a
  // page that renders this) so the bar visibly fills up to the real
  // value instead of just appearing already full. See the same pattern
  // in TrendChart/GulfTrends -- a short setTimeout, not
  // requestAnimationFrame, since rAF ties to the paint/compositing
  // cycle and isn't reliable in every environment. If the score changes
  // later without a remount (switching the selected market), this
  // eases smoothly between the two values instead of resetting to
  // empty and re-filling -- only a true mount starts from zero.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setProgress(target), 30);
    return () => clearTimeout(id);
  }, [target]);

  return (
    // maxWidth (not a fixed width) -- .score-panel's padding on a phone
    // leaves less than 260px of content width available; a fixed width
    // would overflow the card exactly like the old Gauge's 260px SVG
    // box risked doing before .score-panel's own mobile stacking was
    // added.
    <div style={{ width: "100%", maxWidth: 260 }} title={percentileReading(score)}>
      <div className="gauge-label">MMAI Score · percentile</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 18px" }}>
        <span
          className="gauge-num"
          style={{ color: numberColour, transition: "color 0.4s ease" }}
        >
          {score === null ? "N/A" : score.toFixed(1)}
        </span>
        <span
          className="band-pill"
          style={{ background: "rgba(212, 176, 106, 0.10)", color: "var(--accent)", border: "1px solid rgba(212, 176, 106, 0.45)", marginTop: 0 }}
        >
          <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 1, background: band.color, flex: "none" }} />
          {band.label}
        </span>
      </div>
      <div style={{ height: 6, background: "var(--track)", borderRadius: 1, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: band.color,
            borderRadius: 1,
            transition: "width 1.1s cubic-bezier(0.22, 1, 0.36, 1), background 0.4s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--slate)", marginTop: 6, fontFamily: "IBM Plex Mono, monospace" }}>
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}
