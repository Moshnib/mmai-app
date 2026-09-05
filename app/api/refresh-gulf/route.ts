import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { fetchInflation, fetchFxReservesMonths, fetchCurrentAccountPctGdp } from "@/lib/fetchers/worldbank";
import { fetchBahrainInflation } from "@/lib/fetchers/bahrainCpi";
import { withRetry } from "@/lib/retryFetch";
import {
  carryForwardGulf, carryNote, MAX_GULF_CARRY_DAYS, type StoredGulfRow,
} from "@/lib/gulfCarryForward";
import { fetchQatarInflation } from "@/lib/fetchers/qatarCpi";
import { fetchQatarRealEstate } from "@/lib/fetchers/qatarRealEstate";
import { fetchSaudiInflation } from "@/lib/fetchers/datasaudi";
import { fetchBisPolicyRate } from "@/lib/fetchers/bis";
import { GULF_POLICY_RATE_LABELS } from "@/lib/gulfMarkets";

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

// Takes a THUNK now, not a promise, because a retry has to be able to
// start the request again -- a promise can only be awaited once. Every
// call site passes `() => fetchX()` for that reason.
async function settle<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await withRetry(`Gulf [${label}]`, run);
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
  if (country === "AE") return settle("UAE CPI", () => fetchInflation("ARE"));
  if (country === "BH") return settle("Bahrain CPI", () => fetchBahrainInflation());
  if (country === "QA") return settle("Qatar CPI", () => fetchQatarInflation());
  if (country === "SA") return settle("Saudi CPI", () => fetchSaudiInflation());
  if (country === "KW") return settle("Kuwait CPI", () => fetchInflation("KWT"));
  return settle("Oman CPI", () => fetchInflation("OMN")); // OM
}

// BIS carries central bank policy rates for Saudi Arabia and Kuwait
// only (of these six). UAE and Bahrain are absent from BIS and IMF
// alike, and their own central banks are bot-protected.
//
// QATAR AND OMAN, checked against IMF MFS_IR on 6 September 2026, are
// NOT the matching pair an earlier note here claimed:
//
//   Qatar   MFS166 "Monetary policy-related, Rate"  4.35%, 2026-M07
//   Oman    no MFS166 at all; its best rate series stops at 2022-M04
//           and its discount rate at 2018-M10
//
// So Oman is not a wiring job, it is absent data, and publishing a
// four-year-old policy rate beside Saudi's from last week would be
// worse than the gap. Qatar is genuinely available and current, and is
// held back only by IMF's terms, which require written permission for
// commercial reuse -- see MMAI_MASTER_HANDOVER.md.
async function fetchPolicyRate(country: GulfCountryCode) {
  if (country === "SA") return settle("Saudi policy rate", () => fetchBisPolicyRate("SA"));
  if (country === "KW") return settle("Kuwait policy rate", () => fetchBisPolicyRate("KW"));
  return null;
}

