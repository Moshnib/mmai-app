"use client";

import { useMemo, useState } from "react";
import TrendChart, { type Series } from "@/components/TrendChart";
import Flag from "@/components/Flag";
import { MARKET_COLORS, FALLBACK_MARKETS } from "@/lib/markets";
import TimeRangeFilter, { DAILY_RANGES, withinRange } from "@/components/TimeRangeFilter";
import type { BondYieldPoint } from "@/lib/bondYieldsRead";

// ============================================================
// 10-year government bond yields -- the only genuinely DAILY series on
// the site. Everything else here is a survey published monthly at best,
// which is why the rest of the page moves so rarely.
//
// Read from the bond_yields table, collected by the daily job. NOT part
// of the MMAI score: the policy rate is what a central bank SETS, this
// is what the market BELIEVES, and folding the second into Monetary
// Conditions would be a methodology change rather than a display one.
// ============================================================

const MARKET_NAMES: Record<string, string> = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
const ORDER = ["US", "EA", "CA", "UK", "JP", "AU"];

// Fixed per market, from the existing Ember-to-Ice palette. Deliberately
// NOT score-derived: a yield is not a 0-100 score and must not borrow
// the score colours' meaning.
//
// TWO OF THESE SIX USED TO BE THE SAME COLOUR. Japan was #5EC8D8 against
// the US at #22D3EE -- a perceptual distance of 10.3, which is the range
// where two colours simply read as one, and worse on a 2px line on a
// phone. Australia at #B98CFF sat 28 from the Euro Area's #8B5CF6, close
// enough that the two crowded at the top of the chart were hard to
// separate. Six series were being drawn in four distinguishable hues.
//
// Japan and Australia move to pink and gold, which lifts the closest
// pair in the whole set from 10.3 to 36.7. The four that were already
// distinct keep their colours, because a market's colour is its identity
// across the site and should not churn for a problem it did not cause.
// Measured with CIE76 dE; anything under about 20 is too close for a
// thin line. No green, per the site-wide rule.
const COLORS = MARKET_COLORS;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

