"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import { OBSERVATORY, observatoryByRegion, type ObservatoryRow } from "@/lib/observatory";
import { fetchObservatoryRows } from "@/lib/observatoryRead";

// ============================================================
//  COUNTRIES WORTH WATCHING AND NOT WORTH SCORING
//
//  Two days of screening candidate countries produced a boundary: MMAI
//  is calibrated for mature, floating-rate, inflation-targeting
//  economies whose GDP measures domestic activity. Eight of ten
//  candidates failed that test, and almost none failed for having bad
//  data — Brazil's was the best found anywhere.
//
//  So this page exists to stop good data being thrown away because one
//  composite cannot digest it. Real figures, real dates, real sources,
//  and no score.
//
//  WHY EACH COUNTRY IS HERE IS PRINTED BESIDE IT. An unscored country
//  with no stated reason invites a reader to assume the data was
//  missing, which for every country here is false. That sentence is the
//  most important thing on the page and it is not a footnote.
//
//  GULF WATCH IS NOT ABSORBED. It keeps its own name, page and URL. It
//  reached this conclusion first, has its own sources and its own table,
//  and folding it in would break a working thing to satisfy a taxonomy.
// ============================================================

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

const fmt = (v: number | null | undefined, dp = 1, suffix = "") =>
  v == null || !Number.isFinite(v) ? "N/A" : `${v.toFixed(dp)}${suffix}`;

/** A reporting date, short. Every figure carries its own: an annual
 *  reading and a fresh monthly one look identical without it, which is
 *  the gap a site-owner spot-check found in Gulf Watch. */
function when(date: string | null | undefined): string {
  if (!date) return "—";
  const m = date.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!m) return date;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${m[1]}`;
}

function Figure({ value, date, dp = 1, suffix = "%" }: { value: number | null; date: string | null; dp?: number; suffix?: string }) {
  return (
    <td style={TD}>
      <div>{fmt(value, dp, suffix)}</div>
      <div style={{ fontSize: 11, color: "var(--slate)", fontWeight: 400 }}>{when(date)}</div>
    </td>
  );
}

export default function ObservatoryInner() {
  const [rows, setRows] = useState<Map<string, ObservatoryRow>>(new Map());
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        setRows(await fetchObservatoryRows());
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, []);

  const regions = observatoryByRegion();

  return (
    <div className="section">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">OBSERVATORY</p>
          <h1>Tracked, and deliberately not scored</h1>
          <p>
            Every country here publishes figures good enough to show and not comparable enough to
            rank. The reason is printed beside each one, because an unscored country with no
            explanation reads as missing data &mdash; and for every country on this page that is
            false. Figures are the same measures, from the same institutions, as the {" "}
            <Link href="/" style={{ color: "var(--accent-2)" }}>scored markets</Link> use.
          </p>
        </div>

        {state === "loading" && <p style={{ color: "var(--slate)" }}>Reading the latest stored figures&hellip;</p>}
        {state === "error" && (
          <p style={{ color: "var(--slate)" }}>
            The database could not be read just now. Nothing is cached on this page, so there is no
            stale copy to show instead &mdash; try again in a moment.
          </p>
        )}

        {state === "ready" &&
          regions.map(({ region, countries }) => (
            <div key={region} className="chart-card" style={{ marginTop: 20 }}>
              <div className="chart-card-label">
                <span>{region}</span>
                <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  {countries.length} {countries.length === 1 ? "country" : "countries"}, no score
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left", padding: "8px 10px 8px 0" }}>Country</th>
                      <th style={TH}>Inflation</th>
                      <th style={TH}>Unemployment</th>
                      <th style={TH}>GDP growth</th>
                      <th style={TH}>Policy rate</th>
                      <th style={TH}>Ten-year</th>
                      <th style={TH}>Govt debt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map((c) => {
                      const r = rows.get(c.code);
                      return (
                        <tr key={c.code} style={{ borderTop: "1px solid var(--hair)" }}>
                          <td style={{ padding: "10px 10px 10px 0", whiteSpace: "nowrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <Flag code={c.code} size={18} />
                              {c.name}
                            </span>
                          </td>
                          <Figure value={r?.inflation ?? null} date={r?.inflation_observation_date ?? null} />
                          <Figure value={r?.unemployment ?? null} date={r?.unemployment_observation_date ?? null} />
                          <Figure value={r?.gdp_growth ?? null} date={r?.gdp_observation_date ?? null} />
                          {/* A country with no monetary policy of its own
                              gets a sentence, not a dash. A dash reads as a
                              failed fetch; this is a fact about the euro. */}
                          {c.policyRateNote?.includes("no policy rate of its own") ? (
                            <td style={{ ...TD, color: "var(--slate)", fontSize: 12 }}>uses the euro</td>
                          ) : (
                            <Figure value={r?.policy_rate ?? null} date={r?.policy_rate_observation_date ?? null} dp={2} />
                          )}
                          <Figure value={r?.yield_10y ?? null} date={r?.yield_observation_date ?? null} dp={2} />
                          <td style={TD}>
                            <div>{fmt(r?.debt_pct_gdp ?? null, 1, "%")}</div>
                            <div style={{ fontSize: 11, color: "var(--slate)", fontWeight: 400 }}>
                              {r?.debt_observation_period ?? "—"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {countries.map((c) => (
                <div
                  key={`why-${c.code}`}
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px dashed var(--hair)",
                    fontSize: 13,
                    color: "var(--slate)",
                    lineHeight: 1.7,
                  }}
                >
                  <b style={{ color: "var(--ink-soft)" }}>Why {c.name} is not scored.</b> {c.whyUnscored}
                  {c.evidence && <> {c.evidence}</>}
                  {c.policyRateNote && (
                    <>
                      {" "}
                      <span style={{ color: "var(--ink-soft)" }}>On its policy rate:</span> {c.policyRateNote}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}

        {state === "ready" && (
          <div className="chart-card" style={{ marginTop: 20 }}>
            <div className="chart-card-label"><span>Also tracked without a score</span></div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.8 }}>
              <Link href="/gulf-watch" style={{ color: "var(--accent-2)" }}>Gulf Watch</Link> covers six
              Gulf economies the same way and reached this conclusion first, for a different reason:
              their labour-market figures are not comparable with the scored markets&apos;. It keeps
              its own page and its own sources.{" "}
              <Link href="/sources" style={{ color: "var(--accent-2)" }}>Sources</Link> lists every
              series on this page with its institution, licence and reporting date.
            </p>
          </div>
        )}

        {state === "ready" && OBSERVATORY.some((c) => !rows.has(c.code)) && (
          <p style={{ fontSize: 12, color: "var(--slate)", marginTop: 16, lineHeight: 1.7 }}>
            {OBSERVATORY.filter((c) => !rows.has(c.code)).map((c) => c.name).join(", ")} shows no
            figures yet: the daily refresh has not written a reading. That is a row waiting to be
            collected, not a source that failed.
          </p>
        )}
      </div>
    </div>
  );
}
