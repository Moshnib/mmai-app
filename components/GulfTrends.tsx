"use client";

import { useState } from "react";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import Flag from "@/components/Flag";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import {
  GULF_CPI_HISTORY,
  GULF_FX_RESERVES_HISTORY,
  GULF_CURRENT_ACCOUNT_HISTORY,
  GULF_REAL_ESTATE_HISTORY,
  type GulfHistorySeries,
} from "@/lib/gulfHistory";
import { latestPoint, type LatestPoint } from "@/lib/gulfHistoryHelpers";

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid var(--hair)",
  borderRadius: 16,
  padding: "18px 20px",
  backdropFilter: "blur(14px)",
};

function seriesFor(
  countryCode: string,
  name: string,
  color: string,
  hist: Record<string, GulfHistorySeries>
): { series: Series[]; granularity: "annual" | "monthly" | null; hasEnough: boolean } {
  const s = hist[countryCode];
  if (!s) return { series: [], granularity: null, hasEnough: false };
  const data = s.points.map((p) => ({ year: p.period, value: p.value }));
  const realCount = data.filter((d) => d.value !== null).length;
  return {
    series: [{ key: countryCode, name, color, data }],
    granularity: s.granularity,
    hasEnough: realCount > 1,
  };
}

function MiniChart({
  title,
  granularity,
  series,
  hasEnough,
  yLabel,
}: {
  title: string;
  granularity: "annual" | "monthly" | null;
  series: Series[];
  hasEnough: boolean;
  yLabel?: string;
}) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
        {granularity && (
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--slate)", textTransform: "uppercase" }}>{granularity}</span>
        )}
      </div>
      {hasEnough ? (
        // showDots is intentionally true here (unlike other TrendChart
        // call sites): with connectNulls={false}, a real point with a
        // null on both sides has no line segment to draw at all and
        // would render as nothing without a dot. No series in the
        // current generated data happens to have a null-flanked point,
        // but lib/gulfHistory.ts is regenerated from live sources and
        // that can change on a future run -- this is cheap, permanent
        // insurance against a real data point silently disappearing.
        <TrendChart series={series} height={170} showLegend={false} showDots connectNulls={false} yLabel={yLabel} />
      ) : (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--slate)", fontSize: 12 }}>Not enough history yet</div>
      )}
    </div>
  );
}

function formatValue(value: number, kind: "pct" | "months" | "count"): string {
  if (kind === "pct") return `${value.toFixed(1)}%`;
  if (kind === "months") return `${value.toFixed(1)} mo.`;
  return value.toLocaleString();
}

function ComparisonCell({ lp, kind, noSourceHint }: { lp: LatestPoint | null; kind: "pct" | "months" | "count"; noSourceHint?: boolean }) {
  if (!lp) {
    // Distinguishes "no source exists" from "source exists, just no
    // current data" -- a bare "—" alone can't tell those apart, and the
    // chart section's explanation above the table is easy to miss once
    // scrolled past.
    return <span style={{ color: "var(--slate)" }}>{noSourceHint ? "no source" : "—"}</span>;
  }
  return (
    <div>
      <div style={{ fontFamily: "Space Grotesk, monospace", fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>
        {formatValue(lp.point.value as number, kind)}
      </div>
      <div style={{ fontSize: 10, color: "var(--slate)", fontFamily: "monospace" }}>
        {lp.label}
        {lp.granularity === "annual" ? " · annual" : ""}
      </div>
    </div>
  );
}

function ComparisonTable() {
  const rows = GULF_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    cpi: latestPoint(GULF_CPI_HISTORY[c.code]),
    fx: latestPoint(GULF_FX_RESERVES_HISTORY[c.code]),
    ca: latestPoint(GULF_CURRENT_ACCOUNT_HISTORY[c.code]),
    re: latestPoint(GULF_REAL_ESTATE_HISTORY[c.code]),
  }));

  const th: React.CSSProperties = { padding: "8px 10px", fontSize: 11, color: "var(--slate)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 };
  const td: React.CSSProperties = { padding: "10px", verticalAlign: "top" };

  return (
    <div style={{ ...CARD_STYLE, overflowX: "auto", padding: "20px 24px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--hair)" }}>
            <th style={th}>Country</th>
            <th style={th}>Inflation (YoY)</th>
            <th style={th}>FX reserves</th>
            <th style={th}>Current account</th>
            <th style={th}>Real estate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} style={{ borderBottom: "1px solid var(--hair)" }}>
              <td style={{ ...td, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <Flag code={r.code} size={18} /> {r.name}
              </td>
              <td style={td}><ComparisonCell lp={r.cpi} kind="pct" /></td>
              <td style={td}><ComparisonCell lp={r.fx} kind="months" /></td>
              <td style={td}><ComparisonCell lp={r.ca} kind="pct" /></td>
              <td style={td}><ComparisonCell lp={r.re} kind="count" noSourceHint={r.code !== "QA"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: "var(--slate)", margin: "14px 0 0", lineHeight: 1.6 }}>
        Each figure carries its own real reporting period — annual World Bank figures (FX reserves, current account,
        and three countries&apos; inflation) sit next to monthly national figures (Bahrain, Qatar, Saudi Arabia&apos;s
        inflation; Qatar&apos;s real estate) here, sometimes over a year apart. Nothing on this table implies they
        were all measured at the same moment.
      </p>
    </div>
  );
}

