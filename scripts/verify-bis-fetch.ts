// Standalone check of the BIS policy-rate fetcher (lib/fetchers/bis.ts),
// matching the per-fetcher verify scripts alongside it.
//
// The interesting part is not "does it return a number" -- it's the CSV
// parsing. BIS's CBPOL response carries free-text COMPILATION and
// SUPP_INFO_BREAKS fields, and 25 of its 49 daily rows contain commas
// inside those quoted fields. A naive line.split(",") (as used in
// abs.ts/rba.ts, whose sources have no such fields) shifts TIME_PERIOD
// and OBS_VALUE onto the wrong columns for exactly those rows.
//
// Saudi's and Kuwait's rows are comma-free TODAY, so testing only them
// would pass against a broken parser. Brazil's row genuinely contains
// commas in two quoted fields, so it is included as a parser stress
// case -- if the quote handling regresses, BR's guards trip and this
// script fails loudly.
import { fetchBisPolicyRate, type BisPolicyRateArea } from "../lib/fetchers/bis";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function check(area: string, expect?: number): Promise<boolean> {
  try {
    const r = await fetchBisPolicyRate(area as BisPolicyRateArea);
    const dateOk = DATE_RE.test(r.observationDate);
    const valueOk = Number.isFinite(r.policyRate);
    const expectOk = expect === undefined || Math.abs(r.policyRate - expect) < 0.001;
    const ok = dateOk && valueOk && expectOk;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${area}: ${r.policyRate}% as of ${r.observationDate} (${r.rateLabel ?? "no label"})` +
        (expect !== undefined ? `  [expected ~${expect}]` : "")
    );
    return ok;
  } catch (err) {
    console.log(`FAIL  ${area}: threw -> ${(err as Error).message}`);
    return false;
  }
}

(async () => {
  const results: boolean[] = [];

  console.log("--- the two areas actually shipped ---");
  // Values are asserted loosely against what BIS published when this was
  // built (2026-08-28). A central bank genuinely moving its rate should
  // make this fail and prompt a look, not silently pass.
  results.push(await check("SA", 4.25));
  results.push(await check("KW", 3.5));

  console.log("--- parser stress: real row with commas inside quoted fields ---");
  results.push(await check("BR"));

  const failed = results.filter((r) => !r).length;
  console.log(failed === 0 ? "\nAll passed." : `\n${failed} FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
})();
