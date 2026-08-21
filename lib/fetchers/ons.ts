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
