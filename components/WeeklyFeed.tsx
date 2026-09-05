"use client";

import { useEffect, useState } from "react";
import Flag from "@/components/Flag";
import { colorForScore, type PillarKey } from "@/lib/indicators";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { RAW_DECIMALS } from "@/components/KeyRatesRow";
import { fetchAllWeeklyChanges, floorFor, type WeeklyChangesResult } from "@/lib/weeklyChanges";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// PER MARKET. These dates used to be two module constants off one shared
// floor, on the stated assumption that every market started tracking at
// the same moment. That stopped being true the moment four markets'
// unemployment source was swapped and the other two were left alone --
// and printing one date for all six would have told a reader the US had
// no comparable history when it had a week of it.
const trackingSince = (market: string) => formatDate(floorFor(market));

// Matches lib/indicators.ts's COLOR_STOPS[1] (the orange stop) -- not
// imported, because that module exports colorForScore() rather than the
// raw stops. Used here purely as a fixed "down" indicator
// for the composite delta, not as a score-derived color.
const COMPOSITE_DOWN_COLOR = "#F0975B";

function delta(now: number | null, then: number | null): { symbol: string; text: string } | null {
  if (now == null || then == null) return null;
  const diff = now - then;
  const symbol = Math.abs(diff) < 0.05 ? "—" : diff > 0 ? "↑" : "↓";
  return { symbol, text: `${symbol} ${Math.abs(diff).toFixed(1)}` };
}

// The old wide-table layout's cell components were removed when this
// moved to the design reference's two-column row grid. The rules they
// encoded still hold and now live inline in the row markup below:
// indicator figures carry no directional colour (unemployment rising
// and GDP rising are not both "good"), and only the composite -- which
// is directional by design -- uses the site's score colour.

