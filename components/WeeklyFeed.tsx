"use client";

import { useEffect, useState } from "react";
import { colorForScore } from "@/lib/scoring";
import { fetchAllWeeklyChanges, COMPARABILITY_FLOOR, BUCKET_MIN_GAP_DAYS, type WeeklyMarketResult } from "@/lib/weeklyChanges";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Every market's tracking started at the same coordinated launch (verified
// live: all six markets' earliest fully-comparable row lands within the
// same minute of each other on 2026-08-22), so one shared since/expected
// pair is accurate for all of them -- not an approximation.
const TRACKING_SINCE = formatDate(COMPARABILITY_FLOOR);
const FIRST_COMPARISON_EXPECTED = formatDate(COMPARABILITY_FLOOR + BUCKET_MIN_GAP_DAYS * 24 * 60 * 60 * 1000);

// Matches lib/scoring.ts's COLOR_STOPS[1] (the orange stop) -- not
// imported since scoring.ts doesn't export the raw stops, only
// colorForScore()/bandFor(). Used here purely as a fixed "down" indicator
// for the composite delta, not as a score-derived color.
const COMPOSITE_DOWN_COLOR = "#F0975B";

function delta(now: number | null, then: number | null): { symbol: string; text: string } | null {
  if (now == null || then == null) return null;
  const diff = now - then;
  const symbol = Math.abs(diff) < 0.05 ? "—" : diff > 0 ? "↑" : "↓";
  return { symbol, text: `${symbol} ${Math.abs(diff).toFixed(1)}` };
}

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 10.5, color: "var(--slate)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" };
const td: React.CSSProperties = { padding: "9px 10px", verticalAlign: "top", fontFamily: "IBM Plex Mono, monospace", fontSize: 12 };

function IndicatorCell({ now, then, unit }: { now: number | null; then: number | null; unit: string }) {
  if (now == null) return <span style={{ color: "var(--slate)" }}>—</span>;
  const d = delta(now, then);
  return (
    <div>
      <div style={{ color: "var(--ink)" }}>{now.toFixed(1)}{unit}</div>
      {/* Deliberately no color here -- unemployment rising and GDP rising
          aren't both "good", so color-coding direction would itself be
          the interpretation this feed explicitly avoids. Plain symbol
          and number only. */}
      <div style={{ color: "var(--slate)", fontSize: 10.5 }}>{d ? d.text : "—"}</div>
    </div>
  );
}

function CompositeCell({ now, then }: { now: number | null; then: number | null }) {
  if (now == null) return <span style={{ color: "var(--slate)" }}>—</span>;
  const color = colorForScore(now);
  const d = delta(now, then);
  return (
    <div>
      <div style={{ color, fontWeight: 700 }}>{now.toFixed(1)}</div>
      {/* The composite (unlike the raw indicators) is genuinely
          directional by design, so it's the one cell allowed to use the
          site's score color -- visually distinct from the neutral
          indicator cells beside it, so that distinction doesn't bleed
          into implying a judgment on the raw numbers. */}
      <div style={{ color: d && d.symbol === "↑" ? "var(--teal)" : d && d.symbol === "↓" ? COMPOSITE_DOWN_COLOR : "var(--slate)", fontSize: 10.5 }}>{d ? d.text : "—"}</div>
    </div>
  );
}

