import { getPublicSupabaseClient } from "@/lib/supabase";

// ============================================================
// Read side for bond_yields. Server-only: called from the Data Over
// Time page, which passes plain objects down to the client component.
//
// Reading from the table rather than calling the six sources on page
// load is the whole point of storing them. Six government websites at
// render time would be slow, would hammer them on every visit, and
// would lose everything the day one of them changed shape.
// ============================================================

export interface BondYieldPoint {
  market: string;
  date: string;      // YYYY-MM-DD
  y10: number;
  y2: number | null;
}

/** Every stored reading for the given window, oldest first. */
export async function readBondYields(days = 365): Promise<BondYieldPoint[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // PUBLIC client, not the service one. bond_yields carries a public
    // read policy, so the anon key is the right credential -- and using
    // the service key here meant the section silently vanished wherever
    // that server-only key was not configured, which is exactly how it
    // failed the first time.
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("bond_yields")
      .select("market, yield_10y, yield_2y, observation_date")
      .gte("observation_date", since)
      .order("observation_date", { ascending: true })
      // Six markets x ~250 trading days. 2000 leaves headroom without
      // risking Supabase's default response cap silently truncating the
      // OLDEST rows -- which are exactly the left-hand end of the chart.
      .limit(2000);

    if (error || !data) return [];
    return data
      .filter((r) => r.yield_10y != null && typeof r.observation_date === "string")
      .map((r) => ({
        market: r.market as string,
        date: r.observation_date as string,
        y10: Number(r.yield_10y),
        y2: r.yield_2y == null ? null : Number(r.yield_2y),
      }))
      .filter((r) => Number.isFinite(r.y10));
  } catch {
    // The page renders without this section rather than failing.
    return [];
  }
}
