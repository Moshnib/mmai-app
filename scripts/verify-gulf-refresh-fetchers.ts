// Standalone check of refresh-gulf's fetch orchestration (not the
// Supabase write, which needs the real service role key -- see the
// route's own manual-trigger verification after deploy).
import { fetchInflation } from "../lib/fetchers/worldbank";
import { fetchBahrainInflation } from "../lib/fetchers/bahrainCpi";
import { fetchQatarInflation } from "../lib/fetchers/qatarCpi";
import { fetchQatarRealEstate } from "../lib/fetchers/qatarRealEstate";
import { fetchSaudiInflation } from "../lib/fetchers/datasaudi";

async function settle<T>(label: string, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.log(`  settle caught [${label}]:`, (err as Error).message);
    return null;
  }
}

(async () => {
  const countries = ["AE", "BH", "QA", "SA", "KW", "OM"] as const;
  let allOk = true;

  for (const country of countries) {
    let cpi: number | null = null;
    let realEstate: number | null = null;

    if (country === "AE") cpi = (await settle("UAE CPI", fetchInflation("ARE")))?.inflation ?? null;
    if (country === "BH") cpi = (await settle("Bahrain CPI", fetchBahrainInflation()))?.inflation ?? null;
    if (country === "QA") {
      const [c, r] = await Promise.all([settle("Qatar CPI", fetchQatarInflation()), settle("Qatar RE", fetchQatarRealEstate())]);
      cpi = c?.inflation ?? null;
      realEstate = r?.realEstateValue ?? null;
    }
    if (country === "SA") cpi = (await settle("Saudi CPI", fetchSaudiInflation()))?.inflation ?? null;
    if (country === "KW") cpi = (await settle("Kuwait CPI", fetchInflation("KWT")))?.inflation ?? null;
    if (country === "OM") cpi = (await settle("Oman CPI", fetchInflation("OMN")))?.inflation ?? null;

    const ok = cpi !== null;
    allOk = allOk && ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${country}  cpi=${cpi}  realEstate=${realEstate}`);
  }

  console.log("\n" + (allOk ? "ALL COUNTRIES GOT A CPI VALUE" : "SOME COUNTRIES FAILED"));
  process.exit(allOk ? 0 : 1);
})();
