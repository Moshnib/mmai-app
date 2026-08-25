import { fetchSaudiInflation } from "../lib/fetchers/datasaudi";

(async () => {
  try {
    const result = await fetchSaudiInflation();
    console.log("PASS  fetchSaudiInflation()", result);
    process.exit(0);
  } catch (err) {
    console.log("FAIL  fetchSaudiInflation()", (err as Error).message);
    process.exit(1);
  }
})();
