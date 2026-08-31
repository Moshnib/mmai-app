// ============================================================
// HISTORICAL CALIBRATION PANEL — builder.
//
// Charter §18 lists "historical calibration datasets" as a research
// deliverable to preserve. Charter §13 requires testing across regimes
// including the Global Financial Crisis. MMAI's live history begins in
// 2019, so none of that can run. This produces the missing panel.
//
// THIS IS A SCRIPT, NOT A SPREADSHEET, AND THAT IS THE POINT.
// A hand-assembled file cannot be audited, cannot be rebuilt when a
// source revises, and is worth little as an intellectual asset. Anyone
// can re-run this and get the same panel from the same public APIs.
//
//   npx tsx research/build-historical-panel.ts
//
// SOURCES — deliberately ONLY sources already cleared for this project,
// so the panel introduces no new licensing question (charter §12):
//   World Bank   CC BY 4.0        inflation, GDP growth, unemployment
//   BIS          unrestricted*    policy rates       (*with citation)
//   EIA          public domain    Brent crude
//
// ------------------------------------------------------------
// THREE LIMITS THAT MUST TRAVEL WITH THIS DATA
//
// 1. REVISED, NOT VINTAGE. Every figure is as published TODAY. Nobody
//    knew 2008's GDP growth in 2008. This panel supports FULL-INFORMATION
//    backtests only. It CANNOT support a claim that MMAI "would have
//    signalled" anything in real time -- that needs vintage data, which
//    is a separate and much harder problem.
//
// 2. THE EURO AREA DID NOT EXIST BEFORE 1999. The ECB's policy rate
//    begins January 1999; World Bank euro-area aggregates before then are
//    backcast constructions. Euro-area rows before 1999 carry a flag and
//    must not be treated as observations of a policy regime that existed.
//
// 3. JAPAN HAS NO POLICY RATE AT ALL FOR NINE OF TWENTY-NINE YEARS.
//    Verified against BIS directly: the rows are ABSENT, not empty, for
//    1999, 2001-2005 and 2013-2015. Those are exactly the periods when
//    the Bank of Japan was targeting the MONETARY BASE rather than an
//    interest rate -- the Zero Interest Rate Policy, Quantitative Easing,
//    and Qualitative and Quantitative Easing. The instrument MMAI scores
//    did not exist.
//
//    This is an economic fact, not a data-quality defect, and it must not
//    be filled in. Those years fall through to coverage 4/5 = 0.80, which
//    still clears the 0.70 publication gate, so Japan remains scorable --
//    on four pillars, with the weights renormalised. Any calibration of
//    the Monetary Conditions coefficient should EXCLUDE Japan rather than
//    treat a third of its window as missing at random.
// ============================================================

import { writeFileSync } from "fs";
import { join } from "path";
import { parseCsvLine } from "../lib/fetchers/bis";

const FROM = 1990;
const TO = 2018; // live history takes over from 2019

interface MarketCodes {
  code: string;
  name: string;
  worldBank: string;
  bis: string;
  /** Year the market's monetary policy regime actually begins, if later
   *  than FROM. Rows before it are flagged, never silently included. */
  regimeFrom?: number;
}

const MARKETS: MarketCodes[] = [
  { code: "US", name: "United States", worldBank: "USA", bis: "US" },
  { code: "EA", name: "Euro Area", worldBank: "EMU", bis: "XM", regimeFrom: 1999 },
  { code: "CA", name: "Canada", worldBank: "CAN", bis: "CA" },
  { code: "UK", name: "United Kingdom", worldBank: "GBR", bis: "GB" },
  { code: "JP", name: "Japan", worldBank: "JPN", bis: "JP" },
  { code: "AU", name: "Australia", worldBank: "AUS", bis: "AU" },
];

const WB_INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
} as const;

