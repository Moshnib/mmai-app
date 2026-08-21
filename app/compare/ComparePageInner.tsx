"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import TrendChart, { type Series } from "@/components/TrendChart";
import { HISTORY } from "@/lib/history";
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
  const marketNames = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
  const marketCodes = FALLBACK_MARKETS.map((m) => m.code);

  // Union of every year that appears across all markets' history, sorted.
  // Not assumed to be a continuous range -- the real dataset jumps from
  // 2024 straight to 2026 (this year's live snapshot), no fabricated 2025.
  const allYears = useMemo(() => {
    const set = new Set<string>();
    marketCodes.forEach((code) => (HISTORY[code] ?? []).forEach((h) => set.add(h.year)));
    return Array.from(set).sort();
  }, [marketCodes]);

  const [fromYear, setFromYear] = useState(allYears[0]);
  const [toYear, setToYear] = useState(allYears[allYears.length - 1]);
  const [selectedPillar, setSelectedPillar] = useState<PillarKey>("PS");

  const yearsInRange = useMemo(() => {
    const fromIdx = allYears.indexOf(fromYear);
    const toIdx = allYears.indexOf(toYear);
    return allYears.slice(Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx) + 1);
  }, [allYears, fromYear, toYear]);

  function buildSeries(valueFn: (pillars: PillarScores, raw: RawIndicators) => number | null): Series[] {
    return marketCodes.map((code) => {
      const history = (HISTORY[code] ?? []).filter((h) => yearsInRange.includes(h.year));
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
    [yearsInRange]
  );

  const pillarScoreSeries = useMemo(
    () => buildSeries((pillars) => pillars[selectedPillar]),
    [yearsInRange, selectedPillar]
  );

  const rawIndicatorSeries = useMemo(
    () => buildSeries((_pillars, raw) => raw[RAW_FIELD[selectedPillar].key] ?? null),
    [yearsInRange, selectedPillar]
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
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)" }}>YEAR RANGE:</span>
            <select value={fromYear} onChange={(e) => setFromYear(e.target.value)} style={selectStyle}>
              {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ color: "var(--slate)" }}>→</span>
            <select value={toYear} onChange={(e) => setToYear(e.target.value)} style={selectStyle}>
              {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", marginBottom: 8, backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 10 }}>
              COMPOSITE MMAI SCORE
            </div>
            <TrendChart series={compositeSeries} height={320} yDomain={[0, 100]} />
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
            <TrendChart series={pillarScoreSeries} height={300} yDomain={[0, 100]} />
          </div>

          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "24px 28px", backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 10 }}>
              {RAW_FIELD[selectedPillar].label.toUpperCase()} — RAW RATE
            </div>
            <TrendChart series={rawIndicatorSeries} height={300} yLabel={RAW_FIELD[selectedPillar].unit} />
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
  padding: "6px 12px", borderRadius: 8, border: "1px solid var(--hair)",
  background: "rgba(255,255,255,0.04)", color: "var(--ink)", fontSize: 13, fontFamily: "IBM Plex Mono, monospace",
};
