// ============================================================
// U.S. Energy Information Administration fetcher — Brent Crude,
// year-over-year change. Public domain, attribution requested (per
// EIA's API Terms of Service). Free API key, no cost (registered
// 2026-08-22). Confirmed live via direct API test: series RBRTE
// ("Europe Brent Spot Price FOB"), product facet EPCBRENT.
//
// This is a single shared value used across every market's External &
// Commodities pillar (Equation 5 treats it as one global input, not a
// per-market figure) -- fetch it once per refresh cycle, not once per
// market. EIA returns raw price levels, not a pre-computed rate, so YoY
// is computed the same way as lib/fetchers/abs.ts and lib/fetchers/statcan.ts.
// ============================================================

interface EiaDataRow {
  period: string; // "YYYY-MM"
  value: string;
}

export async function fetchBrentYoY(): Promise<{ brentYoY: number; observationDate: string }> {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error("EIA_API_KEY is not configured");

  const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=monthly&data%5B0%5D=value&facets%5Bproduct%5D%5B%5D=EPCBRENT&facets%5Bseries%5D%5B%5D=RBRTE&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=desc&length=24`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`EIA request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: EiaDataRow[] = json?.response?.data ?? [];
  if (rows.length < 13) throw new Error("EIA Brent price: too few rows for a year-over-year calculation");

  const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  const priorYear = sorted.find((r) => r.period === shiftMonth(latest.period, -12));
  if (!priorYear) throw new Error(`EIA Brent price: no matching prior-year observation for ${latest.period}`);

  const latestValue = parseFloat(latest.value);
  const priorValue = parseFloat(priorYear.value);
  if (Number.isNaN(latestValue) || Number.isNaN(priorValue)) throw new Error("EIA Brent price: unparseable value");

  const yoy = ((latestValue - priorValue) / priorValue) * 100;
  return { brentYoY: Math.round(yoy * 100) / 100, observationDate: `${latest.period}-01` };
}

function shiftMonth(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ============================================================
//  THE SAME SERIES, DAILY
//
//  Everything above returns a MONTHLY AVERAGE as a year-over-year
//  percentage, because that is what a scored indicator needed. On 2
//  October 2026 the owner put it plainly: "oil price went insane,
//  everyone watching, nothing in this website is helpful." He was right.
//  Brent had fallen from $130.80 on 15 September to $113.96 on the 29th
//  and the site -- holding the key to this very series -- said nothing,
//  because a monthly average cannot show a fortnight.
//
//  Same endpoint, same series (RBRTE), same public-domain terms, same
//  key: only `frequency` changes.
//
//  IT LAGS, PERMANENTLY. The EIA publishes this spot price two to four
//  days in arrears -- on 2 October the newest observation was 29
//  September. That is the source's rhythm, not an outage, and it is why
//  the date travels with the price everywhere it is shown. Anything
//  genuinely same-day is a commercial market-data feed.
// ============================================================

export interface BrentDailyPoint {
  /** YYYY-MM-DD, the trading day. No weekend or holiday rows exist. */
  date: string;
  /** Dollars per barrel. */
  price: number;
}

/** The most recent `days` trading days of Brent spot, oldest first.
 *
 *  Asks for more rows than a quarter has trading days (a quarter is ~65)
 *  and lets the caller window it, so a run after a long gap still fills
 *  the hole rather than leaving one. */
export async function fetchBrentDailySeries(rows = 120): Promise<BrentDailyPoint[]> {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error("EIA_API_KEY is not configured");
  const url =
    `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}` +
    `&frequency=daily&data%5B0%5D=value` +
    `&facets%5Bproduct%5D%5B%5D=EPCBRENT&facets%5Bseries%5D%5B%5D=RBRTE` +
    `&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=desc&length=${rows}`;
  // Every fetcher in this project carries a timeout: Node has no default,
  // so a source that accepts the connection and goes quiet never returns
  // (scripts/check-fetch-timeouts.ts fails the build without one).
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`EIA daily Brent request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const data: EiaDataRow[] = json?.response?.data ?? [];
  const points = data
    .map((r) => ({ date: r.period, price: parseFloat(r.value) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) throw new Error("EIA daily Brent: no usable rows in the response");
  return points;
}
