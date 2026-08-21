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

// ============================================================
// Japan, via FRED's redistribution of OECD data.
// OECD's own Terms & Conditions (checked directly, 2026-08-21) permit
// extraction, redistribution, and commercial use with attribution --
// confirmed CC BY 4.0 as of their July 2024 open-access transition.
// ============================================================

async function fetchFredCsv(seriesId: string): Promise<Array<[string, number]>> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FRED request failed for ${seriesId}: ${res.status} ${res.statusText}`);
  const csv = await res.text();
  const lines = csv.trim().split("\n").slice(1); // drop header row
  return lines
    .map((line) => {
      const [date, valueStr] = line.split(",");
      return [date, parseFloat(valueStr)] as [string, number];
    })
    .filter(([, v]) => !Number.isNaN(v));
}

/** Japan unemployment — OECD series, already a direct percentage, no
 *  transformation needed (unlike CPI, which is an index requiring a YoY calc). */
export async function fetchJapanUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const rows = await fetchFredCsv("LRUN74TTJPM156S");
  if (rows.length === 0) throw new Error("Japan unemployment series returned no data");
  const [date, value] = rows[rows.length - 1];
  return { unemployment: value, observationDate: date };
}

/** Japan inflation — OECD CPI index (2015=100), monthly. Computed as a
 *  year-over-year change, same pattern as lib/fetchers/bls.ts uses for the US. */
export async function fetchJapanInflation(): Promise<{ inflation: number; observationDate: string }> {
  const rows = await fetchFredCsv("JPNCPIALLMINMEI");
  if (rows.length < 13) throw new Error("Japan CPI series returned too few rows for a YoY calculation");
  const [latestDate, latestValue] = rows[rows.length - 1];
  const [, priorYearValue] = rows[rows.length - 13]; // 12 months earlier, monthly series
  const yoy = ((latestValue - priorYearValue) / priorYearValue) * 100;
  return { inflation: Math.round(yoy * 100) / 100, observationDate: latestDate };
}
