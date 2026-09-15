// ============================================================
//  READING THE OBSERVATORY
//
//  One helper, used by the page, so there is a single place that knows
//  how "the current row for a country" is decided. This project has
//  twice paid for two components answering the same question
//  differently — two market colour maps that disagreed on five of six
//  markets, and two scoring paths.
// ============================================================

import { getPublicSupabaseClient } from "@/lib/supabase";
import { OBSERVATORY_CODES, type ObservatoryRow } from "@/lib/observatory";

/** The newest row per country.
 *
 *  Ordered by observation_date then fetched_at, matching the pages that
 *  read raw_indicators. Both matter: the first decides which day wins,
 *  the second which run within that day — a re-run after fixing a source
 *  must beat the broken reading it replaced, not lose to it. */
export function newestByCountry(rows: ObservatoryRow[]): Map<string, ObservatoryRow> {
  const out = new Map<string, ObservatoryRow>();
  const sorted = [...rows].sort((a, b) => {
    if (a.observation_date !== b.observation_date) return a.observation_date < b.observation_date ? 1 : -1;
    return a.fetched_at < b.fetched_at ? 1 : -1;
  });
  for (const r of sorted) if (!out.has(r.country_code)) out.set(r.country_code, r);
  return out;
}

export async function fetchObservatoryRows(): Promise<Map<string, ObservatoryRow>> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from("observatory_indicators")
    .select(
      "country_code, inflation, gdp_growth, unemployment, policy_rate, debt_pct_gdp, yield_10y, " +
        "inflation_observation_date, gdp_observation_date, unemployment_observation_date, " +
        "policy_rate_observation_date, debt_observation_period, yield_observation_date, " +
        "observation_date, fetched_at, source_note",
    )
    .order("observation_date", { ascending: false })
    .order("fetched_at", { ascending: false })
    // Generous: a handful of countries at one row per refresh, three
    // refreshes a day. 200 is weeks of reach even after a force-run.
    .limit(200);

  if (error) throw new Error(error.message);
  // Through unknown, because the generated Supabase types are built from
  // the live schema and observatory_indicators is newer than they are.
  // The shape is pinned by ObservatoryRow and by the .select() above.
  // That exact select was run against the live table on 2026-09-15 before
  // this shipped, because a mistyped column name here would not error --
  // it would silently blank every figure on the page.
  const rows = (data ?? []) as unknown as ObservatoryRow[];
  // A country in the registry with no row yet is absent from the map,
  // and the page renders it as awaiting its first reading rather than
  // pretending it has one.
  const byCountry = newestByCountry(rows.filter((r) => OBSERVATORY_CODES.includes(r.country_code)));
  return byCountry;
}
