// ============================================================
// Eurostat fetcher — Euro Area inflation (HICP), GDP growth, unemployment.
// Free reuse (commercial and non-commercial) with attribution, confirmed
// live via direct API test 2026-08-21.
//
// Eurostat publishes the euro area under TWO kinds of geo code:
//   - "EA" (changing composition) — always reflects the current euro area,
//     used here for inflation so no code change is needed on future
//     accessions.
//   - Fixed-composition codes like "EA20"/"EA21" — a NEW code is added
//     each time a country joins (EA21 = 21 members, from 2026); the old
//     code (EA20) keeps working but silently stops being "the euro area"
//     rather than erroring. GDP growth and unemployment only publish
//     fixed-composition codes, so EA_GEO_FIXED needs bumping by hand on
//     the next accession — this is exactly what broke the unemployment
//     fetch this project had planned before (hardcoded to EA20 after
//     EA21 launched, so the query silently matched zero rows).
// ============================================================

const EA_GEO_FIXED = "EA21";

interface JsonStatResponse {
  value: Record<string, number>;
  dimension: { time: { category: { index: Record<string, number> } } };
}

// Eurostat's aggregate (Euro Area) series can lag a period behind its own
// dimension listing: the dataset advertises the latest month as an
// available time period (because SOME member country has data for it),
// but the aggregate itself hasn't been computed from all members yet, so
// that specific cell comes back empty. Confirmed live 2026-08-21: EA21
// unemployment for the latest listed month (2026-07) returned an empty
// value despite the dimension/geo filter matching correctly. Asking for
// the last few periods and walking backward to the newest one that
// actually has a value avoids failing on a publication-lag gap.
function latestObservation(json: JsonStatResponse): { period: string; value: number } | null {
  const periods = Object.entries(json.dimension?.time?.category?.index ?? {}).sort((a, b) => b[1] - a[1]);
  for (const [period, idx] of periods) {
    const value = json.value?.[idx];
    if (typeof value === "number" && Number.isFinite(value)) return { period, value };
  }
  return null;
}

// ============================================================
// REMOVED 2026-09-02 — fetchEuroAreaInflation()
//
// It read Eurostat `prc_hicp_manr` with geo=EA. Eurostat RETIRED that
// dataset on 4 February 2026 when the euro area HICP methodology changed.
// It did not start returning errors; it stopped gaining new months. The
// function asked for the newest observation, was handed December 2025,
// and returned success every single day for nine months while MMAI
// published euro area inflation as 2.0% and the real figure reached 3.3%.
//
// Verified dead on 2026-09-02: EA, EA19 and EA20 all end at 2025-12, and
// asking for 2026 explicitly returns an empty set.
//
// DO NOT REINSTATE THIS AGAINST prc_hicp_manr. The live series is at the
// ECB: see fetchEuroAreaInflation() in lib/fetchers/ecb.ts, which also
// carries the maximum-age guard this function lacked.
//
// Deleted rather than deprecated on purpose. A function left exported
// "just in case" is a function someone imports by autocomplete.
// ============================================================

export async function fetchEuroAreaGdpGrowth(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tec00115?format=JSON&geo=${EA_GEO_FIXED}&unit=CLV_PCH_PRE&lastTimePeriod=3`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Eurostat GDP growth request failed: ${res.status} ${res.statusText}`);

  const obs = latestObservation(await res.json());
  if (!obs) throw new Error("Eurostat GDP growth: no observation returned");
  return { gdpGrowth: obs.value, observationDate: `${obs.period}-01-01` };
}

export async function fetchEuroAreaUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?format=JSON&geo=${EA_GEO_FIXED}&s_adj=SA&sex=T&age=TOTAL&unit=PC_ACT&lastTimePeriod=3`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Eurostat unemployment request failed: ${res.status} ${res.statusText}`);

  const obs = latestObservation(await res.json());
  if (!obs) throw new Error("Eurostat unemployment: no observation returned");
  return { unemployment: obs.value, observationDate: `${obs.period}-01` };
}

// ============================================================
// Euro-area real GDP growth, QUARTERLY, year-over-year.
//
// Replaces fetchEuroAreaGdpGrowth(), which reads tec00115 -- an ANNUAL
// dataset returning a calendar-year figure stamped January. Growth
// Momentum carries 25% of the MMAI score and was being fed a number up
// to twenty months old.
//
// unit=CLV_PCH_SM is chain-linked volumes, percentage change against the
// SAME PERIOD of the previous year -- i.e. year-over-year, matching the
// concept every other MMAI market uses. CLV_PCH_PRE (change on the
// PREVIOUS period) is deliberately NOT used: it is a different quantity,
// and mixing the two across markets would break the cross-country
// comparison while looking entirely reasonable.
//
// s_adj=SCA is seasonally and calendar adjusted, which is the right
// basis for a quarterly series.
// ============================================================

export async function fetchEuroAreaGdpGrowthQuarterly(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url =
    `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp` +
    `?format=JSON&geo=${EA_GEO_FIXED}&unit=CLV_PCH_SM&na_item=B1GQ&s_adj=SCA&lastTimePeriod=4`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Eurostat quarterly GDP request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const index: Record<string, number> = json?.dimension?.time?.category?.index ?? {};
  const values: Record<string, number> = json?.value ?? {};
  const periods = Object.keys(index);
  if (periods.length === 0) throw new Error("Eurostat quarterly GDP: no periods returned");

  // Walk back from the newest period to the first one that actually has a
  // value -- Eurostat returns the period slots before it publishes them.
  let period: string | null = null;
  let value: number | null = null;
  for (const p of [...periods].sort().reverse()) {
    const v = values[String(index[p])];
    if (typeof v === "number" && Number.isFinite(v)) { period = p; value = v; break; }
  }
  if (period == null || value == null) throw new Error("Eurostat quarterly GDP: no populated observation");

  // "2026-Q2" -> stamp at the end of the quarter it describes.
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) throw new Error(`Eurostat quarterly GDP: unexpected period "${period}"`);
  const endMonth = ["03", "06", "09", "12"][Number(m[2]) - 1];

  return { gdpGrowth: value, observationDate: `${m[1]}-${endMonth}-01` };
}
