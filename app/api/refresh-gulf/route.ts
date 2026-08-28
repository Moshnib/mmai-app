import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { fetchInflation, fetchFxReservesMonths, fetchCurrentAccountPctGdp } from "@/lib/fetchers/worldbank";
import { fetchBahrainInflation } from "@/lib/fetchers/bahrainCpi";
import { fetchQatarInflation } from "@/lib/fetchers/qatarCpi";
import { fetchQatarRealEstate } from "@/lib/fetchers/qatarRealEstate";
import { fetchSaudiInflation } from "@/lib/fetchers/datasaudi";
import { fetchBisPolicyRate } from "@/lib/fetchers/bis";

/**
 * Gulf Watch's own refresh job — writes to gulf_indicators, never to
 * raw_indicators/mmai_scores. Kept as a SEPARATE route from the main
 * /api/refresh (not folded into that GET handler) because the combined
 * execution-time budget of 6 scored markets plus 6 panel countries is
 * too much for one Vercel Hobby function regardless of timeout
 * settings — not for error-isolation reasons (each market's failure
 * handling in the main route is already per-market and wouldn't leak
 * either way).
 *
 * These six countries never get a composite score — there's no
 * coverage threshold here, no pillar math, just each country's own
 * available raw numbers, stored honestly. A country missing an
 * indicator (e.g. every country's real estate except Qatar's) simply
 * leaves that column null — see the schema's own check constraint
 * requiring a label whenever a real-estate value IS present, so a
 * number is never shown without saying what it is.
 *
 * Three pillars per country: cost of living (CPI), investment
 * confidence (real estate, where available), currency stability (FX
 * reserves + current account — every Gulf currency here is pegged to
 * or closely tracks the US dollar, so reserve cover is a genuinely
 * meaningful "can the peg hold" signal, unlike for the 6 main markets).
 */

const GULF_COUNTRIES = ["AE", "BH", "QA", "SA", "KW", "OM"] as const;
type GulfCountryCode = (typeof GULF_COUNTRIES)[number];

const ISO3: Record<GulfCountryCode, string> = {
  AE: "ARE", BH: "BHR", QA: "QAT", SA: "SAU", KW: "KWT", OM: "OMN",
};

const SOURCE_NOTES: Record<GulfCountryCode, string> = {
  AE: "World Bank (live)",
  BH: "data.gov.bh + World Bank (live)",
  QA: "data.gov.qa + World Bank (live)",
  SA: "Data Saudi + World Bank + BIS (live)",
  KW: "World Bank + BIS (live)",
  OM: "World Bank (live)",
};

async function settle<T>(label: string, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.error(`Gulf fetch failed [${label}]:`, (err as Error).message);
    return null;
  }
}

interface GulfRawIndicators {
  cpiYoy: number | null;
  realEstateValue: number | null;
  realEstateMetricLabel: string | null;
  fxReservesMonths: number | null;
  currentAccountPctGdp: number | null;
  observationDate: string;
  // Each field's OWN true reporting period, distinct from the single
  // shared `observationDate` above (kept for backward compatibility with
  // the not-null legacy column). CPI, FX reserves, and current account
  // routinely come from different years for the same country -- see
  // app/api/refresh-gulf's git history for why collapsing them into one
  // date was a real problem (a site owner spot-checked several Gulf
  // Watch numbers against IMF/national sources and found no way to tell,
  // from the UI, which figures were current and which were over a year
  // old -- because that information was being fetched correctly but
  // thrown away before it reached the database).
  cpiObservationDate: string | null;
  realEstateObservationDate: string | null;
  fxReservesObservationDate: string | null;
  currentAccountObservationDate: string | null;
  // Only Saudi Arabia and Kuwait have a usable policy-rate source (BIS).
  // The label travels with the value because these are different
  // instruments -- Saudi's repo rate vs Kuwait's discount rate -- same
  // reasoning as realEstateMetricLabel above.
  policyRate: number | null;
  policyRateLabel: string | null;
  policyRateObservationDate: string | null;
}

