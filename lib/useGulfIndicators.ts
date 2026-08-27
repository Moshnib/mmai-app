"use client";

import { useEffect, useState } from "react";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import type { GulfCardData } from "@/components/GulfCard";
import { STALE_THRESHOLD_MS } from "@/lib/constants";

function isStaleFetch(fetchedAt: string | null): boolean {
  return !fetchedAt || Date.now() - new Date(fetchedAt).getTime() > STALE_THRESHOLD_MS;
}

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

function emptyCountries(): GulfCardData[] {
  return GULF_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    cpiYoy: null,
    realEstateValue: null,
    realEstateMetricLabel: null,
    fxReservesMonthsImports: null,
    currentAccountPctGdp: null,
    fetchedAt: null,
    isStale: true, // no data fetched yet
  }));
}

/** Shared by /gulf-watch and the homepage's Gulf Watch section -- extracted
 *  rather than duplicated, so both read the exact same live data the exact
 *  same way. Four details here are load-bearing, not stylistic choices:
 *  - fetched_at-only ordering (never observation_date first) is a shipped
 *    bug fix -- a failed fetch's fallback "today" observation_date used to
 *    sort ahead of real, earlier-dated successful data.
 *  - .limit(60) -- 6 countries x recent refreshes, same headroom pattern
 *    used for raw_indicators elsewhere.
 *  - setLoaded(true) in `finally`, so it fires even when
 *    NEXT_PUBLIC_SUPABASE_URL is unset and the effect returns early.
 *  - initial state is all 6 countries mapped to null, not an empty array. */
export function useGulfIndicators(): { countries: GulfCardData[]; loaded: boolean } {
  const [countries, setCountries] = useState<GulfCardData[]>(() => emptyCountries());
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
          .order("fetched_at", { ascending: false })
          .limit(60);
        if (error || !data) return;

        const latestByCountry = new Map<string, GulfRow>();
        for (const row of data as GulfRow[]) {
          if (!latestByCountry.has(row.country_code)) latestByCountry.set(row.country_code, row);
        }

        setCountries(
          GULF_COUNTRIES.map((c) => {
            const row = latestByCountry.get(c.code);
            if (!row) return { code: c.code, name: c.name, cpiYoy: null, realEstateValue: null, realEstateMetricLabel: null, fxReservesMonthsImports: null, currentAccountPctGdp: null, fetchedAt: null, isStale: true };
            return {
              code: c.code,
              name: c.name,
              cpiYoy: row.cpi_yoy,
              realEstateValue: row.real_estate_value,
              realEstateMetricLabel: row.real_estate_metric_label,
              fxReservesMonthsImports: row.fx_reserves_months_imports,
              currentAccountPctGdp: row.current_account_pct_gdp,
              fetchedAt: row.fetched_at,
              // Computed here, at fetch time inside an effect, not in
              // GulfCard's render body -- Date.now() during render is an
              // impure call the react-hooks/purity rule flags.
              isStale: isStaleFetch(row.fetched_at),
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

  return { countries, loaded };
}
