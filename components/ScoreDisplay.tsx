"use client";

import { useEffect, useState } from "react";
import { bandFor } from "@/lib/scoring";

// Replaces the old semicircle "speedometer" Gauge -- that design had a
// real geometry bug (the animated arc traced the wrong half-circle,
// confirmed live on an actual iPhone, overlapping page content below
// it) that a plain width-based bar can't reproduce: there's no arc
// direction to get backwards, no path-length normalization, nothing
// that depends on SVG arc math at all. Simpler shape, same information
// (score, band, and a sense of where it sits between 0 and 100).
export default function ScoreDisplay({ score }: { score: number | null }) {
  const band = bandFor(score);
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
    <div style={{ width: "100%", maxWidth: 260 }}>
      <div className="gauge-label">MMAI Score</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 18px" }}>
        <span
          className="gauge-num"
          style={{
            color: band.color,
            // The composite is the page's headline figure, so it gets a
            // stronger glow and a slight brightness lift than the same
            // colour carries elsewhere. The hue still comes from
            // colorForScore(), so the score-to-colour meaning is
            // unchanged -- this is emphasis, not a different scale.
            textShadow: `0 0 10px ${band.color}88, 0 0 34px ${band.color}55`,
            filter: "brightness(1.15) saturate(1.1)",
            transition: "color 0.4s ease, text-shadow 0.4s ease",
          }}
        >
          {score === null ? "N/A" : score.toFixed(1)}
        </span>
        <span
          className="band-pill"
          style={{ background: `${band.color}22`, color: band.color, border: `1px solid ${band.color}55`, marginTop: 0 }}
        >
          {band.label}
        </span>
      </div>
      <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: band.color,
            borderRadius: 999,
            boxShadow: `0 0 16px 0 ${band.color}`,
            filter: "brightness(1.15) saturate(1.1)",
            transition: "width 1.1s cubic-bezier(0.22, 1, 0.36, 1), background 0.4s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--slate)", marginTop: 6, fontFamily: "IBM Plex Mono, monospace" }}>
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}