async function fetchCpi(country: GulfCountryCode): Promise<{ inflation: number; observationDate: string } | null> {
  if (country === "AE") return settle("UAE CPI", fetchInflation("ARE"));
  if (country === "BH") return settle("Bahrain CPI", fetchBahrainInflation());
  if (country === "QA") return settle("Qatar CPI", fetchQatarInflation());
  if (country === "SA") return settle("Saudi CPI", fetchSaudiInflation());
  if (country === "KW") return settle("Kuwait CPI", fetchInflation("KWT"));
  return settle("Oman CPI", fetchInflation("OMN")); // OM
}

// BIS carries central bank policy rates for Saudi Arabia and Kuwait
// only (of these six). UAE and Bahrain are absent from BIS and IMF
// alike, and their own central banks are bot-protected; Qatar and Oman
// are available from IMF but not wired in yet.
async function fetchPolicyRate(country: GulfCountryCode) {
  if (country === "SA") return settle("Saudi policy rate", fetchBisPolicyRate("SA"));
  if (country === "KW") return settle("Kuwait policy rate", fetchBisPolicyRate("KW"));
  return null;
}

async function fetchGulfIndicators(country: GulfCountryCode): Promise<GulfRawIndicators> {
  const today = new Date().toISOString().slice(0, 10);
  const iso3 = ISO3[country];

  const [cpi, fx, ca, realEstate, policy] = await Promise.all([
    fetchCpi(country),
    settle(`${country} FX reserves`, fetchFxReservesMonths(iso3)),
    settle(`${country} current account`, fetchCurrentAccountPctGdp(iso3)),
    country === "QA" ? settle("Qatar real estate", fetchQatarRealEstate()) : Promise.resolve(null),
    fetchPolicyRate(country),
  ]);

  return {
    cpiYoy: cpi?.inflation ?? null,
    realEstateValue: realEstate?.realEstateValue ?? null,
    realEstateMetricLabel: realEstate?.realEstateMetricLabel ?? null,
    fxReservesMonths: fx?.fxReservesMonths ?? null,
    currentAccountPctGdp: ca?.currentAccountPctGdp ?? null,
    observationDate: cpi?.observationDate ?? realEstate?.observationDate ?? today,
    cpiObservationDate: cpi?.observationDate ?? null,
    realEstateObservationDate: realEstate?.observationDate ?? null,
    fxReservesObservationDate: fx?.observationDate ?? null,
    currentAccountObservationDate: ca?.observationDate ?? null,
    policyRate: policy?.policyRate ?? null,
    policyRateLabel: policy?.rateLabel ?? null,
    policyRateObservationDate: policy?.observationDate ?? null,
  };
}

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const results: Array<{ country: string; status: string }> = [];

  for (const country of GULF_COUNTRIES) {
    try {
      const raw = await fetchGulfIndicators(country);
      const partial = raw.cpiYoy == null || raw.fxReservesMonths == null || raw.currentAccountPctGdp == null;
      const baseNote = SOURCE_NOTES[country];
      const sourceNote = partial ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)` : baseNote;

      const { error } = await supabase.from("gulf_indicators").insert({
        country_code: country,
        cpi_yoy: raw.cpiYoy,
        real_estate_value: raw.realEstateValue,
        real_estate_metric_label: raw.realEstateMetricLabel,
        fx_reserves_months_imports: raw.fxReservesMonths,
        current_account_pct_gdp: raw.currentAccountPctGdp,
        observation_date: raw.observationDate,
        cpi_observation_date: raw.cpiObservationDate,
        real_estate_observation_date: raw.realEstateObservationDate,
        fx_reserves_observation_date: raw.fxReservesObservationDate,
        current_account_observation_date: raw.currentAccountObservationDate,
        policy_rate: raw.policyRate,
        policy_rate_label: raw.policyRateLabel,
        policy_rate_observation_date: raw.policyRateObservationDate,
        source_note: sourceNote,
        status: "current",
      });
      if (error) throw new Error(`Supabase write failed for ${country}: ${error.message}`);

      results.push({ country, status: "ok" });
    } catch (err) {
      console.error(`Gulf refresh failed for ${country}:`, err);
      results.push({ country, status: `error: ${(err as Error).message}` });
    }
  }

  return NextResponse.json({ refreshedAt: new Date().toISOString(), results });
}
