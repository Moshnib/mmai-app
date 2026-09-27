import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { fetchFxReservesMonths, fetchCurrentAccountPctGdp } from "@/lib/fetchers/worldbank";
import { fetchBahrainInflation } from "@/lib/fetchers/bahrainCpi";
import { withRetry, MAX_ATTEMPT_MS } from "@/lib/retryFetch";
import { fetchQatarInflation } from "@/lib/fetchers/qatarCpi";
import { fetchQatarRealEstate } from "@/lib/fetchers/qatarRealEstate";
import { fetchSaudiInflation } from "@/lib/fetchers/datasaudi";
import { fetchBisPolicyRate } from "@/lib/fetchers/bis";
import { GULF_POLICY_RATE_LABELS } from "@/lib/gulfMarkets";
import { parseGulfRelay, gulfSourceNote, type RelayKey, type RelayedFigure } from "@/lib/gulfRelay";

type Relay = Partial<Record<RelayKey, RelayedFigure>>;

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

// The per-row source note is built by gulfSourceNote (lib/gulfRelay.ts),
// because it now depends on which path produced each figure.

// Takes a THUNK now, not a promise, because a retry has to be able to
// start the request again -- a promise can only be awaited once. Every
// call site passes `() => fetchX()` for that reason.
async function settle<T>(label: string, run: () => Promise<T>, deadline?: number): Promise<T | null> {
  try {
    return await withRetry(`Gulf [${label}]`, run, { deadline });
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
  // Saudi Arabia and Kuwait (BIS) and, since 19 September, Qatar (IMF,
  // relayed) have a usable policy-rate source.
  // The label travels with the value because these are different
  // instruments -- Saudi's repo rate vs Kuwait's discount rate -- same
  // reasoning as realEstateMetricLabel above.
  policyRate: number | null;
  policyRateLabel: string | null;
  policyRateObservationDate: string | null;
}

// RELAYED FIRST (19 September). The refresh workflow fetches these on the
// GitHub runner (scripts/relay-gulf.mjs) and hands them in:
//
//   AE/KW/OM  IMF CPI, quarterly (UAE) or monthly. RELAY ONLY, no World
//             Bank fallback. The card dates these by the granularity in
//             lib/gulfMarkets.ts; a fallback annual figure under a monthly
//             label would print "Jan 2025", and a non-null fallback would
//             stop carry-forward holding the last IMF figure. A missed
//             relay stores null, which carry-forward covers for 14 days.
//   BH        data.gov.bh, which fails from Vercel. The route's own fetch
//             stays as a fallback: same source, same granularity.
//
// The "already written today" guard means a relay missed at 06:10 is not
// retried at 12:00 or 18:00 -- acceptable, because carry-forward covers it.
const toCpi = (r: RelayedFigure | undefined) => (r ? { inflation: r.value, observationDate: r.observationDate } : null);

async function fetchCpi(country: GulfCountryCode, deadline: number, relay: Relay): Promise<{ inflation: number; observationDate: string } | null> {
  if (country === "AE") return toCpi(relay.ae_cpi);
  if (country === "KW") return toCpi(relay.kw_cpi);
  if (country === "OM") return toCpi(relay.om_cpi);
  if (country === "BH") return toCpi(relay.bh_cpi) ?? settle("Bahrain CPI", () => fetchBahrainInflation(), deadline);
  if (country === "QA") return settle("Qatar CPI", () => fetchQatarInflation(), deadline);
  return settle("Saudi CPI", () => fetchSaudiInflation(), deadline); // SA
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
// worse than the gap.
//
// QATAR IS WIRED since 19 September: the IMF's terms for statistical
// data (read that day in a browser -- see MMAI_MASTER_HANDOVER.md §40)
// permit publishing with attribution; only COMMERCIAL reuse needs their
// permission, and that is on the pre-monetization list. It arrives
// relayed (MFS166, monthly), not fetched here.
async function fetchPolicyRate(country: GulfCountryCode, deadline: number, relay: Relay) {
  if (country === "SA") return settle("Saudi policy rate", () => fetchBisPolicyRate("SA"), deadline);
  if (country === "KW") return settle("Kuwait policy rate", () => fetchBisPolicyRate("KW"), deadline);
  if (country === "QA" && relay.qa_rate) {
    return { policyRate: relay.qa_rate.value, rateLabel: GULF_POLICY_RATE_LABELS.QA, observationDate: relay.qa_rate.observationDate };
  }
  return null;
}

async function fetchGulfIndicators(country: GulfCountryCode, deadline: number, relay: Relay): Promise<GulfRawIndicators> {
  const today = new Date().toISOString().slice(0, 10);
  const iso3 = ISO3[country];

  const [cpi, fx, ca, realEstate, policy] = await Promise.all([
    fetchCpi(country, deadline, relay),
    settle(`${country} FX reserves`, () => fetchFxReservesMonths(iso3), deadline),
    settle(`${country} current account`, () => fetchCurrentAccountPctGdp(iso3), deadline),
    country === "QA" ? settle("Qatar real estate", () => fetchQatarRealEstate(), deadline) : Promise.resolve(null),
    fetchPolicyRate(country, deadline, relay),
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
  // scheduled trigger runs up to six times a day so a missed or failed
  // attempt recovers on its own; skipping countries already written
  // today is what keeps the extra attempts harmless no-ops instead of
  // duplicate rows. ?force=1 overrides.
  const force = new URL(request.url).searchParams.get("force") === "1";
  // Figures fetched by the refresh workflow and handed in (lib/gulfRelay.ts).
  const relay: Relay = parseGulfRelay(new URL(request.url));
  console.log(`Gulf relay: ${Object.keys(relay).join(", ") || "nothing handed in"}`);
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

  // Leaves ten seconds of the sixty for the Supabase writes and the
  // response. Countries run one after another, so without this the
  // function can simply be killed part-way through the list -- and a
  // country that is never written is worse off than one written with a
  // gap, because carry-forward never gets the chance to fill it.
  const deadline = Date.now() + 50_000;
  const skippedForTime: string[] = [];

  for (const country of pending) {
    // Reserve one attempt's worth before starting a country, for the
    // same reason withRetry does: asking whether time has already run
    // out lets a 15-second fetcher start with two seconds left.
    if (Date.now() + MAX_ATTEMPT_MS >= deadline) {
      // Reported rather than silent. The scheduled trigger runs three
      // times a day, so a country skipped here is picked up on the next
      // pass; a country skipped WITHOUT anyone knowing is how a gap
      // becomes permanent.
      skippedForTime.push(country);
      results.push({ country, status: "skipped — out of time this run" });
      continue;
    }
    try {
      // WHAT WAS ACTUALLY FETCHED, NULLS AND ALL. The database is the
      // record of what each source returned; it is not the place to
      // repair gaps.
      //
      // Carry-forward used to run HERE, and the merged result was then
      // inserted as a new row. The next run read that row back, saw a
      // value one day old, and carried it again -- so the fourteen-day
      // bound measured the age of the COPY and never expired anything. A
      // permanently dead source published its last number for ever,
      // marked fresh, which is precisely the outcome the bound exists to
      // prevent. Simulated at day 45: still publishing, still unexpired.
      //
      // It now runs where the six scored markets already do theirs, at
      // READ time in lib/useGulfIndicators.ts. Derived data is never
      // written, so it can never be read back as if it were fetched, and
      // the bound measures the real age of the real observation.
      const raw = await fetchGulfIndicators(country, deadline, relay);
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
      const baseNote = gulfSourceNote(country, {
        imfCpi: (country === "AE" || country === "KW" || country === "OM") && raw.cpiYoy != null,
        imfRate: country === "QA" && raw.policyRate != null,
      });
      // Records what THIS RUN fetched. Whether a gap is later filled
      // from an earlier row is a question for the page, not for the
      // stored row -- see the note above.
      const sourceNote = partial
        ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)`
        : baseNote;

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

  // The scheduled job checks only the HTTP status, so anything it
  // should react to has to be in the body where a human reading the
  // run log will see it. A run that quietly did four countries out of
  // six looks identical to a clean one otherwise.
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    ...(skippedForTime.length > 0
      ? {
          outOfTime: skippedForTime,
          reason:
            `${skippedForTime.length} country(ies) were not attempted because the run ran out of ` +
            `time. They are picked up on the next scheduled pass. If this recurs, a source is ` +
            `timing out rather than failing fast.`,
        }
      : {}),
    results,
  });
}
