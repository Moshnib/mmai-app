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
    signal: AbortSignal.timeout(8000),
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

// ============================================================
// Unemployment rate — vector 2062815, "Unemployment rate, both sexes,
// 15 years and over, seasonally adjusted" (StatCan table 14-10-0287-01,
// Labour Force Survey). Same Open Licence as the CPI series above.
//
// Replaces the World Bank's annual figure for Canada, which is an ILO
// MODELLED estimate published once a year and currently a year behind
// (2025: 6.907). This is Statistics Canada's own monthly rate.
// Confirmed live 2026-08-28: 2026-07 = 6.4, matching the OECD's
// harmonised series for Canada to the decimal -- OECD republishes this
// very series, which is why going direct is preferable to going
// through them.
//
// Unlike CPI above there is no year-over-year maths here: StatCan
// publishes the unemployment RATE directly, so the value is used as-is.
// ============================================================
export async function fetchCanadaUnemployment(): Promise<{ unemployment: number; observationDate: string }> {
  const res = await fetch("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ vectorId: 2062815, latestN: 6 }]),
    next: { revalidate: 0 },
    // The refresh job runs six markets sequentially inside one function
    // invocation, so a source that hangs costs every market after it.
    //
    // 8s is deliberate, from a measured latency profile (2026-08-28, six
    // consecutive calls): 1.6s, 1.7s, 1.7s, 2.1s, 5.7s, and one complete
    // hang. StatCan is usually fast but has a long tail and does
    // occasionally stall outright, which is precisely what this cap is
    // for. On abort, settle() nulls Canada's unemployment for that run:
    // the market publishes on four pillars (coverage 0.8, above the 0.70
    // gate) and recovers next day. Raising this much further would put
    // the six-market worst case near the route's 60s budget.
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Statistics Canada request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  if (json?.[0]?.status !== "SUCCESS") {
    throw new Error(`Statistics Canada unemployment: API returned status "${json?.[0]?.status}"`);
  }

  const points: VectorDataPoint[] = json?.[0]?.object?.vectorDataPoint ?? [];
  if (points.length === 0) throw new Error("Statistics Canada unemployment: no observations returned");

  // Sorted, never "take the last row". StatCan happens to return these
  // ascending today, but nothing documents that -- and this project has
  // already been bitten once by trusting a source's row order (see the
  // note in lib/fetchers/abs.ts).
  const rows = points
    .map((p) => ({ period: p.refPer.slice(0, 7), value: p.value }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.period.localeCompare(b.period));
  if (rows.length === 0) throw new Error("Statistics Canada unemployment: no usable numeric observations");

  const latest = rows[rows.length - 1];
  return { unemployment: latest.value, observationDate: `${latest.period}-01` };
}

function shiftMonth(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ============================================================
// Canada real GDP growth, QUARTERLY, year-over-year.
//
// Replaces the World Bank ANNUAL figure, which was stamped January and
// up to twenty months old while carrying 25% of the MMAI score.
//
// Vector 62305752 is quarterly real GDP in chained dollars -- LEVELS,
// not a growth rate. Year-over-year is computed here from those levels
// so the concept matches every other MMAI market.
//
// Statistics Canada's own headline quarterly number is annualised
// quarter-on-quarter, which is a DIFFERENT quantity and far more
// volatile. Using it would break comparability while looking reasonable.
// ============================================================

export async function fetchCanadaGdpGrowthQuarterly(): Promise<{ gdpGrowth: number; observationDate: string }> {
  const res = await fetch("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ vectorId: 62305752, latestN: 9 }]),
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Statistics Canada GDP request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  if (json?.[0]?.status !== "SUCCESS") {
    throw new Error(`Statistics Canada GDP: status ${json?.[0]?.status ?? "unknown"}`);
  }
  const points: VectorDataPoint[] = json?.[0]?.object?.vectorDataPoint ?? [];
  if (points.length < 5) throw new Error(`Statistics Canada GDP: need 5+ quarters, got ${points.length}`);

  const rows = points
    .map((p) => ({ period: p.refPer.slice(0, 10), value: p.value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const latest = rows[rows.length - 1];
  // Same quarter one year earlier: refPer is the quarter's FIRST month
  // (01, 04, 07, 10), so the match is an exact date one year back.
  const y = Number(latest.period.slice(0, 4));
  const monthDay = latest.period.slice(4);              // "-04-01"
  const prior = rows.find((r) => r.period === `${y - 1}${monthDay}`);
  if (!prior || !Number.isFinite(prior.value) || prior.value === 0) {
    throw new Error(`Statistics Canada GDP: no comparable quarter for ${latest.period}`);
  }

  // Stamp at the END of the quarter the figure describes.
  const endByStart: Record<string, string> = { "-01-01": "03", "-04-01": "06", "-07-01": "09", "-10-01": "12" };
  const endMonth = endByStart[monthDay];
  if (!endMonth) throw new Error(`Statistics Canada GDP: unexpected quarter start "${latest.period}"`);

  return {
    gdpGrowth: Math.round(((latest.value - prior.value) / prior.value) * 10000) / 100,
    observationDate: `${y}-${endMonth}-01`,
  };
}