export default function GulfTrends() {
  const [current, setCurrent] = useState("AE");
  const countryName = GULF_COUNTRIES.find((c) => c.code === current)?.name ?? current;

  const cpi = seriesFor(current, "Inflation (YoY)", "#E14B4B", GULF_CPI_HISTORY);
  const fx = seriesFor(current, "FX reserves (months of imports)", "#22D3EE", GULF_FX_RESERVES_HISTORY);
  const ca = seriesFor(current, "Current account (% of GDP)", "#8B5CF6", GULF_CURRENT_ACCOUNT_HISTORY);
  const re = seriesFor(current, "Real estate transactions", "#D9A441", GULF_REAL_ESTATE_HISTORY);

  return (
    <>
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">DATA OVER TIME</p>
            <h2>Six countries, each on its own real timeline</h2>
            <p style={{ maxWidth: "68ch" }}>
              Pick a country below. Every chart uses that indicator&apos;s own real reporting dates — annual figures
              are never stretched to look monthly, and a gap in the data renders as a gap, not a smoothed-over line.
            </p>
          </div>

          <div className="tabs">
            {GULF_COUNTRIES.map((c) => (
              <button
                key={c.code}
                className={`tab${c.code === current ? " active" : ""}`}
                onClick={() => setCurrent(c.code)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Flag code={c.code} size={18} /> {c.name}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <MiniChart title="Inflation (YoY)" granularity={cpi.granularity} series={cpi.series} hasEnough={cpi.hasEnough} yLabel="%" />
            <MiniChart title="FX reserves (months of imports)" granularity={fx.granularity} series={fx.series} hasEnough={fx.hasEnough} />
            <MiniChart title="Current account (% of GDP)" granularity={ca.granularity} series={ca.series} hasEnough={ca.hasEnough} yLabel="%" />
            {current === "QA" ? (
              <MiniChart title="Real estate transactions" granularity={re.granularity} series={re.series} hasEnough={re.hasEnough} />
            ) : (
              <div style={CARD_STYLE}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Real estate transactions</div>
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--slate)", fontSize: 12, lineHeight: 1.6 }}>
                  No real estate source exists for {countryName} yet — see the{" "}
                  <Link href="/sources" style={{ color: "var(--gold-deep)" }}>Sources</Link> page for why.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">SNAPSHOT COMPARISON</p>
            <h2>Latest known figure, side by side</h2>
            <p style={{ maxWidth: "68ch" }}>
              Not all 6 countries report on the same schedule. Every number below carries its own real period rather
              than being lined up on a shared timeline that would imply they&apos;re all measured &quot;now.&quot;
            </p>
          </div>
          <ComparisonTable />
        </div>
      </div>
    </>
  );
}
