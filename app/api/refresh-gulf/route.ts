import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { fetchInflation } from "@/lib/fetchers/worldbank";
import { fetchBahrainInflation } from "@/lib/fetchers/bahrainCpi";
import { fetchQatarInflation } from "@/lib/fetchers/qatarCpi";
import { fetchQatarRealEstate } from "@/lib/fetchers/qatarRealEstate";
import { fetchSaudiInflation } from "@/lib/fetchers/datasaudi";

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
 * indicator (e.g. Kuwait/UAE/Bahrain/Saudi all currently have no real
 * estate source) simply leaves that column null — see the schema's own
 * check constraint requiring a label whenever a real-estate value IS
 * present, so a number is never shown without saying what it is.
 */

const GULF_COUNTRIES = ["AE", "BH", "QA", "SA", "KW", "OM"] as const;
type GulfCountryCode = (typeof GULF_COUNTRIES)[number];

const SOURCE_NOTES: Record<GulfCountryCode, string> = {
  AE: "World Bank (live)",
  BH: "data.gov.bh (live)",
  QA: "data.gov.qa (live)",
  SA: "Data Saudi (live)",
  KW: "World Bank (live)",
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
  observationDate: string;
}

async function fetchGulfIndicators(country: GulfCountryCode): Promise<GulfRawIndicators> {
  const today = new Date().toISOString().slice(0, 10);

  if (country === "AE") {
    const cpi = await settle("UAE CPI", fetchInflation("ARE"));
    return { cpiYoy: cpi?.inflation ?? null, realEstateValue: null, realEstateMetricLabel: null, observationDate: cpi?.observationDate ?? today };
  }
  if (country === "BH") {
    const cpi = await settle("Bahrain CPI", fetchBahrainInflation());
    return { cpiYoy: cpi?.inflation ?? null, realEstateValue: null, realEstateMetricLabel: null, observationDate: cpi?.observationDate ?? today };
  }
  if (country === "QA") {
    const [cpi, realEstate] = await Promise.all([
      settle("Qatar CPI", fetchQatarInflation()),
      settle("Qatar real estate", fetchQatarRealEstate()),
    ]);
    return {
      cpiYoy: cpi?.inflation ?? null,
      realEstateValue: realEstate?.realEstateValue ?? null,
      realEstateMetricLabel: realEstate?.realEstateMetricLabel ?? null,
      observationDate: cpi?.observationDate ?? realEstate?.observationDate ?? today,
    };
  }
  if (country === "SA") {
    const cpi = await settle("Saudi CPI", fetchSaudiInflation());
    return { cpiYoy: cpi?.inflation ?? null, realEstateValue: null, realEstateMetricLabel: null, observationDate: cpi?.observationDate ?? today };
  }
  if (country === "KW") {
    const cpi = await settle("Kuwait CPI", fetchInflation("KWT"));
    return { cpiYoy: cpi?.inflation ?? null, realEstateValue: null, realEstateMetricLabel: null, observationDate: cpi?.observationDate ?? today };
  }
  // OM
  const cpi = await settle("Oman CPI", fetchInflation("OMN"));
  return { cpiYoy: cpi?.inflation ?? null, realEstateValue: null, realEstateMetricLabel: null, observationDate: cpi?.observationDate ?? today };
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
      const partial = raw.cpiYoy == null;
      const baseNote = SOURCE_NOTES[country];
      const sourceNote = partial ? `${baseNote} — PARTIAL this run, one or more sources failed (see server logs)` : baseNote;

      const { error } = await supabase.from("gulf_indicators").insert({
        country_code: country,
        cpi_yoy: raw.cpiYoy,
        real_estate_value: raw.realEstateValue,
        real_estate_metric_label: raw.realEstateMetricLabel,
        observation_date: raw.observationDate,
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
