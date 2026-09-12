"use client";

import { useEffect, useRef, useState } from "react";
import { MARKET_COLORS } from "@/lib/markets";

// ============================================================
//  WHERE EACH ECONOMY SITS, AND WHICH WAY IT IS FACING
//
//  The dashboard's tables are accurate and flat: seven rows of numbers
//  that have to be held in the head to be compared. This is the same
//  three dimensions arranged so the comparison happens by looking.
//
//  The axes are chosen for the question an investor actually asks, which
//  is not "what is the score" but "is this a good place now, and is it
//  getting better or worse":
//
//      across  DIRECTION  -- momentum, which way the figures are moving
//      up      CONDITIONS -- the state of things right now
//      size    CAPACITY   -- how much room the state has to respond,
//                            which is what decides whether a bad quarter
//                            is survivable or not
//
//  Quadrants rather than a grid, because the interesting cases are the
//  corners: strong-and-improving is a different investment case from
//  weak-and-improving, and both are hidden inside a single composite.
//  Japan is the standing example -- Conditions 100, Direction 15 -- which
//  is a story the score of 50.7 cannot tell on its own.
//
//  THE SVG IS MEASURED, NOT SCALED, AND NOTHING IS DRAWN BEFORE IT IS
//  MEASURED. A viewBox wider than its container shrinks every label with
//  it: this site once rendered 10px chart text at 3.2px on a phone that
//  way. So the width is read from the element and the viewBox follows it,
//  making the scale always 1 -- and the first render is an empty box of
//  the right height rather than a guessed width, because a guess of 720
//  inside a 247px phone card is the same overflow by another route. The
//  layout check caught exactly that at 320px.
// ============================================================

export interface PositionPoint {
  code: string;
  name: string;
  /** Percentile 0-100. */
  conditions: number;
  direction: number;
  capacity: number;
  score: number;
}

const HEIGHT = 400;
/** Padding is sized so that a dot at the extreme of an axis still sits
 *  inside the box, AND so the quadrant captions live entirely outside the
 *  plot. Japan sits at Conditions 100, which puts its dot hard against the
 *  top edge: with the captions drawn inside the corners it landed on top
 *  of "strong but fading". The largest radius is 18, so the top and bottom
 *  padding each leave 18 for the dot plus room for a caption clear of it. */
const PAD = { top: 46, right: 24, bottom: 62, left: 46 };

/** Radius from Capacity. A floor of 7 keeps a market with almost no
 *  capacity visible -- a dot too small to see reads as missing data. */
const rFor = (capacity: number, scale: number) =>
  (7 + (Math.max(0, Math.min(100, capacity)) / 100) * 11) * scale;

