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

// ============================================================
//  WHEN A SOURCE IS DOWN ALL DAY, SHOW ITS LAST FIGURE, MARKED
//
//  Every refresh retries a missed Observatory figure within the day
//  (lib/observatory.ts, fillFromEarlier). A source down ALL day -- or on
//  the first run, with nothing earlier that day -- still left an N/A.
//  Gulf Watch already solves exactly this at read time
//  (lib/gulfCarryForward.ts), and the same three rules apply here:
//
//    the figure keeps ITS OWN date, never today's
//    it is listed as carried, and the page says so
//    it expires after MAX_OBSERVATORY_CARRY_DAYS: a dead source is a gap
//
//  Read time, never written back: a carried copy stored as a new row
//  would be read the next day as if fetched, and the bound would measure
//  the age of the copy and never expire.
// ============================================================

export const MAX_OBSERVATORY_CARRY_DAYS = 14;

const CARRIED: Array<{ value: keyof ObservatoryRow; date: keyof ObservatoryRow; name: string }> = [
  { value: "inflation", date: "inflation_observation_date", name: "inflation" },
  { value: "unemployment", date: "unemployment_observation_date", name: "unemployment" },
  { value: "gdp_growth", date: "gdp_observation_date", name: "GDP growth" },
  { value: "policy_rate", date: "policy_rate_observation_date", name: "policy rate" },
  { value: "yield_10y", date: "yield_observation_date", name: "ten-year yield" },
  { value: "debt_pct_gdp", date: "debt_observation_period", name: "government debt" },
];

export type ObservatoryShown = ObservatoryRow & { carried: string[] };

/** The newest row for one country with each missing figure taken, with
 *  its date, from the most recent row inside the bound that had it.
 *  `rows` is that country's rows, newest first. */
export function carryForwardObservatory(rows: readonly ObservatoryRow[], now: number): ObservatoryShown | null {
  const [newest, ...older] = rows;
  if (!newest) return null;
  const out: Record<string, unknown> = { ...newest };
  const carried: string[] = [];
  for (const f of CARRIED) {
    if (out[f.value] != null) continue;
    for (const row of older) {
      // Measured against the row actually used, so a country written
      // every day cannot keep a long-dead figure alive.
      const age = (now - Date.parse(row.fetched_at)) / 86_400_000;
      if (!Number.isFinite(age) || age > MAX_OBSERVATORY_CARRY_DAYS) break;
      if (row[f.value] == null || row[f.date] == null) continue; // a value without its date is not usable
      out[f.value] = row[f.value];
      out[f.date] = row[f.date];
      carried.push(f.name);
      break;
    }
  }
  return { ...(out as unknown as ObservatoryRow), carried };
}

export async function fetchObservatoryRows(): Promise<Map<string, ObservatoryShown>> {
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
  // Each country's full history in the same order newestByCountry uses,
  // so the row shown first is the same row it would have picked.
  const now = Date.now();
  const out = new Map<string, ObservatoryShown>();
  for (const code of byCountry.keys()) {
    const history = rows
      .filter((r) => r.country_code === code)
      .sort((a, b) =>
        a.observation_date !== b.observation_date
          ? (a.observation_date < b.observation_date ? 1 : -1)
          : (a.fetched_at < b.fetched_at ? 1 : -1),
      );
    const shown = carryForwardObservatory(history, now);
    if (shown) out.set(code, shown);
  }
  return out;
}
