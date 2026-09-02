// ============================================================
// IS THIS FIGURE STILL ALIVE?
//
// Added 2026-09-02, after a source died and nobody noticed for nine
// months.
//
// Eurostat retired the euro area HICP dataset on 4 February 2026. It did
// not start failing -- it stopped gaining new months. The fetcher asked
// for the newest observation, was handed December 2025, and returned
// success every single morning. MMAI published euro area inflation as
// 2.0% while the real figure climbed to 3.3%, and because Price Stability
// carries 25% of the score, the Euro Area was published as "Supportive"
// when the correct verdict was "Balanced".
//
// THE REASON NOTHING CAUGHT IT: the only staleness check in the project
// measured `fetched_at` -- when we last ASKED -- not the age of what came
// back. A frozen source answers instantly every morning and reads as
// perfectly live. The per-indicator observation dates added for audit
// finding M-6 SHOW a reader the age; nothing TESTED it.
//
// This module is that test. It compares each figure's observation date
// against how often its source actually publishes, which lib/sources.ts
// already records in `cadence`.
//
// WHAT IT IS NOT: a freshness ideal. A UK GDP figure six months old is
// not a fault -- that is genuinely the newest the ONS publishes. These
// limits are set to catch a source that has STOPPED, not one that is
// merely slow. Tightening them to chase freshness would produce false
// alarms, and an alarm that cries wolf is worse than no alarm, because it
// gets muted.
// ============================================================

import type { SourceCadence } from "./sources";

/** How old a figure may get before its source is presumed dead.
 *
 *  Each is deliberately generous -- roughly two to three missed
 *  publications -- so a late release passes and a retirement does not.
 *
 *  `null` means age is not meaningful for that cadence; see below. */
export const MAX_AGE_DAYS: Record<SourceCadence, number | null> = {
  // Market data, published every trading day. Ten days covers a long
  // holiday weekend plus a few days of outage.
  daily: 10,

  // A monthly series is normally 3-7 weeks behind. 100 days is about
  // three missed releases. The dead Eurostat series would have tripped
  // this on ~15 May 2026 instead of running until September.
  monthly: 100,

  // The loosest of the real checks, and deliberately so. UK GDP is
  // legitimately ~6 months old because the ONS national accounts lag two
  // quarters. 240 days allows that and still catches a stopped source
  // inside eight months.
  quarterly: 240,

  // Annual sources -- the World Bank series behind Gulf Watch -- run 1-2
  // years behind by design. This is a weak check and is honest about it:
  // an annual figure is low-signal anyway, and a tighter bound would fire
  // constantly on data that is doing exactly what it should.
  annual: 800,

  // NOT AGE-CHECKED, and this is a judgement, not an oversight.
  //
  // A policy rate is a LEVEL THAT PERSISTS. When a central bank leaves
  // rates unchanged for two years, the two-year-old decision is still the
  // current rate -- the figure is not stale, the world simply did not
  // move. Japan held rates near zero for over a decade; an age check here
  // would have screamed every day of it while the data was perfectly
  // correct.
  //
  // These sources fail LOUDLY instead: every policy-rate fetcher throws
  // on a bad response rather than returning a previous value, so a dead
  // one shows up as a null pillar, not as a stale number.
  "per decision": null,
};

export interface Staleness {
  ageDays: number;
  allowedDays: number;
  stale: boolean;
}

/** Age of an observation in whole days. */
export function ageInDays(observationDate: string, now: number = Date.now()): number {
  return Math.floor((now - Date.parse(observationDate)) / 86_400_000);
}

/** BIS publishes a QUARTER ("2025-Q4"), not a day. Converts it to the
 *  quarter's LAST day, which is the earliest date the figure could
 *  describe -- the generous reading, so this never accuses a source of
 *  being stale because of a labelling convention. */
export function quarterToDate(period: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(period.trim());
  if (!m) return null;
  const endMonth = Number(m[2]) * 3;
  const lastDay = endMonth === 3 ? 31 : endMonth === 6 ? 30 : endMonth === 9 ? 30 : 31;
  return `${m[1]}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
}

/** The shape this module needs from a source. A SourceEntry satisfies it,
 *  so callers can pass one straight in. */
export interface FreshnessRule {
  cadence: SourceCadence;
  /** Overrides the cadence default for THIS source only.
   *
   *  Needed because "quarterly" describes a publication rhythm, not a
   *  publication LAG, and those differ enormously. The ONS releases
   *  quarterly national accounts about two quarters behind; the BIS
   *  releases credit statistics about three. One limit loose enough for
   *  the BIS would let a dead ONS series run for over a year.
   *
   *  Set this rather than loosening MAX_AGE_DAYS, and say why in the
   *  source's `note`. Every relaxation should cost somebody an
   *  explanation. */
  maxAgeDays?: number;
}

/** Is this figure older than its source's publication rhythm allows?
 *
 *  Returns null when the question does not apply -- no date recorded, an
 *  unparseable date, or a cadence that is not age-checked. Null means
 *  "no opinion", never "fine": a caller must not read it as a pass. */
export function stalenessOf(
  rule: FreshnessRule,
  observationDate: string | null | undefined,
  now: number = Date.now()
): Staleness | null {
  const allowedDays = rule.maxAgeDays ?? MAX_AGE_DAYS[rule.cadence];
  if (allowedDays == null) return null;
  if (!observationDate) return null;

  const parsed = Date.parse(observationDate);
  if (!Number.isFinite(parsed)) return null;

  const ageDays = ageInDays(observationDate, now);

  // A FUTURE date is not fresh, it is wrong -- a parser reading a field
  // it does not understand. Reported as stale so it cannot pass silently.
  if (ageDays < -2) return { ageDays, allowedDays, stale: true };

  return { ageDays, allowedDays, stale: ageDays > allowedDays };
}

/** One line per stale figure, for a log or a source note. */
export function describeStale(indicator: string, s: Staleness): string {
  if (s.ageDays < 0) {
    return `${indicator} is dated ${Math.abs(s.ageDays)} days in the FUTURE`;
  }
  return `${indicator} is ${s.ageDays}d old (limit ${s.allowedDays}d)`;
}
