// One-time generator for lib/gulfHistory.ts. Run manually:
//   npx tsx scripts/backfill-gulf-history.ts
//
// Never touches Supabase (no service-role key needed) -- pure
// read-from-public-APIs, write-a-static-TypeScript-file, same
// philosophy as the hand-curated lib/history.ts already used for the 6
// scored markets. Safe to re-run any time: it always emits the
// complete file from scratch (never merges/appends) with a
// deterministic country order and sort, so re-running produces a
// clean, reviewable git diff -- never duplicate or merged-in-place
// data. (The generated header's own timestamp always changes, so the
// diff is never literally empty -- the guarantee is "clean diff", not
// "byte-identical".)
//
// See lib/fetchers/historyUtils.ts and the individual *History()
// fetchers for the sanitizing rules (leading-zero-run drop, Qatar
// real-estate completeness filter, interior gap-filling) applied here
// before anything is written.

import { writeFileSync } from "fs";
import { join } from "path";
import { fetchInflationHistory, fetchFxReservesMonthsHistory, fetchCurrentAccountPctGdpHistory } from "../lib/fetchers/worldbank";
import { fetchBahrainInflationHistory } from "../lib/fetchers/bahrainCpi";
import { fetchQatarInflationHistory } from "../lib/fetchers/qatarCpi";
import { fetchSaudiInflationHistory } from "../lib/fetchers/datasaudi";
import { fetchQatarRealEstateHistory, isCompleteMonth } from "../lib/fetchers/qatarRealEstate";
import { dropLeadingZeroRun, assertNoDuplicatePeriods, fillAnnualGaps, fillMonthlyGaps, type HistoryPoint, type GapFilledPoint } from "../lib/fetchers/historyUtils";

const ISO3: Record<string, string> = { AE: "ARE", BH: "BHR", QA: "QAT", SA: "SAU", KW: "KWT", OM: "OMN" };
const COUNTRY_ORDER = ["AE", "BH", "QA", "SA", "KW", "OM"];

interface Series {
  granularity: "annual" | "monthly";
  points: GapFilledPoint[];
}

function orderByCountry(map: Record<string, Series>): Record<string, Series> {
  const out: Record<string, Series> = {};
  for (const code of COUNTRY_ORDER) if (map[code]) out[code] = map[code];
  return out;
}

async function buildCpiHistory(): Promise<Record<string, Series>> {
  const out: Record<string, Series> = {};

  for (const code of ["AE", "KW", "OM"] as const) {
    const raw = await fetchInflationHistory(ISO3[code]);
    assertNoDuplicatePeriods(raw, `${code} CPI`);
    out[code] = { granularity: "annual", points: fillAnnualGaps(raw) };
  }

  const bahrainRaw = await fetchBahrainInflationHistory();
  assertNoDuplicatePeriods(bahrainRaw, "BH CPI");
  out.BH = { granularity: "monthly", points: fillMonthlyGaps(bahrainRaw) };

  const qatarRaw = await fetchQatarInflationHistory();
  assertNoDuplicatePeriods(qatarRaw, "QA CPI");
  out.QA = { granularity: "monthly", points: fillMonthlyGaps(qatarRaw) };

  const saudiRawFull = await fetchSaudiInflationHistory();
  const saudiCleaned = dropLeadingZeroRun(saudiRawFull);
  const droppedCount = saudiRawFull.length - saudiCleaned.length;
  if (droppedCount > 0) {
    console.log(`SA CPI: dropped ${droppedCount} leading zero-artifact point(s): ${saudiRawFull.slice(0, droppedCount).map((p) => p.period).join(", ")}`);
  }
  assertNoDuplicatePeriods(saudiCleaned, "SA CPI");
  out.SA = { granularity: "monthly", points: fillMonthlyGaps(saudiCleaned) };

  return orderByCountry(out);
}

async function buildAnnualWorldBankHistory(fetcher: (iso3: string) => Promise<HistoryPoint[]>, label: string): Promise<Record<string, Series>> {
  const out: Record<string, Series> = {};
  for (const code of COUNTRY_ORDER) {
    const raw = await fetcher(ISO3[code]);
    assertNoDuplicatePeriods(raw, `${code} ${label}`);
    const points = fillAnnualGaps(raw);
    const gapCount = points.filter((p) => p.value === null).length;
    if (gapCount > 0) console.log(`${code} ${label}: ${gapCount} interior gap year(s) within its ${points[0].period}-${points.at(-1)!.period} range`);
    out[code] = { granularity: "annual", points };
  }
  return out;
}

