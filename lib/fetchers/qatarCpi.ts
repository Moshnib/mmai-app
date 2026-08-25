// ============================================================
// Qatar fetcher — national CPI, year-over-year, monthly.
// data.gov.qa runs Opendatasoft (Explore API v2.1). No API key.
// Confirmed live: latest available is Dec 2025 (cpi_index 112.39),
// ~8 months lagged as of this writing -- that's normal for this
// source, not a bug.
//
// The API returns a raw index (cpi_index), not a percentage -- YoY is
// computed manually here, same pattern as lib/fetchers/eia.ts and
// lib/fetchers/statcan.ts. "group_code"="0" is the headline "General
// Index" row; other rows are COICOP expenditure sub-groups.
//
// IMPORTANT: the API's own order_by only sorts by "year", not by
// "month" within a year (confirmed: a "year desc" query returned 2025's
// months in a jumbled, non-chronological order), and "month" is stored
// as an English 3-letter abbreviation ("Jan".."Dec"), which doesn't
// sort correctly as text either. This fetcher pulls the full ~72-row
// headline series (small, bounded) and sorts it correctly client-side
// rather than trusting the API's ordering.
//
// Licence: CC BY 4.0, confirmed via the API's own dataset metadata.
// ============================================================

const MONTH_NUM: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

interface QatarCpiRow {
  year: string;
  month: string; // "Jan".."Dec"
  cpi_index: number;
}

function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchQatarInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url = new URL(
    "https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/consumer-price-index-cpi-by-expenditure-group-monthly/records"
  );
  url.searchParams.set("where", 'group_code="0"');
  url.searchParams.set("limit", "100");

  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Qatar CPI request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: QatarCpiRow[] = json?.results ?? [];
  if (rows.length < 13) throw new Error("Qatar CPI: too few rows for a year-over-year calculation");

  const withPeriod = rows
    .map((r) => ({ ...r, period: `${r.year}-${MONTH_NUM[r.month]}` }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const latest = withPeriod[withPeriod.length - 1];
  const priorYear = withPeriod.find((r) => r.period === shiftPeriod(latest.period, -12));
  if (!priorYear) throw new Error(`Qatar CPI: no matching prior-year observation for ${latest.period}`);

  const yoy = ((latest.cpi_index - priorYear.cpi_index) / priorYear.cpi_index) * 100;
  return { inflation: Math.round(yoy * 100) / 100, observationDate: `${latest.period}-01` };
}
