// ============================================================
//  GENERATE NORWAY'S MONTHLY HISTORY, ONCE
//
//  Norway had ANNUAL history from its first dormant wiring in August, so
//  its Trends charts rendered — but the monthly view was empty, because
//  lib/monthlyHistory.ts had no NO block. A completeness sweep on
//  2026-09-13 found it; nothing else could, because a missing key in a
//  Record keyed by string is not a type error, it is an empty chart.
//
//  Sources, all already cleared and already used by this project:
//    inflation     Statistics Norway table 14700, the 12-month rate --
//                  the measure Norges Bank's 2% target is set on, and
//                  already the live fetcher in lib/fetchers/ssb.ts.
//                  NOT the HICP Eurostat also publishes for Norway.
//    unemployment  Eurostat une_rt_m, harmonised LFS, seasonally
//                  adjusted -- the same definition every market uses
//    policy rate   BIS WS_CBPOL monthly, sourced from Norges Bank
//
//  SSB is a POST against PxWebApi, unlike every other fetcher here, and
//  none of these three throttle the way OECD does — so this one runs
//  without the elaborate pacing that scripts/backfill-korea-history.ts
//  needs.
//
//    npx tsx scripts/backfill-norway-history.ts
// ============================================================

const FROM_YEAR = 2019;

interface JsonStat2 {
  value?: (number | null)[];
  dimension?: { Tid?: { category?: { index?: Record<string, number> } } };
}

/** Statistics Norway publishes the 12-month rate directly, so no
 *  year-over-year arithmetic happens here — the class of bug that
 *  Canada's and Australia's fetchers each have to get right. */
async function ssbInflation(): Promise<Map<string, number>> {
  // The query is lifted verbatim from lib/fetchers/ssb.ts, including the
  // trailing slash and the dimension CODES, and only the time selection
  // differs: "top 120" for ten years of history rather than "top 1" for
  // today's figure.
  //
  // Guessing those codes cost a round trip — "Konsumgrp"/"TOTAL" looks
  // entirely plausible and returns HTTP 400. The working fetcher was
  // twenty lines away.
  const res = await fetch("https://data.ssb.no/api/v0/en/table/14700/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "VareTjenesteGrp", selection: { filter: "item", values: ["00"] } },
        { code: "ContentsCode", selection: { filter: "item", values: ["Tolvmanedersendring"] } },
        { code: "Tid", selection: { filter: "top", values: ["120"] } },
      ],
      response: { format: "json-stat2" },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`SSB 14700: HTTP ${res.status}`);
  const json = (await res.json()) as JsonStat2;
  const periods = Object.keys(json.dimension?.Tid?.category?.index ?? {});
  const values = json.value ?? [];
  const out = new Map<string, number>();
  periods.forEach((p, i) => {
    // SSB writes months as "2019M01"; the rest of this project uses
    // "2019-01".
    const m = p.match(/^(\d{4})M(\d{2})$/);
    const v = values[i];
    if (m && typeof v === "number" && Number.isFinite(v) && Number(m[1]) >= FROM_YEAR) {
      out.set(`${m[1]}-${m[2]}`, v);
    }
  });
  if (out.size === 0) throw new Error("SSB 14700: no usable observations");
  return out;
}

async function eurostatUnemployment(): Promise<Map<string, number>> {
  const url =
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m" +
    `?format=JSON&geo=NO&s_adj=SA&sex=T&age=TOTAL&unit=PC_ACT&sinceTimePeriod=${FROM_YEAR}-01`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Eurostat unemployment: HTTP ${res.status}`);
  const json = (await res.json()) as {
    value?: Record<string, number>;
    dimension?: { time?: { category?: { index?: Record<string, number> } } };
  };
  const index = json.dimension?.time?.category?.index ?? {};
  const values = json.value ?? {};
  const out = new Map<string, number>();
  for (const [period, i] of Object.entries(index)) {
    const v = values[String(i)];
    if (/^\d{4}-\d{2}$/.test(period) && typeof v === "number" && Number.isFinite(v)) out.set(period, v);
  }
  if (out.size === 0) throw new Error("Eurostat unemployment: no usable observations");
  return out;
}

async function bisMonthlyRate(): Promise<Map<string, number>> {
  const url = `https://stats.bis.org/api/v1/data/WS_CBPOL/M.NO/all?startPeriod=${FROM_YEAR}-01&format=csv`;
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
    // number, which is the trap lib/fetchers/bis.ts documents. Norway's
    // rate went NEGATIVE in 2020-21, so the sign must survive.
    if (/^\d{4}-\d{2}$/.test(period) && /^-?\d+(\.\d+)?$/.test(raw)) out.set(period, Number(raw));
  }
  if (out.size === 0) throw new Error("BIS policy rate: no usable observations");
  return out;
}

const round = (v: number, dp = 2) => Number(v.toFixed(dp));

async function main() {
  console.log("Fetching Norway's monthly history…\n");

  const [inflation, unemployment, rate] = await Promise.all([
    ssbInflation(),
    eurostatUnemployment(),
    bisMonthlyRate(),
  ]);
  console.log(`  inflation     ${inflation.size} months`);
  console.log(`  unemployment  ${unemployment.size} months`);
  console.log(`  policy rate   ${rate.size} months\n`);

  const months = [...new Set([...inflation.keys(), ...unemployment.keys(), ...rate.keys()])]
    .filter((m) => Number(m.slice(0, 4)) >= FROM_YEAR)
    .sort();

  console.log("// ---- paste into lib/monthlyHistory.ts ----");
  console.log("  NO: [");
  for (const m of months) {
    const f = (v: number | undefined) => (v == null ? "null" : String(round(v)));
    console.log(
      `    { period: "${m}", inflation: ${f(inflation.get(m))}, ` +
        `unemployment: ${f(unemployment.get(m))}, policyRate: ${f(rate.get(m))} },`,
    );
  }
  console.log("  ],");
}

void main();
