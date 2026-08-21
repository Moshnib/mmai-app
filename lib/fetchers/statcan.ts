// ============================================================
// Statistics Canada fetcher — CPI (inflation), computed as year-over-year
// change from the raw index (StatCan publishes level values, not a
// pre-computed YoY rate) — same approach as lib/fetchers/abs.ts for
// Australia. Open Licence (explicit right to publish/distribute/sell),
// confirmed live via direct API test 2026-08-21. Vector 41690973 =
// "Consumer Price Index, all-items, Canada" (StatCan table 18-10-0004-01).
// ============================================================

interface VectorDataPoint {
  refPer: string;
  value: number;
}

export async function fetchCanadaInflation(): Promise<{ inflation: number; observationDate: string }> {
  const res = await fetch("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ vectorId: 41690973, latestN: 15 }]),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Statistics Canada request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const points: VectorDataPoint[] = json?.[0]?.object?.vectorDataPoint ?? [];
  if (points.length < 13) throw new Error("Statistics Canada CPI: too few observations for a year-over-year calculation");

  const rows = points
    .map((p) => ({ period: p.refPer.slice(0, 7), value: p.value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const latest = rows[rows.length - 1];
  const priorYear = rows.find((r) => r.period === shiftMonth(latest.period, -12));
  if (!priorYear) throw new Error(`Statistics Canada CPI: no matching prior-year observation for ${latest.period}`);

  const yoy = ((latest.value - priorYear.value) / priorYear.value) * 100;
  return { inflation: Math.round(yoy * 100) / 100, observationDate: `${latest.period}-01` };
}

function shiftMonth(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
