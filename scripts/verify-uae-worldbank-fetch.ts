import { fetchInflation } from "../lib/fetchers/worldbank";

(async () => {
  try {
    const result = await fetchInflation("ARE");
    console.log("PASS  fetchInflation('ARE')", result);
    process.exit(0);
  } catch (err) {
    console.log("FAIL  fetchInflation('ARE')", (err as Error).message);
    process.exit(1);
  }
})();
