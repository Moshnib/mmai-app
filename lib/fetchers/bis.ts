// ============================================================
// Bank for International Settlements fetcher — central bank policy
// rates (dataflow WS_CBPOL), used by Gulf Watch for Saudi Arabia and
// Kuwait. Public SDMX REST API, no key. Confirmed live 2026-08-28.
//
// WHY BIS RATHER THAN THE CENTRAL BANKS DIRECTLY: SAMA's and CBUAE's
// own sites are behind Cloudflare bot protection (verified: 403 /
// connection refused), which this project does not attempt to bypass.
// BIS republishes the same figures supplied to it BY those central
// banks -- each row carries a SOURCE_REF naming the originating
// authority ("Saudi Arabian Monetary Authority", "Central Bank of
// Kuwait") -- so this is the intended use of BIS's data, not a
// workaround.
//
// LICENCE (bis.org/terms_statistics.htm, read verbatim 2026-08-28):
// "The use of the statistics is unrestricted, provided that" BIS is
// cited as the source, the use is not misleading or implying
// affiliation with the BIS, and -- for commercial use -- "their
// inclusion in the publication or product will not result in any
// additional charge to subscribers or other users". Crucially there is
// NO prohibition on storing the data in a database, which is what
// forced FRED's removal from this project (see the handover doc's
// "Do NOT reintroduce FRED" rule). BIS also requires that nothing be
// construed as investment advice -- MMAI already carries that
// disclaimer site-wide.
//
// DAILY, NOT MONTHLY: a policy rate is a current level, not a period
// average. The daily series gives the rate actually in effect (and its
// real effective date); the monthly series would report end-of-last-
// month even when the rate is unchanged and current today.
// ============================================================

/** Short display names for each rate. Deliberately a fixed map rather
 *  than parsed out of the response's own COMPILATION prose (e.g. "From
 *  1 Jan 2000 onwards: official market repo rate.") -- BIS can reword
 *  that text freely, and these are genuinely different instruments, so
 *  the label has to be stable and explicit. Stored alongside the value
 *  (see gulf_indicators.policy_rate_label) for the same reason
 *  real_estate_metric_label exists: a bare number under a generic
 *  "Policy rate" heading would imply Saudi's repo rate and Kuwait's
 *  discount rate are the same measurement. */
const RATE_LABELS = {
  SA: "Policy rate (repo)",
  KW: "Policy rate (discount)",
} as const;

export type BisPolicyRateArea = keyof typeof RATE_LABELS;

// Quote-aware CSV field splitter. NOT interchangeable with the plain
// line.split(",") used in abs.ts/rba.ts: verified against the live full
// CBPOL response that 25 of 50 rows carry quoted free-text fields
// containing commas (COMPILATION and SUPP_INFO_BREAKS), which under a
// naive split yield 15/16/17/18/20/22/26 columns for what is meant to
// be a fixed 15-column table. Saudi's and Kuwait's rows happen to be
// comma-free today, so a naive parser would look correct right up until
// BIS rewords a footnote and it silently starts reading the wrong
// column. Handles RFC 4180 doubled quotes ("") inside a quoted field.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export async function fetchBisPolicyRate(
  refArea: BisPolicyRateArea
): Promise<{ policyRate: number; rateLabel: string; observationDate: string }> {
  const url = `https://stats.bis.org/api/v1/data/WS_CBPOL/D.${refArea}/all?lastNObservations=1&format=csv`;
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BIS request failed for ${refArea}: ${res.status} ${res.statusText}`);

  const lines = (await res.text())
    .trim()
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error(`BIS policy rate ${refArea}: no data rows returned`);

  const header = parseCsvLine(lines[0]);
  const timeIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (timeIdx === -1 || valueIdx === -1) {
    throw new Error(`BIS policy rate ${refArea}: expected TIME_PERIOD/OBS_VALUE columns not found`);
  }

  // lastNObservations=1 against a single fully-specified series key
  // (D.<area>) must yield exactly one data row. More than one means the
  // key stopped being unique or the API changed shape -- either way,
  // silently taking the first would risk reporting another country's
  // rate, so fail loudly instead.
  const dataRows = lines.slice(1);
  if (dataRows.length !== 1) {
    throw new Error(`BIS policy rate ${refArea}: expected exactly 1 observation row, got ${dataRows.length}`);
  }

  const cols = parseCsvLine(dataRows[0]);
  const observationDate = cols[timeIdx]?.trim();
  const policyRate = parseFloat(cols[valueIdx] ?? "");

  if (!observationDate || !/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) {
    throw new Error(`BIS policy rate ${refArea}: unexpected TIME_PERIOD "${observationDate}"`);
  }
  if (!Number.isFinite(policyRate)) {
    throw new Error(`BIS policy rate ${refArea}: non-numeric OBS_VALUE "${cols[valueIdx]}"`);
  }

  return { policyRate, rateLabel: RATE_LABELS[refArea], observationDate };
}
