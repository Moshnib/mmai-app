// ============================================================
//  THE ONLY FACTS THE ASSISTANT IS ALLOWED TO USE
//
//  A model asked about macro data will happily produce a number from its
//  training weights. On a site whose entire claim is "every figure is
//  traceable to the institution that published it", one invented figure
//  is worse than no assistant at all -- it is indistinguishable from the
//  real ones and it carries MMAI's name.
//
//  So the assistant is never asked to recall anything. This module builds
//  a block of facts out of what the database actually holds right now,
//  and the system prompt in app/api/ask/route.ts forbids using anything
//  else. Absence is answerable too: "the site does not publish that" is a
//  correct answer and the prompt says so.
//
//  Everything here is already public -- it is what the pages render and
//  what the CSV export hands out -- so nothing private can leak through
//  the assistant that a reader could not already download.
// ============================================================

import { getPublicSupabaseClient } from "./supabase";
import { FALLBACK_MARKETS } from "./markets";
import { MONTHLY_HISTORY } from "./monthlyHistory";
import { latestCompleteObservation } from "./latestComplete";
import { dimensionPercentiles } from "./composite";
import { SOURCES } from "./sources";
import { REFERENCE_COUNT } from "./composite";

const NAME: Record<string, string> = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));
const CODES = FALLBACK_MARKETS.map((m) => m.code);

interface ScoreRow {
  market: string;
  observation_date: string;
  percentile: number | null;
  band: string | null;
  dim_conditions: number | null;
  dim_direction: number | null;
  dim_capacity: number | null;
  computed_at: string;
}

interface RawRow {
  market: string;
  observation_date: string;
  inflation: number | null;
  gdp_growth: number | null;
  unemployment: number | null;
  policy_rate: number | null;
  debt_pct_gdp: number | null;
  inflation_observation_date: string | null;
  gdp_observation_date: string | null;
  unemployment_observation_date: string | null;
  policy_rate_observation_date: string | null;
}

const n = (v: number | null | undefined, dp = 2) => (v == null ? "not published" : v.toFixed(dp));
/** Percent only when there is a number to attach it to -- "not published%" is nonsense. */
const pct = (v: number | null | undefined, dp = 2) => (v == null ? "not published" : `${v.toFixed(dp)}%`);

/**
 * A plain-text block of every figure the site currently publishes.
 *
 * Plain text rather than JSON on purpose: the model reads it more
 * reliably, and a human can paste the same block into a chat to check
 * what the assistant was actually given when an answer looks wrong.
 */
