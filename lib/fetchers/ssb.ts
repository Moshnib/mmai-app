// ============================================================
// Statistics Norway (SSB) fetcher — CPI, 12-month rate.
// Explicit CC BY 4.0 on SSB's own public API docs (commercial use
// permitted with attribution), confirmed live via direct API test
// 2026-08-21. Table 14700 -- note table 03013 (the older monthly CPI
// table) carries its own notice that it stopped being updated as of
// Feb 2026, replaced by 14700; using 03013 here would have wired in an
// already-stale endpoint.
//
// Unlike bls.ts/abs.ts/statcan.ts, SSB already publishes the 12-month
// rate directly (ContentsCode "Tolvmanedersendring") -- no YoY math
// needed. This is a POST query (PxWebApi), unlike every other fetcher
// in this project, which are all GET.
// ============================================================

interface JsonStat2Response {
  value: number[];
  dimension: { Tid: { category: { index: Record<string, number>; label: Record<string, string> } } };
}

export async function fetchNorwayInflation(): Promise<{ inflation: number; observationDate: string }> {
  const res = await fetch("https://data.ssb.no/api/v0/en/table/14700/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "VareTjenesteGrp", selection: { filter: "item", values: ["00"] } },
        { code: "ContentsCode", selection: { filter: "item", values: ["Tolvmanedersendring"] } },
        { code: "Tid", selection: { filter: "top", values: ["1"] } },
      ],
      response: { format: "json-stat2" },
    }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SSB request failed: ${res.status} ${res.statusText}`);

  const json: JsonStat2Response = await res.json();
  const value = json.value?.[0];
  const period = Object.keys(json.dimension?.Tid?.category?.index ?? {})[0]; // e.g. "2026M07"
  if (value === undefined || !period) throw new Error("SSB CPI 12-month rate: no observation returned");

  const [year, month] = period.split("M");
  return { inflation: value, observationDate: `${year}-${month}-01` };
}
