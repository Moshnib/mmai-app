import type { GulfHistoryPoint, GulfHistorySeries } from "./gulfHistory";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025" for annual, "2026-07" -> "Jul 2026" for monthly -- never lets a
// monthly point read as if it were a bare year, and never implies an
// annual figure happened in a specific month (see the historical
// backfill's review notes on this exact confusion risk).
export function formatPeriod(period: string, granularity: "annual" | "monthly"): string {
  if (granularity === "annual") return period;
  const [y, m] = period.split("-").map(Number);
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
