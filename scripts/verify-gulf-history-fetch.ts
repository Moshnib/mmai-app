// Standalone live check of every new *History() fetcher used by the
// one-time Gulf Watch backfill (scripts/backfill-gulf-history.ts).
// Doesn't touch Supabase -- read-only against each upstream API.
import { fetchInflationHistory, fetchFxReservesMonthsHistory, fetchCurrentAccountPctGdpHistory } from "../lib/fetchers/worldbank";
import { fetchBahrainInflationHistory } from "../lib/fetchers/bahrainCpi";
import { fetchQatarInflationHistory } from "../lib/fetchers/qatarCpi";
import { fetchSaudiInflationHistory } from "../lib/fetchers/datasaudi";
import { fetchQatarRealEstateHistory, isCompleteMonth } from "../lib/fetchers/qatarRealEstate";
import { dropLeadingZeroRun } from "../lib/fetchers/historyUtils";

async function settle<T>(label: string, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.log(`  settle caught [${label}]:`, (err as Error).message);
    return null;
  }
}

(async () => {
  let allOk = true;

  const ISO3: Record<string, string> = { AE: "ARE", BH: "BHR", QA: "QAT", SA: "SAU", KW: "KWT", OM: "OMN" };

  for (const [code, iso3] of Object.entries(ISO3)) {
    const fx = await settle(`${code} FX reserves history`, fetchFxReservesMonthsHistory(iso3));
    const ca = await settle(`${code} current account history`, fetchCurrentAccountPctGdpHistory(iso3));
    console.log(`${fx && ca ? "PASS" : "FAIL"}  ${code}  fx points=${fx?.length ?? 0} (${fx?.[0]?.period}..${fx?.at(-1)?.period})  ca points=${ca?.length ?? 0}`);
    allOk = allOk && !!fx && !!ca;
  }

  // World Bank CPI history for the 3 countries that use it (AE, KW, OM)
  for (const code of ["AE", "KW", "OM"] as const) {
    const cpi = await settle(`${code} CPI history`, fetchInflationHistory(ISO3[code]));
    console.log(`${cpi ? "PASS" : "FAIL"}  ${code} CPI  points=${cpi?.length ?? 0} (${cpi?.[0]?.period}..${cpi?.at(-1)?.period})`);
    allOk = allOk && !!cpi;
  }

  const bahrain = await settle("Bahrain CPI history", fetchBahrainInflationHistory());
  console.log(`${bahrain ? "PASS" : "FAIL"}  BH CPI  points=${bahrain?.length ?? 0} (${bahrain?.[0]?.period}..${bahrain?.at(-1)?.period})`);
  allOk = allOk && !!bahrain;

  const qatarCpi = await settle("Qatar CPI history", fetchQatarInflationHistory());
  console.log(`${qatarCpi ? "PASS" : "FAIL"}  QA CPI  points=${qatarCpi?.length ?? 0} (${qatarCpi?.[0]?.period}..${qatarCpi?.at(-1)?.period})`);
  allOk = allOk && !!qatarCpi;

  const saudiRaw = await settle("Saudi CPI history", fetchSaudiInflationHistory());
  if (saudiRaw) {
    const cleaned = dropLeadingZeroRun(saudiRaw);
    console.log(`PASS  SA CPI  raw points=${saudiRaw.length} (${saudiRaw[0]?.period}..${saudiRaw.at(-1)?.period})  after zero-run drop=${cleaned.length} (starts ${cleaned[0]?.period})`);
    console.log(`  dropped ${saudiRaw.length - cleaned.length} leading zero point(s): ${saudiRaw.slice(0, saudiRaw.length - cleaned.length).map((p) => p.period).join(", ")}`);
  } else {
    allOk = false;
    console.log("FAIL  SA CPI history");
  }

  const qatarRe = await settle("Qatar real estate history", fetchQatarRealEstateHistory());
  if (qatarRe) {
    const complete = qatarRe.filter(isCompleteMonth);
    const dropped = qatarRe.filter((r) => !isCompleteMonth(r));
    console.log(`PASS  QA real estate  total months=${qatarRe.length}  complete=${complete.length}  dropped=${dropped.length}`);
    console.log(`  dropped: ${dropped.map((r) => `${r.period} (${r.firstDay}..${r.lastDay}, ${r.distinctDays}d)`).join("; ")}`);
  } else {
    allOk = false;
    console.log("FAIL  QA real estate history");
  }

  console.log("\n" + (allOk ? "ALL HISTORY FETCHERS OK" : "SOME HISTORY FETCHERS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