export default function BondYieldPanel({ points }: { points: BondYieldPoint[] }) {
  const byMarket = useMemo(() => {
    const m = new Map<string, BondYieldPoint[]>();
    for (const p of points) {
      const arr = m.get(p.market) ?? [];
      arr.push(p);
      m.set(p.market, arr);
    }
    return m;
  }, [points]);

  const markets = useMemo(() => ORDER.filter((c) => (byMarket.get(c)?.length ?? 0) > 0), [byMarket]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // Default 6 months. A full year of daily points is 250+ categories on a
  // category axis -- readable as a shape, not as individual days.
  const [rangeDays, setRangeDays] = useState<number | null>(183);

  // Every date any market reported, narrowed to the chosen range.
  const allDates = useMemo(
    () => withinRange([...new Set(points.map((p) => p.date))].sort(), (d) => d, rangeDays),
    [points, rangeDays]
  );

  const series: Series[] = useMemo(
    () =>
      markets
        .filter((c) => !hidden.has(c))
        .map((code) => {
          const byDate = new Map((byMarket.get(code) ?? []).map((p) => [p.date, p.y10]));
          return {
            key: code,
            name: MARKET_NAMES[code] ?? code,
            color: COLORS[code] ?? "var(--slate)",
            // Every date any market reported, so a market that missed a
            // day renders as a gap rather than being bridged across it.
            // sortKey is the ISO date. Without it the chart sorts on the DISPLAY
            // label and scrambles a year of daily data into noise.
            data: allDates.map((d) => ({ year: fmtDay(d), value: byDate.get(d) ?? null, sortKey: d })),
          };
        }),
    [markets, hidden, byMarket, allDates]
  );

  const latest = useMemo(
    () =>
      markets.map((code) => {
        const arr = byMarket.get(code)!;
        const last = arr[arr.length - 1];
        const prev = arr.length > 1 ? arr[arr.length - 2] : null;
        return {
          code,
          y10: last.y10,
          date: last.date,
          // Audit L-2: histories differ enormously -- Japan began
          // 2026-08-03, Australia 2025-08-29 -- and one shared chart hid
          // that completely. A reader comparing the lines deserves to know
          // one of them is a month long and another a year.
          days: arr.length,
          change: prev ? last.y10 - prev.y10 : null,
          spread: last.y2 != null ? last.y10 - last.y2 : null,
        };
      }),
    [markets, byMarket]
  );

  if (markets.length === 0) return null;

  const toggle = (code: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      // Never allow an empty chart -- an axis with no lines gives a
      // reader no way to tell a filter from a failure.
      else if (markets.length - next.size > 1) next.add(code);
      return next;
    });

  const newestDate = allDates[allDates.length - 1];

  return (
    <div className="section">
      <div className="wrap">
        <div className="section-head" style={{ marginBottom: 16 }}>
          <p className="eyebrow">MARKET RATES · DAILY</p>
          <h2>What lenders charge governments to borrow for ten years</h2>
          <p style={{ maxWidth: "70ch" }}>
            The policy rate is what a central bank decides. This is what the market decides — and unlike every other
            figure on this page, it moves every trading day. Not part of the MMAI score.
          </p>
        </div>

        <div
          className="gulf-strip"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", marginBottom: 14 }}
        >
          {latest.map((m) => (
            <div key={m.code} className="mmai-card">
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Flag code={m.code} size={16} />
                <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>{MARKET_NAMES[m.code]}</span>
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 21,
                  color: COLORS[m.code],
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                }}
              >
                {m.y10.toFixed(2)}%
              </div>
              {/* The daily move, with no colour by direction. A rising
                  yield is not "good" or "bad" -- it depends entirely on
                  why -- so this deliberately avoids the score palette. */}
              <div
                style={{
                  fontSize: 12,
                  color: "var(--slate)",
                  marginTop: 3,
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                {m.change == null ? "—" : `${m.change >= 0 ? "+" : ""}${m.change.toFixed(3)} vs prev. day`}
              </div>
              <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2, fontFamily: "IBM Plex Mono, monospace" }}>
                {m.days} trading {m.days === 1 ? "day" : "days"} of history
              </div>
              {m.spread != null && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--slate)",
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: "1px dashed var(--hair)",
                  }}
                >
                  10y−2y{" "}
                  <b style={{ color: "var(--ink-soft)" }}>
                    {m.spread >= 0 ? "+" : ""}
                    {m.spread.toFixed(2)}
                  </b>
                </div>
              )}
            </div>
          ))}
        </div>

        <TimeRangeFilter options={DAILY_RANGES} selected={rangeDays} onChange={setRangeDays} />
        <div className="country-filter">
          {markets.map((code) => {
            const on = !hidden.has(code);
            return (
              <button
                key={code}
                type="button"
                className={`country-chip${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(code)}
                style={on ? { borderColor: COLORS[code], color: "#fff" } : undefined}
              >
                <i style={{ background: on ? COLORS[code] : "transparent", borderColor: COLORS[code] }} />
                {MARKET_NAMES[code]}
              </button>
            );
          })}
          <button
            type="button"
            className="country-chip country-chip-all"
            onClick={() => setHidden(new Set())}
            disabled={hidden.size === 0}
          >
            Show all
          </button>
        </div>

        <div className="chart-card">
          <div className="chart-card-label">
            <span>10-year government bond yield</span>
            <span
              className="meta-label"
              style={{ marginLeft: "auto", border: "1px solid var(--hair)", borderRadius: 999, padding: "3px 9px" }}
            >
              Daily · {allDates.length} trading days
            </span>
          </div>
          {/* connectNulls, because the gaps were public holidays.
              Every series is plotted on the UNION of all six bond markets'
              trading days, so a date exists for Japan whenever London,
              New York or Sydney traded -- and Japan's own line was given
              a null, and therefore a visible break, on Marine Day and
              Mountain Day. Every market shredded its own line on its own
              holidays, and the newest day was worse: on 4 September only
              the US had settled, so five lines stopped a day early and
              the US was left with an orphaned dot floating past the end.
              A market that did not trade has not lost its yield. Joining
              across the gap is what a yield curve means, and a source
              that genuinely stops is caught by verify-freshness, which
              is the right place for it -- not by shredding a chart. */}
          <TrendChart series={series} height={340} yLabel="%" showDots={false} connectNulls />
          <p
            style={{
              fontSize: 12,
              color: "var(--slate)",
              margin: "14px 0 0",
              paddingTop: 12,
              borderTop: "1px dashed var(--hair)",
              lineHeight: 1.7,
            }}
          >
            One source per market: the US Treasury, Bank of England, ECB, Bank of Canada, the RBA, and Japan&apos;s
            Ministry of Finance. Collected daily and stored, so this history survives a source changing shape or
            disappearing. Markets close at weekends and on public holidays — those days are gaps, never zeros. Latest
            reading {fmtDay(newestDate)}.
          </p>
          <p style={{ fontSize: 12, color: "var(--slate)", margin: "8px 0 0", lineHeight: 1.7 }}>
            <b style={{ color: "var(--ink-soft)" }}>On the 10y−2y spread</b>, shown for the two markets that publish
            both maturities: a negative number means lenders want more to lend for two years than for ten. That is
            unusual, and worth reading alongside everything else rather than on its own.
          </p>
        </div>
      </div>
    </div>
  );
}
