"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Dot } from "recharts";

export interface Series {
  key: string;
  name: string;
  color: string;
  data: Array<{ year: string; value: number | null; sortKey?: string }>;
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
  // The x-axis is a CATEGORY axis, so the order of this array is the order
  // the chart draws in. Sorting the LABELS worked only because every caller
  // used to pass four-digit years, where alphabetical and chronological
  // happen to agree.
  //
  // The bond panel passes formatted dates -- "1 Jun 26", "11 Aug 26",
  // "12 Nov 25" -- and a plain string sort orders those by leading digit:
  // 1, 11, 12, 14, ... 3, 31, 5. Consecutive points on the line were then
  // months apart in arbitrary order, which rendered a year of gilt yields
  // as meaningless noise. It looked like volatility. It was sorting.
  //
  // Callers that have a sortable key (an ISO date) pass sortKey; anything
  // without one keeps the old behaviour, which is correct for years.
  const orderOf = new Map<string, string>();
  for (const s of series) {
    for (const d of s.data) {
      if (!orderOf.has(d.year)) orderOf.set(d.year, d.sortKey ?? d.year);
    }
  }
  const years = Array.from(orderOf.keys()).sort((a, b) =>
    String(orderOf.get(a)).localeCompare(String(orderOf.get(b)))
  );

  // ---------- Smart time axis ----------
  //
  // Recharts is drawing a CATEGORY axis: it treats 131 dates as 131
  // unrelated labels and picks ticks by counting them, which is why a
  // daily series produced a wall of crammed, arbitrary dates.
  //
  // When every point carries an ISO sortKey we know these are DATES, and
  // can do what a time axis would: put ticks on natural boundaries and
  // label them at a resolution that suits the span.
  //
  // Year-based callers pass no sortKey and are untouched -- eight annual
  // points need none of this.
  const isoOf = new Map<string, string>();
  for (const [label, key] of orderOf) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) isoOf.set(label, key);
  }
  const isDateAxis = isoOf.size === years.length && years.length > 0;

  // Span in days decides the resolution: a fortnight wants day labels, a
  // year wants months. Picking by span rather than by point count means
  // a sparse series and a dense one over the same period label alike.
  const spanDays = isDateAxis
    ? Math.round(
        (Date.parse(isoOf.get(years[years.length - 1])!) - Date.parse(isoOf.get(years[0])!)) / 86_400_000
      )
    : 0;

  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Ticks land on the FIRST trading day of each month (or of each quarter
  // over a long span). Markets close at weekends, so 'the 1st' often does
  // not exist -- taking the first point whose month differs from the
  // previous one puts the tick on a real observation every time.
  const smartTicks: string[] | undefined = (() => {
    if (!isDateAxis || years.length < 8) return undefined;
    const everyNthMonth = spanDays > 400 ? 3 : 1;
    const picked: string[] = [];
    let lastMonth = -1;
    for (const label of years) {
      const iso = isoOf.get(label)!;
      const month = Number(iso.slice(5, 7)) - 1;
      if (month === lastMonth) continue;
      lastMonth = month;
      if (everyNthMonth === 1 || month % everyNthMonth === 0) picked.push(label);
    }
    // Never crowd the axis. Thin evenly if a narrow chart would still
    // overlap, and always keep the newest point so the axis ends on the
    // most recent reading rather than a stray boundary.
    const MAX = 8;
    if (picked.length <= MAX) return picked;
    const step = Math.ceil(picked.length / MAX);
    const thinned = picked.filter((_, i) => i % step === 0);
    const newest = years[years.length - 1];
    if (!thinned.includes(newest)) thinned.push(newest);
    return thinned;
  })();

  // Short span -> "3 Jun". Long span -> "Jun 26". The year is dropped on
  // short spans because every tick would repeat it.
  const formatTick = (label: string): string => {
    const iso = isoOf.get(label);
    if (!iso) return label;
    const [yy, mm, dd] = iso.split("-");
    const mon = MONTHS_SHORT[Number(mm) - 1];
    return spanDays > 180 ? `${mon} ${yy.slice(2)}` : `${Number(dd)} ${mon}`;
  };
  const merged = years.map((year) => {
    const row: Record<string, string | number | null> = { year };
    series.forEach((s) => {
      const point = s.data.find((d) => d.year === year);
      row[s.key] = point ? point.value : null;
    });
    return row;
  });

  // ---------- Text alternative for screen readers ----------
  //
  // A Recharts chart is an SVG full of <path> elements. To anyone using a
  // screen reader it is silence -- and these charts ARE the content on
  // Trends and Compare, so silence means the page's main feature does not
  // exist for them.
  //
  // Described rather than merely labelled: "line chart" tells a reader
  // nothing they can use. The direction and the endpoints are the part a
  // sighted reader takes from a glance, so that is what gets spoken.
  //
  // Built from the same `series` the chart draws, so it cannot describe
  // something the chart is not showing.
  const describeSeries = (s: Series): string => {
    const pts = s.data.filter((d) => d.value != null) as Array<{ year: string; value: number }>;
    if (pts.length === 0) return `${s.name}: no data`;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const unit = yLabel ? yLabel.trim() : "";
    // ONE DECIMAL, ALWAYS. These strings are SPOKEN, and the underlying
    // values carry full float precision -- a screen reader reads 70.5175
    // as "seventy point five one seven five", which is worse than no
    // description at all. The chart itself is read at a glance; the
    // spoken version should be too.
    const n = (v: number) => v.toFixed(1);
    if (pts.length === 1) return `${s.name}: ${n(last.value)}${unit} at ${last.year}`;
    const direction = last.value > first.value ? "rising" : last.value < first.value ? "falling" : "flat";
    return (
      `${s.name}: ${direction} from ${n(first.value)}${unit} at ${first.year} ` +
      `to ${n(last.value)}${unit} at ${last.year}`
    );
  };
  const chartDescription =
    series.length > 0
      ? `Line chart. ${series.map(describeSeries).join(". ")}.`
      : "Line chart with no data.";

  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* role="img" collapses the SVG's internals for assistive tech and
          presents the description instead, rather than reading out
          hundreds of meaningless path nodes. */}
      <LineChart
        data={merged}
        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        role="img"
        aria-label={chartDescription}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          dataKey="year"
          ticks={smartTicks}
          tickFormatter={isDateAxis ? formatTick : undefined}
          minTickGap={isDateAxis ? 24 : 5} tick={{ fontSize: 12, fill: "var(--slate)" }} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
        <YAxis
          domain={yDomain ?? ["auto", "auto"]}
          tick={{ fontSize: 11, fill: "var(--slate)" }}
          axisLine={false}
          tickLine={false}
          label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--slate)" } : undefined}
        />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#12121A", fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}
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
