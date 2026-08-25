import { fetchBahrainInflation } from "../lib/fetchers/bahrainCpi";

(async () => {
  try {
    const result = await fetchBahrainInflation();
    console.log("PASS  fetchBahrainInflation()", result);
    process.exit(0);
  } catch (err) {
    console.log("FAIL  fetchBahrainInflation()", (err as Error).message);
    process.exit(1);
  }
})();
