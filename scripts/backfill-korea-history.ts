// ============================================================
//  GENERATE SOUTH KOREA'S HISTORY BLOCKS, ONCE
//
//  Korea joined as the ninth market with live figures and no past, so its
//  entire Data Over Time page read "Not enough history yet to chart a
//  trend" across all four charts while the others went back to 2019. The
//  same gap Sweden had, and it needed its own fix then too.
//
//  A SCRIPT RATHER THAN A LIVE FETCH, matching backfill-sweden-history:
//  a fixed backfill that never changes needs no table, no migration and
//  no nightly write. Run it once, paste the output, commit the data.
//
//  Sources, all already cleared and already used by this project:
//    inflation     OECD DSD_PRICES, KOR.M.N.CPI.PA._T.N.GY -- headline
//                  CPI, the measure the Bank of Korea's 2% target is set
//                  on. Not a core measure, and not an HICP equivalent.
//    unemployment  OECD DSD_LFS, the same dataflow Japan already uses
//    policy rate   BIS WS_CBPOL M.KR, sourced from the Bank of Korea
//    GDP growth    OECD DSD_NAMAIN1 quarterly real growth, year over year
//
//  SEQUENTIAL, WITH LONG PAUSES, AND THAT IS NOT OPTIONAL. OECD answers
//  concurrent requests with HTTP 500 across the board -- including series
//  that work perfectly alone. A parallel version of this script reported
//  "no OECD data for Korea", which is false.
//
//  The pauses are 25 SECONDS, which looks absurd for four requests and is
//  not. OECD throttles on a window longer than a single call, and a large
//  payload seems to cost more of it than a small one: after this script
//  pulled 92 months of CPI, the very next request failed five times
//  across 45 seconds of backoff, while the identical URL returned 200
//  when spaced six seconds apart from a cold start. This runs once, so
//  two minutes is free.
//
//    npx tsx scripts/backfill-korea-history.ts
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HISTORY } from "@/lib/history";

const FROM_YEAR = 2019;
const OECD = "https://sdmx.oecd.org/public/rest/data";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** EACH SERIES IS CACHED THE MOMENT IT ARRIVES, SO A RE-RUN RESUMES.
 *
 *  OECD's throttle is cumulative across a run, not per request: this
 *  script fetched 92 months of CPI and 91 of unemployment, and the third
 *  request then failed five times across five minutes of backoff — while
 *  the identical URL returned 200 when tried alone a minute later.
 *
 *  All-or-nothing was the wrong shape for that. Now a run that gets two
 *  of four series keeps them, and the next run only asks for what is
 *  missing. Cached under the OS temp directory rather than in the repo:
 *  it is scaffolding for a one-off, not data to commit. Delete the
 *  directory to force a clean re-fetch. */
const CACHE = join(tmpdir(), "mmai-korea-backfill");
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

function cached(name: string): Map<string, number> | null {
  const f = join(CACHE, `${name}.json`);
  if (!existsSync(f)) return null;
  try {
    const obj = JSON.parse(readFileSync(f, "utf8")) as Record<string, number>;
    const m = new Map(Object.entries(obj));
    console.log(`  ${name.padEnd(13)} ${m.size} from cache`);
    return m;
  } catch {
    return null;
  }
}

function putCache(name: string, m: Map<string, number>) {
  writeFileSync(join(CACHE, `${name}.json`), JSON.stringify(Object.fromEntries(m)));
}

/** Columns BY HEADER NAME. These dataflows carry 30+ columns and OECD
 *  reorders them without notice; positional indexing would silently read
 *  the wrong field and produce a plausible, wrong history. */