async function buildRealEstateHistory(): Promise<{ series: Record<string, Series>; droppedNote: string }> {
  const raw = await fetchQatarRealEstateHistory();
  const complete = raw.filter(isCompleteMonth).map((r) => ({ period: r.period, value: r.txCount }));
  const dropped = raw.filter((r) => !isCompleteMonth(r));
  console.log(`QA real estate: kept ${complete.length}/${raw.length} months, dropped as incomplete: ${dropped.map((r) => r.period).join(", ") || "none"}`);
  assertNoDuplicatePeriods(complete, "QA real estate");
  const droppedNote =
    dropped.length === 0
      ? "// No months dropped this run -- every month in the source passed the completeness check."
      : `// Dropped as incomplete this run (see isCompleteMonth in lib/fetchers/qatarRealEstate.ts):\n` +
        dropped.map((r) => `//   ${r.period}: spans ${r.firstDay}..${r.lastDay}, ${r.distinctDays} distinct day(s)`).join("\n");
  return { series: { QA: { granularity: "monthly", points: fillMonthlyGaps(complete) } }, droppedNote };
}

function renderSeries(series: Record<string, Series>): string {
  const countryEntries = Object.entries(series)
    .map(([code, s]) => {
      const points = s.points.map((p) => `      { period: "${p.period}", value: ${p.value === null ? "null" : p.value} },`).join("\n");
      return `  ${code}: {\n    granularity: "${s.granularity}",\n    points: [\n${points}\n    ],\n  },`;
    })
    .join("\n");
  return `{\n${countryEntries}\n}`;
}

(async () => {
  console.log("Fetching Gulf Watch historical series from live sources...\n");

  const cpi = await buildCpiHistory();
  const fxReserves = await buildAnnualWorldBankHistory(fetchFxReservesMonthsHistory, "FX reserves");
  const currentAccount = await buildAnnualWorldBankHistory(fetchCurrentAccountPctGdpHistory, "current account");
  const { series: realEstate, droppedNote } = await buildRealEstateHistory();

  const generatedAt = new Date().toISOString();
  const contents = `// ============================================================
// GENERATED FILE -- DO NOT HAND-EDIT.
// Produced by scripts/backfill-gulf-history.ts, run manually against
// live public APIs (World Bank, data.gov.bh, data.gov.qa, Data Saudi).
// Regenerate by re-running that script -- it always emits this file's
// complete contents from scratch (never merges/appends) in a fixed
// country order, so re-running after a genuine upstream update
// produces a clean, reviewable git diff instead of duplicate or stale
// entries. (The timestamp below always changes, so a no-op re-run
// still shows a one-line diff -- the guarantee is "clean diff", not
// "byte-identical".)
//
// Sanitizing rules already applied before these numbers were written
// (see lib/fetchers/historyUtils.ts and the individual fetchers for
// the full reasoning):
//  - Saudi CPI: a leading run of exact-0 values (a base-year artifact of
//    the source API's own year-over-year calculation, not real data)
//    has been dropped.
//  - Qatar real estate: months where recorded transactions don't span
//    close to the full calendar month (the portal stopped publishing
//    partway through, e.g. October 2025 = 2 of 31 days) have been
//    dropped rather than charted as a fabricated activity crash.
//  - Every series has explicit null entries for any interior period
//    with no real data (confirmed real for Kuwait's FX reserves/current
//    account), so a gap renders as a gap with connectNulls={false},
//    never as a silently compressed or interpolated line.
//
// Generated: ${generatedAt}
// ============================================================

export interface GulfHistoryPoint {
  period: string; // "YYYY" for annual series, "YYYY-MM" for monthly series
  value: number | null; // null = no data for this period (see rules above)
}

export interface GulfHistorySeries {
  granularity: "annual" | "monthly";
  points: GulfHistoryPoint[];
}

// Cost of living. AE/KW/OM = World Bank annual; BH/QA/SA = national monthly sources.
export const GULF_CPI_HISTORY: Record<string, GulfHistorySeries> = ${renderSeries(cpi)};

// Currency stability, pillar 1 of 2. World Bank annual, all 6 countries.
export const GULF_FX_RESERVES_HISTORY: Record<string, GulfHistorySeries> = ${renderSeries(fxReserves)};

// Currency stability, pillar 2 of 2. World Bank annual, all 6 countries.
export const GULF_CURRENT_ACCOUNT_HISTORY: Record<string, GulfHistorySeries> = ${renderSeries(currentAccount)};

// Investment confidence. Only Qatar has a real source -- every other
// Gulf Watch country's real estate category has no automatable,
// legally-clear data source at all (see lib/gulfSources.ts). Values are
// raw monthly registered-transaction counts; registration days per
// month vary (Sun-Thu work week, holidays), so month-to-month counts
// partly reflect how many days were published, not market activity alone.
${droppedNote}
export const GULF_REAL_ESTATE_HISTORY: Record<string, GulfHistorySeries> = ${renderSeries(realEstate)};
`;

  const outPath = join(__dirname, "..", "lib", "gulfHistory.ts");
  writeFileSync(outPath, contents, "utf-8");
  console.log(`\nWrote ${outPath}`);
})().catch((err) => {
  console.error("Backfill generation failed:", err);
  process.exit(1);
});
