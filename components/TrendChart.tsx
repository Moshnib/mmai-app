"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface Series {
  key: string;
  name: string;
  color: string;
  data: Array<{ year: string; value: number | null }>;
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
            dot={showDots ? { r: 3.5, fill: s.color, strokeWidth: 0 } : false}
            activeDot={{ r: 5.5 }}
            connectNulls={connectNulls}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
