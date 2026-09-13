// ============================================================
// KOREA — added 2026-09-13 as the ninth market.
//
// NO NEW INSTITUTION AND NO NEW LICENCE. Korea is the first market added
// to this project that needed neither:
//
//   inflation     OECD   (CPI, the measure the Bank of Korea targets)
//   unemployment  OECD   (same dataflow Japan already uses)
//   GDP growth    OECD   (quarterly national accounts)
//   policy rate   BIS    (lib/fetchers/bis.ts)
//   govt debt     BIS    (lib/fetchers/bis.ts)
//
// Both institutions were already audited and wired here.
//
// ------------------------------------------------------------------
// WHY KOREA AND NOT THE OTHERS
//
// Eight candidates were screened the same way on 12-13 September, and
// Korea is the only one that fit. Recorded because the failures are not
// obvious and someone will otherwise re-derive them:
//
//   Denmark       GDP counts pharmaceutical production carried out
//                 ABROAD -- 3.42% average against the euro area's 0.98%
//                 while unemployment sat at 6.7%. Worth 32 points of
//                 score. Also: no inflation target at all, because the
//                 Nationalbank exists to hold the krone to the euro.
//   Brazil        policy rate 14%, which is +6.1 SD against a reference
//                 set whose maximum is 6.75%. Capacity pegged at 100 and
//                 Brazil ranked FIRST. A high rate in an emerging market
//                 is a risk premium, not room to cut.
//   Turkey        policy rate 37%. +17.9 SD. Same failure, six times over.
//   South Africa  unemployment 32.4% = -12.7 SD. Scored 0.0 exactly, and
//                 a fall to 25% would not move it. Honest data, no
//                 resolution left.
//   Malaysia      Bank Negara publishes NO inflation target, so there is
//                 no distance for Conditions to measure.
//   Thailand      unemployment 0.8%, below the reference minimum of 2.40.
//                 Informal-sector absorption, not a tight labour market.
//   Poland/Czechia/Hungary   fine on the numbers, but OECD's price series
//                 for all three is frozen at 2025-12, so each needs its
//                 own national statistics office.
//
// Every Korean reading sits inside 1.6 SD of the reference mean. Nothing
// pegs. That is the test, and it is the one worth running first on any
// future candidate.
//
// ------------------------------------------------------------------
// OECD RATE-LIMITS, AND IT LOOKS EXACTLY LIKE MISSING DATA
//
// These three calls are SEQUENTIAL, deliberately, and must stay that way.
// Fired in parallel, OECD returns HTTP 500 for ALL of them -- including
// series that work perfectly when called alone. While researching this
// market a parallel probe reported "no OECD data for Japan", which is
// false: Japan's unemployment is fetched from OECD by this project in
// production every day.
//
// So a Promise.all here would not fail loudly. It would return three
// nulls, the row would be written PARTIAL, and Korea would silently stop
// being scored. Keep them in series.
//
// ------------------------------------------------------------------
// EVERY SERIES CARRIES AN AGE GUARD, AND OECD IS WHY
//
// OECD's price dataflow rots PER COUNTRY while still answering HTTP 200
// with a plausible number. Measured 13 September 2026:
//
//   Japan        2021-06     five years stale
//   Chile        2023-12
//   Mexico       2024-07
//   France, Poland, Czechia, Hungary, Switzerland   2025-12
//   Korea, US, UK, Germany, Canada, Australia       current
//
// Korea is current today and nothing guarantees it stays that way. The
// guard is the same one that protects euro area inflation after Eurostat
// retired a dataflow and this site published a wrong figure for nine
// months. Throwing is deliberate: the refresh route's settle() turns it
// into a null, the row is written PARTIAL, and the score is withheld
// rather than published from a dead source.
// ============================================================

/** A monthly series further behind than this has not been delayed, it has
 *  been retired. Matches lib/fetchers/ecb.ts, and is the reason a frozen
 *  OECD series cannot quietly become Korea's published inflation. */
const MAX_MONTHLY_AGE_DAYS = 100;

/** Quarterly national accounts publish roughly two months after the
 *  quarter ends, so a genuinely current figure can be ~150 days old at
 *  the start of a new quarter. 220 allows that and still catches a
 *  dataflow that has stopped. */
const MAX_QUARTERLY_AGE_DAYS = 220;

const OECD = "https://sdmx.oecd.org/public/rest/data";

/** format=csvfile, NOT csvfilewithlabels.
 *
 *  That one word took an OECD request from ~0.1s to 11-40 SECONDS, which
 *  blew the timeout and silently dropped Japan onto an annual World Bank
 *  fallback for months. It was diagnosed as "OECD is unreachable from
 *  Vercel"; it was latency. See lib/fetchers/oecd.ts for the full account. */
const FORMAT = "lastNObservations=1&format=csvfile";

