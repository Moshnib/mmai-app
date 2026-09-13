// ============================================================
//  ADDING A MARKET TOUCHES TEN FILES AND THE COMPILER ENFORCES NONE
//
//  Every one of these is a Record keyed by string, so a missing entry is
//  not a type error. It is an empty chart, a grey blob on the map, or a
//  figure nothing checks against its source.
//
//  Three times this has gone wrong, each found by a person rather than by
//  a test:
//
//    Sweden joined on 12 September with no flag, no map shape and no
//    glyph. The site owner reported it: "sweden flags not there every
//    where, sweden in the map not there".
//
//    Norway was reactivated on 12 September with ANNUAL history only. Its
//    Trends charts rendered, so nothing looked broken, and the monthly
//    view was empty for a day.
//
//    Korea joined on 13 September with no history at all. Every chart on
//    its Data Over Time page read "Not enough history yet to chart a
//    trend" — four empty panels on a page about data over time.
//
//  None of those failed a build, threw an error, or moved a pixel
//  anywhere a check was looking. This asks the question for every market
//  and every file at once.
//
//    npx tsx scripts/test-market-completeness.ts
// ============================================================

import { readFileSync } from "node:fs";
import { FALLBACK_MARKETS, MARKET_COLORS } from "@/lib/markets";
import { HISTORY } from "@/lib/history";
import { MONTHLY_HISTORY } from "@/lib/monthlyHistory";
import { INFLATION_TARGET } from "@/lib/indicators";
import { SOURCES } from "@/lib/sources";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const read = (p: string) => readFileSync(p, "utf8");
const flag = read("components/Flag.tsx");
const worldMap = read("components/WorldMap.tsx");
const glyph = read("components/CountryGlyph.tsx");
const audit = read("lib/sourceAudit.ts");
const route = read("app/api/refresh/route.ts");

/** A market code used as an object key: `US: (`, `SE: [`. Deliberately
 *  not a bare word search — "NO" appears in prose constantly. */
const keyedIn = (src: string, code: string) => new RegExp(`\\b${code}:\\s*[[(]`).test(src);

interface Check {
  name: string;
  has: (m: { code: string; name: string }) => boolean;
  why: string;
}

const CHECKS: Check[] = [
  { name: "colour", has: (m) => MARKET_COLORS[m.code] != null, why: "its lines fall back to grey on every chart" },
  { name: "inflation target", has: (m) => INFLATION_TARGET[m.code] != null, why: "Conditions silently scores it against the 2.0 default" },
  { name: "flag", has: (m) => keyedIn(flag, m.code), why: "it renders nothing beside its name, and nothing in the positioning map's dot" },
  { name: "world map shape", has: (m) => keyedIn(worldMap, m.code), why: "the map shows no country for it" },
  { name: "country glyph", has: (m) => keyedIn(glyph, m.code), why: "its glyph is blank" },
  { name: "annual history", has: (m) => Array.isArray((HISTORY as Record<string, unknown>)[m.code]), why: 'its Trends charts read "Not enough history yet"' },
  { name: "monthly history", has: (m) => Array.isArray((MONTHLY_HISTORY as Record<string, unknown>)[m.code]), why: "its monthly view is empty and the dashboard sparkline is a dash" },
  { name: "source rows", has: (m) => SOURCES.some((s) => s.market === m.name), why: "the Sources page cannot say where its figures come from" },
  { name: "source audit probe", has: (m) => new RegExp(`["']${m.code}["']`).test(audit), why: "nothing checks its published figures against the live source" },
  { name: "refresh branch", has: (m) => route.includes(`market === "${m.code}"`), why: "the daily job cannot fetch it" },
];

console.log(`\nCompleteness across ${FALLBACK_MARKETS.length} markets and ${CHECKS.length} files\n`);

for (const check of CHECKS) {
  const missing = FALLBACK_MARKETS.filter((m) => !check.has(m));
  if (missing.length > 0) {
    fail(`${missing.map((m) => m.name).join(", ")} — no ${check.name}: ${check.why}`);
  }
}
if (!failed) ok(`every market has all ${CHECKS.length}`);

// A history block that exists but is EMPTY is worse than one that is
// absent: the absent one at least reads as missing.
for (const m of FALLBACK_MARKETS) {
  const annual = (HISTORY as Record<string, unknown[]>)[m.code];
  const monthly = (MONTHLY_HISTORY as Record<string, unknown[]>)[m.code];
  if (Array.isArray(annual) && annual.length < 2) {
    fail(`${m.name} has an annual history block with ${annual.length} point(s) — a trend needs at least two`);
  }
  if (Array.isArray(monthly) && monthly.length < 12) {
    fail(`${m.name} has only ${monthly.length} months of history — the other markets go back to 2019`);
  }
}
if (!failed) ok("no history block is present but empty");

console.log("");
if (failed) {
  console.error("A market keyed into some files and not others does not fail to build.");
  console.error("It renders, and quietly shows less than every other market.\n");
  process.exit(1);
}
console.log("Every market is wired into every file that is keyed by market.\n");
export {};
