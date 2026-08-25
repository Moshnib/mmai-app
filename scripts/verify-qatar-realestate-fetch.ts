import { fetchQatarRealEstate } from "../lib/fetchers/qatarRealEstate";

(async () => {
  try {
    const result = await fetchQatarRealEstate();
    console.log("PASS  fetchQatarRealEstate()", result);
    process.exit(0);
  } catch (err) {
    console.log("FAIL  fetchQatarRealEstate()", (err as Error).message);
    process.exit(1);
  }
})();
