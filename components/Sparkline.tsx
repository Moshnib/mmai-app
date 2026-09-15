"use client";

// ============================================================
//  THE SHAPE OF THE LAST TWO YEARS, IN THE WIDTH OF A COLUMN
//
//  A table says inflation is 2.9% and fell 0.9 over a year. It cannot
//  say whether that was a steady glide or a spike that came back down,
//  and those are different facts about an economy.
//
//  Deliberately austere: no axes, no grid, no numbers. It is a shape
//  beside a number, not a chart -- the number is already in the cell next
//  to it, and anything more competes with it.
//
//  NOT AN ACCESSIBILITY HOLE. The row states the figure and the change in
//  text; this adds texture for people who can see it and is marked
//  aria-hidden so a screen reader is not read a decorative squiggle it
//  cannot interpret.
//
//  Nulls break the line rather than being bridged. A gap in a statistical
//  series is a real thing -- Japan has no monthly inflation history at
//  all -- and drawing through it would invent a trajectory.
// ============================================================

const W = 64;
const H = 20;

export default function Sparkline({
  values,
  colour = "var(--ink-soft)",
}: {
  values: (number | null)[];
  colour?: string;
}) {
  const real = values.filter((v): v is number => v != null);
  if (real.length < 2) return <span style={{ color: "var(--slate)" }}>—</span>;

  const min = Math.min(...real);
  const max = Math.max(...real);
  // A flat series would divide by zero and, worse, render as a line at
  // the top of the box rather than through the middle.
  const span = max - min || 1;
  const stepX = W / Math.max(1, values.length - 1);

  // Segments, so a null starts a new one instead of being bridged.
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const px = (i * stepX).toFixed(1);
    const py = (H - 2 - ((v - min) / span) * (H - 4)).toFixed(1);
    current.push(`${current.length === 0 ? "M" : "L"}${px},${py}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const lastIndex = values.length - 1 - [...values].reverse().findIndex((v) => v != null);
  const last = values[lastIndex];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ display: "block" }}>
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={colour} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {last != null && (
        // The endpoint, so the eye lands on "now" rather than the middle.
        <circle
          cx={(lastIndex * stepX).toFixed(1)}
          cy={(H - 2 - ((last - min) / span) * (H - 4)).toFixed(1)}
          r={2}
          fill={colour}
        />
      )}
    </svg>
  );
}