export default function PositioningMap({ points }: { points: PositionPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Before measurement, hold the space but draw nothing.
  if (width <= 0) return <div ref={boxRef} style={{ width: "100%", height: HEIGHT }} />;

  const w = width;
  const plotW = w - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (v: number) => PAD.left + (v / 100) * plotW;
  const y = (v: number) => PAD.top + (1 - v / 100) * plotH;

  // On a phone the plot is about 180px across. Two full quadrant captions
  // would be wider than that and would collide over the centre line, so
  // the wording shortens and the dots shrink rather than the text.
  const narrow = plotW < 300;
  const dotScale = narrow ? 0.7 : 1;
  const q = narrow
    ? { tr: "strong, rising", tl: "strong, fading", br: "weak, rising", bl: "weak, falling" }
    : {
        tr: "strong and improving",
        tl: "strong but fading",
        br: "weak but improving",
        bl: "weak and worsening",
      };

  // Drawn biggest-first so a small dot is never hidden behind a large one.
  const ordered = [...points].sort((a, b) => b.capacity - a.capacity);

  // LABELS SIT BESIDE THEIR DOTS, NEVER INSIDE THEM. A dot sized by a low
  // capacity is smaller than the two characters naming it, so the code
  // spilled over its own outline; and where two markets sit close together
  // -- Canada and the Euro Area do -- two centred labels printed on top of
  // each other and neither could be read.
  //
  // Only the LABEL moves. The dot stays exactly where the data puts it,
  // and a leader line is drawn whenever a label has been nudged, so a
  // reader can always see which dot a displaced name belongs to. Moving
  // the dot instead would be moving the finding.
  const laid = [...ordered]
    .sort((a, b) => y(a.conditions) - y(b.conditions))
    .reduce<
      { p: PositionPoint; cx: number; cy: number; r: number; lx: number; ly: number; anchor: "start" | "end" }[]
    >((acc, p) => {
      const cx = x(p.direction);
      const cy = y(p.conditions);
      const r = rFor(p.capacity, dotScale);
      // Flip to the left of the dot rather than run off the edge.
      const toLeft = cx + r + 26 > w - 4;
      const prev = acc[acc.length - 1];
      const wanted = cy + 4;
      const ly = prev && wanted - prev.ly < 13 ? prev.ly + 13 : wanted;
      acc.push({ p, cx, cy, r, lx: toLeft ? cx - r - 6 : cx + r + 6, ly, anchor: toLeft ? "end" : "start" });
      return acc;
    }, []);

  const described = points
    .map(
      (p) =>
        `${p.name}: conditions ${p.conditions.toFixed(0)}, direction ${p.direction.toFixed(0)}, capacity ${p.capacity.toFixed(0)}`,
    )
    .join(". ");

  return (
    <div ref={boxRef} style={{ width: "100%" }}>
      <svg
        width={w}
        height={HEIGHT}
        viewBox={`0 0 ${w} ${HEIGHT}`}
        role="img"
        aria-label={`Scatter chart placing each market by direction across and conditions up, with dot size showing capacity. ${described}.`}
        style={{ display: "block" }}
      >
        {/* Quadrant fills, faint enough to read as background */}
        <rect x={x(50)} y={y(100)} width={plotW / 2} height={plotH / 2} fill="rgba(255,255,255,0.035)" />
        <rect x={x(0)} y={y(50)} width={plotW / 2} height={plotH / 2} fill="rgba(255,255,255,0.015)" />

        {/* Axes */}
        <line x1={PAD.left} y1={y(0)} x2={x(100)} y2={y(0)} stroke="rgba(255,255,255,0.18)" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={y(0)} stroke="rgba(255,255,255,0.18)" />

        {/* The midlines that make the quadrants */}
        <line x1={x(50)} y1={PAD.top} x2={x(50)} y2={y(0)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        <line x1={PAD.left} y1={y(50)} x2={x(100)} y2={y(50)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />

        {/* Quadrant captions, in the padding above and below the plot so a
            dot at an extreme cannot land on one. 11px is the smallest step
            on the site's type scale. */}
        <text x={x(100)} y={PAD.top - 20} textAnchor="end" fontSize="11" fill="#8A8EA3">{q.tr}</text>
        <text x={x(0)} y={PAD.top - 20} fontSize="11" fill="#8A8EA3">{q.tl}</text>
        <text x={x(100)} y={y(0) + 30} textAnchor="end" fontSize="11" fill="#8A8EA3">{q.br}</text>
        <text x={x(0)} y={y(0) + 30} fontSize="11" fill="#8A8EA3">{q.bl}</text>

        {/* Axis titles */}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#C7C9D9">
          {narrow ? "Direction — momentum" : "Direction — momentum, percentile"}
        </text>
        <text
          x={13}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#C7C9D9"
          transform={`rotate(-90 13 ${PAD.top + plotH / 2})`}
        >
          {narrow ? "Conditions — right now" : "Conditions — right now, percentile"}
        </text>

        {laid.map(({ p, cx, cy, r, lx, ly, anchor }) => {
          const colour = MARKET_COLORS[p.code] ?? "#8A8EA3";
          const moved = Math.abs(ly - (cy + 4)) > 2;
          return (
            <g key={p.code}>
              {moved && (
                <line
                  x1={anchor === "end" ? cx - r : cx + r}
                  y1={cy}
                  x2={lx}
                  y2={ly - 4}
                  stroke={colour}
                  strokeWidth={1}
                  strokeOpacity={0.55}
                />
              )}
              <circle cx={cx} cy={cy} r={r} fill={colour} fillOpacity={0.22} stroke={colour} strokeWidth={1.5} />
              <text x={lx} y={ly} textAnchor={anchor} fontSize="11" fontWeight={700} fill="#F5F6FA">
                {p.code}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
