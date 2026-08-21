// ============================================================
// Bank of Canada fetcher — Target for the Overnight Rate (the Bank's
// policy interest rate). Valet API, no key required, no cost, standard
// terms of use, confirmed live via direct API test 2026-08-21.
// ============================================================

export async function fetchCanadaPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const url = "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bank of Canada request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const obs = json?.observations?.[0];
  const rate = obs?.V39079?.v;
  if (!obs || rate == null) throw new Error("Bank of Canada policy rate: no observation returned");

  return { policyRate: parseFloat(rate), observationDate: obs.d };
}
