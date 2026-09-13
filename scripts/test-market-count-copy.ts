// ============================================================
//  A NUMBER OF MARKETS, TYPED INTO A SENTENCE, IS A FUTURE LIE
//
//  Two separate failures on 12 September 2026, both from the same habit.
//
//  1. THE LEARN PAGE NAMED THE WRONG COUNTRY. It listed every scored
//     market by how many rows it contributes to the 148-row reference
//     set and named the smallest. Sweden joined AFTER that set was
//     frozen, so Sweden contributes zero, so Sweden became "the
//     smallest" -- and the page published:
//
//       "Sweden is under-represented in the record ... Sweden
//        contributes 0, because for eight of those years its central
//        bank targeted the quantity of money rather than an interest
//        rate"
//
//     Zero and eight in one sentence, and the eight-year reason is
//     Japan's. It was live on the production site for days. Nothing
//     caught it: it type-checked, it rendered, it read fluently.
//
//  2. FOUR PAGES SAID "SEVEN MARKETS" while eight were scored, within a
//     minute of Norway being added.
//
//  Both are now derived from FALLBACK_MARKETS and REFERENCE_SET. This
//  test holds that line, because the failure mode is a sentence that is
//  merely STALE -- and a stale sentence throws nothing, breaks no
//  layout, and fails no other check in this project.
//
//    npx tsx scripts/test-market-count-copy.ts
// ============================================================

import { readFileSync } from "node:fs";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { REFERENCE_SET } from "@/lib/referenceSet";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

console.log("\nMarket counts in copy\n");

// ---------- 1. no page hand-types the number of markets ----------
const WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** Gulf Watch really does cover six countries, and always will unless the
 *  Gulf changes shape. Its pages are not in scope. */
const FILES = [
  "app/learn/page.tsx",
  "app/dashboard/DashboardInner.tsx",
  "app/dashboard/page.tsx",
  "app/compare/ComparePageInner.tsx",
  "app/page.tsx",
  "app/sources/page.tsx",
  "components/BondYieldPanel.tsx",
  "components/WorldMap.tsx",
];

/** Counts attached to the things this site counts.
 *
 *  "market(s)" WAS THE ONLY NOUN HERE, AND THAT WAS THE HOLE. On
 *  13 September an audit of the live site found three pages announcing
 *  "Six economies" while nine were scored -- the homepage, About and
 *  Compare, the three most-read pages. This test was already running in
 *  CI and passed every time, because it policed one noun and the copy
 *  used another.
 *
 *  A rule that names one word only ever polices that word. Adding
 *  "economies" and "countries"; anything else the copy starts calling
 *  them will need adding too, which is the honest limitation of
 *  checking prose with a regular expression.
 *
 *  NOT flagged: a count attached to the REFERENCE SET. "148 market-years
 *  of the same six economies" is a fixed historical fact that must stay
 *  six however many markets are scored, so a line mentioning the
 *  reference set is skipped. */
const NOUNS = "markets?|economies|economy|countries|country";
/** "one" is dropped: it is a pronoun far more often than a count.
 *  "distinguish one country from another" is English, not a claim about
 *  coverage, and the site has never scored one market. */
const COUNTING_WORDS = WORDS.filter((w) => w !== "one");

// NOTE THE DOUBLE BACKSLASHES, AND DO NOT "TIDY" THEM AWAY.
//
// Inside a template literal `\b` is a BACKSPACE character, not a regex
// word boundary. A single backslash here builds a pattern that matches
// nothing, which makes this test pass on every input -- including the
// three pages that said "Six economies" while nine were scored.
//
// That is not hypothetical: it happened while widening this check on
// 13 September 2026, minutes after adding it. Every assertion went green
// and the check was inert. The only thing that noticed was the mutation
// test below, which puts a known-bad string back and fails if the suite
// stays green.
const PATTERN = new RegExp(
  `\\b(${COUNTING_WORDS.join("|")})\\s+(scored\\s+)?(${NOUNS})\\b`,
  "i",
);

