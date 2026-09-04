"use client";

import { useMemo, useState } from "react";
import TrendChart, { type Series } from "@/components/TrendChart";
import TimeSliderScatter, { type TimeSliderSeriesData } from "@/components/TimeSliderScatter";
import Flag from "@/components/Flag";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import {
  GULF_CPI_HISTORY,
  GULF_FX_RESERVES_HISTORY,
  GULF_CURRENT_ACCOUNT_HISTORY,
  GULF_REAL_ESTATE_HISTORY,
  type GulfHistorySeries,
} from "@/lib/gulfHistory";
import { latestPoint, annualizeCpi, pairAnnualSeries, type LatestPoint } from "@/lib/gulfHistoryHelpers";

// Distinct from every indicator color already used elsewhere in this
// file (#E14B4B inflation, #22D3EE FX reserves, #8B5CF6 current
// account, #D9A441 real estate) -- the scatter plot puts inflation and
// FX reserves on its two AXES, so reusing either of those two colors
// for a country would read as "this country is a variable", not "this
// is a place". No green anywhere (site-wide rule).
const COUNTRY_COLORS: Record<string, string> = {
  AE: "#F0975B",
  BH: "#F472B6",
  QA: "#60A5FA",
  SA: "#C084FC",
  KW: "#FBBF24",
  OM: "#FB7185",
};

