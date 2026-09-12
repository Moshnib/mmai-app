// ============================================================
// NORWAY — unemployment and GDP growth, from Eurostat.
//
// ACTIVATED 2026-09-12, after Norway spent three weeks paused. Read the
// history before changing any of it, because the reasons are not obvious
// from the code.
//
// WHY NORWAY WAS PAUSED, AND WHAT ACTUALLY UNBLOCKED IT
//
// Norway was removed from display on 2026-08-22 because Norges Bank's own
// terms do not state whether commercial reuse of the Key Policy Rate is
// permitted. The plan was to email them. Nobody did, and the market sat
// dormant with all its code intact.
//
// It did not need an email. BIS republishes the Norwegian policy rate in
// WS_CBPOL, naming Norges Bank as the source, under terms that DO permit
// commercial use with citation -- the identical route that unblocked
// Saudi Arabia, Kuwait and Sweden. lib/fetchers/norgesbank.ts is
// therefore no longer called: it is correct code against an unclear
// licence, which is worse than no code at all.
//
// WHY THESE TWO SERIES MOVED OFF THE WORLD BANK
//
// Norway's unemployment and GDP were on World Bank annual series -- an
// ILO MODELLED ESTIMATE for unemployment, not Norway's own measurement,
// updating once a year and lagging by one to two. Every other scored
// market reads a monthly or quarterly figure from its own statistics
// office or from Eurostat. Leaving Norway on annual data would have made
// its "as of" date a year older than everyone else's while looking
// identical in the table.
//
// Eurostat carries both for Norway, live, under terms already cleared
// for the euro area: unemployment monthly, GDP quarterly. Confirmed live
// 2026-09-12 -- unemployment 2026-07, GDP 2026-Q2.
//
// INFLATION IS NOT HERE. It stays in lib/fetchers/ssb.ts, reading
// Statistics Norway's own CPI 12-month rate, because that is the measure
// Norges Bank's 2% target is set on. Eurostat's HICP for Norway exists
// and is the wrong number for this purpose.
//
// WHAT THIS FILE DELIBERATELY DOES NOT FETCH: a ten-year bond yield.
// Eurostat's Maastricht yield series covers EU members, and Norway is not
// one -- it returns empty rather than failing. Norway therefore shows N/A
// in the bond panel exactly as Sweden does, which is honest and already
// the established handling.
// ============================================================

interface JsonStat {
  value?: Record<string, number>;
  dimension?: { time?: { category?: { index?: Record<string, number> } } };
}

/** Newest period that actually carries a value.
 *
 *  Eurostat lists a period as soon as ANY country has filed for it, so
 *  the newest slot is regularly present and empty. Walking backwards is
 *  what stops an ordinary publication lag from reading as a dead source.
 *  Identical in intent to the helper in lib/fetchers/eurostat.ts. */
function newestPopulated(json: JsonStat, what: string): { period: string; value: number } {
  const index = json?.dimension?.time?.category?.index ?? {};
  const values = json?.value ?? {};
  for (const p of Object.keys(index).sort().reverse()) {
    const v = values[String(index[p])];
    if (typeof v === "number" && Number.isFinite(v)) return { period: p, value: v };
  }
  throw new Error(`${what}: no populated observation in response`);
}

async function getJson(url: string, what: string): Promise<JsonStat> {
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${what} request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as JsonStat;
}

/** Harmonised LFS unemployment rate, seasonally adjusted -- the same
 *  definition every other MMAI market uses, which is the whole reason it
 *  is read from Eurostat rather than from Norway's own registered count. */
export async function fetchNorwayUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const url =
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m" +
    "?format=JSON&geo=NO&s_adj=SA&sex=T&age=TOTAL&unit=PC_ACT&lastTimePeriod=4";
  const { period, value } = newestPopulated(await getJson(url, "Eurostat unemployment (NO)"), "Eurostat unemployment (NO)");
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`Eurostat unemployment (NO): unexpected period "${period}"`);
  return { unemployment: value, observationDate: `${period}-01` };
}

/** Quarterly GDP, change on the SAME quarter a year earlier.
 *
 *  CLV_PCH_SM, matching every other market. CLV_PCH_PRE (change on the
 *  previous quarter) is a different quantity and mixing the two across
 *  markets would break the comparison while looking entirely reasonable.
 *
 *  ON THE OIL QUESTION, which is the obvious worry for Norway: this is
 *  TOTAL GDP, including petroleum, and Norwegians usually quote "mainland
 *  GDP" instead. Measured before wiring this up, over twelve quarters,
 *  Norway's total GDP averaged 1.09% against the euro area's 0.98% and
 *  Sweden's 1.70%. It is an ordinary European growth series, not a
 *  distorted one -- unlike Denmark, whose headline GDP averaged 3.42% on
 *  pharmaceutical production carried out abroad, and which was rejected
 *  as a market for exactly that reason. Total GDP is also what every
 *  other market here reports, and the 148-row reference ladder is built
 *  from total GDP, so switching Norway to mainland GDP would break the
 *  comparison rather than improve it. */
export async function fetchNorwayGdpGrowthQuarterly(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const url =
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp" +
    "?format=JSON&geo=NO&unit=CLV_PCH_SM&na_item=B1GQ&s_adj=SCA&lastTimePeriod=4";
  const what = "Eurostat quarterly GDP (NO)";
  const { period, value } = newestPopulated(await getJson(url, what), what);
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) throw new Error(`${what}: unexpected period "${period}"`);
  const endMonth = ["03", "06", "09", "12"][Number(m[2]) - 1];
  return { gdpGrowth: value, observationDate: `${m[1]}-${endMonth}-01` };
}
