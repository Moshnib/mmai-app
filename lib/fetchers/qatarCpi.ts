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

// Paginated fetch of the full headline-index series, sorted correctly
// client-side (see file header -- the API's own ordering is unreliable,
// and "month" is stored as English text so even a literal order_by=month
// wouldn't sort chronologically -- there's no server-side sort worth
// requesting here). A plain limit=100 (the original shape of this
// fetcher) silently truncates once the dataset passes 100 rows, which
// happens around early 2028 at its current one-row-per-month growth
// rate -- confirmed live at 72 rows today, one page. This paginates by
// offset so both the live "latest" fetch and the historical backfill
// stay correct past that point instead of one day silently reporting a
// stale month as current.
//
// NOTE for whoever revisits this once it crosses 100 rows: offset
// pagination assumes the server returns a STABLE order across separate
// requests for the same query. That's untested here (harmless today --
// there's only one page) and worth verifying live before trusting a
// second page's worth of data; the backfill script's
// assertNoDuplicatePeriods() would catch a skip/duplicate across pages,
// but this live function has no equivalent guard.
async function fetchQatarCpiRawSeries(): Promise<QatarCpiRow[]> {
  const PAGE = 100;
  const out: QatarCpiRow[] = [];
  let offset = 0;
  while (true) {
    const url = new URL(
      "https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/consumer-price-index-cpi-by-expenditure-group-monthly/records"
    );
    url.searchParams.set("where", 'group_code="0"');
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Qatar CPI request failed (offset ${offset}): ${res.status} ${res.statusText}`);
    const json = await res.json();
    const rows: QatarCpiRow[] = json?.results ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break; // last page -- results.length < limit is the reliable end-of-data signal
    offset += PAGE;
  }
  return out;
}

export async function fetchQatarInflation(): Promise<{ inflation: number; observationDate: string }> {
  const rows = await fetchQatarCpiRawSeries();
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

// Historical (full-series) variant -- used only by the one-time backfill
// script. Computes YoY for every month that has a matching prior-year
// data point in the series (so the first 12 real months are consumed
// only as prior-year lookups, never emitted as YoY output themselves --
// there's no artificial "0" filled in for them, unlike Data Saudi's cube).
export async function fetchQatarInflationHistory(): Promise<Array<{ period: string; value: number }>> {
  const rows = await fetchQatarCpiRawSeries();
  const withPeriod = rows
    .map((r) => ({ ...r, period: `${r.year}-${MONTH_NUM[r.month]}` }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const out: Array<{ period: string; value: number }> = [];
  for (const row of withPeriod) {
    const priorYear = withPeriod.find((r) => r.period === shiftPeriod(row.period, -12));
    if (!priorYear) continue;
    const yoy = ((row.cpi_index - priorYear.cpi_index) / priorYear.cpi_index) * 100;
    out.push({ period: row.period, value: Math.round(yoy * 100) / 100 });
  }
  return out;
}
