"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Gauge from "@/components/Gauge";
import PillarGrid from "@/components/PillarGrid";
import CompareGrid from "@/components/CompareGrid";
import Heatmap from "@/components/Heatmap";
import Sparkline from "@/components/Sparkline";
import WorldMap from "@/components/WorldMap";
import SubscribeForm from "@/components/SubscribeForm";
import Flag from "@/components/Flag";
import { narrativeDrivers, PILLAR_NAMES, TOTAL_PILLARS } from "@/lib/scoring";
import { FALLBACK_MARKETS, scoreMarket, type MarketData } from "@/lib/markets";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { RawIndicatorRow } from "@/lib/useLiveHistory";
import { sourcesForMarket } from "@/lib/sources";

function latestVerifiedDate(marketName: string): string {
  const entries = sourcesForMarket(marketName);
  if (entries.length === 0) return "—";
  return entries.reduce((latest, e) => (e.lastVerified > latest ? e.lastVerified : latest), entries[0].lastVerified);
}

function narrativeFor(market: MarketData): string {
  const { pillars, coveragePillars, coverage } = scoreMarket(market);
  const drivers = narrativeDrivers(pillars);
  if (coverage < 0.7 || !drivers) {
    return `${market.name} currently has only ${coveragePillars} of ${TOTAL_PILLARS} structural pillars populated (${(coverage * 100).toFixed(1)}% coverage), below the 70% publication threshold. Rather than compute a score from incomplete data, MMAI shows N/A.`;
  }
  const bestVal = pillars[drivers.best]!;
  const worstVal = pillars[drivers.worst]!;
  return `${market.name}'s strongest pillar right now is ${PILLAR_NAMES[drivers.best]} (${bestVal.toFixed(1)}), while ${PILLAR_NAMES[drivers.worst]} (${worstVal.toFixed(1)}) is doing the most to hold the composite back.`;
}

export default function OverviewPage() {
  const [markets, setMarkets] = useState<MarketData[]>(FALLBACK_MARKETS);
  const [current, setCurrent] = useState("US");
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    async function loadLiveData() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return; // not configured yet — stay on fallback
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("raw_indicators")
          .select("market, inflation, gdp_growth, unemployment, policy_rate, brent_yoy, observation_date")
          .order("observation_date", { ascending: false })
          .order("fetched_at", { ascending: false }) // tiebreak same-day reruns -- deterministic "latest", not arbitrary
          .limit(200); // 6 markets x daily refreshes; see lib/useLiveHistory.ts for the same limit and why
        if (error || !data || data.length === 0) return;

        const latestByMarket = new Map<string, RawIndicatorRow>();
        for (const row of data as RawIndicatorRow[]) {
          if (!latestByMarket.has(row.market)) latestByMarket.set(row.market, row);
        }

        const live: MarketData[] = FALLBACK_MARKETS.map((m) => {
          const row = latestByMarket.get(m.code);
          if (!row) return m; // keep fallback for markets not yet in the database
          return {
            ...m,
            raw: {
              inflation: row.inflation,
              gdpGrowth: row.gdp_growth,
              unemployment: row.unemployment,
              policyRate: row.policy_rate,
              brentYoY: row.brent_yoy,
            },
          };
        });
        setMarkets(live);
        setDataSource("live");
      } catch {
        // Supabase not reachable / not configured — silently stay on fallback.
      }
    }
    loadLiveData();
  }, []);

  const market = markets.find((m) => m.code === current)!;
  const { pillars, composite, coveragePillars } = scoreMarket(market);

  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <button className="navlink active">Overview</button>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">
            MOSHNIB MARKET ANALYSIS INDEX · {dataSource === "live" ? "LIVE DATA" : "DEMO DATA — CONNECT SUPABASE FOR LIVE VALUES"}
          </p>
          <h1 className="headline">Is today&apos;s macro environment supportive, or working against you?</h1>
          <p className="sub">One transparent number, built entirely from licensed public data — with every formula, weight, and source open for anyone to check.</p>

          <div className="tabs">
            {markets.map((m) => (
              <button
                key={m.code}
                className={`tab${m.code === current ? " active" : ""}`}
                onClick={() => setCurrent(m.code)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Flag code={m.code} size={18} /> {m.name}
              </button>
            ))}
          </div>

          <div className="score-panel">
            <Gauge score={composite} />
            <div className="score-right">
              <h2>{market.name}</h2>
              <p className="score-narrative">{narrativeFor(market)}</p>
              <div className="meta-row" style={{ marginBottom: 16 }}>
                <span>Coverage: <b>{((coveragePillars / TOTAL_PILLARS) * 100).toFixed(1)}%</b></span>
                <span>Pillars active: <b>{coveragePillars} of {TOTAL_PILLARS}</b></span>
                <span>Sources verified: <b>{latestVerifiedDate(market.name)}</b> · <Link href="/sources" style={{ color: "var(--gold-deep)" }}>view all</Link></span>
              </div>
              <Sparkline marketCode={current} currentScore={composite} />
              <Link
                href="/learn#topic-mmai"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
                  fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700,
                  color: "var(--gold)", textDecoration: "none", padding: "7px 14px",
                  border: "1px solid rgba(34,211,238,0.35)", borderRadius: 999, background: "rgba(34,211,238,0.08)",
                }}
              >
                Σ How is this score calculated? →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">THE COMPOSITE, OPENED UP</p>
            <h2>Five pillars, weighted and shown in full</h2>
            <p>Every ring below is a real 0–100 pillar score computed from the raw indicator behind it — visit the Learn page for what each one means.</p>
          </div>
          <PillarGrid pillars={pillars} market={current} />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">CROSS-MARKET VIEW</p>
            <h2>How the five markets compare today</h2>
          </div>
          <CompareGrid markets={markets} current={current} onSelect={setCurrent} />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">EVERY MARKET, EVERY PILLAR, AT A GLANCE</p>
            <h2>The MMAI Heat Map</h2>
            <p>Click a country on the map or a row below to jump straight to that market.</p>
          </div>
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <WorldMap markets={markets} current={current} onSelect={setCurrent} />
          </div>
          <Heatmap markets={markets} />
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <SubscribeForm />
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
