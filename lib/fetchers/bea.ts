// ============================================================
// U.S. Bureau of Economic Analysis fetcher — Real GDP growth.
// Public domain (U.S. federal government work). Free API key, no cost,
// never expires (registered 2026-08-22). Confirmed live via direct API
// test: table T10101, line 1 ("Gross domestic product") already IS the
// percent-change series -- no YoY math needed, unlike bls.ts/abs.ts.
//
// BEA returns HTTP 200 even on a bad request (missing/invalid key,
// unknown table) -- the error shows up in the response body, not the
// status code, so res.ok alone isn't a reliable success check.
// ============================================================

interface BeaDataRow {
  LineNumber: string;
  TimePeriod: string;
  DataValue: string;
}

export async function fetchUsGdpGrowth(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const key = process.env.BEA_API_KEY;
  if (!key) throw new Error("BEA_API_KEY is not configured");

  const url = `https://apps.bea.gov/api/data/?UserID=${key}&method=GetData&datasetname=NIPA&TableName=T10101&Frequency=A&Year=X&ResultFormat=JSON`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BEA request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const apiError = json?.BEAAPI?.Error ?? json?.BEAAPI?.Results?.Error;
  if (apiError) throw new Error(`BEA API returned an error: ${JSON.stringify(apiError)}`);

  const rows: BeaDataRow[] = json?.BEAAPI?.Results?.Data ?? [];
  const gdpRows = rows.filter((r) => r.LineNumber === "1"); // Line 1 = "Gross domestic product"
  if (gdpRows.length === 0) throw new Error("BEA GDP growth: no rows found for line 1");

  const latest = gdpRows.reduce((a, b) => (b.TimePeriod > a.TimePeriod ? b : a));
  const value = parseFloat(latest.DataValue.replace(/,/g, ""));
  if (Number.isNaN(value)) throw new Error(`BEA GDP growth: unparseable value "${latest.DataValue}"`);

  return { gdpGrowth: value, observationDate: `${latest.TimePeriod}-01-01` };
}
