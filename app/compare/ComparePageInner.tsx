"use client";

import { useCallback, useState, useMemo } from "react";
import TrendChart, { type Series } from "@/components/TrendChart";
import TimeSliderScatter, { type TimeSliderSeriesData } from "@/components/TimeSliderScatter";
import Flag from "@/components/Flag";
import { useLiveHistory } from "@/lib/useLiveHistory";
import { type RawIndicators } from "@/lib/indicators";
import {
  DIMENSION_NAMES, computeMmai, dimensionPercentiles,
  SOURCE_BREAK_UNCERTAINTY_PTS, type DimensionKey,
} from "@/lib/composite";

/** The five scored indicators, as their own selector. Under the three
 *  dimensions a "raw view" of a dimension is ambiguous -- Conditions has
 *  two indicators behind it -- so the raw series gets a flat list rather
 *  than being nested inside a dimension that may hold one or two. */
const RAW_CHOICES = [
  { key: "inflation", label: "Inflation", unit: "% YoY" },
  { key: "unemployment", label: "Unemployment", unit: "%" },
  { key: "gdpGrowth", label: "GDP growth", unit: "% YoY" },
  { key: "debtPctGdp", label: "Government debt", unit: "% of GDP" },
  { key: "policyRate", label: "Policy rate", unit: "%" },
] as const satisfies readonly { key: keyof RawIndicators; label: string; unit: string }[];
import { FALLBACK_MARKETS } from "@/lib/markets";

const ORDER: DimensionKey[] = ["C", "D", "K"];

// Fixed, distinct colors per market -- unlike the pillar/score coloring
// elsewhere in the app (which is deliberately score-based, not identity-based),
// THIS chart's whole purpose is tracking "which line is which country" across
// time, so identity coloring is the correct choice here, not a regression.
const MARKET_COLORS: Record<string, string> = {
  US: "#22D3EE",
  UK: "#F0975B",
  EA: "#E14B4B",
  CA: "#3B82F6",
  JP: "#8B5CF6",
  AU: "#F0609D",
  NO: "#F4C430",
};

