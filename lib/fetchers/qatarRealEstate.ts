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
