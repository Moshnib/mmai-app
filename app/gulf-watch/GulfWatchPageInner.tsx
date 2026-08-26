"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import GulfCard, { type GulfCardData } from "@/components/GulfCard";
import GulfTrends from "@/components/GulfTrends";

interface GulfRow {
  country_code: string;
  cpi_yoy: number | null;
  real_estate_value: number | null;
  real_estate_metric_label: string | null;
  fx_reserves_months_imports: number | null;
  current_account_pct_gdp: number | null;
  observation_date: string;
  fetched_at: string;
}

export default function GulfWatchPageInner() {
  const [countries, setCountries] = useState<GulfCardData[]>(
    GULF_COUNTRIES.map((c) => ({
      code: c.code,
      name: c.name,
      cpiYoy: null,
      realEstateValue: null,
      realEstateMetricLabel: null,
      fxReservesMonthsImports: null,
      currentAccountPctGdp: null,
      fetchedAt: null,
    }))
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("gulf_indicators")
          .select(
            "country_code, cpi_yoy, real_estate_value, real_estate_metric_label, fx_reserves_months_imports, current_account_pct_gdp, observation_date, fetched_at"
          )
          // Sort by fetched_at ONLY, not observation_date first: unlike
          // raw_indicators (one market, one shared reporting period per
          // run), a Gulf Watch row blends three pillars with genuinely
          // different natural dates (CPI's actual reporting month vs. a
          // fallback to "today" when a fetch fails). A failed run's fake
          // "today" observation_date would otherwise sort ahead of a real,
          // earlier-dated successful run -- confirmed this actually
          // happened against live data before this fix. fetched_at is the
          // one field that unambiguously means "when we last wrote this."
          .order("fetched_at", { ascending: false })
          .limit(60); // 6 countries x recent refreshes -- same headroom pattern as raw_indicators' 200-row cap
        if (error || !data) return;

        const latestByCountry = new Map<string, GulfRow>();
        for (const row of data as GulfRow[]) {
          if (!latestByCountry.has(row.country_code)) latestByCountry.set(row.country_code, row);
        }

        setCountries(
          GULF_COUNTRIES.map((c) => {
            const row = latestByCountry.get(c.code);
            if (!row) return { code: c.code, name: c.name, cpiYoy: null, realEstateValue: null, realEstateMetricLabel: null, fxReservesMonthsImports: null, currentAccountPctGdp: null, fetchedAt: null };
            return {
              code: c.code,
              name: c.name,
              cpiYoy: row.cpi_yoy,
              realEstateValue: row.real_estate_value,
              realEstateMetricLabel: row.real_estate_metric_label,
              fxReservesMonthsImports: row.fx_reserves_months_imports,
              currentAccountPctGdp: row.current_account_pct_gdp,
              fetchedAt: row.fetched_at,
            };
          })
        );
      } catch {
        // Unreachable -- cards fall back to their "—" empty state.
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <button className="navlink active">Gulf Watch</button>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn More</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
            <Link href="/contact" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Contact</Link>
          </div>
        </div>
      </nav>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">SIX MORE COUNTRIES, SHOWN HONESTLY</p>
            <h1>Gulf Watch</h1>
            <p style={{ maxWidth: "68ch" }}>
              UAE, Bahrain, Qatar, Saudi Arabia, Kuwait, and Oman — real, live data on cost of living, investment
              confidence, and currency stability. None of these six get an MMAI composite score: a usable policy-rate
              source doesn&apos;t exist for any of them yet, and MMAI would rather show &quot;N/A&quot; than a score
              built on a gap. Every figure below is fetched daily and traced back to its source on the{" "}
              <Link href="/sources" style={{ color: "var(--gold-deep)" }}>Sources</Link> page, same as everywhere
              else on the site.
            </p>
          </div>

          <div className="compare-grid" style={{ opacity: loaded ? 1 : 0.5, transition: "opacity 0.3s ease" }}>
            {countries.map((c) => (
              <GulfCard key={c.code} country={c} />
            ))}
          </div>
        </div>
      </div>

      <GulfTrends />
    </>
  );
}