export default function ComparePageInner() {
  const { history: liveHistory } = useLiveHistory();
  const marketNames = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
  const allMarketCodes = FALLBACK_MARKETS.map((m) => m.code);

  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(allMarketCodes);

  function toggleMarket(code: string) {
    setSelectedMarkets((prev) => {
      if (prev.includes(code)) {
        // Keep at least one market selected -- an empty chart isn't useful
        // and there's no clear "nothing selected" state designed for these charts.
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  }

  // Union of every year that appears across ALL markets' history (not just
  // selected ones), so the year range doesn't shrink or jump around as you
  // toggle markets on and off.
  const allYears = useMemo(() => {
    const set = new Set<string>();
    allMarketCodes.forEach((code) => (liveHistory[code] ?? []).forEach((h) => set.add(h.year)));
    return Array.from(set).sort();
  }, [allMarketCodes, liveHistory]);

  // null = "track the live range automatically" (the common case -- most
  // visitors never touch these dropdowns). Once live data lands, allYears
  // can gain a new latest year (e.g. once "2026" rolls into "2027"); with a
  // fixed default captured once at mount, that new year would silently
  // never appear in the chart. Deriving the default from allYears on every
  // render keeps it current, while still honoring an explicit user pick.
  const [fromYear, setFromYear] = useState<string | null>(null);
  const [toYear, setToYear] = useState<string | null>(null);
  // An explicit pick only counts if it's still a real year -- the live
  // merge REPLACES each market's last point rather than appending, so a
  // year like "2026" can vanish from allYears the moment live data lands;
  // without this guard a stale pick would resolve to index -1 and collapse
  // the range to a single year instead of falling back to the new default.
  const effectiveFromYear = fromYear && allYears.includes(fromYear) ? fromYear : allYears[0];
  const effectiveToYear = toYear && allYears.includes(toYear) ? toYear : allYears[allYears.length - 1];
  const [selectedDimension, setSelectedDimension] = useState<DimensionKey>("C");
  const [selectedRaw, setSelectedRaw] = useState<(typeof RAW_CHOICES)[number]["key"]>("inflation");
  // Which view the single chart area shows: the dimension's rank against
  // history, or one raw indicator on its own units.
  const [pillarView, setPillarView] = useState<"score" | "raw">("score");

  const yearsInRange = useMemo(() => {
    const fromIdx = allYears.indexOf(effectiveFromYear);
    const toIdx = allYears.indexOf(effectiveToYear);
    return allYears.slice(Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx) + 1);
  }, [allYears, effectiveFromYear, effectiveToYear]);

  // useCallback, not a bare function: this closes over liveHistory and
  // marketNames, and the three useMemos below depend on it. Previously it
  // was omitted from their dependency arrays and the charts recomputed
  // only because yearsInRange happens to change when live data arrives --
  // true today, but nothing enforces it. Now the dependency is explicit.
  const buildSeries = useCallback(
    (valueFn: (raw: RawIndicators, code: string) => number | null): Series[] =>
      selectedMarkets.map((code) => {
        const history = (liveHistory[code] ?? []).filter((h) => yearsInRange.includes(h.year));
        return {
          key: code,
          name: marketNames[code],
          color: MARKET_COLORS[code] ?? "var(--slate)",
          data: history.map((h) => ({ year: h.year, value: valueFn(h.indicators, code) })),
        };
      }),
    [selectedMarkets, liveHistory, yearsInRange, marketNames]
  );

  const compositeSeries = useMemo(
    () => buildSeries((raw, code) => computeMmai(raw, code).percentile),
    [buildSeries]
  );

  // The dimension's own rank against the same 148 market-years the headline
  // uses, so both charts on this page share one scale and one meaning.
  const pillarScoreSeries = useMemo(
    () =>
      buildSeries((raw, code) => {
        const { dimensions } = computeMmai(raw, code);
        return dimensions ? dimensionPercentiles(dimensions)[selectedDimension] : null;
      }),
    [buildSeries, selectedDimension]
  );

  const rawIndicatorSeries = useMemo(
    () => buildSeries((raw) => (raw[selectedRaw] as number | null | undefined) ?? null),
    [buildSeries, selectedRaw]
  );

  // Inflation and policy rate come from live Supabase data now (via
  // useLiveHistory replacing each market's last point), where the two
  // fields are independently nullable -- one source failing doesn't take
  // the other down with it (see app/api/refresh/route.ts's per-indicator
  // settle() calls). A year missing EITHER value can't become a slider
  // frame for that market, so this builds byYear only from years where
  // both are present -- the slider then just shows that market's dot as
  // absent for any other year, same as a real gap, never guessed at.
  const relationshipSeries: TimeSliderSeriesData[] = useMemo(() => {
    return selectedMarkets.map((code) => {
      const history = (liveHistory[code] ?? []).filter((h) => yearsInRange.includes(h.year));
      const byYear = new Map<string, { x: number; y: number }>();
      history.forEach((h) => {
        const { inflation, policyRate } = h.indicators;
        if (inflation == null || policyRate == null) return;
        byYear.set(h.year, { x: inflation, y: policyRate });
      });
      return {
        key: code,
        name: marketNames[code],
        color: MARKET_COLORS[code] ?? "var(--slate)",
        byYear,
      };
    });
  }, [yearsInRange, selectedMarkets, liveHistory, marketNames]);

  // Factual standouts for the header card: highest and lowest current
  // score among the selected markets, and how the rest are distributed
  // across bands. Read straight off the same series the charts plot --
  // no claim beyond what the numbers already say.
  const standouts = useMemo(() => {
    const latest = compositeSeries
      .map((s) => {
        const pts = s.data.filter((d) => d.value !== null);
        const last = pts[pts.length - 1];
        return last ? { name: s.name, value: last.value as number, color: s.color } : null;
      })
      .filter((x): x is { name: string; value: number; color: string } => x !== null)
      .sort((a, b) => b.value - a.value);

    if (latest.length < 2) return [];

    // Markets within this many points are reported as LEVEL, not ranked.
    //
    // Now the measured source-break uncertainty rather than the old
    // five-pillar figure. Rebuilding the entire reference history on a
    // single data source moves any published score by up to 2.3 percentile
    // points; a gap narrower than that is not a gap the data supports
    // naming a leader from. The same constant drives areTied() on the
    // homepage, so the two pages cannot disagree about who is level.
    //
    // This is a DISPLAY rule. It changes no score and no equation.
    const LEVEL_TOLERANCE = SOURCE_BREAK_UNCERTAINTY_PTS;

    const fmtNames = (xs: { name: string }[]) =>
      xs.length === 2
        ? `${xs[0].name} and ${xs[1].name}`
        : xs.slice(0, -1).map((x) => x.name).join(", ") + ` and ${xs[xs.length - 1].name}`;
    const fmtVals = (xs: { value: number }[]) => xs.map((x) => x.value.toFixed(1)).join(", ");

    const top = latest[0];
    const bottom = latest[latest.length - 1];
    const leaders = latest.filter((m) => top.value - m.value <= LEVEL_TOLERANCE);
    const trailers = latest.filter((m) => m.value - bottom.value <= LEVEL_TOLERANCE);
    // Against the historical median, which is what a percentile of 50
    // means. "65 or above" was a threshold on the old 0-100 composite and
    // has no meaning on a rank.
    const supportive = latest.filter((m) => m.value >= 50).length;

    const rows: { text: string; color: string }[] = [];

    rows.push(
      leaders.length > 1
        ? {
            text: `${fmtNames(leaders)} are level at the top (${fmtVals(leaders)}) — too close to separate.`,
            color: top.color,
          }
        : { text: `${top.name} leads at ${top.value.toFixed(1)}.`, color: top.color }
    );

    // Only report the bottom separately if it is not already in the top group.
    if (trailers.length < latest.length) {
      rows.push(
        trailers.length > 1
          ? {
              text: `${fmtNames(trailers)} are level at the bottom (${fmtVals(trailers)}).`,
              color: bottom.color,
            }
          : { text: `${bottom.name} is lowest at ${bottom.value.toFixed(1)}.`, color: bottom.color }
      );
    }

    rows.push({
      text: `${supportive} of ${latest.length} selected markets sit above the historical median.`,
      color: "var(--accent-2)",
    });

    return rows;
  }, [compositeSeries]);

  return (
    <>
      <div className="section">
        <div className="wrap">
          <div className="page-head-row" style={{ marginBottom: 8 }}>
            <div className="section-head">
              <p className="eyebrow">GLOBAL COMPARISON</p>
              {/* h1, not h2 -- this is the page's top-level subject. Every other
                  page has one; without it this page reads to a search engine and
                  a screen reader as sections with no subject. */}
              <h1>Compare Markets Over Time</h1>
              <p>Track how the MMAI score and its three dimensions evolve across major economies.</p>
            </div>

            {/* "What stands out now" (brief §9). Deliberately factual --
                who leads, who trails, how many sit in each band -- read
                straight off the same scores the charts below plot. It
                summarises rather than interpreting or advising. */}
            {standouts.length > 0 && (
              <div className="insight-card">
                <h3>
                  <span aria-hidden="true" style={{ color: "var(--accent-2)" }}>◈</span>
                  What stands out now
                </h3>
                <ul>
                  {standouts.map((s) => (
                    <li key={s.text}>
                      <i style={{ background: s.color }} />
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "20px 0 28px" }}>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)" }}>From</span>
            <select value={effectiveFromYear} onChange={(e) => setFromYear(e.target.value)} style={selectStyle}>
              {allYears.map((y) => <option key={y} value={y} style={optionStyle}>{y}</option>)}
            </select>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)" }}>to</span>
            <select value={effectiveToYear} onChange={(e) => setToYear(e.target.value)} style={selectStyle}>
              {allYears.map((y) => <option key={y} value={y} style={optionStyle}>{y}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)", marginBottom: 10 }}>
              MARKETS ({selectedMarkets.length} of {allMarketCodes.length} shown)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {allMarketCodes.map((code) => {
                const active = selectedMarkets.includes(code);
                const color = MARKET_COLORS[code] ?? "var(--slate)";
                return (
                  <button
                    key={code}
                    onClick={() => toggleMarket(code)}
                    aria-pressed={active}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: active ? `1px solid ${color}` : "1px solid var(--hair)",
                      background: active ? `${color}22` : "transparent",
                      color: active ? "#fff" : "var(--slate)",
                      boxShadow: active ? `0 0 12px -4px ${color}` : "none",
                    }}
                  >
                    <i style={{ width: 8, height: 8, borderRadius: "50%", background: active ? color : "var(--hair)" }} />
                    <Flag code={code} size={16} />
                    {marketNames[code]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chart-card" style={{ marginBottom: 8 }}>
            <div className="chart-card-label">
              1. Composite MMAI score over time
              <span className="meta-label" style={{ marginLeft: "auto", border: "1px solid var(--hair)", borderRadius: 999, padding: "3px 9px" }}>
                Annual
              </span>
            </div>
            <TrendChart series={compositeSeries} height={340} yDomain={[0, 100]} showDots={false} />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">2. EXPLORE BY DIMENSION</p>
            <h2>Pick a dimension to compare</h2>
            <p>
              Each line is that dimension&rsquo;s rank against the same 148 market-years the headline
              uses. Switch to the raw view for the underlying indicator on its own units.
            </p>
          </div>

          <div className="selector-row">
            {pillarView === "score"
              ? ORDER.map((key) => (
                  <button
                    key={key}
                    className={`selector-btn${selectedDimension === key ? " active" : ""}`}
                    onClick={() => setSelectedDimension(key)}
                    aria-pressed={selectedDimension === key}
                  >
                    {DIMENSION_NAMES[key]}
                  </button>
                ))
              : RAW_CHOICES.map((c) => (
                  <button
                    key={c.key}
                    className={`selector-btn${selectedRaw === c.key ? " active" : ""}`}
                    onClick={() => setSelectedRaw(c.key)}
                    aria-pressed={selectedRaw === c.key}
                  >
                    {c.label}
                  </button>
                ))}
          </div>

          {/* ONE chart at a time (brief §11), not two stacked. The
              pillar score and its underlying raw rate are different
              scales -- a 0-100 score vs a percentage -- so they get a
              toggle rather than being forced onto one axis, which would
              be exactly the "incompatible scales shown as if identical"
              the brief warns against. */}
          <div className="chart-card">
            <div className="chart-card-label">
              {pillarView === "score"
                ? `${DIMENSION_NAMES[selectedDimension]} — rank against history (0–100)`
                : `${RAW_CHOICES.find((c) => c.key === selectedRaw)!.label} (raw)`}
              <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                {(["score", "raw"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setPillarView(v)}
                    aria-pressed={pillarView === v}
                    style={{
                      padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                      fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700,
                      letterSpacing: 0.5, textTransform: "uppercase",
                      border: pillarView === v ? "1px solid var(--accent-2)" : "1px solid var(--hair)",
                      background: pillarView === v ? "rgba(139,92,246,0.18)" : "transparent",
                      color: pillarView === v ? "#fff" : "var(--slate)",
                    }}
                  >
                    {v === "score" ? "Dimension rank" : "Raw rate"}
                  </button>
                ))}
              </span>
            </div>
            {pillarView === "score" ? (
              <TrendChart series={pillarScoreSeries} height={340} yDomain={[0, 100]} showDots={false} />
            ) : (
              <TrendChart series={rawIndicatorSeries} height={340} yLabel={RAW_CHOICES.find((c) => c.key === selectedRaw)!.unit} showDots={false} />
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">3. HOW EACH MARKET IS POSITIONED</p>
            <h2>Inflation against policy rate</h2>
            <p>
              Drag the slider to move through the selected year range and watch each market&apos;s position change.
              Same markets and years as above.
            </p>
          </div>
          <div className="chart-card">
            <TimeSliderScatter series={relationshipSeries} years={yearsInRange} xLabel="Inflation (%)" yLabel="Policy rate (%)" height={380} />
          </div>

        </div>
      </div>
    </>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#12121A", // solid, not translucent -- native <option> lists often
                          // ignore rgba/transparent backgrounds on the parent
                          // <select> and fall back to a jarring default, which
                          // is what caused the reported color problem.
  color: "#F5F6FA",
  fontSize: 13,
  fontFamily: "IBM Plex Mono, monospace",
  cursor: "pointer",
};

const optionStyle: React.CSSProperties = {
  background: "#12121A",
  color: "#F5F6FA",
};
