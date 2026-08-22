// ============================================================
// Norges Bank fetcher — Policy rate (Key Policy Rate / Styringsrente).
// Norges Bank's official Data Portal, no key required, confirmed live
// via direct API test 2026-08-21. Governed by Norway's national open
// government data framework; unlike Statistics Norway's API (which
// states CC BY 4.0 explicitly), Norges Bank's own pages don't spell
// out the license in so many words -- noted honestly on the Sources
// page rather than overstating confidence.
//
// IMPORTANT: this response shape is NOT identical to lib/fetchers/ecb.ts
// despite both being SDMX-JSON -- Norges Bank wraps dataSets/structure
// under a top-level "data" key (confirmed via a real captured response),
// while the ECB's response has no such wrapper. Don't assume SDMX-JSON
// APIs share one shape; check each one.
// ============================================================

export async function fetchNorwayPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const url = "https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=sdmx-json&lastNObservations=1";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Norges Bank request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const seriesObj = json.data?.dataSets?.[0]?.series ?? {};
  const seriesKey = Object.keys(seriesObj)[0];
  const observations = seriesObj[seriesKey]?.observations ?? {};
  const obsKey = Object.keys(observations)[0];
  const rate = observations[obsKey]?.[0];

  const timePeriods = json.data?.structure?.dimensions?.observation?.[0]?.values ?? [];
  const periodId = timePeriods[Number(obsKey)]?.id;

  if (obsKey === undefined || rate == null || !periodId) throw new Error("Norges Bank policy rate: no observation returned");
  return { policyRate: parseFloat(rate), observationDate: periodId };
}