const RELATIONSHIP_TRAIL_YEARS = 6;

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
          <span className="micro-note" style={{ textTransform: "uppercase" }}>{granularity}</span>
        )}
      </div>
      {hasEnough ? (
        // showDots=true is safe even for Saudi's 151-point monthly
        // series -- TrendChart's own dot renderer thins dense series by
        // real pixel spacing rather than drawing every point, while
        // still always keeping isolated/edge points visible. See the
        // comment on renderSpacedDot in components/TrendChart.tsx.
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
      <div className="micro-note">
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
            <th scope="col" style={th}>Country</th>
            <th scope="col" style={th}>Inflation (YoY)</th>
            <th scope="col" style={th}>FX reserves</th>
            <th scope="col" style={th}>Current account</th>
            <th scope="col" style={th}>Real estate</th>
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

// Pairs each country's annualized CPI with its annual FX-reserves figure
// on matching years only (never an inflation reading from one year
// against an FX reading from another), capped to the most recent
// RELATIONSHIP_TRAIL_YEARS. A country needs at least 1 paired year to
// show up at all -- unlike the old trail-line version, a lone year is
// still a real, useful frame to land on while scrubbing the slider, not
// a "trail" that needs a minimum length to draw.
function buildRelationshipSeries(): { series: TimeSliderSeriesData[]; years: string[]; excluded: string[] } {
  const series: TimeSliderSeriesData[] = [];
  const excluded: string[] = [];
  const yearSet = new Set<string>();
  for (const c of GULF_COUNTRIES) {
    const cpiAnnual = annualizeCpi(GULF_CPI_HISTORY[c.code]);
    const fxAnnual = (GULF_FX_RESERVES_HISTORY[c.code]?.points ?? [])
      .filter((p): p is { period: string; value: number } => p.value !== null)
      .map((p) => ({ year: p.period, value: p.value }));
    const paired = pairAnnualSeries(cpiAnnual, fxAnnual, RELATIONSHIP_TRAIL_YEARS);
    if (paired.length === 0) {
      excluded.push(c.name);
      continue;
    }
    const byYear = new Map(paired.map((p) => [p.period, { x: p.x, y: p.y }]));
    paired.forEach((p) => yearSet.add(p.period));
    series.push({ key: c.code, name: c.name, color: COUNTRY_COLORS[c.code] ?? "var(--slate)", byYear });
  }
  return { series, years: Array.from(yearSet).sort(), excluded };
}

// The three indicators every GCC country reports on a genuinely
// comparable basis, for the cross-country chart (brief §18).
//
// Real estate is deliberately absent: only Qatar has a source, so a
// "comparison" chart would be one line. It stays in the per-country
// section below.
//
// Inflation is annualised first (annualizeCpi, the same helper the
// scatter plot already uses and that carries a 12-month completeness
// guard). BH/QA/SA publish CPI monthly while AE/KW/OM are annual via
// the World Bank -- plotting those raw on one axis would mix two
// different statistics, which the brief explicitly warns against. The
// chart label says "annual average" so the transformation is stated,
// not silent.
const CROSS_INDICATORS = [
  { key: "cpi", label: "Inflation (YoY)", axis: "%", note: "Annual average — monthly sources averaged to the calendar year." },
  { key: "fx", label: "FX reserves", axis: "months", note: "Months of import cover, World Bank basis for all six." },
  { key: "ca", label: "Current account", axis: "% of GDP", note: "Share of GDP, World Bank basis for all six." },
] as const;

type CrossIndicatorKey = (typeof CROSS_INDICATORS)[number]["key"];

// Kuwait's reserves series runs back to the 1970s while the UAE's
// starts in 2023. Showing the full union would squash every recent
// move into the right-hand edge, so the chart caps to a recent window.
const CROSS_YEARS = 15;

function buildCrossSeries(indicator: CrossIndicatorKey): { series: Series[]; excluded: string[] } {
  const series: Series[] = [];
  const excluded: string[] = [];

  // Common upper bound so a country with a longer history doesn't
  // stretch the axis past everyone else's data.
  const allYears = new Set<string>();
  for (const c of GULF_COUNTRIES) {
    const pts =
      indicator === "cpi"
        ? annualizeCpi(GULF_CPI_HISTORY[c.code]).map((p) => p.year)
        : (indicator === "fx" ? GULF_FX_RESERVES_HISTORY : GULF_CURRENT_ACCOUNT_HISTORY)[c.code]?.points
            .filter((p) => p.value !== null)
            .map((p) => p.period) ?? [];
    pts.forEach((y) => allYears.add(y));
  }
  const years = Array.from(allYears).sort().slice(-CROSS_YEARS);
  const keep = new Set(years);

  for (const c of GULF_COUNTRIES) {
    const raw =
      indicator === "cpi"
        ? annualizeCpi(GULF_CPI_HISTORY[c.code]).map((p) => ({ year: p.year, value: p.value }))
        : ((indicator === "fx" ? GULF_FX_RESERVES_HISTORY : GULF_CURRENT_ACCOUNT_HISTORY)[c.code]?.points ?? [])
            .filter((p): p is { period: string; value: number } => p.value !== null)
            .map((p) => ({ year: p.period, value: p.value }));

    const data = raw.filter((p) => keep.has(p.year));
    if (data.length === 0) {
      excluded.push(c.name);
      continue;
    }
    // Every year in the window, with real gaps left as null rather than
    // bridged -- TrendChart renders those as gaps (connectNulls={false}).
    const byYear = new Map(data.map((p) => [p.year, p.value]));
    series.push({
      key: c.code,
      name: c.name,
      color: COUNTRY_COLORS[c.code] ?? "var(--slate)",
      data: years.map((y) => ({ year: y, value: byYear.get(y) ?? null })),
    });
  }
  return { series, excluded };
}

export default function GulfTrends() {
  const [current, setCurrent] = useState("AE");
  const [crossIndicator, setCrossIndicator] = useState<CrossIndicatorKey>("cpi");
  const cross = useMemo(() => buildCrossSeries(crossIndicator), [crossIndicator]);
  const crossMeta = CROSS_INDICATORS.find((i) => i.key === crossIndicator)!;

  // Which countries are drawn. Six lines on one axis is legible on a
  // desktop and genuinely not on a phone, and the comparison a reader
  // actually wants is usually two or three countries rather than all of
  // them. Defaults to all so the chart is unchanged until touched.
  const [shown, setShown] = useState<Set<string>>(() => new Set(GULF_COUNTRIES.map((c) => c.code)));
  const toggleCountry = (code: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      // Never allow an empty chart -- deselecting the last country would
      // leave an axis with nothing on it and no way to tell whether the
      // data failed or the filter did.
      if (next.has(code)) {
        if (next.size === 1) return prev;
        next.delete(code);
      } else next.add(code);
      return next;
    });

  const visibleSeries = cross.series.filter((s) => shown.has(s.key));
  const allShown = shown.size === GULF_COUNTRIES.length;

  const cpi = seriesFor(current, "Inflation (YoY)", "#E14B4B", GULF_CPI_HISTORY);
  const fx = seriesFor(current, "FX reserves (months of imports)", "#22D3EE", GULF_FX_RESERVES_HISTORY);
  const ca = seriesFor(current, "Current account (% of GDP)", "#8B5CF6", GULF_CURRENT_ACCOUNT_HISTORY);
  const re = seriesFor(current, "Real estate transactions", "#D9A441", GULF_REAL_ESTATE_HISTORY);

  // Static generated data (lib/gulfHistory.ts) -- computing this once
  // per mount rather than per render is enough; no live/dynamic input
  // feeds it, unlike the per-country memos on the Compare page.
  const { series: relationshipSeries, years: relationshipYears, excluded: relationshipExcluded } = useMemo(() => buildRelationshipSeries(), []);

  return (
    <>
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {/* Primary analytical block (brief §18): one large chart, all
              six countries, switched by indicator tab -- rather than a
              grid of small per-country charts. */}
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">TRACK THE INDICATORS</p>
            <h2>All six countries, one indicator at a time</h2>
            <p style={{ maxWidth: "68ch" }}>
              Pick an indicator to compare the region on a single, consistent basis. A gap in a country&apos;s data
              renders as a gap, never a smoothed-over line.
            </p>
          </div>

          <div className="selector-row">
            {CROSS_INDICATORS.map((ind) => (
              <button
                key={ind.key}
                className={`selector-btn${crossIndicator === ind.key ? " active" : ""}`}
                onClick={() => setCrossIndicator(ind.key)}
                aria-pressed={crossIndicator === ind.key}
              >
                {ind.label}
              </button>
            ))}
          </div>

          {/* Country filter. Each chip carries its own line colour, so the
              control and the chart read as the same object -- a reader
              never has to match a name to a line by guesswork. */}
          <div className="country-filter">
            {cross.series.map((s) => {
              const on = shown.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`country-chip${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleCountry(s.key)}
                  style={on ? { borderColor: s.color, color: "#fff" } : undefined}
                >
                  <i style={{ background: on ? s.color : "transparent", borderColor: s.color }} />
                  {s.name}
                </button>
              );
            })}
            <button
              type="button"
              className="country-chip country-chip-all"
              onClick={() => setShown(new Set(GULF_COUNTRIES.map((c) => c.code)))}
              disabled={allShown}
            >
              Show all
            </button>
          </div>

          <div className="chart-card" style={{ marginBottom: 34 }}>
            <div className="chart-card-label">
              {crossMeta.label} —{" "}
              {allShown
                ? "all six GCC economies"
                : visibleSeries.length === 1
                  ? visibleSeries[0].name
                  : `${visibleSeries.length} of six`}
              <span className="meta-label" style={{ marginLeft: "auto", border: "1px solid var(--hair)", borderRadius: 999, padding: "3px 9px" }}>
                Annual
              </span>
            </div>
            <TrendChart series={visibleSeries} height={360} yLabel={crossMeta.axis} showDots connectNulls={false} />
            <p style={{ fontSize: 11, color: "var(--slate)", margin: "12px 0 0", lineHeight: 1.6 }}>
              {crossMeta.note}
              {cross.excluded.length > 0 && ` No comparable data in this window for: ${cross.excluded.join(", ")}.`}
            </p>
          </div>

          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">COUNTRY DETAIL</p>
            <h2>Each country on its own real timeline</h2>
            <p style={{ maxWidth: "68ch" }}>
              Pick a country to see every indicator it publishes, each on that indicator&apos;s own reporting dates —
              annual figures are never stretched to look monthly.
            </p>
          </div>

          <div className="tabs">
            {GULF_COUNTRIES.map((c) => (
              <button
                key={c.code}
                className={`tab${c.code === current ? " active" : ""}`}
                onClick={() => setCurrent(c.code)}
                aria-pressed={c.code === current}
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
            {/* Only Qatar has a real estate fetcher wired up -- the
                other 5 countries' "no source" card used to always take
                up a grid slot here explaining why it was blank. Hiding
                it entirely (the grid is auto-fit, so the remaining 3
                cards reflow to fill the row) is the more honest version
                -- it doesn't imply real estate is a field these
                countries almost have. Still documented on /sources. */}
            {current === "QA" && (
              <MiniChart title="Real estate transactions" granularity={re.granularity} series={re.series} hasEnough={re.hasEnough} />
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

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">COST OF LIVING VS. CURRENCY STABILITY</p>
            <h2>Inflation against FX reserves, country by country</h2>
            <p style={{ maxWidth: "68ch" }}>
              Drag the slider (or hit play) to move through {relationshipYears[0]}–{relationshipYears[relationshipYears.length - 1]} and
              watch each country&apos;s position change. A country with no reading for a given year is simply hidden
              that year, not guessed at. Inflation is averaged to a full calendar year here so monthly and annual
              sources compare fairly.
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", backdropFilter: "blur(14px)" }}>
            <TimeSliderScatter series={relationshipSeries} years={relationshipYears} xLabel="Inflation (%, annual average)" yLabel="FX reserves (months of imports)" height={380} />
            {relationshipExcluded.length > 0 && (
              <p style={{ fontSize: 11, color: "var(--slate)", margin: "14px 0 0", lineHeight: 1.6 }}>
                No year with both figures available yet for: {relationshipExcluded.join(", ")}.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
