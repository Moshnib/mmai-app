import type { GulfHistoryPoint, GulfHistorySeries } from "./gulfHistory";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025" for annual, "2026-07" -> "Jul 2026" for monthly, "2026-08-13"
// -> "13 Aug 2026" for daily -- never lets a monthly point read as if it
// were a bare year, and never implies an annual figure happened in a
// specific month (see the historical backfill's review notes on this
// exact confusion risk).
//
// "daily" was added for central bank policy rates (BIS), which are a
// current level rather than a period average -- the exact day a rate
// took effect is real information, not spurious precision.
export function formatPeriod(period: string, granularity: "annual" | "monthly" | "daily"): string {
  if (granularity === "annual") return period;
  const [y, m, d] = period.split("-").map(Number);
  if (granularity === "daily") return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
  return `${MONTH_ABBR[m - 1]} ${y}`;
}

export interface LatestPoint {
  point: GulfHistoryPoint;
  label: string;
  granularity: "annual" | "monthly";
}

export function latestPoint(series: GulfHistorySeries | undefined): LatestPoint | null {
  if (!series) return null;
  for (let i = series.points.length - 1; i >= 0; i--) {
    const p = series.points[i];
    if (p.value !== null) return { point: p, label: formatPeriod(p.period, series.granularity), granularity: series.granularity };
  }
  return null;
}

export interface AnnualPoint {
  year: string;
  value: number;
}

// Reduces a CPI series to one value per calendar year, for pairing
// against an inherently-annual series (FX reserves, current account) in
// a scatter plot. AE/KW/OM's CPI is already annual (World Bank) --
// passed through directly. BH/QA/SA's CPI is monthly -- averaged to a
// calendar-year MEAN, not "the latest available month", which was
// tried and rejected: the latest month alone silently mixes two
// different statistics on one axis (three countries would read as a
// single month's YoY, three as an annual average, with a reader
// attributing the gap to the countries rather than the method), AND a
// still-in-progress year (e.g. Bahrain's series currently runs only to
// June) would get treated as if it were a complete year. Requiring all
// 12 months present before including a year excludes exactly that
// partial-year case, honestly, rather than mislabeling 6 months of
// data as "the year".
export function annualizeCpi(series: GulfHistorySeries | undefined): AnnualPoint[] {
  if (!series) return [];
  if (series.granularity === "annual") {
    return series.points.filter((p): p is { period: string; value: number } => p.value !== null).map((p) => ({ year: p.period, value: p.value }));
  }
  const byYear = new Map<string, number[]>();
  for (const p of series.points) {
    if (p.value === null) continue;
    const year = p.period.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(p.value);
  }
  const out: AnnualPoint[] = [];
  for (const [year, values] of byYear) {
    if (values.length < 12) continue; // partial year -- excluded, not mislabeled
    out.push({ year, value: values.reduce((a, b) => a + b, 0) / values.length });
  }
  return out.sort((a, b) => a.year.localeCompare(b.year));
}

// Joins two already-annual series on year, keeping only years present
// in BOTH (a scatter point needs a real value on each axis for the
// same year -- never an inflation reading from one year paired with an
// FX-reserves reading from another), then caps to the most recent
// `trailYears` of that joined series. The cap keeps every country's
// trail roughly comparable in length -- Kuwait alone has ~50 years of
// paired data, which would otherwise dwarf a country with 2.
export function pairAnnualSeries(x: AnnualPoint[], y: AnnualPoint[], trailYears: number): Array<{ x: number; y: number; period: string }> {
  const yByYear = new Map(y.map((p) => [p.year, p.value]));
  const paired = x
    .filter((p) => yByYear.has(p.year))
    .map((p) => ({ x: p.value, y: yByYear.get(p.year)!, period: p.year }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return paired.slice(-trailYears);
}
