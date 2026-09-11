// ============================================================
// World Bank fetcher — GDP growth, any country.
// CC BY 4.0, confirmed throughout this project's licensing audit
// (same source already used for the historical UAE dataset).
// ============================================================

export async function fetchGdpGrowth(countryIso3: string): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
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
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank inflation for ${countryIso3}: no non-null values found`);

  return { inflation: latest.value as number, observationDate: `${latest.date}-01-01` };
}

export async function fetchUnemployment(countryIso3: string): Promise<{ unemployment: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/SL.UEM.TOTL.ZS?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank unemployment for ${countryIso3}: no non-null values found`);

  return { unemployment: latest.value as number, observationDate: `${latest.date}-01-01` };
}

// Gulf Watch's "currency stability" pillar — how well a country's reserves
// cover its dollar-pegged (or basket-pegged) currency, and whether it's
// running an external surplus or deficit. Same World Bank source/licence
// as everything else above, confirmed live for all 6 Gulf Watch countries.

export async function fetchFxReservesMonths(countryIso3: string): Promise<{ fxReservesMonths: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/FI.RES.TOTL.MO?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank FX reserves for ${countryIso3}: no non-null values found`);

  return { fxReservesMonths: latest.value as number, observationDate: `${latest.date}-01-01` };
}

export async function fetchCurrentAccountPctGdp(countryIso3: string): Promise<{ currentAccountPctGdp: number; observationDate: string }> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/BN.CAB.XOKA.GD.ZS?format=json&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`World Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  const latest = rows.find((r) => r.value !== null);
  if (!latest) throw new Error(`World Bank current account for ${countryIso3}: no non-null values found`);

  return { currentAccountPctGdp: latest.value as number, observationDate: `${latest.date}-01-01` };
}

// ============================================================
// Historical (full-series) variants -- used only by the one-time
// backfill script, never by the daily refresh routes. The live
// functions above intentionally fetch just per_page=20 and take the
// latest non-null row; that's wrong for history, where the goal is
// every year the API has, not just the newest one.
//
// per_page=300 is comfortably above every indicator's real total (all
// 6 Gulf countries x GDP/inflation/unemployment/FX-reserves/current-
// account confirmed at total=66, i.e. ~1960-2025) -- the pages===1
// assert below means a future indicator that actually needs real
// pagination fails loudly instead of silently truncating history.
// ============================================================

async function fetchWorldBankHistory(countryIso3: string, indicator: string, label: string): Promise<Array<{ period: string; value: number }>> {
  const url = `https://api.worldbank.org/v2/country/${countryIso3}/indicator/${indicator}?format=json&per_page=300`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`World Bank history request failed for ${label} ${countryIso3}: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const meta = json[0] as { pages?: number; total?: number } | undefined;
  if (meta?.pages && meta.pages !== 1) {
    throw new Error(`World Bank history for ${label} ${countryIso3}: expected 1 page, got ${meta.pages} of ${meta.total} rows -- raise per_page`);
  }

  const rows: Array<{ date: string; value: number | null }> = json[1] ?? [];
  return rows
    .filter((r): r is { date: string; value: number } => r.value !== null)
    .map((r) => ({ period: r.date, value: r.value }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function fetchInflationHistory(countryIso3: string) {
  return fetchWorldBankHistory(countryIso3, "FP.CPI.TOTL.ZG", "inflation");
}

export function fetchFxReservesMonthsHistory(countryIso3: string) {
  return fetchWorldBankHistory(countryIso3, "FI.RES.TOTL.MO", "FX reserves");
}

export function fetchCurrentAccountPctGdpHistory(countryIso3: string) {
  return fetchWorldBankHistory(countryIso3, "BN.CAB.XOKA.GD.ZS", "current account");
}
