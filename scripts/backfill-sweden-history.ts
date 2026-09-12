// ============================================================
//  GENERATE SWEDEN'S HISTORY BLOCKS, ONCE
//
//  Sweden joined as the seventh market with live figures but no past, so
//  its Trends chart was empty while the other six went back to 2019.
//  This pulls the same three monthly series the other markets show, plus
//  the annual snapshot, and prints TypeScript to paste into
//  lib/monthlyHistory.ts and lib/history.ts.
//
//  A SCRIPT RATHER THAN A LIVE FETCH, matching gulfHistory and
//  stablecoinHistory: a fixed backfill that never changes does not need a
//  table, a migration or a nightly write.
//
//  Sources, all already cleared for this project:
//    CPIF YoY      SCB KPIF2020 / 000007ZM   (the Riksbank's target
//                  measure -- CPI would read the policy, not the prices)
//    unemployment  SCB AKURLBefM / ALÖSP, seasonally adjusted
//    policy rate   BIS WS_CBPOL M.SE, sourced from Sveriges Riksbank
//
//    npx tsx scripts/backfill-sweden-history.ts
// ============================================================

const FROM = "2019-01";

interface JsonStat2 {
  value?: (number | null)[];
  dimension?: { Tid?: { category?: { index?: Record<string, number> } } };
}

async function scb(table: string, query: unknown[]): Promise<Map<string, number>> {
  const res = await fetch(`https://api.scb.se/OV0104/v1/doris/en/ssd/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`SCB ${table}: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as JsonStat2;
  const periods = Object.keys(json.dimension?.Tid?.category?.index ?? {});
  const values = json.value ?? [];
  const out = new Map<string, number>();
  periods.forEach((p, i) => {
    const v = values[i];
    // "2019M01" -> "2019-01"
    const m = /^(\d{4})M(\d{2})$/.exec(p);
    if (m && v != null && Number.isFinite(v)) out.set(`${m[1]}-${m[2]}`, v);
  });
  return out;
}

/** BIS monthly policy rate. Quote-aware because CBPOL rows carry
 *  free-text fields containing commas -- the same trap lib/fetchers/bis.ts
 *  documents. */
async function bisMonthlyRate(): Promise<Map<string, number>> {
  const url = `https://stats.bis.org/api/v1/data/WS_CBPOL/M.SE/all?startPeriod=${FROM}&format=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`BIS rate: ${res.status} ${res.statusText}`);
  const lines = (await res.text()).trim().split("\n");
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]);
  const ti = head.indexOf("TIME_PERIOD");
  const vi = head.indexOf("OBS_VALUE");
  if (ti < 0 || vi < 0) throw new Error("BIS rate: TIME_PERIOD/OBS_VALUE not found");
  const out = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const f = split(line);
    const v = Number(f[vi]);
    if (/^\d{4}-\d{2}$/.test(f[ti]) && Number.isFinite(v)) out.set(f[ti], v);
  }
  return out;
}

const r2 = (v: number | undefined) => (v == null ? null : Math.round(v * 100) / 100);

async function main() {
  const [cpif, unemp, rate] = await Promise.all([
    scb("PR/PR0101/PR0101G/KPIF2020", [
      { code: "ContentsCode", selection: { filter: "item", values: ["000007ZM"] } },
      { code: "Tid", selection: { filter: "all", values: ["*"] } },
    ]),
    scb("AM/AM0401/AM0401A/AKURLBefM", [
      { code: "Arbetskraftstillh", selection: { filter: "item", values: ["ALÖSP"] } },
      { code: "TypData", selection: { filter: "item", values: ["SR_DATA"] } },
      { code: "Kon", selection: { filter: "item", values: ["1+2"] } },
      { code: "Alder", selection: { filter: "item", values: ["tot15-74"] } },
      { code: "Tid", selection: { filter: "all", values: ["*"] } },
    ]),
    bisMonthlyRate(),
  ]);

  // STOPS AT THE NEWEST MONTH THAT HAS AN INFLATION READING. The policy
  // rate is published daily and so runs a month or two ahead of the
  // statistics; carrying those extra months would leave Sweden with a
  // lone rate point extending past every other market, which reads as
  // Sweden being fresher rather than the series being ragged. The other
  // six all end at the newest published CPI month for the same reason.
  const lastInflation = [...cpif.keys()].filter((p) => p >= FROM).sort().pop() ?? FROM;
  const months = [...new Set([...cpif.keys(), ...unemp.keys(), ...rate.keys()])]
    .filter((p) => p >= FROM && p <= lastInflation)
    .sort();

  console.log(`\n// ${months.length} months, ${months[0]} to ${months[months.length - 1]}`);
  console.log(`  SE: [`);
  for (const p of months) {
    console.log(
      `    { period: "${p}", inflation: ${r2(cpif.get(p))}, unemployment: ${r2(unemp.get(p))}, policyRate: ${r2(rate.get(p))} },`,
    );
  }
  console.log(`  ],`);

  // Coverage, so a silent gap cannot pass as a complete backfill.
  const miss = (m: Map<string, number>) => months.filter((p) => !m.has(p)).length;
  console.error(`\nCoverage over ${months.length} months — CPIF missing ${miss(cpif)}, unemployment missing ${miss(unemp)}, policy rate missing ${miss(rate)}`);
}

main();
export {};