type Series = Record<number, number | null>;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** World Bank annual series for one country and indicator. */
async function worldBank(country: string, indicator: string): Promise<Series> {
  const url =
    `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}` +
    `?format=json&per_page=200&date=${FROM}:${TO}`;
  const json = (await getJson(url)) as Array<unknown>;
  const rows = (json[1] ?? []) as Array<{ date: string; value: number | null }>;
  if (!Array.isArray(rows)) throw new Error(`World Bank returned no rows for ${country}/${indicator}`);
  const out: Series = {};
  for (const r of rows) {
    const y = Number(r.date);
    if (y >= FROM && y <= TO) out[y] = r.value == null ? null : Number(r.value);
  }
  return out;
}

/** BIS monthly policy rates -> the DECEMBER (end-of-period) level for
 *  each year. December, not an annual average: MMAI scores the rate
 *  actually in effect, and the BIS series is already end-of-period. An
 *  average would describe a rate that was never set. */
async function bisPolicyRate(area: string): Promise<Series> {
  const url = `https://stats.bis.org/api/v1/data/WS_CBPOL/M.${area}/all?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BIS ${area}: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`BIS ${area}: no data rows`);

  // Header-name lookup, never a fixed index: BIS reorders columns and
  // embeds commas inside quoted notes. parseCsvLine handles the quoting.
  const header = parseCsvLine(lines[0]);
  const ti = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (ti < 0 || vi < 0) throw new Error(`BIS ${area}: TIME_PERIOD/OBS_VALUE not in header`);

  const out: Series = {};
  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line);
    const period = (f[ti] ?? "").trim();      // "2008-12"
    const raw = (f[vi] ?? "").trim();
    const m = period.match(/^(\d{4})-(\d{2})$/);
    if (!m || raw === "") continue;
    const year = Number(m[1]);
    if (m[2] !== "12" || year < FROM || year > TO) continue;
    const v = Number(raw);
    if (Number.isFinite(v)) out[year] = v;
  }
  return out;
}

/** EIA Brent, monthly -> annual mean -> year-over-year % change.
 *  The annual MEAN is right here (unlike the policy rate): MMAI's EC
 *  pillar reads a year-over-year CHANGE, so both endpoints should be
 *  period aggregates rather than single days. */
async function brentYoY(): Promise<Series> {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error("EIA_API_KEY is not configured (source .env.local first)");
  const url =
    `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}` +
    `&frequency=monthly&data%5B0%5D=value` +
    `&facets%5Bproduct%5D%5B%5D=EPCBRENT&facets%5Bseries%5D%5B%5D=RBRTE` +
    `&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=asc&length=5000`;
  const json = (await getJson(url)) as { response?: { data?: Array<{ period: string; value: string | number }> } };
  const rows = json.response?.data ?? [];
  if (rows.length === 0) throw new Error("EIA returned no Brent rows");

  const byYear = new Map<number, number[]>();
  for (const r of rows) {
    const y = Number(String(r.period).slice(0, 4));
    const v = Number(r.value);
    if (!Number.isFinite(v)) continue;
    byYear.set(y, [...(byYear.get(y) ?? []), v]);
  }
  const mean = new Map<number, number>();
  for (const [y, vs] of byYear) mean.set(y, vs.reduce((a, b) => a + b, 0) / vs.length);

  const out: Series = {};
  for (let y = FROM; y <= TO; y++) {
    const now = mean.get(y);
    const prev = mean.get(y - 1);
    out[y] = now != null && prev != null && prev !== 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : null;
  }
  return out;
}

// ------------------------------------------------------------

interface PanelRow {
  year: number;
  inflation: number | null;
  gdpGrowth: number | null;
  unemployment: number | null;
  policyRate: number | null;
  brentYoY: number | null;
  /** True when the market's monetary regime did not yet exist. */
  preRegime?: boolean;
}

async function main() {
  console.log(`Building historical panel ${FROM}-${TO} for ${MARKETS.length} markets\n`);

  const brent = await brentYoY();
  console.log(`Brent year-over-year: ${Object.values(brent).filter((v) => v != null).length} years\n`);

  const panel: Record<string, PanelRow[]> = {};
  const coverage: Array<{ market: string; field: string; have: number }> = [];

  for (const m of MARKETS) {
    const [inflation, gdpGrowth, unemployment, policyRate] = await Promise.all([
      worldBank(m.worldBank, WB_INDICATORS.inflation),
      worldBank(m.worldBank, WB_INDICATORS.gdpGrowth),
      worldBank(m.worldBank, WB_INDICATORS.unemployment),
      bisPolicyRate(m.bis),
    ]);

    const rows: PanelRow[] = [];
    for (let y = FROM; y <= TO; y++) {
      const preRegime = m.regimeFrom != null && y < m.regimeFrom;
      rows.push({
        year: y,
        inflation: inflation[y] ?? null,
        gdpGrowth: gdpGrowth[y] ?? null,
        unemployment: unemployment[y] ?? null,
        // A rate is never invented for a regime that did not exist.
        policyRate: preRegime ? null : policyRate[y] ?? null,
        brentYoY: brent[y] ?? null,
        ...(preRegime ? { preRegime: true } : {}),
      });
    }
    panel[m.code] = rows;

    const count = (f: keyof PanelRow) => rows.filter((r) => r[f] != null).length;
    coverage.push(
      { market: m.code, field: "inflation", have: count("inflation") },
      { market: m.code, field: "gdpGrowth", have: count("gdpGrowth") },
      { market: m.code, field: "unemployment", have: count("unemployment") },
      { market: m.code, field: "policyRate", have: count("policyRate") }
    );

    console.log(
      `  ${m.code}  inflation ${String(count("inflation")).padStart(2)}/29` +
        `   gdp ${String(count("gdpGrowth")).padStart(2)}/29` +
        `   unemp ${String(count("unemployment")).padStart(2)}/29` +
        `   policy ${String(count("policyRate")).padStart(2)}/29` +
        (m.regimeFrom ? `   (policy from ${m.regimeFrom})` : "")
    );
  }

  const output = {
    _README:
      "Historical calibration panel for MMAI research. REVISED data as published today, " +
      "NOT vintage: supports full-information backtests only, never a claim about real-time " +
      "signalling. Euro-area rows before 1999 have policyRate null and preRegime true. " +
      "Rebuild with: npx tsx research/build-historical-panel.ts",
    generatedFor: `${FROM}-${TO}`,
    sources: {
      inflation: "World Bank FP.CPI.TOTL.ZG (CC BY 4.0)",
      gdpGrowth: "World Bank NY.GDP.MKTP.KD.ZG (CC BY 4.0)",
      unemployment: "World Bank SL.UEM.TOTL.ZS (CC BY 4.0)",
      policyRate: "BIS WS_CBPOL, monthly end-of-period, December value (unrestricted use with citation)",
      brentYoY: "US EIA RBRTE, monthly, annual mean, year-over-year (public domain)",
    },
    limitations: [
      "Revised data, not vintage. Full-information backtests only.",
      "Euro area monetary policy begins 1999; earlier aggregates are backcast.",
      "Japan has NO policy rate for 1999, 2001-2005 and 2013-2015: the BoJ targeted the monetary base, not a rate. Verified absent at source. Those years score on four pillars (coverage 0.80). Exclude Japan when calibrating the Monetary Conditions coefficient.",
    ],
    markets: MARKETS.map((m) => ({ code: m.code, name: m.name })),
    panel,
  };

  const outPath = join(__dirname, "historical-panel.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  const total = coverage.reduce((a, c) => a + c.have, 0);
  const possible = coverage.length * (TO - FROM + 1);
  console.log(`\nWrote ${outPath}`);
  console.log(`Coverage: ${total}/${possible} indicator-years (${((total / possible) * 100).toFixed(1)}%)`);
  console.log(`\nREMEMBER: revised data, not vintage. Full-information backtests only.`);
}

main().catch((err) => {
  console.error("\nFAILED:", (err as Error).message);
  process.exit(1);
});
