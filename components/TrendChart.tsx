"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Dot } from "recharts";

export interface Series {
  key: string;
  name: string;
  color: string;
  data: Array<{ year: string; value: number | null }>;
}

// Recharts hands the dot render-function every point's pixel x/y AND the
// full points array for that line (points[i].value / points[i].x), so
// neighbor context comes straight from what Recharts already computed --
// no manual lookup into the original series data, no risk of the two
// drifting out of sync.
//
// A flat "show every dot" (the old behavior) is fine for the 6 scored
// markets' sparse ~8-point annual charts, but Gulf Watch's monthly
// series can have 150+ points -- confirmed live, Saudi's CPI history
// rendered as a smear of 151 overlapping dots on a ~286px mobile chart.
// Point COUNT isn't the right thing to threshold on though (a 40-point
// series is fine at 900px and a smear at 286px) -- real pixel spacing
// between points is, and Recharts recomputes that on every resize, so
// this rule self-adjusts to viewport width with no resize listener.
//
// Always drawn regardless of spacing:
//  - the first and last real point (an endpoint with no dot and no line
//    past it would be invisible -- confirmed for Saudi's 151-point,
//    zero-null series, where the "isolated point" rule below has
//    nothing to catch)
//  - an "orphaned" point -- real value, both neighbors null/missing --
//    which with connectNulls={false} has no line segment reaching it at
//    all. See lib/fetchers/qatarRealEstate.ts and GulfTrends.tsx for the
//    original incident (a real published month rendered as literally
//    nothing) this specifically guards against; don't remove this branch
//    without re-reading that.
function renderSpacedDot(props: RechartsDotProps, color: string) {
  const { cx, cy, index, value, points } = props;
  if (value == null || !points) return null;

  const total = points.length;
  const isEdge = index === 0 || index === total - 1;
  const prevValue = index > 0 ? points[index - 1]?.value : null;
  const nextValue = index < total - 1 ? points[index + 1]?.value : null;
  const isOrphan = prevValue == null && nextValue == null;

  let show = isEdge || isOrphan;
  if (!show && total > 1) {
    const firstX = points[0]?.x ?? 0;
    const lastX = points[total - 1]?.x ?? 0;
    const spacing = Math.abs((lastX - firstX) / (total - 1));
    show = spacing >= 10; // px -- below this, adjacent dots visually merge
  }

  return show ? <Dot key={`dot-${index}`} cx={cx} cy={cy} r={3.5} fill={color} strokeWidth={0} /> : null;
}

interface RechartsDotPoint {
  readonly x: number | null;
  readonly y: number | null;
  readonly value?: number | null;
}

interface RechartsDotProps {
  cx?: number;
  cy?: number;
  index: number;
  value: number | null;
  points: ReadonlyArray<RechartsDotPoint>;
}

export default function TrendChart({
  series,
  height = 280,
  yDomain,
  yLabel,
  showLegend = true,
  showDots = true,
  connectNulls = true,
}: {
  series: Series[];
  height?: number;
  yDomain?: [number, number];
  yLabel?: string;
  showLegend?: boolean;
  showDots?: boolean;
  // Default true preserves the 6 scored markets' existing dense,
  // gap-free series. Gulf Watch history has real gaps (see
  // lib/fetchers/historyUtils.ts) that must render as gaps, not as an
  // interpolated line implying data that doesn't exist -- pass false there.
  connectNulls?: boolean;
}) {
  // Recharts wants one array of objects keyed by series name, not separate arrays.
  const years = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.year)))).sort();
  const merged = years.map((year) => {
    const row: Record<string, string | number | null> = { year };
    series.forEach((s) => {
      const point = s.data.find((d) => d.year === year);
      row[s.key] = point ? point.value : null;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={merged} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11.5, fill: "#9296AB" }} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
        <YAxis
          domain={yDomain ?? ["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#9296AB" }}
          axisLine={false}
          tickLine={false}
          label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "#9296AB" } : undefined}
        />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#12121A", fontSize: 12.5, fontFamily: "monospace" }}
          labelStyle={{ fontWeight: 700, color: "#F5F6FA" }}
          itemStyle={{ color: "#C7C9D9" }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: "#C7C9D9" }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            dot={showDots ? (dotProps: RechartsDotProps) => renderSpacedDot(dotProps, s.color) : false}
            activeDot={{ r: 5.5 }}
            connectNulls={connectNulls}
            // Explicit rather than relying on Recharts' defaults: draws
            // the line in left-to-right on mount (a fresh page load, or
            // navigating to a page that renders this chart) instead of
            // just appearing already complete.
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
