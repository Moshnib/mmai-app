"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { MONTHLY_HISTORY, type MonthlyPoint } from "@/lib/monthlyHistory";
import { latestCompleteObservation } from "@/lib/latestComplete";
import { colorForScore } from "@/lib/indicators";
import { DIMENSION_NAMES, dimensionPercentiles, type DimensionKey } from "@/lib/composite";

// ============================================================
//  ONE SCREEN FOR SOMEONE DECIDING WHERE TO PUT MONEY
//
//  The rest of the site explains the index. This page assumes you already
//  believe it, and asks the three questions an investor actually has:
//  where is the macro environment supportive, what has changed lately,
//  and what does money cost.
//
//  IT READS, IT DOES NOT RECOMPUTE. Scores, bands and the three
//  dimensions come from mmai_scores exactly as the refresh wrote them. A
//  second scoring path here would be a second engine to keep in step, and
//  this project has already paid for that once, with two market colour
//  maps that disagreed on five of six markets.
//
//  WHAT IT DELIBERATELY DOES NOT SHOW: a trend line of the SCORE. The
//  engine changed on 5 September 2026, so score history is about a week
//  long and anything spanning that date is not comparable. "What moved"
//  is built on the INDICATORS instead -- monthly back to 2019, the same
//  measure throughout -- which is what an investor wants anyway: not "the
//  score fell" but "inflation stopped falling and unemployment turned up".
// ============================================================

/** Conditions, Direction, Capacity. The order the whole site uses. */
const ORDER: DimensionKey[] = ["C", "D", "K"];

interface ScoreRow {
  market: string;
  observation_date: string;
  percentile: number | null;
  band: string | null;
  dim_conditions: number | null;
  dim_direction: number | null;
  dim_capacity: number | null;
  computed_at: string;
}

interface RawRow {
  market: string;
  observation_date: string;
  fetched_at: string;
  inflation: number | null;
  gdp_growth: number | null;
  unemployment: number | null;
  policy_rate: number | null;
  debt_pct_gdp: number | null;
}

interface BondRow {
  market: string;
  yield_10y: number | null;
  observation_date: string;
}

const NAME: Record<string, string> = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
const CODES = FALLBACK_MARKETS.map((m) => m.code);

const fmt = (v: number | null | undefined, dp = 1, suffix = "") =>
  v == null || !Number.isFinite(v) ? "N/A" : `${v.toFixed(dp)}${suffix}`;