async function oecdRow(url: string, what: string): Promise<{ period: string; value: number }> {
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) {
    throw new Error(
      `${what}: OECD returned ${res.status}. If several OECD calls ran at once this is ` +
        `rate limiting, not missing data -- these calls must stay sequential.`,
    );
  }

  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`${what}: no data rows`);

  // By header NAME, never position: these dataflows carry 30+ columns and
  // OECD adds label columns beside code columns without warning.
  const header = lines[0].split(",");
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti === -1 || vi === -1) throw new Error(`${what}: expected columns not found`);

  // Rows come back in NO GUARANTEED ORDER, so take the newest rather than
  // the last -- the trap already documented in lib/fetchers/oecd.ts.
  const rows = lines
    .slice(1)
    .map((l) => l.split(","))
    .filter((c) => c.length > vi && c[ti] && c[vi])
    .map((c) => ({ period: c[ti].trim(), value: Number(c[vi]) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.period.localeCompare(b.period));

  const newest = rows[rows.length - 1];
  if (!newest) throw new Error(`${what}: no usable observation`);
  return newest;
}

function guardAge(what: string, observationDate: string, maxDays: number) {
  const ageDays = (Date.now() - Date.parse(observationDate)) / 86_400_000;
  if (ageDays > maxDays) {
    throw new Error(
      `${what}: newest observation is ${observationDate} (${Math.round(ageDays)} days old). ` +
        `OECD series rot per country while still returning HTTP 200 -- Japan's price series ` +
        `has been frozen at 2021-06 for five years. Find a replacement rather than raising this limit.`,
    );
  }
}

// ------------------------------------------------------------------
//  INFLATION — CPI, year over year
// ------------------------------------------------------------------

/** The Bank of Korea targets 2% on HEADLINE CPI, stated on its own site
 *  and in force since 2019. This is that series -- not a core measure and
 *  not an HICP equivalent, because the score measures distance from the
 *  target each central bank actually set. */
export async function fetchKoreaInflation(): Promise<{ inflation: number; observationDate: string }> {
  const what = "OECD CPI (KR)";
  const { period, value } = await oecdRow(
    `${OECD}/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/KOR.M.N.CPI.PA._T.N.GY?${FORMAT}`,
    what,
  );
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`${what}: unexpected period "${period}"`);
  const observationDate = `${period}-01`;
  guardAge(what, observationDate, MAX_MONTHLY_AGE_DAYS);
  return { inflation: value, observationDate };
}

// ------------------------------------------------------------------
//  UNEMPLOYMENT — harmonised monthly rate
// ------------------------------------------------------------------

/** The same dataflow and the same key shape Japan already uses, with the
 *  reference area swapped. Verified by this project on 2026-08-28 to be a
 *  genuine pass-through of the national figure rather than a different
 *  measure. */
export async function fetchKoreaUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const what = "OECD unemployment (KR)";
  const { period, value } = await oecdRow(
    `${OECD}/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/KOR.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M?${FORMAT}`,
    what,
  );
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`${what}: unexpected period "${period}"`);
  const observationDate = `${period}-01`;
  guardAge(what, observationDate, MAX_MONTHLY_AGE_DAYS);
  return { unemployment: value, observationDate };
}

// ------------------------------------------------------------------
//  GDP GROWTH — quarterly, year over year
// ------------------------------------------------------------------

/** Quarterly real GDP growth against the SAME quarter a year earlier,
 *  which is the concept every other market here uses. Growth on the
 *  previous quarter is a different quantity and mixing the two across
 *  markets breaks the comparison while looking entirely reasonable.
 *
 *  Measured over fourteen quarters before wiring: Korea averaged 1.92%,
 *  between Sweden's 1.70% and Brazil's 2.62%, ranging -0.03% to +3.78%.
 *  Ordinary cyclical variation -- not Denmark's 3.42% structural
 *  overstatement, which is what disqualified Denmark. */
export async function fetchKoreaGdpGrowthQuarterly(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const what = "OECD quarterly GDP (KR)";
  const { period, value } = await oecdRow(
    `${OECD}/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH_OECD,1.1/Q.Y.KOR.S1..B1GQ......GY.?${FORMAT}`,
    what,
  );
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) throw new Error(`${what}: unexpected period "${period}"`);
  const endMonth = ["03", "06", "09", "12"][Number(m[2]) - 1];
  const observationDate = `${m[1]}-${endMonth}-01`;
  guardAge(what, observationDate, MAX_QUARTERLY_AGE_DAYS);
  return { gdpGrowth: value, observationDate };
}

// ------------------------------------------------------------------
//  ALL THREE, IN SERIES
// ------------------------------------------------------------------

export interface KoreaReadings {
  inflation: { inflation: number; observationDate: string } | null;
  unemployment: { unemployment: number; observationDate: string } | null;
  gdpGrowth: { gdpGrowth: number; observationDate: string } | null;
  errors: string[];
}

/** THE ONLY WAY THE REFRESH ROUTE SHOULD FETCH KOREA.
 *
 *  Every other market fires its sources with Promise.all, because they
 *  are different institutions. Korea's three come from ONE, and OECD
 *  answers concurrent requests with HTTP 500 across the board. A
 *  Promise.all here would not fail loudly -- it would return three nulls,
 *  write the row PARTIAL, and quietly stop scoring Korea.
 *
 *  Each failure is captured rather than thrown so one dead series cannot
 *  take the other two with it, matching what settle() does elsewhere. */
export async function fetchKoreaReadings(): Promise<KoreaReadings> {
  const out: KoreaReadings = { inflation: null, unemployment: null, gdpGrowth: null, errors: [] };

  try {
    out.inflation = await fetchKoreaInflation();
  } catch (e) {
    out.errors.push(`KR inflation: ${(e as Error).message}`);
  }

  try {
    out.unemployment = await fetchKoreaUnemployment();
  } catch (e) {
    out.errors.push(`KR unemployment: ${(e as Error).message}`);
  }

  try {
    out.gdpGrowth = await fetchKoreaGdpGrowthQuarterly();
  } catch (e) {
    out.errors.push(`KR GDP growth: ${(e as Error).message}`);
  }

  return out;
}
