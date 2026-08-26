// ============================================================
// Qatar fetcher — real estate transaction activity, monthly.
// data.gov.qa (Opendatasoft), dataset "weekly-real-estates-sales-bulletin"
// (Ministry of Justice). Despite the name, this is raw per-transaction
// data (each row is one individual sale), not a pre-aggregated weekly
// figure -- "weekly" describes the publish cadence, not the row
// granularity. CC BY 4.0, same portal/licence already confirmed for
// Qatar's CPI dataset.
//
// Two-step fetch: (1) find the most recent registration_date actually
// in the data, since it lags today by months and there's no point
// guessing the current month; (2) aggregate transaction count for that
// calendar month using the API's own server-side count(), rather than
// pulling potentially thousands of raw rows to count client-side.
// ============================================================

interface LatestDateRow {
  registration_date: string; // "YYYY-MM-DD"
}

interface AggregateRow {
  tx_count: number;
}

export async function fetchQatarRealEstate(): Promise<{ realEstateValue: number; realEstateMetricLabel: string; observationDate: string }> {
  const base = "https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/weekly-real-estates-sales-bulletin/records";

  const latestUrl = new URL(base);
  latestUrl.searchParams.set("order_by", "registration_date desc");
  latestUrl.searchParams.set("limit", "1");
  const latestRes = await fetch(latestUrl, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!latestRes.ok) throw new Error(`Qatar real estate (latest-date lookup) failed: ${latestRes.status} ${latestRes.statusText}`);
  const latestJson = await latestRes.json();
  const latestRow: LatestDateRow | undefined = latestJson?.results?.[0];
  if (!latestRow?.registration_date) throw new Error("Qatar real estate: could not determine latest registration date");

  const [year, month] = latestRow.registration_date.split("-");
  const monthStart = `${year}-${month}-01`;
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const monthEnd = `${year}-${month}-${String(daysInMonth).padStart(2, "0")}`;

  const aggUrl = new URL(base);
  aggUrl.searchParams.set("select", "count(*) as tx_count");
  aggUrl.searchParams.set("where", `registration_date>=date'${monthStart}' and registration_date<=date'${monthEnd}'`);
  aggUrl.searchParams.set("limit", "1");
  const aggRes = await fetch(aggUrl, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!aggRes.ok) throw new Error(`Qatar real estate (aggregate) failed: ${aggRes.status} ${aggRes.statusText}`);
  const aggJson = await aggRes.json();
  const aggRow: AggregateRow | undefined = aggJson?.results?.[0];
  if (!aggRow || typeof aggRow.tx_count !== "number") throw new Error("Qatar real estate: no usable aggregate in response");

  return {
    realEstateValue: aggRow.tx_count,
    realEstateMetricLabel: "Registered property transactions this month",
    observationDate: monthStart,
  };
}

// ============================================================
// Historical (full-series) variant -- used only by the one-time backfill
// script. One grouped call returns all 66 months at once (confirmed live)
// instead of the 66 separate per-month aggregate calls a naive port of
// the live fetcher's 2-step pattern would need.
//
// IMPORTANT: `select ... as yr, ... as mo` aliases come back null for a
// grouped query on this API (confirmed live) -- the actual group-by
// values arrive under the literal unaliased keys "year(registration_date)"
// / "month(registration_date)" instead. Also confirmed: this grouped
// endpoint's own total_count reflects the page size requested, NOT the
// true row count (e.g. limit=5 -> total_count=5) -- results.length below
// the requested limit is the only reliable end-of-data signal here, same
// as the plain /records endpoint used elsewhere in this file and in
// qatarCpi.ts.
// ============================================================

export interface QatarRealEstateMonthRaw {
  period: string; // "YYYY-MM"
  txCount: number;
  distinctDays: number;
  firstDay: string; // "YYYY-MM-DD"
  lastDay: string; // "YYYY-MM-DD"
}

export async function fetchQatarRealEstateHistory(): Promise<QatarRealEstateMonthRaw[]> {
  const url = new URL("https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/weekly-real-estates-sales-bulletin/records");
  url.searchParams.set(
    "select",
    "count(*) as tx_count, count(distinct registration_date) as distinct_days, min(registration_date) as first_day, max(registration_date) as last_day"
  );
  url.searchParams.set("group_by", "year(registration_date), month(registration_date)");
  const PAGE = 100;
  url.searchParams.set("limit", String(PAGE));

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Qatar real estate history request failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const results: Array<Record<string, unknown>> = json?.results ?? [];
  if (results.length >= PAGE) {
    throw new Error(`Qatar real estate history: hit the ${PAGE}-row page limit -- needs offset pagination now`);
  }

  const rows: QatarRealEstateMonthRaw[] = results.map((r) => {
    const year = r["year(registration_date)"] as number;
    const month = r["month(registration_date)"] as number;
    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      txCount: r.tx_count as number,
      distinctDays: r.distinct_days as number,
      firstDay: String(r.first_day).slice(0, 10),
      lastDay: String(r.last_day).slice(0, 10),
    };
  });

  return rows.sort((a, b) => a.period.localeCompare(b.period));
}

// A month is judged complete by ONE signal only: does the observed range
// reach the end of the calendar month. October 2025 (2 of 31 days,
// cutting off after the 2nd) isn't actually a "portal stopped publishing
// mid-month" case -- 2025-09 and 2025-12 are both complete, so bulletins
// went missing for most of one specific month and then resumed, which in
// principle could land anywhere in a month, not just at the tail. This
// rule deliberately only catches the tail-shaped instance of that -- an
// under-inclusive but easy-to-verify trade, not a mechanically exhaustive
// one. What justifies the specific "-6" slack: sweeping it from -2 to -9
// against the live 66-month series lands on a stable plateau (drops
// exactly 2021-04/2021-12/2025-10) across the -4 to -7 range -- -6 sits
// in the middle of that plateau, not tuned to hit a preferred answer.
//
// Two things this function deliberately does NOT check, both tried and
// rejected after producing false positives against real data:
//  - A late-START threshold. Several genuinely complete months start
//    well into the month because Eid closures fall in the first week --
//    e.g. 2020-08 starts on the 9th (Eid al-Adha) but runs cleanly
//    through the 31st and is the single busiest month in the whole
//    series. A first-week-late-start rule deleted that month along with
//    three other real ones (2020-11, 2022-05, 2025-04).
//  - A distinct-day-count floor. Qatar's Sunday-Thursday work week means
//    even a fully-published month only ever has ~17-23 distinct
//    transaction days out of ~30 calendar days, and the genuinely
//    complete Eid months above have as few as 14 -- so any day-count
//    cutoff high enough to catch a real problem month also catches good
//    ones. October 2021 (11 days, day 10-31) and November 2025 (11
//    days, day 2-30) have IDENTICAL working-day coverage (11 of ~21
//    Sun-Thu working days each) and near-identical daily rates (~25
//    tx/working-day, above the ~17 tx/day median across the series) --
//    they're the same case, not two, and the transaction totals (277,
//    282) sit well above the ~50% of median a real missing-data month
//    would predict. That's the signature of activity batched onto fewer
//    registration dates, not of absent data -- both are kept as real.
//    An earlier version of this rule dropped only one of the two
//    (inconsistently, since nothing distinguishes them) purely because
//    a day-count floor happened to land between them by coincidence.
export function isCompleteMonth(row: QatarRealEstateMonthRaw): boolean {
  const [year, month] = row.period.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDayNum = Number(row.lastDay.slice(8, 10));
  return lastDayNum >= daysInMonth - 6;
}
