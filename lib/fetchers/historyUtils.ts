// ============================================================
// Shared helpers used only by the one-time historical backfill
// (scripts/backfill-gulf-history.ts) -- NOT used by the daily live
// fetchers, which only ever need the latest point.
// ============================================================

export interface HistoryPoint {
  period: string; // "YYYY" for annual sources, "YYYY-MM" for monthly sources -- never coerced onto a shared axis
  value: number;
}

// A leading run of exact 0 values in an otherwise real-valued series is a
// known base-year artifact, not real data -- confirmed live for Data
// Saudi's inflation cube: its year-over-year calculation has no prior
// year for the series' first reported months and the server fills 0
// instead of null (Saudi's actual 2013 inflation was ~3.5%, not 0%). A
// single scattered zero elsewhere in an otherwise normal series (Bahrain
// has 4, spread across its history) looks genuine and is left alone --
// only a run of 2+ zeros at the very START of a chronologically-sorted
// series gets dropped.
export function dropLeadingZeroRun(points: HistoryPoint[]): HistoryPoint[] {
  let runLen = 0;
  while (runLen < points.length && points[runLen].value === 0) runLen++;
  return runLen >= 2 ? points.slice(runLen) : points;
}

export function assertNoDuplicatePeriods(points: HistoryPoint[], label: string): void {
  const seen = new Set<string>();
  for (const p of points) {
    if (seen.has(p.period)) throw new Error(`${label}: duplicate period ${p.period} in generated history`);
    seen.add(p.period);
  }
}

export interface GapFilledPoint {
  period: string;
  value: number | null;
}

// World Bank series aren't always contiguous even between two real
// endpoints -- confirmed live: Kuwait's FX-reserves/current-account
// series has 49 real points spanning 1975-2025 (51 years), i.e. 2
// interior years are genuinely missing, not just absent before/after the
// real range. TrendChart's x-axis is categorical (evenly spaced ticks,
// not a real time scale) -- if only the 49 real points are stored, the
// chart would silently compress that gap into two adjacent ticks instead
// of showing it as a gap. Filling every interior period between the
// first and last real point with an explicit null (rendered with
// connectNulls={false}) makes the gap visible instead of invisible.
export function fillAnnualGaps(points: HistoryPoint[]): GapFilledPoint[] {
  if (points.length === 0) return [];
  const byPeriod = new Map(points.map((p) => [p.period, p.value]));
  const startYear = Number(points[0].period);
  const endYear = Number(points[points.length - 1].period);
  const out: GapFilledPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const period = String(y);
    out.push({ period, value: byPeriod.get(period) ?? null });
  }
  return out;
}

export function fillMonthlyGaps(points: HistoryPoint[]): GapFilledPoint[] {
  if (points.length === 0) return [];
  const byPeriod = new Map(points.map((p) => [p.period, p.value]));
  const [startY, startM] = points[0].period.split("-").map(Number);
  const [endY, endM] = points[points.length - 1].period.split("-").map(Number);
  const out: GapFilledPoint[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const period = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ period, value: byPeriod.get(period) ?? null });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
