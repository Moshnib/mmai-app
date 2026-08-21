// ============================================================
// Reserve Bank of Australia fetcher — Cash Rate Target.
// CC BY 4.0 (confirmed directly on RBA's own copyright page, 2026-08-21).
// No key required. Table F1.1, confirmed live via direct browser test —
// the last published row matched an independent news report of the same
// rate on the same date, cross-verifying the data is genuinely current.
// ============================================================

export async function fetchAustraliaPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const url = "https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`RBA request failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const lines = csv.trim().split("\n");

  // Data rows look like "31/07/2026,4.35,4.35,...". Walk from the bottom
  // to find the most recent row with a real value in the first data column
  // (Cash Rate Target) -- some recent rows can be blank if not yet published.
  for (let i = lines.length - 1; i >= 0; i--) {
    const cols = lines[i].split(",");
    const dateStr = cols[0]?.trim();
    const rateStr = cols[1]?.trim();
    // Real data rows start with a DD/MM/YYYY date -- skip header/title rows.
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) continue;
    const rate = parseFloat(rateStr);
    if (Number.isNaN(rate)) continue;

    const [dd, mm, yyyy] = dateStr.split("/");
    return { policyRate: rate, observationDate: `${yyyy}-${mm}-${dd}` };
  }
  throw new Error("RBA cash rate: no valid data row found");
}
