"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MARKET_COLORS } from "@/lib/markets";
import { FLAG_SHAPES } from "@/components/Flag";

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
const PAD = { top: 52, right: 30, bottom: 66, left: 46 };

/** Radius from Capacity.
 *
 *  The floor used to be 7, which is enough to SEE a dot and not enough to
 *  read a flag inside one. A 14px circle turns the Union Flag into a
 *  smudge. Raised to 11, so the smallest dot is 22px across and every
 *  flag is at least recognisable; the range is kept the same width so
 *  Capacity is still encoded by the same amount of area as before.
 *
 *  PAD above was widened to match. A dot at an axis extreme extends by
 *  its own radius, so the largest radius and the padding move together --
 *  forget that and Japan, which sits at Conditions 100, is clipped by the
 *  top edge of the SVG. */
const rFor = (capacity: number, scale: number) =>
  (11 + (Math.max(0, Math.min(100, capacity)) / 100) * 11) * scale;

export default function PositioningMap({ points }: { points: PositionPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // clipPath ids are document-global. Two of these on one page with
  // hand-written ids would silently share clips and one map would draw
  // the other's circles.
  const uid = useId().replace(/:/g, "");

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

// MARKETS THAT SIT ON TOP OF EACH OTHER, NAMED RATHER THAN LEFT TO SQUINT AT.
//
// Canada and the Euro Area currently differ by about two percentile
// points on each axis. Once the dots became flags instead of translucent
// discs, the front one covered roughly two-thirds of the back one, and
// the obvious fix -- nudging them apart -- is the one thing this chart
// must not do.
//
// So the occlusion is reported instead. "These two are in almost exactly
// the same position" is a finding about the economies, not a defect in
// the drawing, and a reader is better served by being told it than by
// being left to work out why one flag is half-hidden.
//
// Measured in percentile points because that is what the axes are; a
// pixel threshold would change meaning with the width of the container.
const NEAR = 6;

function nearlyIdentical(ps: PositionPoint[]): [PositionPoint, PositionPoint][] {
  const out: [PositionPoint, PositionPoint][] = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      if (Math.abs(a.direction - b.direction) <= NEAR && Math.abs(a.conditions - b.conditions) <= NEAR) {
        out.push([a, b]);
      }
    }
  }
  return out;
}

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
        <rect x={x(50)} y={y(100)} width={plotW / 2} height={plotH / 2} fill="var(--hover)" />
        <rect x={x(0)} y={y(50)} width={plotW / 2} height={plotH / 2} fill="var(--hover)" />

        {/* Axes */}
        <line x1={PAD.left} y1={y(0)} x2={x(100)} y2={y(0)} stroke="var(--hair-strong)" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={y(0)} stroke="var(--hair-strong)" />

        {/* The midlines that make the quadrants */}
        <line x1={x(50)} y1={PAD.top} x2={x(50)} y2={y(0)} stroke="var(--mid)" strokeDasharray="3 4" />
        <line x1={PAD.left} y1={y(50)} x2={x(100)} y2={y(50)} stroke="var(--mid)" strokeDasharray="3 4" />

        {/* Quadrant captions, in the padding above and below the plot so a
            dot at an extreme cannot land on one. 11px is the smallest step
            on the site's type scale. */}
        <text x={x(100)} y={PAD.top - 20} textAnchor="end" fontSize="11" fill="var(--slate)">{q.tr}</text>
        <text x={x(0)} y={PAD.top - 20} fontSize="11" fill="var(--slate)">{q.tl}</text>
        <text x={x(100)} y={y(0) + 30} textAnchor="end" fontSize="11" fill="var(--slate)">{q.br}</text>
        <text x={x(0)} y={y(0) + 30} fontSize="11" fill="var(--slate)">{q.bl}</text>

        {/* Axis titles */}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="var(--ink-soft)">
          {narrow ? "Direction — momentum" : "Direction — momentum, percentile"}
        </text>
        <text
          x={13}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fontSize="12"
          fill="var(--ink-soft)"
          transform={`rotate(-90 13 ${PAD.top + plotH / 2})`}
        >
          {narrow ? "Conditions — right now" : "Conditions — right now, percentile"}
        </text>

        {laid.map(({ p, cx, cy, r }) => {
          const colour = MARKET_COLORS[p.code] ?? "var(--slate)";
          return (
            <g key={p.code}>
              {/* THE DOT IS THE COUNTRY'S FLAG, CLIPPED TO A CIRCLE.
                  A reader who knows the Japanese flag does not have to
                  learn that pink means Japan first.

                  The flags are authored in a 28x20 box (components/
                  Flag.tsx). To COVER a circle of radius r the short side
                  has to reach the diameter, so the scale is 2r/20 = r/10
                  and the width becomes 2.8r -- wider than the circle, and
                  the excess is clipped off the sides. Scaling to fit the
                  WIDTH instead would leave empty wedges top and bottom.

                  The ring stays the market's colour, because that colour
                  is the country's identity in every other chart on the
                  site -- the sparklines, the compare lines, the bond
                  curves. The flag says which country; the ring says which
                  line on every other page is the same country. */}
              {/* A DARK HALO, DRAWN FIRST IN EACH DOT SO IT CUTS INTO
                  WHATEVER IS BEHIND IT. Canada and the Euro Area sit at
                  almost the same coordinates, and once the dots became
                  opaque flags the front one simply erased the back one --
                  the old translucent discs had let both show through.
                  Moving either is off the table, so instead every dot
                  carves a rim out of its neighbour and the one behind
                  reads as a crescent rather than a smudge. */}
              <circle cx={cx} cy={cy} r={r + 1.5} fill="none" stroke="var(--card-bg)" strokeWidth={3} />
              <clipPath id={`${uid}-${p.code}`}>
                <circle cx={cx} cy={cy} r={r} />
              </clipPath>
              {FLAG_SHAPES[p.code] ? (
                <g clipPath={`url(#${uid}-${p.code})`}>
                  {/* Painted under the flag: several of these flags have
                      white in them, and an unpainted gap would show the
                      quadrant shading through. */}
                  <circle cx={cx} cy={cy} r={r} fill="var(--card-bg)" />
                  <g transform={`translate(${cx - 1.4 * r}, ${cy - r}) scale(${r / 10})`}>
                    {FLAG_SHAPES[p.code]}
                  </g>
                </g>
              ) : (
                // No flag authored for this market: fall back to the disc
                // rather than drawing an empty hole.
                <circle cx={cx} cy={cy} r={r} fill={colour} fillOpacity={0.22} />
              )}
              {/* Drawn after, so the ring sits ON the flag rather than
                  under its clipped edge, where half its width would be
                  invisible. */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={colour} strokeWidth={2} />
            </g>
          );
        })}

        {/* EVERY LABEL AFTER EVERY DOT, WHICH IS THE WHOLE REASON THIS IS
            A SECOND PASS.

            When each market drew its own dot and its own name together,
            a market drawn later painted its flag straight over an earlier
            market's name. On a phone that hid Norway's: "NO" sat behind
            Australia's flag and simply was not there.

            Splitting the passes costs nothing and makes the guarantee
            structural -- no dot can cover a name, whatever the data does
            next. */}
        {laid.map(({ p, cx, cy, r, lx, ly, anchor }) => {
          const colour = MARKET_COLORS[p.code] ?? "var(--slate)";
          const moved = Math.abs(ly - (cy + 4)) > 2;
          return (
            <g key={`label-${p.code}`}>
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
              {/* A dark backing stroke under the name. The labels sit
                  beside the dots, and beside a dot is sometimes on top of
                  the quadrant shading or another flag's rim; painting the
                  glyphs twice, dark and wide underneath, keeps them
                  legible without a box that would clutter the plot. */}
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                fontSize="11"
                fontWeight={700}
                fill="none"
                stroke="var(--card-bg)"
                strokeWidth={3}
                strokeLinejoin="round"
              >
                {p.code}
              </text>
              <text x={lx} y={ly} textAnchor={anchor} fontSize="11" fontWeight={700} fill="var(--ink)">
                {p.code}
              </text>
            </g>
          );
        })}
      </svg>

      {nearlyIdentical(points).map(([a, b]) => (
        <p
          key={`${a.code}-${b.code}`}
          style={{ fontSize: 12, color: "var(--slate)", margin: "10px 0 0", lineHeight: 1.7 }}
        >
          <b style={{ color: "var(--ink-soft)" }}>
            {a.name} and {b.name} overlap because they are in almost the same position.
          </b>{" "}
          Conditions {a.conditions.toFixed(0)} against {b.conditions.toFixed(0)}, direction{" "}
          {a.direction.toFixed(0)} against {b.direction.toFixed(0)}. Neither dot has been moved to
          separate them &mdash; that would misplace both.
        </p>
      ))}
    </div>
  );
}
