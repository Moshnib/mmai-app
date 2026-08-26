// ============================================================
// Bahrain fetcher — national CPI, year-over-year, monthly.
// data.gov.bh runs OpenDataSoft (Explore API v2 -- v2.1 404s on this
// deployment despite the platform's own deprecation notice, use v2).
// No API key. Confirmed live: June 2026 = 2.3%.
//
// "level=1" / coicop_code="0" is the headline "all items" row; other
// rows in this dataset are COICOP sub-divisions (food, housing, etc).
// The API's default sort only orders by year, not month within a year
// -- must explicitly sort by both, or it silently returns March before
// January before February for the same year.
//
// Licence: Bahrain Open Government Data License v1.0 -- explicit
// commercial use permitted, per this project's licensing review.
// ============================================================

interface BahrainCpiRecord {
  record: { fields: { year: string; month: string; percentage_change: number } };
}

export async function fetchBahrainInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url = new URL("https://www.data.gov.bh/api/v2/catalog/datasets/06-percentage-change-from-previous-year/records");
  url.searchParams.set("where", "level=1");
  url.searchParams.set("order_by", "year desc, month desc");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Bahrain CPI request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const record: BahrainCpiRecord | undefined = json?.records?.[0];
  const fields = record?.record?.fields;
  if (!fields || typeof fields.percentage_change !== "number") {
    throw new Error("Bahrain CPI: no usable value in response");
  }

  // "month" is formatted "06 June" -- the leading two digits are the
  // actual month number.
  const monthNum = fields.month.slice(0, 2);
  return { inflation: fields.percentage_change, observationDate: `${fields.year}-${monthNum}-01` };
}

// ============================================================
// Historical (full-series) variant -- used only by the one-time backfill
// script. This dataset is on Opendatasoft's older v2 deployment, whose
// records/limit endpoint caps at 100 rows per request (confirmed live:
// limit=200 returns "InvalidRESTParameterError ... -1 <= limit <= 100")
// and, unlike the v2.1 grouped-aggregate endpoint used for Qatar real
// estate, this plain records endpoint's own total_count IS a true total
// -- so offset pagination against it is reliable. Confirmed live at
// total_count=102 (2018-01 through 2026-06) as of this writing, growing
// by one row a month.
// ============================================================

export async function fetchBahrainInflationHistory(): Promise<Array<{ period: string; value: number }>> {
  const PAGE = 100;
  const out: Array<{ period: string; value: number }> = [];
  let offset = 0;
  let totalCount = Infinity;

  while (offset < totalCount) {
    const url = new URL("https://www.data.gov.bh/api/v2/catalog/datasets/06-percentage-change-from-previous-year/records");
    url.searchParams.set("where", "level=1");
    url.searchParams.set("order_by", "year asc, month asc");
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Bahrain CPI history request failed (offset ${offset}): ${res.status} ${res.statusText}`);
    const json = await res.json();
    totalCount = typeof json?.total_count === "number" ? json.total_count : 0;

    const records: BahrainCpiRecord[] = json?.records ?? [];
    for (const r of records) {
      const fields = r.record?.fields;
      if (!fields || typeof fields.percentage_change !== "number") continue;
      out.push({ period: `${fields.year}-${fields.month.slice(0, 2)}`, value: fields.percentage_change });
    }
    if (records.length === 0) break; // safety net against an infinite loop if total_count is ever wrong
    offset += PAGE;
  }

  return out.sort((a, b) => a.period.localeCompare(b.period));
}
