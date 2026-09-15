// ============================================================
// THE OBSERVATORY'S FIGURES — Denmark and Finland
//
// NO NEW INSTITUTION AND NO NEW LICENCE. Every series comes from a
// source this project already reads and has already cleared:
//
//   inflation     ECB Data Portal, HICP   (the euro area's own dataflow)
//   unemployment  Eurostat une_rt_m
//   GDP growth    Eurostat namq_10_gdp
//   10y yield     Eurostat irt_lt_mcby_m
//   policy rate   BIS WS_CBPOL            (Denmark only — see below)
//   govt debt     BIS WS_TC
//
// ------------------------------------------------------------------
// THE TRAP, WRITTEN DOWN BECAUSE IT WAS NEARLY WALKED INTO TWICE
//
// The obvious source for Danish inflation is Eurostat's `prc_hicp_manr`
// with geo=DK. It responds, returns a plausible number, and is DEAD —
// the same retired dataset that made this site publish euro area
// inflation of 2.0% for nine months while the real figure was 3.3%. On
// 13 September 2026 it still answered for Denmark with December 2025.
//
// So inflation is read from the ECB's live HICP dataflow, on the key
// shape the euro area already uses, with the same maximum-age guard.
//
// ------------------------------------------------------------------
// FINLAND HAS NO POLICY RATE, AND THAT IS NOT A GAP
//
// BIS returns HTTP 404 for WS_CBPOL/D.FI, correctly: Finland uses the
// euro, so the ECB sets one rate for all 21 members. The page says so in
// words rather than showing a dash, because a dash reads as a failed
// fetch and this is a fact about the monetary union.
// ============================================================

/** A monthly series further behind than this has been retired, not
 *  delayed. Matches lib/fetchers/ecb.ts. */
const MAX_MONTHLY_AGE_DAYS = 100;

const EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

interface JsonStat {
  value?: Record<string, number>;
  dimension?: { time?: { category?: { index?: Record<string, number> } } };
}

/** Newest period that actually carries a value.
 *
 *  Eurostat lists a period as available as soon as ANY member has filed
 *  for it, so the newest slot is regularly present and empty. Walking
 *  backwards stops an ordinary publication lag reading as a dead source. */
function newestPopulated(json: JsonStat, what: string): { period: string; value: number } {
  const index = json?.dimension?.time?.category?.index ?? {};
  const values = json?.value ?? {};
  for (const p of Object.keys(index).sort().reverse()) {
    const v = values[String(index[p])];
    if (typeof v === "number" && Number.isFinite(v)) return { period: p, value: v };
  }
  throw new Error(`${what}: no populated observation`);
}

async function eurostat(path: string, what: string): Promise<{ period: string; value: number }> {
  const res = await fetch(`${EUROSTAT}/${path}`, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${res.statusText}`);
  return newestPopulated((await res.json()) as JsonStat, what);
}

const monthToDate = (period: string) => `${period}-01`;

function quarterToDate(period: string, what: string): string {
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) throw new Error(`${what}: unexpected period "${period}"`);
  return `${m[1]}-${["03", "06", "09", "12"][Number(m[2]) - 1]}-01`;
}

// ------------------------------------------------------------------
//  INFLATION
// ------------------------------------------------------------------

export async function fetchObservatoryInflation(
  geo: string,
): Promise<{ inflation: number; observationDate: string }> {
  const what = `ECB HICP (${geo})`;
  const url = `https://data-api.ecb.europa.eu/service/data/HICP/M.${geo}.N.000000.4D0.ANR?format=csvdata&lastNObservations=1`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${res.statusText}`);

  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`${what}: no data rows`);

  // By header NAME, never position: 30+ metadata columns, reordered freely.
  const header = lines[0].split(",");
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti === -1 || vi === -1) throw new Error(`${what}: expected columns not found`);

  const cells = lines[1].split(",");
  const period = (cells[ti] ?? "").trim();
  const value = Number(cells[vi]);
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`${what}: unexpected period "${period}"`);
  if (!Number.isFinite(value)) throw new Error(`${what}: non-numeric value "${cells[vi]}"`);

  const observationDate = monthToDate(period);
  const ageDays = (Date.now() - Date.parse(observationDate)) / 86_400_000;
  if (ageDays > MAX_MONTHLY_AGE_DAYS) {
    throw new Error(
      `${what}: newest observation is ${period} (${Math.round(ageDays)} days old). A monthly ` +
        `series this far behind has been retired — do NOT fall back to Eurostat's prc_hicp_manr, ` +
        `which is the dataset that already caused nine months of a wrong published figure.`,
    );
  }
  return { inflation: value, observationDate };
}

// ------------------------------------------------------------------
//  UNEMPLOYMENT, GDP, BOND YIELD
// ------------------------------------------------------------------

/** Harmonised LFS rate, seasonally adjusted — the same definition every
 *  scored market uses, so a figure here means what it means elsewhere. */
export async function fetchObservatoryUnemployment(
  geo: string,
): Promise<{ unemployment: number; observationDate: string }> {
  const what = `Eurostat unemployment (${geo})`;
  const { period, value } = await eurostat(
    `une_rt_m?format=JSON&geo=${geo}&s_adj=SA&sex=T&age=TOTAL&unit=PC_ACT&lastTimePeriod=4`,
    what,
  );
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`${what}: unexpected period "${period}"`);
  return { unemployment: value, observationDate: monthToDate(period) };
}

/** Change on the SAME quarter a year earlier. CLV_PCH_PRE — change on the
 *  previous quarter — is a different quantity, and mixing the two across
 *  countries breaks the comparison while looking entirely reasonable. */
export async function fetchObservatoryGdpGrowth(
  geo: string,
): Promise<{ gdpGrowth: number; observationDate: string }> {
  const what = `Eurostat quarterly GDP (${geo})`;
  const { period, value } = await eurostat(
    `namq_10_gdp?format=JSON&geo=${geo}&unit=CLV_PCH_SM&na_item=B1GQ&s_adj=SCA&lastTimePeriod=4`,
    what,
  );
  return { gdpGrowth: value, observationDate: quarterToDate(period, what) };
}

export async function fetchObservatoryBondYield(
  geo: string,
): Promise<{ yield10y: number; observationDate: string }> {
  const what = `Eurostat 10y yield (${geo})`;
  const { period, value } = await eurostat(
    `irt_lt_mcby_m?format=JSON&geo=${geo}&int_rt=MCBY&lastTimePeriod=4`,
    what,
  );
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`${what}: unexpected period "${period}"`);
  return { yield10y: value, observationDate: monthToDate(period) };
}
