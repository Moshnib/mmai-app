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
