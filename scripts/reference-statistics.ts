// ============================================================
// REFERENCE STATISTICS — the μ and σ the framework needs
//
// Framework §2: Zᵢ = (Xᵢ − μᵢ) / σᵢ.  Nothing can be standardised until
// every indicator has a documented mean and standard deviation, and §9.1
// lists the reference period as unresolved. This computes them.
//
// POOLED ACROSS THE SIX MARKETS, not per country. If each country were
// standardised against its own history, every country would sit near
// zero by construction -- Japan's 2.4% unemployment and Spain's 15%
// would both read "normal for them" -- and cross-country comparison,
// which is the entire point of MMAI, would stop working.
//
// WINDOWS DIFFER BY INDICATOR, and that is stated rather than hidden.
// The macro series reach back to 1991; the bond slope only to May 2013,
// because the RBA's table F2 starts there. Each μ and σ is estimated
// from a representative sample of its OWN indicator, which is what the
// framework requires -- but the windows are not identical and a reader
// is entitled to know.
//
//   npx tsx scripts/reference-statistics.ts
// ============================================================

import { HISTORY } from "../lib/history";
import { INFLATION_TARGET } from "../lib/scoring";

const MARKETS = ["US", "EA", "UK", "CA", "JP", "AU"];

interface Stat { name: string; group: string; n: number; mean: number; sd: number; min: number; max: number; window: string; better: string }

function describe(name: string, group: string, values: number[], window: string, better: string): Stat {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { name, group, n, mean, sd, min: Math.min(...values), max: Math.max(...values), window, better };
}

async function bondSlope(): Promise<number[]> {
  // Read straight from Supabase with the public key: bond_yields carries a
  // public read policy, same as every chart on the site uses.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.warn("  (no Supabase credentials — bond slope skipped)"); return []; }
  const out: number[] = [];
  for (let from = 0; ; from += 1000) {
    // ORDER BY id IS LOAD-BEARING. Paging without a stable, unique sort
    // key lets Postgres return rows in a different order per request, so
    // a page boundary can repeat some rows and skip others. The first
    // version of this file did exactly that and produced a mean of 0.373
    // against the true 0.407 -- close enough to look right, wrong enough
    // to matter. Same failure the CSV export already documents.
    const res = await fetch(
      `${url}/rest/v1/bond_yields?select=id,yield_10y,yield_5y&yield_5y=not.is.null` +
        `&observation_date=gte.2013-05-20&order=id.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } }
    );
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{ yield_10y: number; yield_5y: number }>;
    if (rows.length === 0) break;
    for (const r of rows) out.push(Number(r.yield_10y) - Number(r.yield_5y));
    if (rows.length < 1000) break;
  }
  return out;
}

async function main() {
  const infGap: number[] = [], unemp: number[] = [], growth: number[] = [], debt: number[] = [], rate: number[] = [];
  for (const m of MARKETS) {
    for (const pt of HISTORY[m] ?? []) {
      const r = pt.indicators;
      const target = INFLATION_TARGET[m] ?? 2;
      if (r.inflation != null) infGap.push(Math.abs(r.inflation - target));
      if (r.unemployment != null) unemp.push(r.unemployment);
      if (r.gdpGrowth != null) growth.push(r.gdpGrowth);
      if (r.debtPctGdp != null) debt.push(r.debtPctGdp);
      if (r.policyRate != null) rate.push(r.policyRate);
    }
  }
  console.log("Fetching the bond slope from Supabase…");
  const slope = await bondSlope();

  const stats: Stat[] = [
    describe("Inflation gap |π − π*|", "CONDITIONS", infGap, "2019–2026", "lower"),
    describe("Unemployment", "CONDITIONS", unemp, "2019–2026", "lower"),
    describe("GDP growth", "DIRECTION", growth, "2019–2026", "higher"),
    ...(slope.length ? [describe("Bond slope 10y − 5y", "DIRECTION", slope, "2013–2026", "higher")] : []),
    describe("Government debt % GDP", "CAPACITY", debt, "2019–2026", "lower"),
    describe("Policy rate", "CAPACITY", rate, "2019–2026", "higher*"),
  ];

  console.log("\nREFERENCE STATISTICS — pooled across the six markets\n");
  console.log("indicator                  group        n      mean       sd      min      max   window      better");
  console.log("-".repeat(104));
  for (const s of stats) {
    console.log(
      `${s.name.padEnd(26)} ${s.group.padEnd(11)} ${String(s.n).padStart(5)} ${s.mean.toFixed(3).padStart(8)} ${s.sd.toFixed(3).padStart(8)} ${s.min.toFixed(2).padStart(8)} ${s.max.toFixed(2).padStart(8)}   ${s.window.padEnd(11)} ${s.better}`
    );
  }
  console.log("\n* Policy rate: in CAPACITY the question is \"can we handle trouble?\", so a");
  console.log("  HIGHER rate is better — it is room to cut. That is the opposite sign from");
  console.log("  a \"how tight is policy\" reading, and it falls out of the grouping.");

  console.log("\nTODAY'S Z-SCORES\n");
  const LIVE: Record<string, { inf: number; une: number; gdp: number; debt: number; rate: number }> = {
    US: { inf: 3.7, une: 4.1, gdp: 2.1, debt: 111.0, rate: 3.63 },
    EA: { inf: 3.3, une: 6.4, gdp: 1.0, debt: 85.3, rate: 2.25 },
    UK: { inf: 2.9, une: 4.9, gdp: 0.9, debt: 88.8, rate: 3.75 },
    CA: { inf: 3.03, une: 6.4, gdp: 1.13, debt: 96.1, rate: 2.25 },
    JP: { inf: 2.0, une: 2.4, gdp: 0.55, debt: 178.8, rate: 0.977 },
    AU: { inf: 3.45, une: 4.46, gdp: 2.14, debt: 50.7, rate: 4.35 },
  };
  const by = Object.fromEntries(stats.map((s) => [s.name, s]));
  const z = (name: string, x: number) => { const s = by[name]; return s ? (x - s.mean) / s.sd : NaN; };
  console.log("market    infGap   unemp   growth    debt    rate");
  console.log("-".repeat(52));
  for (const m of MARKETS) {
    const d = LIVE[m], t = INFLATION_TARGET[m] ?? 2;
    console.log(
      `${m.padEnd(9)}${z("Inflation gap |π − π*|", Math.abs(d.inf - t)).toFixed(2).padStart(6)}` +
      `${z("Unemployment", d.une).toFixed(2).padStart(8)}` +
      `${z("GDP growth", d.gdp).toFixed(2).padStart(9)}` +
      `${z("Government debt % GDP", d.debt).toFixed(2).padStart(8)}` +
      `${z("Policy rate", d.rate).toFixed(2).padStart(8)}`
    );
  }
  console.log("\n(raw Z, before the sign flip that makes positive = better)");
}

main().catch((e) => { console.error(e); process.exit(1); });
