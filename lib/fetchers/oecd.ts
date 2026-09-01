// ============================================================
// OECD fetcher — monthly unemployment rate, used for JAPAN ONLY.
//
// Why OECD here and nowhere else: Canada, the UK and Australia all
// publish a monthly unemployment rate through statistics offices this
// project already calls for CPI (StatCan, ONS, ABS), so those go direct
// -- fewer intermediaries, full precision, licences already cleared,
// and four markets don't end up behind one shared dependency. Japan is
// the exception: its national source (e-Stat) requires a registered
// application ID, so there is no key-free national endpoint. OECD
// republishes Japan's Statistics Bureau figure and is the best
// available option.
//
// Verified 2026-08-28 that OECD is a genuine pass-through rather than a
// different measure: its US series matched BLS (4.1/4.2/4.3 across
// three months) and its Australian series matched ABS to six decimals
// (4.461825 vs 4.46182469). It is the same number, republished.
//
// Licence: OECD's default is CC BY 4.0, commercial use explicit, with
// no database-storage restriction (the clause that forced FRED out of
// this project). Confirmed on OECD's Open Access Policy page
// 2026-08-28: "The default licence applied by the OECD is Creative
// Commons Attribution 4.0 (CC BY 4.0)". Because the underlying figure
// originates with Japan's Statistics Bureau, both are attributed on the
// Sources page -- OECD's own terms ask users to check for third-party
// ownership.
//
// TWO TRAPS, both found by testing the live API rather than reading the
// docs:
//
//  1. Rows come back in NO GUARANTEED ORDER. With a `startPeriod`
//     query the last row for a country was June, not July. Anything
//     that takes "the last row" silently stores a stale figure with no
//     error raised. `lastNObservations=1` returns exactly one row per
//     country; the sort below is a second line of defence.
//  2. A hardcoded `startPeriod` rots -- it returns an ever-growing
//     payload as time passes, which makes trap 1 progressively worse.
//
// Key dimensions, in order:
//   REF_AREA . MEASURE . UNIT_MEASURE . TRANSFORMATION . ADJUSTMENT
//   . SEX . AGE . ACTIVITY . FREQ
// so JPN.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M reads as: Japan,
// monthly unemployment rate, % of labour force, no transformation,
// calendar+seasonally adjusted, both sexes, 15 and over, monthly.
// ============================================================

const OECD_UNEMPLOYMENT_URL =
  "https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/" +
  // format=csvfile, NOT csvfilewithlabels.
//
// This one word was the whole problem. "withlabels" makes OECD expand
// every code in a 16-column dataflow into a human-readable label, and
// the request went from ~0.1s to 11-40 SECONDS. The 8s timeout below
// then aborted it every time, so Japan silently fell through to the
// World Bank ANNUAL fallback -- which is why Japan was scoring on
// unemployment from January 2025 while OECD had June 2026 all along.
//
// It was diagnosed as "OECD is unreachable from Vercel". It was not a
// network block. It was latency, and Vercel Hobby's 10s function cap
// made raising the timeout impossible -- so the real fix had to be
// making the request fast, not waiting longer.
//
// The parser below selects columns BY HEADER NAME, so it never needed
// the labels. Measured after the change: 0.08-2.0s across repeated
// calls, comfortably inside the timeout.
"JPN.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M?lastNObservations=1&format=csvfile";

// Observed 2026-08-28: one transient 500 during testing, then 8/8
// clean on an immediate retry. Throwing is the right response -- the
// refresh route's settle() turns it into a null for this indicator, so
// Japan publishes on four pillars that day (coverage 0.8, above the
// 0.70 gate) and recovers on the next run. No retry loop here: the job
// runs daily, and a retry inside one invocation would eat the shared
// function timeout that five other markets are queued behind.
export async function fetchJapanUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const res = await fetch(OECD_UNEMPLOYMENT_URL, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OECD request failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const lines = csv.trim().split("\n");
  if (lines.length < 2) throw new Error("OECD unemployment: response contained no data rows");

  // Select columns BY HEADER NAME, never by position -- this dataflow
  // carries 30+ columns and OECD adds label columns beside every code
  // column, so positional indexing would break on any schema tweak.
  const header = lines[0].split(",");
  const timeIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (timeIdx === -1 || valueIdx === -1) throw new Error("OECD unemployment response: expected columns not found");

  const rows = lines
    .slice(1)
    .map((line) => line.split(","))
    .filter((cols) => cols.length > valueIdx && cols[timeIdx] && cols[valueIdx])
    .map((cols) => ({ period: cols[timeIdx], value: parseFloat(cols[valueIdx]) }))
    .filter((r) => !Number.isNaN(r.value))
    .sort((a, b) => a.period.localeCompare(b.period));

  if (rows.length === 0) throw new Error("OECD unemployment: no usable observations returned");

  const latest = rows[rows.length - 1];
  // TIME_PERIOD is "YYYY-MM" for a monthly series. Guard rather than
  // assume: a shape change here would otherwise produce an
  // "Invalid Date" on the page instead of a caught failure.
  if (!/^\d{4}-\d{2}$/.test(latest.period)) {
    throw new Error(`OECD unemployment: unexpected period format "${latest.period}"`);
  }

  return { unemployment: latest.value, observationDate: `${latest.period}-01` };
}
