import { fetchFxReservesMonths, fetchCurrentAccountPctGdp } from "../lib/fetchers/worldbank";

(async () => {
  const countries = { AE: "ARE", BH: "BHR", QA: "QAT", SA: "SAU", KW: "KWT", OM: "OMN" } as const;
  let allOk = true;

  for (const [code, iso3] of Object.entries(countries)) {
    try {
      const [fx, ca] = await Promise.all([fetchFxReservesMonths(iso3), fetchCurrentAccountPctGdp(iso3)]);
      console.log(`PASS  ${code}  fxReservesMonths=${fx.fxReservesMonths.toFixed(1)}  currentAccountPctGdp=${ca.currentAccountPctGdp.toFixed(1)}`);
    } catch (err) {
      allOk = false;
      console.log(`FAIL  ${code}  ${(err as Error).message}`);
    }
  }

  console.log("\n" + (allOk ? "ALL COUNTRIES PASSED" : "SOME COUNTRIES FAILED"));
  process.exit(allOk ? 0 : 1);
})();