export default function WeeklyFeed() {
  const [data, setData] = useState<WeeklyChangesResult | null>(null);

  useEffect(() => {
    let alive = true;
    // .catch as well as .then: fetchAllWeeklyChanges swallows its own
    // errors today, but a future edit that let one escape would have
    // left this stuck on the skeleton forever with no way to tell.
    fetchAllWeeklyChanges()
      .then((r) => alive && setData(r))
      .catch(() => alive && setData({ ok: false, reason: "unavailable" }));
    return () => {
      alive = false;
    };
  }, []);

  const results = data?.ok ? data.markets : null;

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
          <span style={{ fontSize: 11, color: "var(--slate)", textTransform: "uppercase", letterSpacing: 0.5 }}>Brent crude, YoY (shared across all markets)</span>
          <span style={{ fontSize: 13, color: "var(--ink)" }}>
            {brentNow.toFixed(1)}% <span style={{ color: "var(--slate)", marginLeft: 6 }}>{brentDeltaText}</span>
          </span>
        </div>
      )}

      {results?.some((r) => !r.isStale && r.buckets.length < 2) && (
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 14, padding: "10px 12px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <span aria-hidden="true">●</span>
          {/* Names the affected markets rather than implying all six are
              waiting. After a source swap only the swapped markets reset,
              so a blanket "tracking began" line would understate what the
              rest of the feed can already show. */}
          <span>
            {(() => {
              const waiting = (results ?? []).filter((r) => !r.isStale && r.buckets.length < 2);
              const names = waiting.map((r) => r.marketName).join(", ");
              const soonest = Math.min(...waiting.map((r) => floorFor(r.marketCode)));
              return (
                <>
                  Nothing has moved for <b style={{ color: "var(--ink)" }}>{names}</b> since{" "}
                  <b style={{ color: "var(--ink)" }}>{formatDate(soonest)}</b>, when{" "}
                  {waiting.length === 1 ? "its source" : "their sources"} last changed. Inflation and unemployment
                  are published monthly, growth and debt quarterly, and policy rates only when a committee sits — so
                  a still reading is the normal state between releases, not a gap in the data.
                </>
              );
            })()}
          </span>
        </div>
      )}

      {/* Two-column grid of compact rows (design reference) rather than a
          wide table. The figures and the no-interpretation rule are
          unchanged -- only the layout differs. */}
      {/* Reaching the database failed -- say THAT, rather than the old
          behaviour of flagging every market stale and rendering "Not
          currently refreshing", which blamed the data pipeline for what
          is almost always a connection problem on the reader's side. */}
      {data && !data.ok && (
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "12px 14px", background: "rgba(240,151,91,0.06)", border: "1px solid rgba(240,151,91,0.22)", borderRadius: 10, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <span aria-hidden="true">●</span>
          <span>
            {data.reason === "unconfigured"
              ? "Weekly signals aren't configured in this environment, so there's nothing to show here."
              : "Couldn't load this week's signals — the live data couldn't be reached just now. The scores above are unaffected. Refreshing the page usually fixes it."}
          </span>
        </div>
      )}

      <div className="signal-grid">
        {/* One skeleton per market, so the block doesn't visibly jump
            from four rows to six when the data lands. */}
        {data === null &&
          FALLBACK_MARKETS.map((m) => (
            <div key={m.code} className="signal-row" aria-hidden="true">
              <span className="signal-market" style={{ color: "var(--slate)" }}>Loading…</span>
              <span />
              <span />
            </div>
          ))}

        {results?.map((r) => {
          // `latest` drives what is DISPLAYED and ignores the
          // comparability floor -- a current reading is always valid.
          // `buckets` drives the DELTA and respects the floor, because a
          // change spanning a source swap would be a fetcher artefact.
          // Splitting these is what stopped four markets rendering as an
          // empty "tracking since" row while their live numbers sat
          // unused in the same response.
          const now = r.buckets[0] ?? r.latest;
          const then = r.buckets[1];
          const hasFigures = !!now;
          const scoreDelta = r.buckets[0] && then ? delta(r.buckets[0].composite, then.composite) : null;
          const stateColor =
            scoreDelta?.symbol === "↑" ? "var(--status-live)" : scoreDelta?.symbol === "↓" ? COMPOSITE_DOWN_COLOR : "var(--slate)";

          return (
            <div key={r.marketCode} className="signal-row">
              <span className="signal-market">
                <Flag code={r.marketCode} size={18} />
                <span>{r.marketName}</span>
              </span>

              <span className="signal-body">
                {r.isStale ? (
                  <span className="signal-headline" style={{ color: "var(--slate)", fontWeight: 500 }}>
                    Not currently refreshing — no recent data available.
                  </span>
                ) : !hasFigures ? (
                  <>
                    <span className="signal-headline" style={{ color: "var(--slate)", fontWeight: 500 }}>
                      Tracking since {trackingSince(r.marketCode)}
                    </span>
                    <span className="signal-detail">
                      No change yet since its source was swapped
                    </span>
                  </>
                ) : (
                  <>
                    <span className="signal-headline">
                      MMAI score{" "}
                      <b style={{ color: colorForScore(now.composite), fontFamily: "Space Grotesk, sans-serif" }}>
                        {now.composite != null ? now.composite.toFixed(1) : "—"}
                      </b>
                      {scoreDelta ? (
                        <span style={{ color: stateColor, marginLeft: 8 }}>{scoreDelta.text}</span>
                      ) : (
                        // ALWAYS SAYS SOMETHING. This read "no weekly
                        // comparison yet", which reports the state of the
                        // software rather than the state of the economy --
                        // and on a feed that only fires when a figure
                        // moves, most rows on most days land here.
                        // "Unchanged since 12 August" is the same absence
                        // stated as the fact it actually is, and unlike
                        // the old label it is checkable.
                        <span style={{ color: "var(--slate)", marginLeft: 8, fontWeight: 500 }}>
                          {r.steadySince
                            ? `unchanged since ${formatDate(new Date(r.steadySince).getTime())}`
                            : "first reading — nothing to compare yet"}
                        </span>
                      )}
                    </span>
                    <span className="signal-detail">
                      {/* Per-field precision (RAW_DECIMALS), not a
                          blanket one decimal: a policy rate is set to
                          the quarter-point, so 4.35 printed here as
                          "4.3%" was a rate the RBA never set. */}
                      {([
                        ["Infl", now.raw.inflation, "PS"],
                        ["GDP", now.raw.gdpGrowth, "GM"],
                        ["Unemp", now.raw.unemployment, "LM"],
                        ["Rate", now.raw.policyRate, "MC"],
                      ] as Array<[string, number | null, PillarKey]>)
                        .map(([label, v, p]) => `${label} ${v != null ? `${v.toFixed(RAW_DECIMALS[p])}%` : "—"}`)
                        .join("  ·  ")}
                    </span>
                  </>
                )}
              </span>

              <span
                className="signal-state"
                style={{ background: `${stateColor === "var(--slate)" ? "rgba(255,255,255,0.06)" : "transparent"}`, border: `1px solid var(--hair)`, color: stateColor }}
                aria-hidden="true"
              >
                {scoreDelta ? scoreDelta.symbol : "·"}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--slate)", margin: "14px 0 0", lineHeight: 1.6 }}>
        Each market is compared against the most recent reading that was actually <em>different</em>, not against a
        fixed week ago — official figures arrive on release schedules, so a fixed window is either empty or lumps
        unrelated releases together. Where nothing has moved, the row says how long the current figures have stood.
        Raw numbers only, no interpretation. Inflation and unemployment are published monthly, growth and debt
        quarterly, and policy rates only when a committee sits, so a steady reading between releases is the normal
        state rather than a gap in the data.
      </p>
    </div>
  );
}
