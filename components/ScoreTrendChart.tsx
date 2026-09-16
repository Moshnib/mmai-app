"use client";

import Link from "next/link";
import { colorForScore } from "@/lib/indicators";
import { computeMmai, percentileBandLabel } from "@/lib/composite";
import { useLiveHistory } from "@/lib/useLiveHistory";

// ============================================================
// The composite score's history, as the main visual block beside the
// score itself (design reference: a full chart with axes, a legend and
// a neutral reference line, not a bare sparkline).
//
// Replaces Sparkline in the homepage's score panel. Reads through
// useLiveHistory() like every other chart on the site, so its last
// point is the same live score shown to its left rather than the
// hardcoded snapshot in lib/history.ts.
//
// The reference mock-up shows a monthly axis (Nov '24 ... May '25).
// MMAI's history is genuinely ANNUAL (2019 onward) plus today's live
// value, and no monthly back-series exists to fetch -- the sources
// publish current values only. So the axis shows the real periods
// rather than inventing months that were never observed.
// ============================================================

const W = 700;
const H = 230;
const PAD_L = 36;
const PAD_R = 46;
const PAD_T = 16;
const PAD_B = 30;

const NEUTRAL = 50;

export default function ScoreTrendChart({ marketCode, currentScore }: { marketCode: string; currentScore: number | null }) {
  const { history: liveHistory } = useLiveHistory();
  const history = liveHistory[marketCode] ?? [];

  const points = history
    .map((h) => {
      // Recomputed through the SAME engine that produces the headline.
      // Reading stored v1.0 composites here would draw a five-pillar
      // history underneath a three-dimension number — two different
      // measurements sharing one line, which is the exact mistake that
      // made two of six rankings wrong the last time.
      const { percentile } = computeMmai(h.indicators, marketCode);
      return { year: h.year, value: percentile };
    })
    .filter((p): p is { year: string; value: number } => p.value !== null);

  const band = { color: colorForScore(currentScore), label: percentileBandLabel(currentScore) };

  if (points.length < 2) {
    return (
      <div style={{ fontSize: 12, color: "var(--slate)", fontFamily: "IBM Plex Mono, monospace", padding: "18px 0" }}>
        Not enough history yet to chart a trend for this market.
      </div>
    );
  }

  // Fixed 0-100 domain: the MMAI score is defined on that scale, so an
  // auto-fitted axis would exaggerate small moves and make two markets'
  // charts non-comparable at a glance.
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / 100) * (H - PAD_T - PAD_B);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD_B} L${x(0).toFixed(1)},${H - PAD_B} Z`;
  const last = points[points.length - 1];
  const gradId = `score-trend-${marketCode}`;

  // Thin out x labels so they never collide on a narrow card.
  const labelEvery = Math.ceil(points.length / 8);

  return (
    <div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 11, color: "var(--slate)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: "50%", background: band.color, flex: "none" }} />
          MMAI Score
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i style={{ width: 14, height: 0, borderTop: "1px dashed rgba(255,255,255,0.35)", flex: "none" }} />
          Neutral (50)
        </span>
        {/* States the frequency outright rather than leaving a reader to
            infer it from the tick labels. The brief's data rules require
            every point to carry its real period; monthly is a separate,
            later piece of work that needs monthly source series first. */}
        <span
          className="meta-label"
          style={{ marginLeft: "auto", letterSpacing: 1, border: "1px solid var(--hair)", borderRadius: 4, padding: "3px 9px" }}
        >
          Annual
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }} role="img" aria-label={`MMAI score from ${points[0].year} to ${last.year}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={band.color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={band.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)}
              stroke={v === NEUTRAL ? "var(--mid)" : "var(--hair)"}
              strokeWidth={1}
              strokeDasharray={v === NEUTRAL ? "5 5" : undefined}
            />
            <text x={PAD_L - 9} y={y(v) + 3.5} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="var(--slate)">
              {v}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        {/* The score line is the chart's subject, so it carries a
            heavier stroke than the gridlines around it -- weight, not
            glow. Colour still comes from colorForScore(). */}
        {/* Drawn rather than printed: the line runs from 2019 to now in
            about a second, so the chart arrives the way the history did.
            pathLength normalises the dash to 1 whatever the real length
            is, and the whole thing is off under prefers-reduced-motion. */}
        <path
          className="trend-line"
          d={line}
          pathLength={1}
          fill="none"
          stroke={band.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.year} x={x(i)} y={H - PAD_B + 17} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="var(--slate)">
              {p.year}
            </text>
          ) : null
        )}

        <circle className="trend-dot" cx={x(points.length - 1)} cy={y(last.value)} r={4.5} fill="var(--accent)" stroke="var(--card-bg)" strokeWidth={2} />
        <text
          x={x(points.length - 1) + 10}
          y={y(last.value) + 4}
          fontWeight={500}
          fontSize={15}
          fill="var(--accent)"
          style={{ fontFamily: "var(--font-num)" }}
        >
          {last.value.toFixed(1)}
        </text>
      </svg>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <Link href={`/trends?market=${marketCode}`} className="tap" style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--accent-2)", textDecoration: "none" }}>
          More score detail →
        </Link>
      </div>
    </div>
  );
}