const TH: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "right",
  color: "var(--slate)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontWeight: 600,
};
const TD: React.CSSProperties = { padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const NOTE: React.CSSProperties = {
  fontSize: 12,
  color: "var(--slate)",
  margin: "14px 0 0",
  paddingTop: 12,
  borderTop: "1px dashed var(--hair)",
  lineHeight: 1.7,
};

/** A change, with the direction stated rather than left to colour alone.
 *  Colour fails anyone who cannot separate red from green, and "up" is not
 *  "good" for every row -- unemployment rising is the opposite. So the
 *  glyph carries the direction and the caption explains what it means. */
function Delta({ now, then, dp = 1 }: { now: number | null; then: number | null; dp?: number }) {
  if (now == null || then == null) return <span style={{ color: "var(--slate)" }}>&mdash;</span>;
  const d = now - then;
  if (Math.abs(d) < 0.05) return <span style={{ color: "var(--slate)" }}>flat</span>;
  return (
    <span style={{ color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
      {d > 0 ? "up" : "down"} {Math.abs(d).toFixed(dp)}
    </span>
  );
}

function MarketCell({ code }: { code: string }) {
  return (
    <td style={{ padding: "10px 10px 10px 0", whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Flag code={code} size={16} />
        {NAME[code]}
      </span>
    </td>
  );
}

type Indicator = "inflation" | "unemployment" | "policyRate";

/** THE LATEST READING THAT EXISTS, AND THE ONE N MONTHS BEFORE IT.
 *
 *  Taking the last ROW is wrong here: the three series publish on
 *  different schedules and the newest month is often only partly filled.
 *  Read that way the dashboard showed N/A for euro-area inflation, UK
 *  unemployment and Japanese inflation -- all of which have perfectly
 *  good recent figures, just not in the final row. The comparison is
 *  anchored to the newest reading so the gap is always a true N months. */
function pairFor(series: MonthlyPoint[], key: Indicator, months: number): { now: number | null; then: number | null } {
  let latest = -1;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i][key] != null) { latest = i; break; }
  }
  if (latest < 0) return { now: null, then: null };
  const j = latest - months;
  return { now: series[latest][key], then: j >= 0 ? series[j][key] : null };
}

export default function DashboardInner() {
  const [scores, setScores] = useState<Record<string, ScoreRow>>({});
  const [raw, setRaw] = useState<Record<string, RawRow>>({});
  const [bonds, setBonds] = useState<Record<string, BondRow>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        const supabase = getPublicSupabaseClient();
        const [s, r, b] = await Promise.all([
          supabase
            .from("mmai_scores")
            .select("market, observation_date, percentile, band, dim_conditions, dim_direction, dim_capacity, computed_at")
            .order("observation_date", { ascending: false })
            .order("computed_at", { ascending: false })
            .limit(200),
          supabase
            .from("raw_indicators")
            .select("market, observation_date, fetched_at, inflation, gdp_growth, unemployment, policy_rate, debt_pct_gdp")
            .order("observation_date", { ascending: false })
            .order("fetched_at", { ascending: false })
            .limit(200),
          supabase
            .from("bond_yields")
            .select("market, yield_10y, observation_date")
            .order("observation_date", { ascending: false })
            .limit(300),
        ]);
        if (s.error || r.error || b.error) throw new Error("read failed");

        // The queries are already newest-first, so the first sighting of a
        // market is its newest row.
        const firstBy = <T extends { market: string }>(rows: T[] | null): Record<string, T> => {
          const out: Record<string, T> = {};
          for (const row of rows ?? []) if (!out[row.market]) out[row.market] = row;
          return out;
        };
        setScores(firstBy(s.data as ScoreRow[] | null));
        setBonds(firstBy(b.data as BondRow[] | null));

        // Raw figures use the same rule the pages use -- the most recent
        // COMPLETE observation, bounded -- so this screen cannot quote a
        // figure the rest of the site has already stopped showing.
        const byMarket: Record<string, RawRow[]> = {};
        for (const row of (r.data ?? []) as RawRow[]) (byMarket[row.market] ??= []).push(row);
        const picked: Record<string, RawRow> = {};
        for (const code of CODES) {
          const pick = latestCompleteObservation(
            byMarket[code] ?? [],
            ["inflation", "gdp_growth", "unemployment", "policy_rate", "debt_pct_gdp"],
            (row) => row.observation_date,
          );
          if (pick.row) picked[code] = pick.row;
        }
        setRaw(picked);
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, []);

  const ranked = CODES.map((code) => ({ code, score: scores[code] })).sort(
    (a, b) => (b.score?.percentile ?? -1) - (a.score?.percentile ?? -1),
  );
  const unscored = CODES.filter((c) => scores[c]?.percentile == null);

  return (
    <div className="section">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">DASHBOARD</p>
          <h1>Where macro is supportive, what moved, and what money costs</h1>
          <p>
            The seven markets MMAI scores, arranged for a decision rather than an explanation. Every
            figure is read from what the daily refresh stored, so this page cannot disagree with the
            rest of the site. It measures the macro environment, not any security, and it is not
            investment advice.
          </p>
        </div>

        {state === "loading" && <p style={{ color: "var(--slate)" }}>Reading the latest stored figures&hellip;</p>}
        {state === "error" && (
          <p style={{ color: "var(--slate)" }}>
            The database could not be read just now. Nothing is cached on this page, so there is no
            stale copy to show you instead &mdash; try again in a moment.
          </p>
        )}

        {state === "ready" && (
          <>
            {/* ---------------- 1. WHERE ---------------- */}
            <div className="chart-card" style={{ marginTop: 20 }}>
              <div className="chart-card-label">
                <span>Ranked right now</span>
                <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  a rank against 148 market-years
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left", padding: "8px 10px 8px 0" }}>Market</th>
                      <th style={TH}>Score</th>
                      <th style={{ ...TH, textAlign: "left" }}>Band</th>
                      {ORDER.map((k) => (
                        <th key={k} style={TH}>{DIMENSION_NAMES[k]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map(({ code, score }) => {
                      // mmai_scores stores the STANDARDISED dimension values,
                      // which read as 1, 0, -1 and mean nothing to a reader.
                      // Every other page shows them as percentiles, so this
                      // one does too -- through the same function, not a
                      // second conversion of its own.
                      const st = score;
                      const dims: Record<DimensionKey, number | null> =
                        st?.dim_conditions != null && st.dim_direction != null && st.dim_capacity != null
                          ? dimensionPercentiles({ C: st.dim_conditions, D: st.dim_direction, K: st.dim_capacity })
                          : { C: null, D: null, K: null };
                      return (
                        <tr key={code} style={{ borderTop: "1px solid var(--hair)" }}>
                          <MarketCell code={code} />
                          <td style={{ ...TD, fontWeight: 700, color: colorForScore(score?.percentile ?? null) }}>
                            {fmt(score?.percentile, 1)}
                          </td>
                          <td style={{ padding: "10px", color: "var(--ink-soft)" }}>{score?.band ?? "No score"}</td>
                          {ORDER.map((k) => (
                            <td key={k} style={{ ...TD, color: "var(--ink-soft)" }}>{fmt(dims[k], 0)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={NOTE}>
                <b style={{ color: "var(--ink-soft)" }}>How to read this.</b> The score is a percentile
                against 148 market-years of history, so 70 means the environment is more supportive than
                70% of the years on record &mdash; not that anything is 70% good. The three columns are
                what the score is made of, and they can disagree sharply: a market can sit mid-table
                because strong conditions are cancelling weak capacity, which is a different situation
                from one where all three are middling. <Link href="/compare" style={{ color: "var(--accent-2)" }}>Compare</Link>{" "}
                shows which.
              </p>
            </div>

            {/* ---------------- 2. WHAT MOVED ---------------- */}
            <div className="chart-card" style={{ marginTop: 20 }}>
              <div className="chart-card-label">
                <span>What moved</span>
                <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  against 3 and 12 months ago
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left", padding: "8px 10px 8px 0" }}>Market</th>
                      <th style={TH}>Inflation</th>
                      <th style={TH}>3m</th>
                      <th style={TH}>12m</th>
                      <th style={TH}>Unemployment</th>
                      <th style={TH}>3m</th>
                      <th style={TH}>12m</th>
                      <th style={TH}>Policy rate</th>
                      <th style={TH}>12m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CODES.map((code) => {
                      const series = MONTHLY_HISTORY[code] ?? [];
                      const inf3 = pairFor(series, "inflation", 3);
                      const inf12 = pairFor(series, "inflation", 12);
                      const une3 = pairFor(series, "unemployment", 3);
                      const une12 = pairFor(series, "unemployment", 12);
                      const rate12 = pairFor(series, "policyRate", 12);
                      return (
                        <tr key={code} style={{ borderTop: "1px solid var(--hair)" }}>
                          <MarketCell code={code} />
                          <td style={TD}>{fmt(inf3.now, 1, "%")}</td>
                          <td style={TD}><Delta now={inf3.now} then={inf3.then} /></td>
                          <td style={TD}><Delta now={inf12.now} then={inf12.then} /></td>
                          <td style={TD}>{fmt(une3.now, 1, "%")}</td>
                          <td style={TD}><Delta now={une3.now} then={une3.then} /></td>
                          <td style={TD}><Delta now={une12.now} then={une12.then} /></td>
                          <td style={TD}>{fmt(rate12.now, 2, "%")}</td>
                          <td style={TD}><Delta now={rate12.now} then={rate12.then} dp={2} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={NOTE}>
                <b style={{ color: "var(--ink-soft)" }}>Direction, not level.</b> A change is in percentage
                points, so &ldquo;up 0.4&rdquo; on inflation means the rate is 0.4 points higher than it
                was, not that prices rose 0.4%. Up is neither good nor bad on its own: inflation moving
                toward a central bank&apos;s target is good whichever way it travels, and unemployment
                rising rarely is. These are the published monthly figures back to 2019, on the same
                measure throughout &mdash; which is why this panel tracks the indicators rather than the
                score. One figure differs from the ranking above on purpose: US inflation reads CPI here
                and PCE there, because the Federal Reserve states its 2% target on PCE, so PCE is what
                the score measures. Both are real; they are different baskets. Japan&apos;s inflation reads N/A because no monthly series is wired for it: the
                OECD price dataflow returns an error for Japan specifically, and Japan&apos;s own e-Stat
                needs a registered key. Its scored figure comes from e-Stat and is current; only the
                monthly history is missing.
              </p>
            </div>

            {/* ---------------- 3. THE PRICE OF MONEY ---------------- */}
            <div className="chart-card" style={{ marginTop: 20 }}>
              <div className="chart-card-label">
                <span>What money costs</span>
                <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  policy rate against the ten-year
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left", padding: "8px 10px 8px 0" }}>Market</th>
                      <th style={TH}>Policy rate</th>
                      <th style={TH}>Ten-year</th>
                      <th style={TH}>Spread</th>
                      <th style={TH}>Govt debt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CODES.map((code) => {
                      const policy = raw[code]?.policy_rate ?? null;
                      const ten = bonds[code]?.yield_10y ?? null;
                      const spread = policy != null && ten != null ? ten - policy : null;
                      return (
                        <tr key={code} style={{ borderTop: "1px solid var(--hair)" }}>
                          <MarketCell code={code} />
                          <td style={TD}>{fmt(policy, 2, "%")}</td>
                          <td style={TD}>{fmt(ten, 2, "%")}</td>
                          <td style={{ ...TD, color: spread != null && spread < 0 ? "var(--ink)" : "var(--ink-soft)" }}>
                            {spread == null ? "N/A" : `${spread > 0 ? "+" : ""}${spread.toFixed(2)}`}
                          </td>
                          <td style={{ ...TD, color: "var(--ink-soft)" }}>{fmt(raw[code]?.debt_pct_gdp, 0, "%")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={NOTE}>
                <b style={{ color: "var(--ink-soft)" }}>The spread is the ten-year minus the policy rate.</b>{" "}
                Positive is the ordinary state: lenders want more for locking money away for a decade.
                Negative &mdash; an inverted curve &mdash; means markets are pricing rate cuts, which has
                often preceded recessions, though it is a signal and not a schedule. Sweden reads N/A
                because no Swedish bond series is wired: that figure would come from the Riksbank, whose
                terms do not confirm commercial reuse is permitted. Government debt sits alongside
                because the two interact &mdash; a heavily indebted state pays more for the same policy
                rate.
              </p>
            </div>

            {/* ---------------- 4. WHAT TO DISTRUST ---------------- */}
            <div className="chart-card" style={{ marginTop: 20 }}>
              <div className="chart-card-label"><span>Before you rely on any of it</span></div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.8 }}>
                {unscored.length === 0
                  ? "Every market has a current score, so nothing here is being withheld."
                  : `No score for ${unscored.map((c) => NAME[c]).join(", ")} — a market is left unscored rather than scored on partial data, because a country measured on four indicators is not comparable with one measured on five.`}{" "}
                Figures are each market&apos;s most recent <em>complete</em> observation, which is not
                always today: statistics offices publish monthly or quarterly, and a reading can be
                several weeks old while being the newest that exists. The{" "}
                <Link href="/sources" style={{ color: "var(--accent-2)" }}>Sources</Link> page gives every
                series its own reporting date, institution and licence.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
