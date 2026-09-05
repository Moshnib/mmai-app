// ============================================================
//  WHEN A GULF SOURCE BLINKS, KEEP YESTERDAY'S NUMBER
//
//  Bahrain's inflation disappeared from Gulf Watch on roughly four days
//  in ten. Not because the data was missing -- data.gov.bh publishes it
//  monthly and it was the freshest inflation figure of the six -- but
//  because the endpoint is intermittently unavailable, and a failed
//  fetch wrote null straight over a perfectly good number. The card then
//  showed a dash where a value had been the day before.
//
//  Nothing was wrong with the fetcher: called directly it succeeded five
//  times out of five in under half a second. It is the source that
//  blinks, and the refresh had no memory.
//
//  The six scored markets already solve this, in lib/latestComplete.ts,
//  by falling back to the most recent COMPLETE row. That approach cannot
//  work here: a Gulf row is legitimately incomplete -- four of the six
//  countries have no policy-rate source at all, and only Qatar has real
//  estate -- so "complete" would never be satisfied and the fallback
//  would never fire. Gulf needs the same idea applied per indicator.
//
//  TWO RULES MAKE THIS HONEST RATHER THAN A LIE:
//
//  1. THE OBSERVATION DATE TRAVELS WITH THE VALUE. Carrying a number
//     forward while stamping it with today's date would invent a
//     reporting period that never existed -- exactly the defect the
//     per-indicator date columns were added to fix. A carried value
//     keeps the date it was actually published for, so the card goes on
//     saying "as of July 2026" and a reader is told the truth.
//
//  2. IT EXPIRES. A source that has been dead for a fortnight is not
//     blinking, it is gone, and a page that quietly shows a month-old
//     number forever is worse than one showing a gap. After
//     MAX_GULF_CARRY_DAYS the value reverts to null and the gap appears.
// ============================================================

/** Matches MAX_FALLBACK_DAYS in lib/latestComplete.ts deliberately: the
 *  reasoning is identical and two different bounds would be two things
 *  to remember. Long enough to ride out a bad week at a small national
 *  statistics office, short enough that a dead source surfaces. */
export const MAX_GULF_CARRY_DAYS = 14;

/** The value fields, each paired with the date field that must move with
 *  it and any label that describes it. Adding an indicator to the Gulf
 *  refresh means adding it here too -- otherwise it silently gets no
 *  protection, which is the bug this file exists to fix. */
export const CARRIED_FIELDS = [
  { value: "cpiYoy", date: "cpiObservationDate", label: null, name: "inflation" },
  { value: "fxReservesMonths", date: "fxReservesObservationDate", label: null, name: "FX reserves" },
  { value: "currentAccountPctGdp", date: "currentAccountObservationDate", label: null, name: "current account" },
  { value: "realEstateValue", date: "realEstateObservationDate", label: "realEstateMetricLabel", name: "real estate" },
  { value: "policyRate", date: "policyRateObservationDate", label: "policyRateLabel", name: "policy rate" },
] as const;

/** The previous row, as stored. Snake_case because it comes straight
 *  back from Supabase. */
export interface StoredGulfRow {
  cpi_yoy: number | null;
  cpi_observation_date: string | null;
  fx_reserves_months_imports: number | null;
  fx_reserves_observation_date: string | null;
  current_account_pct_gdp: number | null;
  current_account_observation_date: string | null;
  real_estate_value: number | null;
  real_estate_metric_label: string | null;
  real_estate_observation_date: string | null;
  policy_rate: number | null;
  policy_rate_label: string | null;
  policy_rate_observation_date: string | null;
  fetched_at: string;
}

/** Which stored column each in-memory field reads from. */
const COLUMN: Record<string, keyof StoredGulfRow> = {
  cpiYoy: "cpi_yoy",
  cpiObservationDate: "cpi_observation_date",
  fxReservesMonths: "fx_reserves_months_imports",
  fxReservesObservationDate: "fx_reserves_observation_date",
  currentAccountPctGdp: "current_account_pct_gdp",
  currentAccountObservationDate: "current_account_observation_date",
  realEstateValue: "real_estate_value",
  realEstateMetricLabel: "real_estate_metric_label",
  realEstateObservationDate: "real_estate_observation_date",
  policyRate: "policy_rate",
  policyRateLabel: "policy_rate_label",
  policyRateObservationDate: "policy_rate_observation_date",
};

export interface CarryResult<T> {
  merged: T;
  /** Human names of the indicators that were carried, for the source
   *  note. Empty when everything fetched cleanly. */
  carried: string[];
  /** True when a previous row existed but was too old to draw on. Kept
   *  separate from "nothing was carried" so the caller can tell a quiet
   *  success from an expired fallback. */
  expired: boolean;
}

/**
 * Fill this run's null indicators from the last run that had them.
 *
 * `previous` is the most recent stored row for the country, or null if
 * there is none. Values are only ever carried INTO a null -- a
 * successful fetch is never overwritten, so a source coming back to life
 * takes effect immediately.
 */
export function carryForwardGulf<T>(
  fresh: T,
  previous: StoredGulfRow | null,
  now: Date,
): CarryResult<T> {
  if (!previous) return { merged: fresh, carried: [], expired: false };

  // Read and written through a Record view. The caller passes a typed
  // interface, which has no index signature by design, so the widening
  // happens once here rather than being forced on every call site.

  const ageDays = (now.getTime() - new Date(previous.fetched_at).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays > MAX_GULF_CARRY_DAYS) {
    // Only report expiry if there was in fact something worth carrying,
    // so a country whose sources are all healthy never claims one.
    const hadSomething = CARRIED_FIELDS.some((f) => previous[COLUMN[f.value]] != null);
    return { merged: fresh, carried: [], expired: hadSomething };
  }

  const merged: Record<string, unknown> = { ...(fresh as Record<string, unknown>) };
  const carried: string[] = [];

  for (const field of CARRIED_FIELDS) {
    if (merged[field.value] != null) continue;              // fetched fine
    const prevValue = previous[COLUMN[field.value]];
    if (prevValue == null) continue;                        // nothing to carry

    merged[field.value] = prevValue;
    // The date is not optional. A value without the period it belongs to
    // is a number with no meaning, and worse, one a reader would assume
    // is current.
    merged[field.date] = previous[COLUMN[field.date]] ?? null;
    if (field.label) merged[field.label] = previous[COLUMN[field.label]] ?? null;
    carried.push(field.name);
  }

  return { merged: merged as T, carried, expired: false };
}

/** What to append to the source note, so the row says what happened
 *  rather than looking like a clean fetch. */
export function carryNote(carried: string[]): string {
  if (carried.length === 0) return "";
  const list = carried.length === 1
    ? carried[0]
    : `${carried.slice(0, -1).join(", ")} and ${carried[carried.length - 1]}`;
  return ` — ${list} carried forward from the last successful fetch (the source did not answer this run; the reporting date shown is unchanged)`;
}
