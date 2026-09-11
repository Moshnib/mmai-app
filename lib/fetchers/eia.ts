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
