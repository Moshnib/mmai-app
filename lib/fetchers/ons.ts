// ============================================================
// UK Office for National Statistics fetcher — CPI annual rate.
// Open Government Licence v3.0 (no permission required, commercial use
// explicit). Confirmed live via direct API test 2026-08-21 — note the
// old api.ons.gov.uk domain referenced in this project's original setup
// notes is fully decommissioned (retired 25/11/2024, confirmed live: it
// now returns a decommission notice); this
// www.ons.gov.uk/.../timeseries/{id}/{dataset}/data endpoint is the one
// still live. Series D7G7 = "CPI ANNUAL RATE 00: ALL ITEMS 2015=100".
// ============================================================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface OnsMonthPoint {
  year: string;
  month: string;
  value: string;
}

export async function fetchUkInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url = "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23/data";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ONS request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const months: OnsMonthPoint[] = json.months ?? [];
  if (months.length === 0) throw new Error("ONS CPI: no monthly observations returned");

  const latest = months[months.length - 1];
  const value = parseFloat(latest.value);
  const monthNum = MONTH_NAMES.indexOf(latest.month) + 1;
  if (Number.isNaN(value) || monthNum === 0) throw new Error(`ONS CPI: unparseable observation ${JSON.stringify(latest)}`);

  return { inflation: value, observationDate: `${latest.year}-${String(monthNum).padStart(2, "0")}-01` };
}

// ============================================================
// Unemployment rate — series MGSX, "Unemployment rate (aged 16 and
// over, seasonally adjusted)" from the LMS dataset. Same Open
// Government Licence v3.0 as the CPI series above.
//
// Replaces the World Bank's annual figure for the UK, which is an ILO
// MODELLED estimate published once a year and currently a year behind
// (2025: 4.746). Confirmed live 2026-08-28: latest 4.9, matching the
// OECD's harmonised series for the UK exactly.
//
// IMPORTANT -- this is a ROLLING THREE-MONTH AVERAGE, not a single
// month. ONS stamps it with the MIDDLE month: the entry dated
// "2026 MAY" carries the label "2026 APR-JUN". That is how the UK
// publishes its headline rate; there is no true single-month series to
// use instead. Two consequences worth knowing: the figure is smoother
// than the other markets' single-month rates, and its period stamp
// always reads about two months behind even though it contains much
// more recent data.
// ============================================================
export async function fetchUkUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const url = "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms/data";
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ONS request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const months: OnsMonthPoint[] = json.months ?? [];
  if (months.length === 0) throw new Error("ONS unemployment: no monthly observations returned");

  const latest = months[months.length - 1];
  const value = parseFloat(latest.value);
  const monthNum = MONTH_NAMES.indexOf(latest.month) + 1;
  if (Number.isNaN(value) || monthNum === 0) throw new Error(`ONS unemployment: unparseable observation ${JSON.stringify(latest)}`);

  return { unemployment: value, observationDate: `${latest.year}-${String(monthNum).padStart(2, "0")}-01` };
}
