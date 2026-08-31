// ============================================================
// U.S. Bureau of Economic Analysis fetcher — Real GDP growth.
// Public domain (U.S. federal government work). Free API key, no cost,
// never expires (registered 2026-08-22). Confirmed live via direct API
// test: table T10101, line 1 ("Gross domestic product") already IS the
// percent-change series -- no YoY math needed, unlike bls.ts/abs.ts.
//
// BEA returns HTTP 200 even on a bad request (missing/invalid key,
// unknown table) -- the error shows up in the response body, not the
// status code, so res.ok alone isn't a reliable success check.
// ============================================================

interface BeaDataRow {
  LineNumber: string;
  TimePeriod: string;
  DataValue: string;
}

export async function fetchUsGdpGrowth(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const key = process.env.BEA_API_KEY;
  if (!key) throw new Error("BEA_API_KEY is not configured");

  const url = `https://apps.bea.gov/api/data/?UserID=${key}&method=GetData&datasetname=NIPA&TableName=T10101&Frequency=A&Year=X&ResultFormat=JSON`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BEA request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const apiError = json?.BEAAPI?.Error ?? json?.BEAAPI?.Results?.Error;
  if (apiError) throw new Error(`BEA API returned an error: ${JSON.stringify(apiError)}`);

  const rows: BeaDataRow[] = json?.BEAAPI?.Results?.Data ?? [];
  const gdpRows = rows.filter((r) => r.LineNumber === "1"); // Line 1 = "Gross domestic product"
  if (gdpRows.length === 0) throw new Error("BEA GDP growth: no rows found for line 1");

  const latest = gdpRows.reduce((a, b) => (b.TimePeriod > a.TimePeriod ? b : a));
  const value = parseFloat(latest.DataValue.replace(/,/g, ""));
  if (Number.isNaN(value)) throw new Error(`BEA GDP growth: unparseable value "${latest.DataValue}"`);

  return { gdpGrowth: value, observationDate: `${latest.TimePeriod}-01-01` };
}

// ============================================================
// U.S. headline PCE inflation — the measure the Fed's 2% target is
// actually defined on.
//
// WHY THIS EXISTS. MMAI scores Price Stability as a deviation from a 2%
// target. For the United States that target belongs to the Federal
// Reserve, and the Fed's "Longer-Run Goals and Monetary Policy Strategy"
// states the 2% objective in terms of the annual change in the price
// index for PERSONAL CONSUMPTION EXPENDITURES. Scoring US inflation
// against a 2% target while feeding it CPI measures the country against
// a benchmark it does not use. The Working Charter (30 Aug 2026, §10)
// reached the same conclusion independently.
//
// CPI is NOT abandoned -- fetchUsInflation() above still runs and CPI is
// still displayed. This changes which series enters the SCORE.
//
// The two are not interchangeable, and the gap is not a fixed offset.
// Measured on 2026-08-31 for 2026M07: PCE 3.70% against CPI 3.36%, so
// PCE was running 0.34pp ABOVE CPI -- the reverse of the long-run
// average, where CPI's fixed basket and narrower scope usually put it
// above PCE. That is precisely why the correct series has to be fetched
// rather than approximated from the other with an assumed wedge.
//
// Table T20804 line 1 = "Personal consumption expenditures (PCE)", the
// HEADLINE index (not the core/ex-food-and-energy line). It returns
// index LEVELS, so unlike fetchUsGdpGrowth the year-over-year change is
// computed here.
// ============================================================

interface BeaMonthlyRow extends BeaDataRow {
  LineDescription?: string;
}

export async function fetchUsPceInflation(): Promise<{ inflation: number; observationDate: string }> {
  const key = process.env.BEA_API_KEY;
  if (!key) throw new Error("BEA_API_KEY is not configured");

  // Two calendar years, so the same month one year back is always present
  // even in January. Asking for Year=X on a monthly table returns every
  // month BEA holds, which is far more than this needs.
  const now = new Date().getFullYear();
  const years = `${now - 1},${now}`;
  const url =
    `https://apps.bea.gov/api/data/?UserID=${key}&method=GetData&datasetname=NIPA` +
    `&TableName=T20804&Frequency=M&Year=${years}&ResultFormat=JSON`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BEA PCE request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  // BEA answers 200 with the error in the body — see the note at the top
  // of this file. res.ok alone is not a success check.
  const apiError = json?.BEAAPI?.Error ?? json?.BEAAPI?.Results?.Error;
  if (apiError) throw new Error(`BEA PCE API returned an error: ${JSON.stringify(apiError)}`);

  const rows: BeaMonthlyRow[] = json?.BEAAPI?.Results?.Data ?? [];
  const pce = rows.filter((r) => r.LineNumber === "1");
  if (pce.length < 13) {
    throw new Error(`BEA PCE: need 13+ monthly points to compute a YoY rate, got ${pce.length}`);
  }

  // Guard against BEA reordering the table: line 1 must still be headline
  // PCE. If the table is restructured this throws rather than silently
  // scoring the United States on some other line.
  const desc = pce[0].LineDescription ?? "";
  if (!/personal consumption expenditures/i.test(desc)) {
    throw new Error(`BEA PCE: line 1 is "${desc}", not headline PCE — table may have been restructured`);
  }

  const byPeriod = new Map(pce.map((r) => [r.TimePeriod, parseFloat(r.DataValue.replace(/,/g, ""))]));
  const latestPeriod = [...byPeriod.keys()].sort().pop()!;
  const [y, m] = [latestPeriod.slice(0, 4), latestPeriod.slice(5)]; // "2026M07" -> "2026","07"
  const priorPeriod = `${Number(y) - 1}M${m}`;

  const latest = byPeriod.get(latestPeriod);
  const prior = byPeriod.get(priorPeriod);
  if (latest == null || prior == null || !Number.isFinite(latest) || !Number.isFinite(prior) || prior === 0) {
    throw new Error(`BEA PCE: cannot compute YoY for ${latestPeriod} (need ${priorPeriod})`);
  }

  const yoy = ((latest - prior) / prior) * 100;
  return {
    inflation: Math.round(yoy * 100) / 100,
    observationDate: `${y}-${m}-01`,
  };
}