export async function buildFactsBlock(): Promise<string> {
  const supabase = getPublicSupabaseClient();

  const [scoreRes, rawRes, bondRes] = await Promise.all([
    supabase
      .from("mmai_scores")
      .select("market, observation_date, percentile, band, dim_conditions, dim_direction, dim_capacity, computed_at")
      .order("observation_date", { ascending: false })
      .order("computed_at", { ascending: false })
      .limit(200),
    supabase
      .from("raw_indicators")
      .select(
        "market, observation_date, inflation, gdp_growth, unemployment, policy_rate, debt_pct_gdp, inflation_observation_date, gdp_observation_date, unemployment_observation_date, policy_rate_observation_date",
      )
      .order("observation_date", { ascending: false })
      .order("fetched_at", { ascending: false })
      .limit(200),
    supabase
      .from("bond_yields")
      .select("market, yield_10y, yield_2y, observation_date")
      .order("observation_date", { ascending: false })
      .limit(300),
  ]);

  if (scoreRes.error || rawRes.error || bondRes.error) {
    throw new Error("Could not read the published figures");
  }

  const firstBy = <T extends { market: string }>(rows: T[] | null) => {
    const out: Record<string, T> = {};
    for (const row of rows ?? []) if (!out[row.market]) out[row.market] = row;
    return out;
  };
  const scores = firstBy(scoreRes.data as ScoreRow[] | null);
  const bonds = firstBy(bondRes.data as { market: string; yield_10y: number | null; yield_2y: number | null; observation_date: string }[] | null);

  const byMarket: Record<string, RawRow[]> = {};
  for (const row of (rawRes.data ?? []) as RawRow[]) (byMarket[row.market] ??= []).push(row);

  const lines: string[] = [];
  lines.push("WHAT MMAI IS");
  lines.push(
    `MMAI scores ${CODES.length} markets on the macro environment. The score is a PERCENTILE against ${REFERENCE_COUNT} market-years of history (2000-2025, six economies), so 70 means more supportive than 70% of those years. It is built from three dimensions weighted equally: Conditions, Direction and Capacity. A market missing any of its five indicators is left UNSCORED rather than scored on partial data. MMAI measures the macro environment, not any security, and is not investment advice.`,
  );

  lines.push("", "TODAY'S SCORES");
  for (const code of CODES) {
    const s = scores[code];
    if (!s || s.percentile == null) {
      lines.push(`${NAME[code]}: no published score.`);
      continue;
    }
    const dims =
      s.dim_conditions != null && s.dim_direction != null && s.dim_capacity != null
        ? dimensionPercentiles({ C: s.dim_conditions, D: s.dim_direction, K: s.dim_capacity })
        : null;
    lines.push(
      `${NAME[code]}: score ${s.percentile.toFixed(1)} (${s.band ?? "no band"}), as of ${s.observation_date}` +
        (dims ? `; Conditions ${dims.C.toFixed(0)}, Direction ${dims.D.toFixed(0)}, Capacity ${dims.K.toFixed(0)} (all percentiles).` : "."),
    );
  }

  lines.push("", "LATEST PUBLISHED INDICATORS (each with the period it refers to, which is not the same as today)");
  for (const code of CODES) {
    const pick = latestCompleteObservation(
      byMarket[code] ?? [],
      ["inflation", "gdp_growth", "unemployment", "policy_rate", "debt_pct_gdp"],
      (r) => r.observation_date,
    );
    const r = pick.row;
    if (!r) {
      lines.push(`${NAME[code]}: no complete observation published.`);
      continue;
    }
    lines.push(
      `${NAME[code]}: inflation ${n(r.inflation)}% (period ${r.inflation_observation_date ?? "unknown"}), ` +
        `GDP growth ${n(r.gdp_growth)}% (period ${r.gdp_observation_date ?? "unknown"}), ` +
        `unemployment ${n(r.unemployment)}% (period ${r.unemployment_observation_date ?? "unknown"}), ` +
        `policy rate ${n(r.policy_rate)}% (period ${r.policy_rate_observation_date ?? "unknown"}), ` +
        `government debt ${n(r.debt_pct_gdp, 1)}% of GDP.`,
    );
  }

  lines.push("", "TEN-YEAR GOVERNMENT BOND YIELDS (daily; not part of the MMAI score)");
  for (const code of CODES) {
    const b = bonds[code];
    lines.push(
      b
        ? `${NAME[code]}: 10-year ${pct(b.yield_10y)}, 2-year ${pct(b.yield_2y)} (${b.observation_date}).`
        : `${NAME[code]}: no bond series is wired. For Sweden that is because the figure would come from the Riksbank, whose terms do not confirm commercial reuse is permitted.`,
    );
  }

  lines.push("", "TWELVE-MONTH CHANGE IN THE MONTHLY SERIES (percentage points)");
  for (const code of CODES) {
    const series = MONTHLY_HISTORY[code] ?? [];
    const parts: string[] = [];
    for (const key of ["inflation", "unemployment", "policyRate"] as const) {
      let latest = -1;
      for (let i = series.length - 1; i >= 0; i--) if (series[i][key] != null) { latest = i; break; }
      if (latest < 0) { parts.push(`${key}: no monthly history`); continue; }
      const then = latest - 12 >= 0 ? series[latest - 12][key] : null;
      const now = series[latest][key]!;
      parts.push(
        then == null
          ? `${key}: ${now} now, no reading twelve months earlier`
          : `${key}: ${now} now vs ${then} twelve months earlier (${(now - then) >= 0 ? "+" : ""}${(now - then).toFixed(2)})`,
      );
    }
    lines.push(`${NAME[code]}: ${parts.join("; ")}.`);
  }

  lines.push("", "WHERE EACH FIGURE COMES FROM, AND UNDER WHAT LICENCE");
  for (const s of SOURCES) {
    if (s.status !== "live") continue;
    lines.push(`${s.market} ${s.indicator}: ${s.institution}. Licence: ${s.license}`);
  }

  lines.push(
    "",
    "KNOWN GAPS, WHICH ARE DELIBERATE AND SHOULD BE STATED PLAINLY IF ASKED",
    "Japan has no monthly inflation history (the OECD price dataflow errors for Japan specifically); its scored figure is current and comes from e-Stat.",
    "Sweden has no ten-year bond yield wired (Riksbank licence unresolved).",
    "Gulf Watch countries are shown unscored on purpose: no licensable policy-rate feed exists for them, and MMAI does not publish a composite built on partial coverage.",
    "The scoring engine changed on 5 September 2026, so stored SCORE history before that date is not comparable with today's. Indicator history is comparable throughout.",
    "US INFLATION APPEARS TWICE WITH DIFFERENT VALUES, and both are right. The SCORED figure is PCE, because the Federal Reserve states its 2% target on PCE. The monthly history series is CPI. If a reader notices the two differ, explain that rather than treating either as an error. No other market has this split.",
  );

  return lines.join("\n");
}
