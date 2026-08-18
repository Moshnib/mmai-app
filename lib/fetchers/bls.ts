// ============================================================
// BLS fetcher — US CPI and Unemployment
// Public domain, no key required (optional key raises the rate limit).
// This mirrors exactly the query you built by hand in Power Query:
// api.bls.gov/publicAPI/v2/timeseries/data/{seriesId}?startyear=X&endyear=Y
// ============================================================

interface BlsDataPoint {
  year: string;
  period: string; // "M01".."M12"
  periodName: string;
  value: string; // BLS returns numbers as strings; "-" marks a gap (e.g. shutdown)
  footnotes: Array<{ code?: string; text?: string }>;
}

interface BlsResponse {
  status: string;
  Results: {
    series: Array<{
      seriesID: string;
      data: BlsDataPoint[];
    }>;
  };
}

async function fetchBlsSeries(seriesId: string, startYear: number, endYear: number): Promise<BlsDataPoint[]> {
  const key = process.env.BLS_API_KEY; // optional — leave unset to use the free 25-request/day tier
  const url = new URL(`https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}`);
  url.searchParams.set("startyear", String(startYear));
  url.searchParams.set("endyear", String(endYear));
  if (key) url.searchParams.set("registrationkey", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BLS request failed: ${res.status} ${res.statusText}`);

  const json: BlsResponse = await res.json();
  if (json.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS API returned status: ${json.status}`);
  }
  const series = json.Results.series[0];
  if (!series) throw new Error(`BLS series ${seriesId} returned no data`);
  return series.data;
}

/** Finds the most recent data point with a real numeric value (skips
 *  shutdown-style gaps, which BLS marks with value "-"), and the value
 *  for the same month one year earlier, to compute a year-over-year rate. */
function latestYoyChange(data: BlsDataPoint[]): { latest: number; yoy: number; observationDate: string } {
  const usable = data.filter((d) => d.value !== "-" && d.period !== "M13"); // M13 = annual average, skip
  if (usable.length === 0) throw new Error("No usable data points returned");

  const latest = usable[0]; // BLS returns most-recent-first
  const latestValue = parseFloat(latest.value);

  const priorYear = String(Number(latest.year) - 1);
  const match = usable.find((d) => d.year === priorYear && d.period === latest.period);
  if (!match) {
    throw new Error(`No matching prior-year observation found for ${latest.periodName} ${latest.year}`);
  }
  const priorValue = parseFloat(match.value);

  const yoy = ((latestValue - priorValue) / priorValue) * 100;
  const month = latest.period.replace("M", "").padStart(2, "0");
  const observationDate = `${latest.year}-${month}-01`;

  return { latest: latestValue, yoy: Math.round(yoy * 100) / 100, observationDate };
}

export async function fetchUsInflation(): Promise<{ inflation: number; observationDate: string }> {
  const now = new Date().getFullYear();
  const data = await fetchBlsSeries("CUUR0000SA0", now - 2, now); // 2-year window is enough for a YoY calc
  const { yoy, observationDate } = latestYoyChange(data);
  return { inflation: yoy, observationDate };
}

export async function fetchUsUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const now = new Date().getFullYear();
  const data = await fetchBlsSeries("LNS14000000", now - 1, now);
  const usable = data.filter((d) => d.value !== "-" && d.period !== "M13");
  if (usable.length === 0) throw new Error("No usable unemployment data returned");
  const latest = usable[0];
  const month = latest.period.replace("M", "").padStart(2, "0");
  return {
    unemployment: parseFloat(latest.value),
    observationDate: `${latest.year}-${month}-01`,
  };
}
