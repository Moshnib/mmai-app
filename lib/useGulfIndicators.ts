"use client";

import { useEffect, useState } from "react";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import type { GulfCardData } from "@/components/GulfCard";
import { carryForwardGulf, MAX_GULF_CARRY_DAYS } from "@/lib/gulfCarryForward";
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
  cpi_observation_date: string | null;
  real_estate_observation_date: string | null;
  fx_reserves_observation_date: string | null;
  current_account_observation_date: string | null;
  policy_rate: number | null;
  policy_rate_label: string | null;
  policy_rate_observation_date: string | null;
  fetched_at: string;
}

/** The camelCase view of a row that carryForwardGulf fills in. Field
 *  names must match CARRIED_FIELDS in lib/gulfCarryForward.ts -- that
 *  module is keyed by them. */
interface FreshView {
  cpiYoy: number | null;
  cpiObservationDate: string | null;
  fxReservesMonths: number | null;
  fxReservesObservationDate: string | null;
  currentAccountPctGdp: number | null;
  currentAccountObservationDate: string | null;
  realEstateValue: number | null;
  realEstateMetricLabel: string | null;
  realEstateObservationDate: string | null;
  policyRate: number | null;
  policyRateLabel: string | null;
  policyRateObservationDate: string | null;
}

function viewOf(row: GulfRow): FreshView {
  return {
    cpiYoy: row.cpi_yoy,
    // The legacy shared date is the fallback ONLY for rows written
    // before the per-field columns existed. It is applied here, before
    // carry-forward runs, so a row that genuinely has no usable period
    // is skipped rather than carried and then stamped with today.
    cpiObservationDate: row.cpi_observation_date ?? row.observation_date ?? null,
    fxReservesMonths: row.fx_reserves_months_imports,
    fxReservesObservationDate: row.fx_reserves_observation_date,
    currentAccountPctGdp: row.current_account_pct_gdp,
    currentAccountObservationDate: row.current_account_observation_date,
    realEstateValue: row.real_estate_value,
    realEstateMetricLabel: row.real_estate_metric_label,
    realEstateObservationDate: row.real_estate_observation_date,
    policyRate: row.policy_rate,
    policyRateLabel: row.policy_rate_label,
    policyRateObservationDate: row.policy_rate_observation_date,
  };
}

function emptyCountries(): GulfCardData[] {
  return GULF_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    carriedFields: [],
    cpiYoy: null,
    realEstateValue: null,
    realEstateMetricLabel: null,
    fxReservesMonthsImports: null,
    currentAccountPctGdp: null,
    cpiObservationDate: null,
    realEstateObservationDate: null,
    fxReservesObservationDate: null,
    currentAccountObservationDate: null,
    policyRate: null,
    policyRateLabel: null,
    policyRateObservationDate: null,
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
            "country_code, cpi_yoy, real_estate_value, real_estate_metric_label, fx_reserves_months_imports, current_account_pct_gdp, observation_date, cpi_observation_date, real_estate_observation_date, fx_reserves_observation_date, current_account_observation_date, policy_rate, policy_rate_label, policy_rate_observation_date, fetched_at"
          )
          .order("fetched_at", { ascending: false })
          // ENOUGH ROWS TO REACH THE CARRY BOUND. One row per country
          // per day, so 60 was ten days for six countries -- less than
          // MAX_GULF_CARRY_DAYS, which would have capped the real
          // fallback window below its stated fourteen and expired values
          // early without saying so. Six countries times the bound, plus
          // headroom for the days a manual ?force=1 writes a second row.
          .limit(GULF_COUNTRIES.length * (MAX_GULF_CARRY_DAYS + 6));
        if (error || !data) return;

        // CARRY-FORWARD HAPPENS HERE, not in the refresh job.
        //
        // It used to run before the write, and the merged result was
        // stored as a new row -- which the next run read back and
        // carried again, so the fourteen-day bound measured the age of a
        // copy and never expired anything. A dead source published for
        // ever. Filling gaps at read time means the stored rows stay an
        // honest record of what each source returned, so the bound
        // measures the real age of the real observation. It is also
        // where the six scored markets already do theirs
        // (lib/latestComplete.ts).
        const historyByCountry = new Map<string, GulfRow[]>();
        for (const row of data as GulfRow[]) {
          const list = historyByCountry.get(row.country_code);
          if (list) list.push(row);
          else historyByCountry.set(row.country_code, [row]);
        }

        const viewByCountry = new Map<string, FreshView>();
        const rowByCountry = new Map<string, GulfRow>();
        const carriedByCountry = new Map<string, string[]>();
        for (const [code, rows] of historyByCountry) {
          // Newest first, from the query's own ordering. The newest row
          // is what this country last fetched; everything after it is
          // history to fill gaps from.
          const { merged, carried } = carryForwardGulf(viewOf(rows[0]), rows.slice(1), new Date());
          viewByCountry.set(code, merged);
          rowByCountry.set(code, rows[0]);
          carriedByCountry.set(code, carried);
        }

        setCountries(
          GULF_COUNTRIES.map((c) => {
            const row = rowByCountry.get(c.code);
            const view = viewByCountry.get(c.code);
            if (!row || !view) {
              return {
                code: c.code, name: c.name, cpiYoy: null, realEstateValue: null, realEstateMetricLabel: null,
                fxReservesMonthsImports: null, currentAccountPctGdp: null,
                cpiObservationDate: null, realEstateObservationDate: null,
                fxReservesObservationDate: null, currentAccountObservationDate: null,
                policyRate: null, policyRateLabel: null, policyRateObservationDate: null,
                fetchedAt: null, isStale: true, carriedFields: [],
              };
            }
            return {
              code: c.code,
              name: c.name,
              // From the carried view, so a source that failed this run
              // still shows its last real reading WITH that reading's own
              // period. carriedFields below names anything filled this way.
              cpiYoy: view.cpiYoy,
              realEstateValue: view.realEstateValue,
              realEstateMetricLabel: view.realEstateMetricLabel,
              fxReservesMonthsImports: view.fxReservesMonths,
              currentAccountPctGdp: view.currentAccountPctGdp,
              // Older rows (written before this column existed) have
              // null here even though the row itself has a real CPI
              // value -- falling back to the legacy shared
              // observation_date keeps those cards showing a real date
              // instead of "date unknown" until the next refresh
              // overwrites them with the real, field-specific one.
              cpiObservationDate: view.cpiObservationDate,
              realEstateObservationDate: view.realEstateObservationDate,
              fxReservesObservationDate: view.fxReservesObservationDate,
              currentAccountObservationDate: view.currentAccountObservationDate,
              policyRate: view.policyRate,
              policyRateLabel: view.policyRateLabel,
              policyRateObservationDate: view.policyRateObservationDate,
              carriedFields: carriedByCountry.get(c.code) ?? [],
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
