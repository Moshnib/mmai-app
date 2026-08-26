"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface ScatterPoint {
  x: number;
  y: number;
  period: string;
  isCurrent?: boolean;
}

export interface ScatterSeriesData {
  key: string;
  name: string;
  color: string;
  points: ScatterPoint[];
}

interface ShapeProps {
  cx?: number;
  cy?: number;
  payload?: { isCurrent?: boolean };
}

// The current/latest point per series is drawn larger with a ring
// around it; every earlier point in its trail is a small faint dot.
// Branches on payload.isCurrent (set explicitly in each point's data),
// not on array index -- Recharts' Scatter shape callback doesn't hand
// back a reliable index the way Line's dot callback does.
function renderPoint(props: ShapeProps, color: string) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return <g />;
  if (payload?.isCurrent) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={11} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
        <circle cx={cx} cy={cy} r={6} fill={color} stroke="#08080D" strokeWidth={2} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={2.5} fill={color} opacity={0.55} />;
}

interface TooltipPointPayload {
  seriesName: string;
  period: string;
  x: number;
  y: number;
}

function ScatterTooltip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPointPayload }>;
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#12121A", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 12px", fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>
      <div style={{ fontWeight: 700, color: "#F5F6FA", marginBottom: 4 }}>
        {p.seriesName} — {p.period}
      </div>
      <div style={{ color: "#C7C9D9" }}>{xLabel}: {p.x.toFixed(1)}</div>
      <div style={{ color: "#C7C9D9" }}>{yLabel}: {p.y.toFixed(1)}</div>
    </div>
  );
}

export default function RelationshipScatter({
  series,
  xLabel,
  yLabel,
  height = 340,
  showLegend = true,
}: {
  series: ScatterSeriesData[];
  xLabel: string;
  yLabel: string;
  height?: number;
  showLegend?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#9296AB" }}
          axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
          tickLine={false}
          label={{ value: xLabel, position: "insideBottom", offset: -18, fontSize: 11, fill: "#9296AB" }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#9296AB" }}
          axisLine={false}
          tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "#9296AB" }}
        />
        <Tooltip content={<ScatterTooltip xLabel={xLabel} yLabel={yLabel} />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: "#C7C9D9" }} />}
        {series.map((s) => (
          <Scatter
            key={s.key}
            name={s.name}
            data={s.points.map((p) => ({ ...p, seriesName: s.name }))}
            fill={s.color}
            line={{ stroke: s.color, strokeOpacity: 0.35, strokeWidth: 1.5 }}
            lineType="joint"
            shape={(props: ShapeProps) => renderPoint(props, s.color)}
            isAnimationActive
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
