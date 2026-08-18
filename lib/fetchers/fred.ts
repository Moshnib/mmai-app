// ============================================================
// FRED fetcher — US Federal Funds Rate
// Public domain (the Federal Reserve is the data owner — see the
// licensing audit in the methodology paper, Table 1).
// ============================================================

export async function fetchUsPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FRED request failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const lines = csv.trim().split("\n");
  // Format: "DATE,FEDFUNDS" header, then rows like "2026-07-01,3.63"
  const lastLine = lines[lines.length - 1];
  const [date, valueStr] = lastLine.split(",");
  const value = parseFloat(valueStr);
  if (Number.isNaN(value)) throw new Error(`Could not parse FRED value from row: ${lastLine}`);

  return { policyRate: value, observationDate: date };
}