async function fetchGulfIndicators(country: GulfCountryCode): Promise<GulfRawIndicators> {
  const today = new Date().toISOString().slice(0, 10);
  const iso3 = ISO3[country];

  const [cpi, fx, ca, realEstate, policy] = await Promise.all([
    fetchCpi(country),
    settle(`${country} FX reserves`, () => fetchFxReservesMonths(iso3)),
    settle(`${country} current account`, () => fetchCurrentAccountPctGdp(iso3)),
    country === "QA" ? settle("Qatar real estate", () => fetchQatarRealEstate()) : Promise.resolve(null),
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
  // Fails CLOSED: a missing CRON_SECRET refuses everyone rather than
  // admitting everyone. See lib/cronAuth.ts for what the old fail-open
  // version would have cost.
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const results: Array<{ country: string; status: string }> = [];

  // Freshness guard -- same reasoning as app/api/refresh/route.ts. The
  // scheduled trigger runs three times a day so a missed or failed
  // attempt recovers on its own; skipping countries already written
  // today is what keeps the extra attempts harmless no-ops instead of
  // duplicate rows. ?force=1 overrides.
  const force = new URL(request.url).searchParams.get("force") === "1";
  const today = new Date().toISOString().slice(0, 10);
  let alreadyToday = new Set<string>();
  if (!force) {
    const { data: doneRows } = await supabase
      .from("gulf_indicators")
      .select("country_code")
      .gte("fetched_at", `${today}T00:00:00Z`);
    alreadyToday = new Set((doneRows ?? []).map((r) => r.country_code as string));
  }

  const pending = GULF_COUNTRIES.filter((c) => !alreadyToday.has(c));
  if (pending.length === 0) {
    return NextResponse.json({
      refreshedAt: new Date().toISOString(),
      skipped: true,
      reason: `All ${GULF_COUNTRIES.length} countries already have a reading for ${today}. Pass ?force=1 to refresh anyway.`,
      results: [],
    });
  }

  // The last stored row per country, for carry-forward. One query for
  // all six rather than one each: the refresh runs inside a 60-second
  // function and six round trips to buy what one buys is time taken
  // from the fetches that actually matter.
  //
  // Ordered newest-first and bucketed by country, so each country reads
  // its own most recent row regardless of how the rows interleave.
  const historyByCountry = new Map<string, StoredGulfRow[]>();
  {
    const since = new Date(Date.now() - MAX_GULF_CARRY_DAYS * 86_400_000).toISOString();
    const { data: prevRows } = await supabase
      .from("gulf_indicators")
      .select(
        "country_code, cpi_yoy, cpi_observation_date, fx_reserves_months_imports, fx_reserves_observation_date, " +
        "current_account_pct_gdp, current_account_observation_date, real_estate_value, real_estate_metric_label, " +
        "real_estate_observation_date, policy_rate, policy_rate_label, policy_rate_observation_date, fetched_at",
      )
      .in("country_code", pending)
      .gte("fetched_at", since)
      .order("fetched_at", { ascending: false });
    // Every row in the window, newest first, not just the newest one.
    // Carry-forward scans per field, because a flaky source usually
    // fails on consecutive days and the most recent row is then just as
    // empty as today's.
    for (const row of prevRows ?? []) {
      const code = (row as unknown as { country_code: string }).country_code;
      const list = historyByCountry.get(code);
      if (list) list.push(row as unknown as StoredGulfRow);
      else historyByCountry.set(code, [row as unknown as StoredGulfRow]);
    }
  }

  for (const country of pending) {
    try {
      const fetched = await fetchGulfIndicators(country);

      // A source that blinks must not wipe a good number. Values are
      // only ever carried INTO a null, and each carried value brings its
      // own reporting date with it, so the card keeps saying the period
      // the figure actually belongs to. See lib/gulfCarryForward.ts.
      const { merged: raw, carried, expired } = carryForwardGulf(
        fetched,
        historyByCountry.get(country) ?? [],
        new Date(),
      );
      if (carried.length > 0) {
        console.warn(`Gulf [${country}]: carried forward ${carried.join(", ")}`);
      }
      // Policy rate counts toward PARTIAL only for the countries that
// actually have a source. Ignoring it entirely would let SOURCE_NOTES
      // keep claiming "+ BIS (live)" on a day the BIS fetch failed;
      // counting it for everyone would mark the other four PARTIAL every
      // single day, since they have no policy-rate source by design.
      const expectsPolicyRate = country in GULF_POLICY_RATE_LABELS;
      const partial =
        raw.cpiYoy == null ||
        raw.fxReservesMonths == null ||
        raw.currentAccountPctGdp == null ||
        (expectsPolicyRate && raw.policyRate == null);
      const baseNote = SOURCE_NOTES[country];
      // Three states, and they are not the same thing. A carried value
      // is a source that blinked and a number a reader can still trust;
      // PARTIAL is a genuine hole; expired means a source has been down
      // longer than carry-forward will cover, which is the one that
      // needs somebody to look.
      const expiredNote = expired
        ? ` — a source has now been unavailable for more than ${MAX_GULF_CARRY_DAYS} days, so nothing was carried forward`
        : "";
      const sourceNote = partial
        ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)${carryNote(carried)}${expiredNote}`
        : `${baseNote}${carryNote(carried)}${expiredNote}`;

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