export default function WeeklyFeed() {
  const [results, setResults] = useState<WeeklyMarketResult[] | null>(null);

  useEffect(() => {
    fetchAllWeeklyChanges(2).then(setResults);
  }, []);

  // Brent is one global series shared by every market, not a per-market
  // figure -- showing it as 6 duplicate columns would be exactly the
  // redundancy this whole restructure exists to remove. The delta needs
  // "now" and "then" from the SAME market's paired buckets (not two
  // different markets' independently-newest rows), so prefer a market
  // with both; only fall back to a now-only market when nothing has a
  // pair, in which case there's no valid delta to show at all.
  const brentPaired = results?.find((r) => r.buckets[0] && r.buckets[1]);
  const brentNowOnly = results?.find((r) => r.buckets[0]);
  const brentSource = brentPaired ?? brentNowOnly;
  const brentNow = brentSource?.buckets[0]?.raw.brentYoY ?? null;
  const brentThen = brentPaired?.buckets[1]?.raw.brentYoY ?? null;
  // Distinct from "—" (delta() below 0.05, i.e. genuinely flat) --
  // this "no comparison" case means the change is unknown, not zero.
  const brentDelta = brentPaired ? delta(brentNow, brentThen) : null;
  const brentDeltaText = brentPaired ? (brentDelta ? brentDelta.text : "—") : "no comparison yet";

  return (
    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "20px 24px", backdropFilter: "blur(14px)" }}>
      {brentNow != null && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, paddingBottom: 14, borderBottom: "1px dashed var(--hair)", fontFamily: "IBM Plex Mono, monospace" }}>
          <span style={{ fontSize: 10.5, color: "var(--slate)", textTransform: "uppercase", letterSpacing: 0.5 }}>Brent crude, YoY (shared across all markets)</span>
          <span style={{ fontSize: 13, color: "var(--ink)" }}>
            {brentNow.toFixed(1)}% <span style={{ color: "var(--slate)", marginLeft: 6 }}>{brentDeltaText}</span>
          </span>
        </div>
      )}

      {results?.some((r) => !r.isStale && r.buckets.length < 2) && (
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 14, padding: "10px 12px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <span aria-hidden="true">●</span>
          <span>
            Live tracking began <b style={{ color: "var(--ink)" }}>{TRACKING_SINCE}</b>, when every source came online at once. A
            comparison needs two readings at least {BUCKET_MIN_GAP_DAYS} days apart, so the first real week-over-week changes
            appear starting around <b style={{ color: "var(--ink)" }}>{FIRST_COMPARISON_EXPECTED}</b> — this isn&apos;t a gap in the
            data, it&apos;s how young the tracking still is.
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--hair)" }}>
              <th style={th}>Market</th>
              <th style={th}>Score</th>
              <th style={th}>Inflation</th>
              <th style={th}>GDP growth</th>
              <th style={th}>Unemployment</th>
              <th style={th}>Policy rate</th>
            </tr>
          </thead>
          <tbody>
            {results === null &&
              [0, 1, 2].map((i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--hair)" }}>
                  <td style={{ ...td, color: "var(--slate)" }} colSpan={6}>Loading…</td>
                </tr>
              ))}
            {results?.map((r) => {
              const now = r.buckets[0];
              const then = r.buckets[1];
              const hasEnough = !!now && !!then;
              return (
                <tr key={r.marketCode} style={{ borderBottom: "1px solid var(--hair)" }}>
                  <td style={{ ...td, fontWeight: 700, color: "var(--ink)" }}>{r.marketName}</td>
                  {r.isStale ? (
                    <td style={{ ...td, color: "var(--slate)" }} colSpan={5}>Not currently refreshing — no recent data available.</td>
                  ) : !hasEnough ? (
                    <td style={{ ...td, color: "var(--slate)" }} colSpan={5}>
                      Tracking since {TRACKING_SINCE} — first comparison expected ~{FIRST_COMPARISON_EXPECTED}.
                    </td>
                  ) : (
                    <>
                      <td style={td}><CompositeCell now={now.composite} then={then.composite} /></td>
                      <td style={td}><IndicatorCell now={now.raw.inflation ?? null} then={then.raw.inflation ?? null} unit="%" /></td>
                      <td style={td}><IndicatorCell now={now.raw.gdpGrowth ?? null} then={then.raw.gdpGrowth ?? null} unit="%" /></td>
                      <td style={td}><IndicatorCell now={now.raw.unemployment ?? null} then={then.raw.unemployment ?? null} unit="%" /></td>
                      <td style={td}><IndicatorCell now={now.raw.policyRate ?? null} then={then.raw.policyRate ?? null} unit="%" /></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: "var(--slate)", margin: "14px 0 0", lineHeight: 1.6 }}>
        Compares each market&apos;s latest figures to the closest available reading from roughly a week earlier — the raw
        numbers only, no interpretation. An annual-frequency indicator (GDP growth or unemployment for most markets
        outside the US) showing no change most weeks is expected — it only updates when a new annual figure is published,
        not every week.
      </p>
    </div>
  );
}
