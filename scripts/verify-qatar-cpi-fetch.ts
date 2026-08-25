import { fetchQatarInflation } from "../lib/fetchers/qatarCpi";

(async () => {
  try {
    const result = await fetchQatarInflation();
    console.log("PASS  fetchQatarInflation()", result);
    process.exit(0);
  } catch (err) {
    console.log("FAIL  fetchQatarInflation()", (err as Error).message);
    process.exit(1);
  }
})();
