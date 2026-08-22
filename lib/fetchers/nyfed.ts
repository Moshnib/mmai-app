// ============================================================
// Federal Reserve Bank of New York fetcher — Effective Federal Funds
// Rate (EFFR), the daily reference rate NY Fed itself calculates and
// publishes. Used in place of FRED (the St. Louis Fed's redistribution
// portal) specifically because FRED's Terms of Service prohibit storing
// or caching FRED Content in a database, which conflicts with this
// app's refresh pipeline. The NY Fed's own Terms of Use, by contrast,
// explicitly permit downloading, storing, and using Content for
// personal or business purposes.
//
// NY Fed's Terms of Use require a specific notice for Reference Rates
// data (see the "Reference Rates" Use Restriction at
// newyorkfed.org/privacy/termsofuse), reproduced on the Sources page:
// "The Effective Federal Funds Rate (EFFR) is subject to the Terms of
// Use posted at newyorkfed.org. The New York Fed is not responsible for
// publication of the EFFR by MMAI, does not sanction or endorse any
// particular republication, and has no liability for your use."
// ============================================================

interface NyFedRateRow {
  effectiveDate: string;
  type: string;
  percentRate: number;
}

export async function fetchUsPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const url = "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`NY Fed request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: NyFedRateRow[] = json?.refRates ?? [];
  const latest = rows.find((r) => r.type === "EFFR");
  if (!latest) throw new Error("NY Fed EFFR: no EFFR row found in response");

  return { policyRate: latest.percentRate, observationDate: latest.effectiveDate };
}
