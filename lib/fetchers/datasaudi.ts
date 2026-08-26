// ============================================================
// Data Saudi fetcher — Saudi Arabia national CPI, year-over-year.
// Data Saudi (datasaudi.sa) is run by Saudi's Ministry of Economy &
// Planning and republishes GASTAT's own statistics via a real structured
// API (Datawheel's open-source "Tesseract" OLAP server) — not a scraper.
// No API key, no signup. robots.txt explicitly allows automated access
// to everything except /accounts.
//
// Licensing: no explicit restriction found anywhere for this platform
// (contrast with KAPSARC, whose Terms of Use explicitly prohibit
// automated access without permission — confirmed and avoided
// separately). A confirmation email has been sent requesting written
// commercial-use clearance; until that's answered, treat this the same
// way Bank of Japan's policy rate is treated: fine for a non-commercial
// site, must be resolved before monetizing. See MMAI_MASTER_HANDOVER.md.
//
// The underlying GASTAT dataflow updates monthly with roughly a
// 3-4 week publication lag — this is normal, not a bug.
// ============================================================

interface DataSaudiRecord {
  "Month ID": number;
  Month: string;
  "Inflation rate": number;
}

export async function fetchSaudiInflation(): Promise<{ inflation: number; observationDate: string }> {
  const url =
    "https://api.datasaudi.sa/tesseract/data.jsonrecords?cube=gastat_inflation&drilldowns=Month&measures=Inflation+rate&Main+Division=1&limit=1&sort=Month.desc";
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Data Saudi request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: DataSaudiRecord[] = json?.data ?? [];
  const latest = rows[0];
  if (!latest || typeof latest["Inflation rate"] !== "number") {
    throw new Error("Data Saudi inflation: no usable value in response");
  }

  // "Month" comes back as "YYYY-MM" — normalize to a full date.
  const observationDate = `${latest.Month}-01`;
  return { inflation: latest["Inflation rate"], observationDate };
}

// ============================================================
// Historical (full-series) variant -- used only by the one-time backfill
// script. Confirmed live: 163 months, 2013-01 through 2026-07.
//
// KNOWN ARTIFACT: the first 12 months (all of calendar 2013) come back
// as exactly 0, not null -- a base-year artifact of the cube's own
// year-over-year calculation (2013 has no prior year for it to diff
// against). Real Saudi inflation in 2013 was ~3.5%, not 0%. The caller
// (scripts/backfill-gulf-history.ts) MUST run dropLeadingZeroRun() on
// this before writing it anywhere -- this function intentionally
// returns the raw series, artifact included, so the sanitizing step
// stays visible and auditable in one place rather than hidden here.
// ============================================================

export async function fetchSaudiInflationHistory(): Promise<Array<{ period: string; value: number }>> {
  const url =
    "https://api.datasaudi.sa/tesseract/data.jsonrecords?cube=gastat_inflation&drilldowns=Month&measures=Inflation+rate&Main+Division=1&sort=Month.asc&limit=1000";
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Data Saudi history request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const rows: DataSaudiRecord[] = json?.data ?? [];
  if (rows.length === 0) throw new Error("Data Saudi inflation history: empty response");

  return rows
    .filter((r) => typeof r["Inflation rate"] === "number")
    .map((r) => ({ period: r.Month, value: r["Inflation rate"] }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
