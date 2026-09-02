// ============================================================
// European Central Bank fetcher — Deposit Facility Rate (the ECB's
// policy rate for MMAI's Monetary Conditions pillar). Public
// institutional data via the ECB Data Portal SDMX REST API — no key,
// no published rate limit, confirmed live via direct API test 2026-08-21.
// ============================================================

// ============================================================
// EURO AREA INFLATION — HICP, all items, annual rate of change.
//
// REPLACED EUROSTAT ON 2026-09-02. Read this before changing it back.
//
// MMAI previously read Eurostat's `prc_hicp_manr`. On 4 FEBRUARY 2026 the
// euro area HICP underwent a methodology change, and BOTH Eurostat's
// dataset and the ECB's old `ICP` dataflow were discontinued and replaced
// on that day. Neither started failing. They simply stopped gaining new
// months.
//
// The old fetcher asked for the newest observation, was handed December
// 2025, and returned success. MMAI then published euro area inflation as
// 2.0% -- exactly on target -- for NINE MONTHS, while the real figure
// climbed to 3.3%. Price Stability carries 25% of the score, so the Euro
// Area was published as "Supportive" when it was "Balanced". Nothing
// alerted, because every staleness check in this project measures
// fetched_at -- when we last ASKED -- and not the age of what came back.
//
// THE KEY CHANGED SHAPE, NOT JUST NAME. Old: ICP/M.U2.N.000000.4.ANR.
// New: HICP/M.U2.N.000000.4D0.ANR -- the data-provider dimension went
// from `4` to `4D0`. The old key still resolves against the old dataflow
// and still returns 2025 data, so a half-migration looks like it works.
//
// Licence: ECB Data Portal free access and reuse policy -- the same terms
// already cleared for the deposit facility rate above.
// ============================================================

/** Monthly series are allowed to lag; a monthly series this far behind is
 *  not lagging, it is dead. Eurostat's retired dataset was 9 months stale
 *  before anyone noticed. 100 days permits a genuinely late publication
 *  (the longest normal HICP gap is ~7 weeks) while catching a source that
 *  has stopped entirely, well inside a quarter rather than after a year. */
const MAX_MONTHLY_AGE_DAYS = 100;

export async function fetchEuroAreaInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url =
    "https://data-api.ecb.europa.eu/service/data/HICP/M.U2.N.000000.4D0.ANR?format=csvdata&lastNObservations=1";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ECB HICP request failed: ${res.status} ${res.statusText}`);

  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("ECB HICP: no data rows");

  // Select by HEADER NAME, never by position. This response carries 30+
  // columns of metadata and the ECB reorders them freely.
  const header = lines[0].split(",");
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti === -1 || vi === -1) throw new Error("ECB HICP: expected columns not found");

  // The row's own commentary field can contain commas inside quotes, but
  // TIME_PERIOD and OBS_VALUE both sit BEFORE it, so a plain split is safe
  // for these two indices specifically.
  const cells = lines[1].split(",");
  const period = (cells[ti] ?? "").trim();
  const value = Number(cells[vi]);

  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`ECB HICP: unexpected period "${period}"`);
  if (!Number.isFinite(value)) throw new Error(`ECB HICP: non-numeric value "${cells[vi]}"`);

  const observationDate = `${period}-01`;

  // The guard that the Eurostat version lacked. THROWING is deliberate:
  // the refresh route's settle() turns this into a null, the row is
  // written PARTIAL with a note, and the score is withheld rather than
  // published from a dead source. A wrong number presented confidently is
  // worse than a visible gap.
  const ageDays = (Date.now() - Date.parse(observationDate)) / 86_400_000;
  if (ageDays > MAX_MONTHLY_AGE_DAYS) {
    throw new Error(
      `ECB HICP: newest observation is ${period} (${Math.round(ageDays)} days old). ` +
        `A monthly series this far behind means the dataflow has been retired, as ` +
        `Eurostat's prc_hicp_manr was on 2026-02-04. Find the replacement series.`
    );
  }

  return { inflation: value, observationDate };
}

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
