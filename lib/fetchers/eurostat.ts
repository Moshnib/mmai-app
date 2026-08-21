// ============================================================
// Eurostat fetcher — Euro Area inflation (HICP), GDP growth, unemployment.
// Free reuse (commercial and non-commercial) with attribution, confirmed
// live via direct API test 2026-08-21.
//
// Eurostat publishes the euro area under TWO kinds of geo code:
//   - "EA" (changing composition) — always reflects the current euro area,
//     used here for inflation so no code change is needed on future
//     accessions.
//   - Fixed-composition codes like "EA20"/"EA21" — a NEW code is added
//     each time a country joins (EA21 = 21 members, from 2026); the old
//     code (EA20) keeps working but silently stops being "the euro area"
//     rather than erroring. GDP growth and unemployment only publish
//     fixed-composition codes, so EA_GEO_FIXED needs bumping by hand on
//     the next accession — this is exactly what broke the unemployment
//     fetch this project had planned before (hardcoded to EA20 after
//     EA21 launched, so the query silently matched zero rows).
// ============================================================

const EA_GEO_FIXED = "EA21";

interface JsonStatResponse {
  value: Record<string, number>;
  dimension: { time: { category: { index: Record<string, number> } } };
}

// Eurostat's aggregate (Euro Area) series can lag a period behind its own
// dimension listing: the dataset advertises the latest month as an
// available time period (because SOME member country has data for it),
// but the aggregate itself hasn't been computed from all members yet, so
// that specific cell comes back empty. Confirmed live 2026-08-21: EA21
// unemployment for the latest listed month (2026-07) returned an empty
// value despite the dimension/geo filter matching correctly. Asking for
// the last few periods and walking backward to the newest one that
// actually has a value avoids failing on a publication-lag gap.
function latestObservation(json: JsonStatResponse): { period: string; value: number } | null {
  const periods = Object.entries(json.dimension?.time?.category?.index ?? {}).sort((a, b) => b[1] - a[1]);
  for (const [period, idx] of periods) {
    const value = json.value?.[idx];
    if (typeof value === "number" && Number.isFinite(value)) return { period, value };
  }
  return null;
}

export async function fetchEuroAreaInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?format=JSON&geo=EA&coicop=CP00&unit=RCH_A&lastTimePeriod=3";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Eurostat HICP request failed: ${res.status} ${res.statusText}`);

  const obs = latestObservation(await res.json());
  if (!obs) throw new Error("Eurostat HICP: no observation returned");
  return { inflation: obs.value, observationDate: `${obs.period}-01` };
}

export async function fetchEuroAreaGdpGrowth(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tec00115?format=JSON&geo=${EA_GEO_FIXED}&unit=CLV_PCH_PRE&lastTimePeriod=3`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Eurostat GDP growth request failed: ${res.status} ${res.statusText}`);

  const obs = latestObservation(await res.json());
  if (!obs) throw new Error("Eurostat GDP growth: no observation returned");
  return { gdpGrowth: obs.value, observationDate: `${obs.period}-01-01` };
}

export async function fetchEuroAreaUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?format=JSON&geo=${EA_GEO_FIXED}&s_adj=SA&sex=T&age=TOTAL&unit=PC_ACT&lastTimePeriod=3`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Eurostat unemployment request failed: ${res.status} ${res.statusText}`);

  const obs = latestObservation(await res.json());
  if (!obs) throw new Error("Eurostat unemployment: no observation returned");
  return { unemployment: obs.value, observationDate: `${obs.period}-01` };
}
