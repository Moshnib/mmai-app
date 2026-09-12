// ============================================================
//  SWEDEN'S THREE SCB SERIES, AGAINST THE LIVE API
//
//  This project's rule: a fetcher is proved standalone before it is
//  wired into anything. Bahrain, Qatar and Data Saudi each got one of
//  these, and each caught something.
//
//    npx tsx scripts/verify-sweden-fetch.ts
// ============================================================

import { fetchSwedenInflation, fetchSwedenUnemployment, fetchSwedenGdpGrowthQuarterly } from "@/lib/fetchers/scb";

async function main() {
  let fails = 0;
  const check = async (label: string, run: () => Promise<Record<string, unknown>>, plausible: (v: number) => boolean) => {
    try {
      const t = Date.now();
      const r = await run();
      const value = Number(Object.values(r).find((v) => typeof v === "number"));
      const date = String(r.observationDate);
      const okDate = /^\d{4}-\d{2}-01$/.test(date);
      const okValue = plausible(value);
      if (!okDate || !okValue) fails++;
      console.log(
        `  ${okDate && okValue ? "ok  " : "FAIL"}  ${label.padEnd(14)} ${String(value).padStart(6)}   ${date}   ${Date.now() - t}ms` +
          (okValue ? "" : "   <- implausible") + (okDate ? "" : "   <- bad date"),
      );
    } catch (e) {
      fails++;
      console.log(`  FAIL  ${label.padEnd(14)} ${(e as Error).message}`);
    }
  };

  console.log("\nStatistics Sweden, live\n");
  // Ranges are deliberately wide: this asks "is this a rate at all",
  // not "is it the number I saw today".
  await check("inflation", fetchSwedenInflation, (v) => v > -10 && v < 30);
  await check("unemployment", fetchSwedenUnemployment, (v) => v > 0 && v < 30);
  await check("GDP growth", fetchSwedenGdpGrowthQuarterly, (v) => v > -20 && v < 20);

  console.log("");
  if (fails > 0) {
    console.error(`${fails} of 3 failed.\n`);
    process.exit(1);
  }
  console.log("All three Swedish series fetch, parse and date correctly.\n");
}

main();
export {};
