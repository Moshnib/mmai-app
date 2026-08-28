"use client";

import Link from "next/link";
import { computePillarScores, computeComposite, bandFor } from "@/lib/scoring";
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
      const { composite } = computeComposite(computePillarScores(h.indicators));
      return { year: h.year, value: composite };
    })
    .filter((p): p is { year: string; value: number } => p.value !== null);

  const band = bandFor(currentScore);

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
          style={{ marginLeft: "auto", letterSpacing: 1, border: "1px solid var(--hair)", borderRadius: 999, padding: "3px 9px" }}
        >
          Annual
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }} role="img" aria-label={`MMAI score from ${points[0].year} to ${last.year}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={band.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={band.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)}
              stroke={v === NEUTRAL ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)"}
              strokeWidth={1}
              strokeDasharray={v === NEUTRAL ? "5 5" : undefined}
            />
            <text x={PAD_L - 9} y={y(v) + 3.5} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="var(--slate)">
              {v}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={band.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 5px ${band.color}70)` }} />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.year} x={x(i)} y={H - PAD_B + 17} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="var(--slate)">
              {p.year}
            </text>
          ) : null
        )}

        <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill={band.color} style={{ filter: `drop-shadow(0 0 6px ${band.color})` }} />
        <text
          x={x(points.length - 1) + 9}
          y={y(last.value) + 4}
          fontFamily="Space Grotesk, sans-serif"
          fontWeight={700}
          fontSize={14}
          fill={band.color}
        >
          {last.value.toFixed(1)}
        </text>
      </svg>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <Link href={`/trends?market=${marketCode}`} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--gold-deep)", textDecoration: "none" }}>
          More score detail →
        </Link>
      </div>
    </div>
  );
}
