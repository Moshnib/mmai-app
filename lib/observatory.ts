// ============================================================
//  THE OBSERVATORY — countries tracked, deliberately not scored
//
//  Two days of screening candidate countries produced a clear boundary:
//  MMAI is calibrated for mature, floating-rate, inflation-targeting
//  economies whose GDP measures domestic activity. Eight of ten
//  candidates failed that test, and almost none failed for having bad
//  data. Brazil's was the best found anywhere.
//
//  Those countries are not uninteresting. They are unscoreable, which is
//  a different thing, and throwing away good data because one composite
//  cannot digest it would be the wrong trade. So they appear here with
//  their real figures, their real dates, their sources — and no score.
//
//  THE SAME DECISION GULF WATCH ALREADY MADE. Gulf Watch shows six
//  countries and refuses to combine them into a composite, because its
//  labour-market figures are not comparable with the scored markets'.
//  It keeps its own name and its own page; this is the same idea
//  extended to everywhere else, not a replacement for it.
//
//  WHY EACH ONE IS HERE RATHER THAN IN THE INDEX is stored beside it and
//  rendered on the page. An unscored country with no stated reason
//  invites the reader to assume the data was missing, which for every
//  one of these is false.
// ============================================================

export interface ObservatoryCountry {
  code: string;
  name: string;
  region: string;
  /** Why this country is tracked rather than scored, in a sentence a
   *  reader can act on. Rendered verbatim. */
  whyUnscored: string;
  /** The measurable behind that sentence, where there is one. Keeps the
   *  claim checkable rather than asserted. */
  evidence?: string;
  /** Markets without their own monetary policy have no policy rate to
   *  show, and a dash with no explanation reads as a missing fetch. */
  policyRateNote?: string;
}

export const OBSERVATORY: ObservatoryCountry[] = [
  {
    code: "DK",
    name: "Denmark",
    region: "Nordics",
    whyUnscored:
      "Danish GDP counts pharmaceutical production carried out in other countries, so it measures a Danish-headquartered industry rather than the Danish economy. MMAI's Direction dimension is GDP growth and nothing else, so that one figure would carry a third of the score.",
    evidence:
      "Denmark's GDP averaged 3.42% over twelve quarters against the euro area's 0.98%, while Danish unemployment sat at 6.7%. Scored, it would have ranked second of nine.",
    policyRateNote:
      "Danmarks Nationalbank sets this rate to hold the krone fixed against the euro, not to steer Danish prices — it has no inflation target of its own.",
  },
  {
    code: "FI",
    name: "Finland",
    region: "Nordics",
    whyUnscored:
      "Finland uses the euro, so it has no policy rate of its own and is already inside the Euro Area score. Showing it separately is a view of one member, not a tenth market.",
    policyRateNote:
      "Finland has no policy rate of its own. The European Central Bank sets one rate for all 21 euro members, and it is shown under the Euro Area.",
  },
];

export const OBSERVATORY_CODES = OBSERVATORY.map((c) => c.code);

/** Regions in display order, each with the countries in it. Derived, so
 *  adding a country to the list above is the only edit needed. */
export function observatoryByRegion(): { region: string; countries: ObservatoryCountry[] }[] {
  const order: string[] = [];
  const byRegion = new Map<string, ObservatoryCountry[]>();
  for (const c of OBSERVATORY) {
    if (!byRegion.has(c.region)) {
      byRegion.set(c.region, []);
      order.push(c.region);
    }
    byRegion.get(c.region)!.push(c);
  }
  return order.map((region) => ({ region, countries: byRegion.get(region)! }));
}

/** A row as stored. Mirrors the five scored indicators so the same
 *  figures mean the same things across the site — an Observatory
 *  country's inflation is the same measure, from the same institution,
 *  as a scored market's. */
export interface ObservatoryRow {
  country_code: string;
  inflation: number | null;
  gdp_growth: number | null;
  unemployment: number | null;
  policy_rate: number | null;
  debt_pct_gdp: number | null;
  yield_10y: number | null;
  inflation_observation_date: string | null;
  gdp_observation_date: string | null;
  unemployment_observation_date: string | null;
  policy_rate_observation_date: string | null;
  debt_observation_period: string | null;
  yield_observation_date: string | null;
  observation_date: string;
  fetched_at: string;
  source_note: string | null;
}
