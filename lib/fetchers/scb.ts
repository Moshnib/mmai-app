// ============================================================
// Statistics Sweden (SCB) — inflation, unemployment and GDP growth.
//
// LICENCE, checked on SCB's own pages rather than a third-party catalog
// (the rule this project adopted after Norway): Creative Commons
// Attribution 4.0. SCB states "you are free to copy, reproduce, and
// redistribute all statistics", commercial use included, with "Source:
// Statistics Sweden" required. That is the same licence class as ONS,
// Statistics Canada and the ABS, and unlike Norges Bank it needs no
// permission email before monetising.
//
// SCB PUBLISHES ALL THREE RATES READY-MADE, which is unusual and worth
// saying: no index arithmetic happens here.
//   inflation     CPIF "annual changes" (code 000007ZM) -- SCB's own YoY
//   unemployment  labour status ALÖSP, "unemployment rate, percent"
//   GDP growth    NR0103DH, "change in volume corresp. period previous
//                 year, percent" -- already year-over-year
// Every other market in this project computes at least one of these from
// a raw index (see abs.ts, statcan.ts), and each of those computations is
// a place to get it wrong. Here there are none.
//
// The API is PxWeb: a POST of a JSON query against a table path, no key,
// no registration, free of charge. The API data is CC0 -- SCB states it
// "may be used and disseminated ... without any requirement to state the
// source" -- so nothing here needs anyone's permission. MMAI attributes
// regardless. Verified live 2026-09-12: CPIF 0.7% (2026M07),
// unemployment 8.6% (2026M07), GDP growth 3.3% (2026K2).
//
// RATE LIMIT: ten call-ups per ten seconds per IP, and 100,000 values per
// table. This module makes three calls per refresh, three times a day --
// nine a day -- and each asks for a single observation. Recorded because
// it is what would break if a PAGE were ever pointed at this directly
// instead of the scheduled job.
// ============================================================

const BASE = "https://api.scb.se/OV0104/v1/doris/en/ssd";

/** PxWeb json-stat2, reduced to the shape this file needs. */
interface JsonStat2 {
  value?: (number | null)[];
  dimension?: { Tid?: { category?: { index?: Record<string, number> } } };
}

/** One POST, one number, one period. Every SCB call here asks for the
 *  single newest observation, so the response is one value and one time
 *  label -- anything else means the table changed shape and is worth
 *  throwing over rather than guessing at. */
async function fetchLatest(table: string, query: unknown[], label: string): Promise<{ value: number; period: string }> {
  const res = await fetch(`${BASE}/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`SCB ${label} request failed: ${res.status} ${res.statusText}`);

  const json = (await res.json()) as JsonStat2;
  const periods = Object.keys(json.dimension?.Tid?.category?.index ?? {});
  const values = json.value ?? [];
  if (periods.length !== 1 || values.length !== 1) {
    throw new Error(`SCB ${label}: expected one observation, got ${values.length} for ${periods.length} period(s)`);
  }
  const value = values[0];
  if (value == null || !Number.isFinite(value)) throw new Error(`SCB ${label}: no numeric value returned`);
  return { value, period: periods[0] };
}

/** "2026M07" -> "2026-07-01". */
function monthToDate(period: string, label: string): string {
  const m = /^(\d{4})M(\d{2})$/.exec(period);
  if (!m) throw new Error(`SCB ${label}: unrecognised month "${period}"`);
  return `${m[1]}-${m[2]}-01`;
}

/** "2026K2" -> "2026-06-01", the LAST month of the quarter.
 *  Matches how every other quarterly series here is dated: US Q2 is
 *  stored as 2026-06-01, UK Q1 as 2026-03-01. A quarter is not a day, and
 *  stamping it at the start would make it look three months fresher than
 *  it is. */
function quarterToDate(period: string, label: string): string {
  const q = /^(\d{4})K([1-4])$/.exec(period);
  if (!q) throw new Error(`SCB ${label}: unrecognised quarter "${period}"`);
  return `${q[1]}-${String(Number(q[2]) * 3).padStart(2, "0")}-01`;
}

/**
 * CPIF, NOT CPI -- and the difference is not cosmetic.
 *
 * The composite scores |inflation - target|, so the series has to be the
 * one that country's central bank actually targets. Every market here
 * already follows that rule: PCE for the United States because the Fed
 * defines its 2% on PCE, HICP for the euro area, headline CPI for the
 * UK, Canada and Australia because those central banks target it.
 *
 * The Riksbank's formal target variable has been CPIF since 2017. CPIF is
 * the same basket as CPI with the effect of changed mortgage interest
 * rates removed -- and the Riksbank's own explanation of why is exactly
 * the trap here: rate cuts, which are meant to RAISE inflation, push CPI
 * DOWN in the short term through mortgage costs. Sweden has cut to
 * 1.75%, so CPI is depressed by the very policy the score is trying to
 * read.
 *
 * Measured at the time of wiring: CPI 0.2%, CPIF 0.7% for 2026M07. As a
 * distance from the 2% target that is 1.8 against 1.3 -- half a point of
 * pure artefact in the scored quantity.
 */
export async function fetchSwedenInflation(): Promise<{ inflation: number; observationDate: string }> {
  const { value, period } = await fetchLatest(
    "PR/PR0101/PR0101G/KPIF2020",
    [
      { code: "ContentsCode", selection: { filter: "item", values: ["000007ZM"] } },
      { code: "Tid", selection: { filter: "top", values: ["1"] } },
    ],
    "CPIF",
  );
  return { inflation: value, observationDate: monthToDate(period, "CPIF") };
}

export async function fetchSwedenUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const { value, period } = await fetchLatest(
    "AM/AM0401/AM0401A/AKURLBefM",
    [
      // ALÖSP is "unemployment rate, percent" -- SR_DATA is the
      // seasonally adjusted series, which is what a labour-market reading
      // compares across countries.
      { code: "Arbetskraftstillh", selection: { filter: "item", values: ["ALÖSP"] } },
      { code: "TypData", selection: { filter: "item", values: ["SR_DATA"] } },
      { code: "Kon", selection: { filter: "item", values: ["1+2"] } },
      { code: "Alder", selection: { filter: "item", values: ["tot15-74"] } },
      { code: "Tid", selection: { filter: "top", values: ["1"] } },
    ],
    "unemployment",
  );
  return { unemployment: value, observationDate: monthToDate(period, "unemployment") };
}

export async function fetchSwedenGdpGrowthQuarterly(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const { value, period } = await fetchLatest(
    "NR/NR0103/NR0103B/NR0103ENS2010T12Kv",
    [
      // 0010 is GDP at market prices; NR0103DH is the year-over-year
      // volume change, which is the same concept every other market's
      // growth figure uses. NR0103DJ next to it is quarter-on-quarter and
      // would NOT be comparable -- do not swap them.
      { code: "SNI2007", selection: { filter: "item", values: ["0010"] } },
      { code: "ContentsCode", selection: { filter: "item", values: ["NR0103DH"] } },
      { code: "Tid", selection: { filter: "top", values: ["1"] } },
    ],
    "GDP growth",
  );
  return { gdpGrowth: value, observationDate: quarterToDate(period, "GDP growth") };
}
