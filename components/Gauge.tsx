"use client";

import { useEffect, useState } from "react";
import { bandFor } from "@/lib/scoring";

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// One fixed full-semicircle path (0 to 180 degrees) -- the score no
// longer changes WHICH path is drawn, only how much of it is revealed
// via strokeDashoffset below. Animating a numeric dash offset is far
// more reliably interpolated by browsers than animating the path's own
// "d" attribute (the previous approach), which most engines don't
// smoothly tween for an arc -- that's why the gauge never visibly swept
// in on load before, despite already having a CSS transition on "d".
const FULL_ARC_D = (() => {
  const start = polarToCartesian(130, 150, 100, 180);
  const end = polarToCartesian(130, 150, 100, 0);
  return `M ${start.x} ${start.y} A 100 100 0 0 1 ${end.x} ${end.y}`;
})();

export default function Gauge({ score }: { score: number | null }) {
  const band = bandFor(score);
  const target = score === null ? 0 : Math.min(100, Math.max(0, score));

  // Starts at 0 on every fresh mount -- a page load, or navigating to a
  // page that renders this -- so the ring visibly sweeps up to its real
  // value instead of just appearing there already full. A short setTimeout
  // (not requestAnimationFrame) commits the dashoffset=100 "empty" state
  // as its own separate render before jumping to the target -- rAF ties
  // its callback to the browser's paint/compositing cycle, which some
  // environments throttle or skip entirely for a backgrounded tab, so it
  // isn't reliable here for something that must actually run every time.
  // If the score changes later without a remount (switching the selected
  // market on the same page), this smoothly eases between the two values
  // instead of resetting to empty and re-sweeping -- only a true mount
  // starts from zero.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setProgress(target), 30);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <div style={{ position: "relative", width: 260, height: 170 }}>
      <svg viewBox="0 0 260 170" width={260} height={170} style={{ overflow: "visible" }}>
        <path d="M 30 150 A 100 100 0 0 1 230 150" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={20} strokeLinecap="round" />
        <path
          d={FULL_ARC_D}
          fill="none"
          stroke={band.color}
          strokeWidth={20}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - progress}
          style={{
            transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.4s ease, filter 0.4s ease",
            filter: `drop-shadow(0 0 10px ${band.color}90)`,
          }}
        />
      </svg>
      <div style={{ position: "absolute", top: "62%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <div
          className="gauge-num"
          style={{ color: band.color, textShadow: `0 0 22px ${band.color}55`, transition: "color 0.4s ease, text-shadow 0.4s ease" }}
        >
          {score === null ? "N/A" : score.toFixed(1)}
        </div>
        <div className="gauge-label">MMAI Score</div>
        <div className="band-pill" style={{ background: `${band.color}22`, color: band.color, border: `1px solid ${band.color}55` }}>
          {band.label}
        </div>
      </div>
    </div>
  );
}