async function oecdSeries(url: string, what: string): Promise<Map<string, number>> {
  // RETRIED, BECAUSE OECD THROTTLES ON A TIMESCALE LONGER THAN ONE CALL.
  //
  // The first run of this script failed on its FIRST request — no
  // concurrency of its own to blame. Earlier probing in the same session
  // had used up whatever budget OECD allows, and the throttle was still
  // in force; the identical URL returned 200 a minute later.
  //
  // So a 500 here means "wait", not "gone". Backing off is the difference
  // between a script that works and one that has to be run by hand until
  // it happens to land.
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.ok) break;
    if (attempt === 5) {
      throw new Error(
        `${what}: HTTP ${res.status} after 5 attempts. A 500 from OECD is usually rate ` +
          `limiting rather than missing data — wait a minute and re-run.`,
      );
    }
    const wait = attempt * 30_000;
    console.log(`  ${what}: HTTP ${res.status}, waiting ${wait / 1000}s and retrying`);
    await sleep(wait);
  }
  if (!res) throw new Error(`${what}: no response`);
  const lines = (await res.text()).trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`${what}: no data rows`);

  const header = lines[0].split(",");
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti === -1 || vi === -1) throw new Error(`${what}: expected columns not found`);

  const out = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const period = (c[ti] ?? "").trim();
    const value = Number(c[vi]);
    if (period && Number.isFinite(value)) out.set(period, value);
  }
  if (out.size === 0) throw new Error(`${what}: no usable observations`);
  return out;
}

async function bisMonthly(): Promise<Map<string, number>> {
  const url = `https://stats.bis.org/api/v1/data/WS_CBPOL/M.KR/all?startPeriod=${FROM_YEAR}-01&format=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`BIS policy rate: HTTP ${res.status}`);
  const lines = (await res.text()).trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti === -1 || vi === -1) throw new Error("BIS policy rate: expected columns not found");

  const out = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const period = (c[ti] ?? "").trim();
    const raw = (c[vi] ?? "").trim();
    // Strict: parseFloat would turn a comma-decimal into a silently wrong
    // number, which is the trap lib/fetchers/bis.ts documents.
    if (/^\d{4}-\d{2}$/.test(period) && /^-?\d+(\.\d+)?$/.test(raw)) out.set(period, Number(raw));
  }
  if (out.size === 0) throw new Error("BIS policy rate: no usable observations");
  return out;
}

async function bisDebtQuarterly(): Promise<Map<string, number>> {
  const url = `https://stats.bis.org/api/v1/data/WS_TC/Q.KR.G.A.M.770.A/all?startPeriod=${FROM_YEAR}&format=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`BIS debt: HTTP ${res.status}`);
  const lines = (await res.text()).trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti === -1 || vi === -1) throw new Error("BIS debt: expected columns not found");

  const out = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const period = (c[ti] ?? "").trim();
    const raw = (c[vi] ?? "").trim();
    if (/^\d{4}-Q[1-4]$/.test(period) && /^-?\d+(\.\d+)?$/.test(raw)) out.set(period, Number(raw));
  }
  if (out.size === 0) throw new Error("BIS debt: no usable observations");
  return out;
}

/** Brent is ONE GLOBAL PRICE, identical for every market and no longer
 *  scored — it stopped being a pillar on 1 September 2026 precisely
 *  because the same figure applied to everyone could never separate one
 *  country from another. It is still charted, so Korea's rows carry the
 *  same values every other market's do rather than a column of gaps.
 *  Read from an existing market instead of retyped. */
const BRENT_BY_YEAR: Record<string, number | null> = (() => {
  const out: Record<string, number | null> = {};
  for (const p of HISTORY.US ?? []) out[p.year] = p.indicators.brentYoY ?? null;
  return out;
})();

const round = (v: number, dp = 2) => Number(v.toFixed(dp));

