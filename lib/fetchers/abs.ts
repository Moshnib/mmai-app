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

// ============================================================
// Unemployment rate — dataflow ABS,LF (Labour Force), key
// M13.3.1599.20.AUS.M = Unemployment rate / Persons / Total (age) /
// Seasonally Adjusted / Australia / Monthly. Same CC BY 4.0 licence
// and same Data API as the CPI series above, so no new licence
// question and no key.
//
// Replaces the World Bank's annual figure for Australia, which is an
// ILO MODELLED estimate published once a year and currently a year
// behind (2025: 4.09). Confirmed live 2026-08-28: 2026-07 = 4.46182469.
// The OECD's harmonised series returns 4.461825 for the same month --
// it republishes this very series, rounded, which is why going direct
// is preferable to going through them.
//
// No year-over-year maths: ABS publishes the unemployment RATE.
// ============================================================
export async function fetchAustraliaUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  // lastNObservations, not a start date: this needs only the current
  // reading, and a fixed start date would silently grow the response
  // forever.
  const url = "https://data.api.abs.gov.au/rest/data/ABS,LF,1.0.0/M13.3.1599.20.AUS.M?format=csvfilewithlabels&lastNObservations=2";
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ABS request failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const timeIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (timeIdx === -1 || valueIdx === -1) throw new Error("ABS unemployment response: expected columns not found");

  const rows = lines
    .slice(1)
    .map((line) => line.split(","))
    .filter((cols) => cols.length > valueIdx && cols[timeIdx] && cols[valueIdx])
    .map((cols) => ({ period: cols[timeIdx], value: parseFloat(cols[valueIdx]) }))
    .filter((r) => !Number.isNaN(r.value))
    .sort((a, b) => a.period.localeCompare(b.period)); // ABS doesn't guarantee row order

  if (rows.length === 0) throw new Error("ABS unemployment: no usable observations returned");

  const latest = rows[rows.length - 1];
  return { unemployment: latest.value, observationDate: `${latest.period}-01` };
}

function shiftMonth(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ============================================================
// Australia real GDP growth, QUARTERLY, year-over-year.
//
// Replaces the World Bank ANNUAL figure, which was stamped January and
// twenty months old while carrying 25% of the MMAI score.
//
// Series key M1.GPM.20.AUS.Q:
//   M1   Chain volume measures  (real, not current prices)
//   GPM  Gross domestic product
//   20   Seasonally Adjusted
//   AUS  Australia
//   Q    Quarterly
//
// These are LEVELS, so year-over-year is computed here -- matching the
// concept every other MMAI market uses. The ABS also publishes
// "Percentage Changes" (MEASURE M4), but on CURRENT prices, which is
// nominal and would not be comparable with the real growth used
// everywhere else.
//
// format=csvfile, not csvfilewithlabels: the label expansion is what made
// the OECD Japan fetcher time out (see lib/fetchers/oecd.ts). Columns are
// selected by header name, so labels are never needed.
// ============================================================

export async function fetchAustraliaGdpGrowthQuarterly(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url = "https://data.api.abs.gov.au/rest/data/ABS,ANA_AGG,1.0.0/M1.GPM.20.AUS.Q?format=csvfile&lastNObservations=6";
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ABS GDP request failed: ${res.status} ${res.statusText}`);

  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("ABS GDP: response contained no data rows");

  const header = lines[0].split(",");
  const timeIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (timeIdx === -1 || valueIdx === -1) throw new Error("ABS GDP: expected columns not found");

  const rows = lines
    .slice(1)
    .map((l) => l.split(","))
    .filter((c) => c.length > valueIdx && c[timeIdx] && c[valueIdx])
    .map((c) => ({ period: c[timeIdx].trim(), value: parseFloat(c[valueIdx]) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.period.localeCompare(b.period));

  if (rows.length < 5) throw new Error(`ABS GDP: need 5+ quarters for a YoY rate, got ${rows.length}`);

  const latest = rows[rows.length - 1];
  const m = latest.period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) throw new Error(`ABS GDP: unexpected period "${latest.period}"`);

  const prior = rows.find((r) => r.period === `${Number(m[1]) - 1}-Q${m[2]}`);
  if (!prior || prior.value === 0) throw new Error(`ABS GDP: no comparable quarter for ${latest.period}`);

  const endMonth = ["03", "06", "09", "12"][Number(m[2]) - 1];
  return {
    gdpGrowth: Math.round(((latest.value - prior.value) / prior.value) * 10000) / 100,
    observationDate: `${m[1]}-${endMonth}-01`,
  };
}
