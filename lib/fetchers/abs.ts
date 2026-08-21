// ============================================================
// Australian Bureau of Statistics fetcher — CPI (inflation).
// CC BY 4.0 (confirmed directly on ABS's own website copyright page,
// 2026-08-21: "All material... is provided under a Creative Commons
// Attribution 4.0 International licence"). No key required for the
// Data API (only the separate, unrelated Indicator API needs one).
// Endpoint and dataflow confirmed live via direct browser test.
// ============================================================

export async function fetchAustraliaInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url = "https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/1.10001.10.50.M?format=csvfilewithlabels";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ABS request failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const timeIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (timeIdx === -1 || valueIdx === -1) throw new Error("ABS CPI response: expected columns not found");

  const rows = lines
    .slice(1)
    .map((line) => line.split(","))
    .filter((cols) => cols.length > valueIdx && cols[timeIdx] && cols[valueIdx])
    .map((cols) => ({ period: cols[timeIdx], value: parseFloat(cols[valueIdx]) }))
    .filter((r) => !Number.isNaN(r.value))
    .sort((a, b) => a.period.localeCompare(b.period)); // ABS doesn't guarantee row order

  if (rows.length < 13) throw new Error("ABS CPI: too few rows for a year-over-year calculation");

  const latest = rows[rows.length - 1];
  const priorYear = rows.find((r) => r.period === shiftMonth(latest.period, -12));
  if (!priorYear) throw new Error(`ABS CPI: no matching prior-year observation for ${latest.period}`);

  const yoy = ((latest.value - priorYear.value) / priorYear.value) * 100;
  return { inflation: Math.round(yoy * 100) / 100, observationDate: `${latest.period}-01` };
}

function shiftMonth(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
