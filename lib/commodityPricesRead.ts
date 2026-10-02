import { getPublicSupabaseClient } from "@/lib/supabase";
import type { PricePoint } from "@/lib/commodityPrices";

// ============================================================
//  READ SIDE FOR commodity_prices
//
//  Same shape as lib/bondYieldsRead.ts, and for the same reasons: read
//  the stored series rather than calling the EIA on every page load, and
//  read it with the PUBLIC key, because the table carries a public read
//  policy and the service key is not available everywhere the site
//  renders. Using the service key is exactly how the bond-yield panel
//  silently vanished once.
//
//  NOTHING HERE MAY THROW. The migration that creates this table is run
//  by hand, so a deploy can land before it does; a page that throws
//  because a table is missing would take the whole page with it. An empty
//  list means the caller renders nothing, which is the correct outcome
//  for a card that has no price to show.
// ============================================================

/** The series key, not the commodity: a monthly average and a daily spot
 *  are two different series of the same oil and are allowed to disagree. */
export const BRENT_SPOT_DAILY = "brent_spot_daily";

export async function readCommoditySeries(series: string, days = 120): Promise<PricePoint[]> {
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from("commodity_prices")
      .select("observation_date, price")
      .eq("series", series)
      .gte("observation_date", since)
      .order("observation_date", { ascending: true })
      .limit(400);
    if (error || !data) return [];
    return data
      .map((r) => ({ date: String(r.observation_date), price: Number(r.price) }))
      .filter((p) => Number.isFinite(p.price));
  } catch {
    // Not configured, unreachable, or the table does not exist yet.
    return [];
  }
}
