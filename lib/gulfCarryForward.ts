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
 * Fill this run's null indicators from the most recent run that had them.
 *
 * `history` is the country's stored rows, NEWEST FIRST. Values are only
 * ever carried INTO a null -- a successful fetch is never overwritten,
 * so a source coming back to life takes effect immediately.
 *
 * SCANS PER FIELD, NOT PER ROW, and that distinction is the whole point.
 * An earlier version of this took only the single most recent row, which
 * quietly failed in the exact case it was written for: Bahrain went down
 * on 1 AND 2 September, so on the second day the previous row was itself
 * null and nothing was carried. Consecutive failures are not the
 * unusual case for a flaky source, they are the normal one. Each field
 * now looks back independently until it finds a row that actually has
 * that indicator.
 */
export function carryForwardGulf<T>(
  fresh: T,
  history: readonly StoredGulfRow[],
  now: Date,
): CarryResult<T> {
  if (history.length === 0) return { merged: fresh, carried: [], expired: false };

  // Rows are read through a Record view. The caller passes a typed
  // interface, which has no index signature by design, so the widening
  // happens once here rather than being forced on every call site.
  const merged: Record<string, unknown> = { ...(fresh as Record<string, unknown>) };
  const carried: string[] = [];
  let sawTooOld = false;

  for (const field of CARRIED_FIELDS) {
    if (merged[field.value] != null) continue;              // fetched fine

    for (const row of history) {
      const value = row[COLUMN[field.value]];
      if (value == null) continue;                          // this row lacks it too

      // The bound is measured against the row actually being used, not
      // against the newest row in the window -- a country refreshed
      // daily would otherwise always look fresh no matter how long ago
      // the indicator itself last arrived.
      const ageDays = (now.getTime() - new Date(row.fetched_at).getTime()) / 86_400_000;
      if (!Number.isFinite(ageDays) || ageDays > MAX_GULF_CARRY_DAYS) { sawTooOld = true; break; }

      merged[field.value] = value;
      // The date is not optional. A value without the period it belongs
      // to is a number with no meaning, and worse, one a reader would
      // assume is current.
      merged[field.date] = row[COLUMN[field.date]] ?? null;
      if (field.label) merged[field.label] = row[COLUMN[field.label]] ?? null;
      carried.push(field.name);
      break;
    }
  }

  return { merged: merged as T, carried, expired: sawTooOld };
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
