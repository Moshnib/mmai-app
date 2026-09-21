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

/** Newest first: observation_date, then fetched_at. Both matter -- the
 *  first decides which day wins, the second which run within that day, so
 *  a re-run after fixing a source beats the broken reading it replaced.
 *  THE one ordering for "which row is current"; there used to be two. */
export function byNewestFirst(a: ObservatoryRow, b: ObservatoryRow): number {
  if (a.observation_date !== b.observation_date) return a.observation_date < b.observation_date ? 1 : -1;
  return a.fetched_at < b.fetched_at ? 1 : -1;
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
  const now = Date.now();
  // THE WHOLE CARRY WINDOW, BY DATE -- not "the newest N rows". Every run
  // writes a row for each incomplete country, up to four a day, so a fixed
  // row count could stop short of fourteen days and the carry-forward
  // above would quietly give up early. One day of margin on the bound.
  const since = new Date(now - (MAX_OBSERVATORY_CARRY_DAYS + 1) * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("observatory_indicators")
    .select(
      "country_code, inflation, gdp_growth, unemployment, policy_rate, debt_pct_gdp, yield_10y, " +
        "inflation_observation_date, gdp_observation_date, unemployment_observation_date, " +
        "policy_rate_observation_date, debt_observation_period, yield_observation_date, " +
        "observation_date, fetched_at, source_note",
    )
    .gte("fetched_at", since)
    .order("observation_date", { ascending: false })
    .order("fetched_at", { ascending: false })
    // A ceiling, not the window: a handful of countries, a few rows a day
    // for fifteen days is well under this even after force-runs.
    .limit(2000);

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
  // Sorted once, then grouped per country: each group's first row is the
  // current one, by the single ordering above.
  const sorted = rows.filter((r) => OBSERVATORY_CODES.includes(r.country_code)).sort(byNewestFirst);
  const history = new Map<string, ObservatoryRow[]>();
  for (const r of sorted) (history.get(r.country_code) ?? history.set(r.country_code, []).get(r.country_code)!).push(r);
  const out = new Map<string, ObservatoryShown>();
  for (const [code, rowsForCountry] of history) {
    const shown = carryForwardObservatory(rowsForCountry, now);
    if (shown) out.set(code, shown);
  }
  return out;
}