async function main() {
  console.log("Fetching South Korea's history, sequentially…\n");

  /** Fetch only what is not already cached, pausing between real calls. */
  async function series(name: string, url: string, label: string): Promise<Map<string, number>> {
    const hit = cached(name);
    if (hit) return hit;
    const m = await oecdSeries(url, label);
    putCache(name, m);
    console.log(`  ${name.padEnd(13)} ${m.size} fetched`);
    await sleep(25_000);
    return m;
  }

  const inflation = await series(
    "inflation",
    `${OECD}/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/KOR.M.N.CPI.PA._T.N.GY?startPeriod=${FROM_YEAR}-01&format=csvfile`,
    "OECD CPI",
  );

  const unemployment = await series(
    "unemployment",
    `${OECD}/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/KOR.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M?startPeriod=${FROM_YEAR}-01&format=csvfile`,
    "OECD unemployment",
  );

  // lastNObservations rather than startPeriod: forty quarters reaches
  // back past 2019 and asks for a smaller response, which matters when
  // the throttle is cumulative.
  const gdp = await series(
    "gdp",
    `${OECD}/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH_OECD,1.1/Q.Y.KOR.S1..B1GQ......GY.?lastNObservations=40&format=csvfile`,
    "OECD GDP",
  );

  // BIS is not throttled and needs no cache.
  const rate = await bisMonthly();
  console.log(`  policy rate   ${rate.size} months`);

  // Government debt, Q4 of each year -- the same basis Sweden's block
  // uses, because an annual row wants one figure and Q4 is the year's
  // closing position rather than an average of four different quarters.
  const debt = await bisDebtQuarterly();
  console.log(`  govt debt     ${debt.size} quarters\n`);

  // ---------- monthly ----------
  const months = [...new Set([...inflation.keys(), ...unemployment.keys(), ...rate.keys()])]
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && Number(m.slice(0, 4)) >= FROM_YEAR)
    .sort();

  console.log("// ---- paste into lib/monthlyHistory.ts ----");
  console.log("  KR: [");
  for (const m of months) {
    const i = inflation.get(m);
    const u = unemployment.get(m);
    const r = rate.get(m);
    const f = (v: number | undefined, dp = 2) => (v == null ? "null" : String(round(v, dp)));
    console.log(`    { period: "${m}", inflation: ${f(i)}, unemployment: ${f(u)}, policyRate: ${f(r)} },`);
  }
  console.log("  ],\n");

  // ---------- annual ----------
  //
  // Built exactly the way Sweden's was: inflation and unemployment are
  // the calendar-year averages of the monthly series above, growth is the
  // average of that year's quarterly year-over-year readings, and the
  // policy rate is December's level -- a rate is a level at a moment, not
  // something to average.
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  // STOPS BEFORE THE CURRENT YEAR. lib/history.ts appends the latest
  // point from FALLBACK_MARKETS for every market, so emitting a row for
  // this year would produce two — and the second would be a partial year
  // averaged from however many months happen to exist.
  const thisYear = String(new Date().getFullYear());
  const years = [...new Set(months.map((m) => m.slice(0, 4)))]
    .filter((y) => y < thisYear)
    .sort();

  console.log("// ---- paste into lib/history.ts ----");
  console.log("  KR: [");
  for (const y of years) {
    const infl = avg(months.filter((m) => m.startsWith(y)).map((m) => inflation.get(m)).filter((v): v is number => v != null));
    const une = avg(months.filter((m) => m.startsWith(y)).map((m) => unemployment.get(m)).filter((v): v is number => v != null));
    const growth = avg([...gdp.entries()].filter(([q]) => q.startsWith(y)).map(([, v]) => v));
    const dec = rate.get(`${y}-12`) ?? [...rate.entries()].filter(([m]) => m.startsWith(y)).map(([, v]) => v).pop();
    const f = (v: number | null | undefined, dp = 1) => (v == null ? "null" : String(round(v, dp)));
    const brent = BRENT_BY_YEAR[y] ?? null;
    const yearEndDebt = debt.get(`${y}-Q4`) ?? null;
    console.log(
      `    { year: "${y}", indicators: { inflation: ${f(infl)}, gdpGrowth: ${f(growth)}, ` +
        `unemployment: ${f(une)}, policyRate: ${f(dec, 2)}, brentYoY: ${f(brent, 0)}, ` +
        `debtPctGdp: ${f(yearEndDebt)} } },`,
    );
  }
  console.log("  ],");
  console.log("\n// Brent is the same global price every other market carries: one",);
  console.log("// figure applied to all, which is exactly why it stopped being scored.");
  console.log("// Debt is the BIS Q4 reading for each year, matching Sweden's block.");
}

void main();
