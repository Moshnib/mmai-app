// ============================================================
// World Bank fetcher — GDP growth, any country.
// CC BY 4.0, confirmed throughout this project's licensing audit
// (same source already used for the historical UAE dataset).
// ============================================================

export async function fetchGdpGrowth(countryIso3: string): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  // World Bank returns [metadata, dataArray] — the data is the second element.
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank GDP growth for ${countryIso3}: no non-null values found`);

  return { gdpGrowth: latest.value as number, observationDate: `${latest.date}-01-01` };
}

export async function fetchInflation(countryIso3: string): Promise<{ inflation: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank inflation for ${countryIso3}: no non-null values found`);

  return { inflation: latest.value as number, observationDate: `${latest.date}-01-01` };
}

export async function fetchUnemployment(countryIso3: string): Promise<{ unemployment: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/SL.UEM.TOTL.ZS?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank unemployment for ${countryIso3}: no non-null values found`);

  return { unemployment: latest.value as number, observationDate: `${latest.date}-01-01` };
}
