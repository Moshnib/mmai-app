"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import Flag from "@/components/Flag";
import { useLiveHistory } from "@/lib/useLiveHistory";
import { PILLAR_NAMES, RAW_FIELD, computePillarScores, computeComposite, type PillarKey, type PillarScores, type RawIndicators } from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

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
  const [selectedPillar, setSelectedPillar] = useState<PillarKey>("PS");

  const yearsInRange = useMemo(() => {
    const fromIdx = allYears.indexOf(effectiveFromYear);
    const toIdx = allYears.indexOf(effectiveToYear);
    return allYears.slice(Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx) + 1);
  }, [allYears, effectiveFromYear, effectiveToYear]);

  function buildSeries(valueFn: (pillars: PillarScores, raw: RawIndicators) => number | null): Series[] {
    return selectedMarkets.map((code) => {
      const history = (liveHistory[code] ?? []).filter((h) => yearsInRange.includes(h.year));
      return {
        key: code,
        name: marketNames[code],
        color: MARKET_COLORS[code] ?? "#9296AB",
        data: history.map((h) => {
          const pillars = computePillarScores(h.indicators);
          return { year: h.year, value: valueFn(pillars, h.indicators) };
        }),
      };
    });
  }

  const compositeSeries = useMemo(
    () => buildSeries((pillars) => computeComposite(pillars).composite),
    [yearsInRange, selectedMarkets]
  );

  const pillarScoreSeries = useMemo(
    () => buildSeries((pillars) => pillars[selectedPillar]),
    [yearsInRange, selectedPillar, selectedMarkets]
  );

  const rawIndicatorSeries = useMemo(
    () => buildSeries((_pillars, raw) => raw[RAW_FIELD[selectedPillar].key] ?? null),
    [yearsInRange, selectedPillar, selectedMarkets]
  );

  return (
    <>
      <nav>
        <div className="wrap navbar">
          <Link href="/" className="brand" style={{ textDecoration: "none" }}>
            <span className="dot" /> MMAI
          </Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <button className="navlink active">Compare Markets</button>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
          </div>
        </div>
      </nav>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">ALL MARKETS, SIDE BY SIDE</p>
            <h2>Compare Markets Over Time</h2>
            <p>See how every market's score, pillar, and underlying rate moved against each other — pick a year range, then a pillar.</p>
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
                const color = MARKET_COLORS[code] ?? "#9296AB";
                return (
                  <button
                    key={code}
                    onClick={() => toggleMarket(code)}
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

          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", marginBottom: 8, backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 10 }}>
              COMPOSITE MMAI SCORE
            </div>
            <TrendChart series={compositeSeries} height={340} yDomain={[0, 100]} showDots={false} />
          </div>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">BY PILLAR</p>
            <h2>Pick a pillar to compare</h2>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {ORDER.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedPillar(key)}
                style={{
                  padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: selectedPillar === key ? "1px solid var(--gold)" : "1px solid var(--hair)",
                  background: selectedPillar === key ? "linear-gradient(135deg, var(--gold-deep), #6D28D9)" : "transparent",
                  color: selectedPillar === key ? "#fff" : "var(--slate)",
                }}
              >
                {PILLAR_NAMES[key]}
              </button>
            ))}
          </div>

          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", marginBottom: 20, backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 10 }}>
              {PILLAR_NAMES[selectedPillar].toUpperCase()} — PILLAR SCORE (0–100)
            </div>
            <TrendChart series={pillarScoreSeries} height={320} yDomain={[0, 100]} showDots={false} />
          </div>

          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 10 }}>
              {RAW_FIELD[selectedPillar].label.toUpperCase()} — RAW RATE
            </div>
            <TrendChart series={rawIndicatorSeries} height={320} yLabel={RAW_FIELD[selectedPillar].unit} showDots={false} />
          </div>
        </div>
      </div>

      <footer>
        <div className="wrap">
          © 2026 MMAI — Moshnib Market Analysis Index. An analytical communication tool, not investment advice.
        </div>
      </footer>
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
