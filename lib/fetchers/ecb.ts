// ============================================================
// European Central Bank fetcher — Deposit Facility Rate (the ECB's
// policy rate for MMAI's Monetary Conditions pillar). Public
// institutional data via the ECB Data Portal SDMX REST API — no key,
// no published rate limit, confirmed live via direct API test 2026-08-21.
// ============================================================

export async function fetchEuroAreaPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const url = "https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=1";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ECB request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const seriesObj = json.dataSets?.[0]?.series ?? {};
  const seriesKey = Object.keys(seriesObj)[0];
  const observations = seriesObj[seriesKey]?.observations ?? {};
  const obsKey = Object.keys(observations)[0];
  const rate = observations[obsKey]?.[0];

  const timePeriods = json.structure?.dimensions?.observation?.[0]?.values ?? [];
  const periodId = timePeriods[Number(obsKey)]?.id;

  if (obsKey === undefined || rate == null || !periodId) throw new Error("ECB deposit facility rate: no observation returned");
  return { policyRate: rate, observationDate: periodId };
}
