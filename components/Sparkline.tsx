"use client";

import { computePillarScores, computeComposite, bandFor } from "@/lib/scoring";
import { HISTORY } from "@/lib/history";

export default function Sparkline({ marketCode, currentScore }: { marketCode: string; currentScore: number | null }) {
  const history = HISTORY[marketCode] ?? [];
  const points = history
    .map((h) => {
      const pillars = computePillarScores(h.indicators);
      const { composite } = computeComposite(pillars);
      return { year: h.year, value: composite };
    })
    .filter((p) => p.value !== null) as { year: string; value: number }[];

  const band = bandFor(currentScore);

  if (points.length < 2) {
    return (
      <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", padding: "10px 0" }}>
        Not enough history yet to chart a trend for this market.
      </div>
    );
  }

  const W = 100, H = 100, PAD = 6;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p.value - min) / range) * (H - PAD * 2);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${H} L${coords[0].x.toFixed(1)},${H} Z`;
  const gradId = `spark-grad-${marketCode}`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, fontWeight: 700, color: "var(--slate)", letterSpacing: 1 }}>
          TREND, {points[0].year}–{points[points.length - 1].year}
        </span>
        <a href={`/trends?market=${marketCode}`} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: band.color, textDecoration: "none" }}>
          full chart →
        </a>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={70} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={band.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={band.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={band.color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${band.color}90)` }}
        />
        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={2.6} fill={band.color} style={{ filter: `drop-shadow(0 0 5px ${band.color})` }} />
      </svg>
    </div>
  );
}
