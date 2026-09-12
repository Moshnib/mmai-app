// ============================================================
//  NORWAY'S FETCHERS, AGAINST THE LIVE SOURCES
//
//  Norway was reactivated on 2026-09-12 with three of its four series
//  moved to different institutions. A swap like that is the easiest place
//  in this project to introduce a silently wrong number: the field names
//  match, the types match, and only the VALUE is from somewhere else.
//
//    npx tsx scripts/verify-norway-fetch.ts
//
//  NOT PART OF CI. It calls four live endpoints and would make the build
//  depend on Statistics Norway, Eurostat and the BIS all being up.
// ============================================================

import { fetchNorwayInflation } from "@/lib/fetchers/ssb";
import { fetchNorwayUnemployment, fetchNorwayGdpGrowthQuarterly } from "@/lib/fetchers/norway";
import { fetchBisPolicyRate, fetchGovernmentDebt } from "@/lib/fetchers/bis";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

/** Plausibility bands. NOT assertions that a number is right -- only that
 *  it is the KIND of number the series returns. A unit mix-up (an index
 *  level where a rate belongs, a fraction where a percent belongs) is the
 *  failure this catches, and it is the one that looks most convincing
 *  once it is sitting in a database. */
const BANDS: Record<string, [number, number]> = {
  inflation: [-3, 15],
  unemployment: [1, 20],
  gdpGrowth: [-15, 15],
  policyRate: [-2, 15],
  debtPctGdp: [5, 300],
};

function check(label: string, key: string, value: number, date: string, maxAgeDays: number) {
  const [lo, hi] = BANDS[key];
  if (!Number.isFinite(value)) return fail(`${label}: not a finite number (${value})`);
  if (value < lo || value > hi) return fail(`${label}: ${value} is outside ${lo}..${hi} — check the unit`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(`${label}: date "${date}" is not YYYY-MM-DD`);
  const age = Math.round((Date.now() - Date.parse(date)) / 86_400_000);
  if (age < 0) return fail(`${label}: observation date ${date} is in the future`);
  if (age > maxAgeDays) return fail(`${label}: newest observation ${date} is ${age}d old, over the ${maxAgeDays}d limit`);
  ok(`${label.padEnd(38)} ${String(value).padStart(6)}   as of ${date}  (${age}d)`);
}

async function main() {
  console.log("\nNorway — every series, against the live source\n");

  try {
    const r = await fetchNorwayInflation();
    check("inflation (Statistics Norway CPI)", "inflation", r.inflation, r.observationDate, 70);
  } catch (e) { fail(`inflation threw: ${(e as Error).message}`); }

  try {
    const r = await fetchNorwayUnemployment();
    check("unemployment (Eurostat LFS)", "unemployment", r.unemployment, r.observationDate, 120);
  } catch (e) { fail(`unemployment threw: ${(e as Error).message}`); }

  try {
    const r = await fetchNorwayGdpGrowthQuarterly();
    check("GDP growth YoY (Eurostat)", "gdpGrowth", r.gdpGrowth, r.observationDate, 220);
  } catch (e) { fail(`GDP growth threw: ${(e as Error).message}`); }

  try {
    const r = await fetchBisPolicyRate("NO");
    check("policy rate (BIS)", "policyRate", r.policyRate, r.observationDate, 30);
  } catch (e) { fail(`policy rate threw: ${(e as Error).message}`); }

  try {
    const rows = await fetchGovernmentDebt();
    const no = rows.find((r) => r.market === "NO");
    if (!no) fail("govt debt: BIS returned no row for NO — check DEBT_AREAS");
    else {
      const [lo, hi] = BANDS.debtPctGdp;
      if (no.debtPctGdp < lo || no.debtPctGdp > hi) fail(`govt debt: ${no.debtPctGdp} outside ${lo}..${hi}`);
      else ok(`govt debt %GDP (BIS)${" ".repeat(19)}${String(no.debtPctGdp).padStart(6)}   as of ${no.period}`);
    }
  } catch (e) { fail(`govt debt threw: ${(e as Error).message}`); }

  // ---------- the licence point, asserted in code ----------
  // Norway was paused for three weeks waiting on an answer from Norges
  // Bank that BIS had already made unnecessary. If anyone ever "restores"
  // the direct Norges Bank fetcher, this is where it should be argued
  // again rather than done quietly.
  console.log("");
  const routeSrc = await import("node:fs").then((fs) =>
    fs.readFileSync("app/api/refresh/route.ts", "utf8"),
  );
  if (/fetchNorwayPolicyRate\s*\(/.test(routeSrc)) {
    fail(
      "the refresh route calls fetchNorwayPolicyRate() again. Norges Bank's own terms " +
        "do not confirm commercial reuse; BIS's do, and BIS name Norges Bank as the source.",
    );
  } else {
    ok("policy rate is read from BIS, not Norges Bank direct — the licence question stays answered");
  }

  console.log("");
  if (failed) {
    console.error("Norway is not ready.\n");
    process.exit(1);
  }
  console.log("Every Norwegian series is live, in range, and recent.\n");
}

void main();
