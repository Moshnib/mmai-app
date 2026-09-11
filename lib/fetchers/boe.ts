// ============================================================
// Bank of England fetcher — Bank Rate (the UK's policy interest rate).
// Statistical Interactive Database (IADB), series IUDBEDR, no key
// required. Not an officially documented public API, but stable and
// widely used for this exact purpose — confirmed live via direct API
// test 2026-08-21.
// ============================================================

const IADB_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatIadbDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${IADB_MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

export async function fetchUkPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 400); // Bank Rate changes infrequently -- wide enough window to always catch at least one row.

  const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&SeriesCodes=IUDBEDR&UsingCodes=Y&CSVF=TN&Datefrom=${formatIadbDate(from)}&Dateto=${formatIadbDate(to)}`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Bank of England request failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const lines = csv.trim().split("\n");
  if (lines.length < 2) throw new Error("Bank of England Bank Rate: no data rows returned");

  const [dateStr, rateStr] = lines[lines.length - 1].split(",");
  const rate = parseFloat(rateStr);
  const match = /^(\d{2}) (\w{3}) (\d{4})$/.exec(dateStr?.trim() ?? "");
  if (Number.isNaN(rate) || !match) throw new Error(`Bank of England Bank Rate: unparseable row "${lines[lines.length - 1]}"`);

  const [, dd, mon, yyyy] = match;
  const monthNum = IADB_MONTHS.indexOf(mon) + 1;
  return { policyRate: rate, observationDate: `${yyyy}-${String(monthNum).padStart(2, "0")}-${dd}` };
}