/** A line describing the frozen reference set may legitimately say six. */
const ABOUT_THE_REFERENCE_SET =
  /148|market-year|reference|record|own history|since 2000|2000.{0,4}2025|Gulf/i;

// ---------- 0. does the pattern work at all? ----------
//
// A regex that matches NOTHING makes every assertion below pass. That is
// not a hypothetical failure mode: it happened here on 13 September 2026,
// when a single backslash in a template literal turned the word boundary
// into a backspace character. The whole file went green while checking
// nothing.
//
// So the pattern is tested against strings it MUST catch and strings it
// MUST NOT, before it is trusted on real pages.
const MUST_CATCH = [
  "<h1>Six economies on one scale</h1>",
  "The seven markets MMAI scores, arranged for a decision",
  "eight countries on one scale",
  "Six economies scored on five official figures each",
];
const MUST_NOT_CATCH = [
  "distinguish one country from another",
  "could never make one country look better or worse",
];
for (const sample of MUST_CATCH) {
  if (!PATTERN.test(sample)) fail(`the pattern does not match "${sample}" — it is not doing anything`);
}
for (const sample of MUST_NOT_CATCH) {
  if (PATTERN.test(sample)) fail(`the pattern matches "${sample}", which is English rather than a count`);
}
if (!failed) ok("the pattern catches what it must and ignores what it must not");

for (const file of FILES) {
  let src: string;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue; // a page that no longer exists is not this test's business
  }
  const offenders = src
    .split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    // Comments may discuss history -- the prose a reader sees may not.
    .filter(({ line }) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .filter(({ line }) => PATTERN.test(line))
    .filter(({ line }) => !ABOUT_THE_REFERENCE_SET.test(line));

  if (offenders.length > 0) {
    for (const { line, n } of offenders) {
      fail(`${file}:${n} hand-types a market count — "${line.trim().slice(0, 90)}"`);
    }
  }
}
if (!failed) ok(`no page hand-types a market count (${FALLBACK_MARKETS.length} markets scored today)`);

// ---------- 2. the reference set is not assumed to cover every market ----------
const refCodes = new Set(REFERENCE_SET.map((r) => r.m));
const absent = FALLBACK_MARKETS.filter((m) => !refCodes.has(m.code));

const inRef = FALLBACK_MARKETS.filter((m) => refCodes.has(m.code));
const counts = inRef.map((m) => ({
  code: m.code,
  n: REFERENCE_SET.filter((r) => r.m === m.code).length,
}));
const smallest = [...counts].sort((a, b) => a.n - b.n)[0];

if (!smallest) {
  fail("no scored market appears in the reference set at all");
} else if (smallest.n === 0) {
  fail(`${smallest.code} is counted as "in the reference set" but has 0 rows`);
} else {
  ok(`fewest reference rows is ${smallest.code} with ${smallest.n} — a real count, not a market that joined later`);
}

if (absent.length > 0) {
  ok(`${absent.map((m) => m.code).join(", ")} contribute no reference rows, and are excluded from that ranking`);

  // The site must SAY so. A market ranked against a record it is absent
  // from is a live methodology caveat, not an implementation detail.
  const learn = readFileSync("app/learn/page.tsx", "utf8");
  if (!/REF_ABSENT/.test(learn)) {
    fail(
      `${absent.map((m) => m.name).join(" and ")} ${absent.length === 1 ? "is" : "are"} scored against a ` +
        `reference set ${absent.length === 1 ? "it does" : "they do"} not appear in, and the Learn page does not say so`,
    );
  } else {
    ok("the Learn page discloses which markets are absent from the reference set");
  }
}

console.log("");
if (failed) {
  console.error("Counts and names in copy must be DERIVED. A hand-typed one is correct");
  console.error("until the next market is added, and silent forever after.\n");
  process.exit(1);
}
console.log("Every market count in copy is derived.\n");
export {};
