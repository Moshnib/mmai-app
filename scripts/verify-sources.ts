// ============================================================
// THE SOURCE REGISTRY IS NOW LOAD-BEARING. THIS CHECKS IT.
//
// lib/sources.ts used to be documentation: a table feeding the public
// Sources page. As of 2026-09-02 it also generates the provenance line
// stored on every scored row, via sourceNoteFor(). A gap in the registry
// is no longer a gap in a page — it is a wrong statement about where a
// number came from.
//
// WHAT WENT WRONG BEFORE THIS EXISTED. The provenance line was a
// hand-maintained table in app/api/refresh/route.ts, and it drifted three
// separate ways without anything noticing:
//
//   - Four markets credited the WORLD BANK for figures that came from
//     Statistics Canada, the ONS, the ABS and e-Stat. That is a false
//     statement about provenance on the one page whose entire purpose is
//     letting a reader check the work — and it made the data look older
//     than it is, since the World Bank publishes annually.
//   - Every market credited the EIA, which stopped scoring anything when
//     the oil pillar was retired.
//   - No market credited the BIS, which had started scoring Fiscal
//     Resilience the same day.
//
// Generating the line removed the drift. This file guards the registry
// the generator now depends on.
//
//   npx tsx scripts/verify-sources.ts
// ============================================================

import { SOURCES, sourcesForMarket, sourceForPillar, sourceNoteFor } from "../lib/sources";
import { FALLBACK_MARKETS } from "../lib/markets";
import { NEWS_SOURCES } from "../lib/newsSources";
import { PILLAR_CODES, type PillarKey } from "../lib/indicators";

// PILLAR_CODES is already the list. It replaced PILLAR_WEIGHTS, which was
// an object this line used to enumerate -- Object.keys() on the array would
// return ["0","1","2","3","4"], and the cast below would have hidden that.
const KEYS: readonly PillarKey[] = PILLAR_CODES;

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`        expected ${JSON.stringify(expected)}`);
    console.log(`        got      ${JSON.stringify(actual)}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

console.log("Source registry\n");

// ---------- the generator's requirements ----------
// A live scored source with no shortName would silently fall back to its
// full institution name and make the stored provenance line unreadable.
const noShortName = SOURCES
  .filter((s) => s.status === "live" && s.pillar != null && !s.shortName)
  .map((s) => `${s.market}/${s.indicator}`);
check("Every live scored source has a shortName", noShortName, []);

// ---------- every published pillar is attributed ----------
// This is the check that would have caught the World Bank drift: a pillar
// that scores but has no live source behind it is a number with no
// stated origin.
const unattributed: string[] = [];
for (const market of FALLBACK_MARKETS) {
  for (const key of KEYS) {
    const src = sourceForPillar(market.name, key);
    if (!src) unattributed.push(`${market.name}/${key} — no source at all`);
    else if (src.status !== "live") unattributed.push(`${market.name}/${key} — source is "${src.status}"`);
  }
}
check("Every scored pillar of every published market has a live source", unattributed, []);

// ---------- the generated line is real ----------
const emptyNotes = FALLBACK_MARKETS
  .filter((m) => sourceNoteFor(m.name) === "no live scored source")
  .map((m) => m.name);
check("Every published market generates a real provenance line", emptyNotes, []);

// The retired oil pillar must not reappear in any provenance line. Brent
// is still fetched and still shown in the weekly feed; naming it here
// would tell a reader it contributed to a score, which it does not.
const creditsEia = FALLBACK_MARKETS
  .filter((m) => /EIA|Energy Information/i.test(sourceNoteFor(m.name)))
  .map((m) => m.name);
check("No provenance line credits the EIA, which scores nothing", creditsEia, []);

// The World Bank is now used ONLY for dormant Norway and Japan's
// unemployment fallback. If it reappears in a published market's line,
// the exact drift this file exists to prevent has happened again.
const creditsWorldBank = FALLBACK_MARKETS
  .filter((m) => /World Bank/i.test(sourceNoteFor(m.name)))
  .map((m) => m.name);
check("No published market credits the World Bank", creditsWorldBank, []);

// ---------- the page's promise ----------
// The Sources page invites readers to check the work. Without a link,
// a reader who wants to verify a figure has to go find the agency.
const noUrl = SOURCES.filter((s) => s.status === "live" && !s.url).map((s) => `${s.market}/${s.indicator}`);
check("Every live source links to the institution's own page", noUrl, []);

// ---------- every news feed is licensed, by its own row ----------
// A feed in lib/newsSources.ts reaches the homepage the moment it is
// added. Its licence row is what puts it on the Sources page -- and it
// must be ITS row. Matching by institution name would pass on the data
// rows alone (BLS, the RBA, the Bank of Canada and Statistics Norway are
// all already listed for their figures), and a figure's licence is not a
// headline's: the RBA excludes its Cash Rate from the CC BY 4.0 that
// covers its media releases. So the tie is an explicit id.
const unlicensedFeeds: string[] = [];
for (const feed of NEWS_SOURCES) {
  const rows = SOURCES.filter((s) => s.newsSourceId === feed.id);
  if (rows.length !== 1) unlicensedFeeds.push(`${feed.id} — ${rows.length} licence rows`);
  else if (rows[0].market !== "All markets" || rows[0].pillar != null) unlicensedFeeds.push(`${feed.id} — its row is not an unscored "All markets" row`);
  // The name on an item's tooltip must be the name on the Sources page.
  else if (rows[0].institution !== feed.institution || rows[0].shortName !== feed.shortName)
    unlicensedFeeds.push(`${feed.id} — named "${feed.institution}" / "${feed.shortName}", its row says "${rows[0].institution}" / "${rows[0].shortName}"`);
}
const orphanRows = SOURCES
  .filter((s) => s.newsSourceId != null && !NEWS_SOURCES.some((f) => f.id === s.newsSourceId))
  .map((s) => `${s.indicator} — names feed "${s.newsSourceId}", which does not exist`);
check("Every news feed has exactly one licence row of its own", [...unlicensedFeeds, ...orphanRows], []);

// ---------- no duplicates ----------
const seen = new Set<string>();
const dupes: string[] = [];
for (const s of SOURCES) {
  const k = `${s.market}||${s.indicator}`;
  if (seen.has(k)) dupes.push(k);
  seen.add(k);
}
check("No duplicate (market, indicator) rows", dupes, []);

// ---------- what a reader will actually see ----------
console.log("\nGenerated provenance lines:");
for (const m of FALLBACK_MARKETS) {
  console.log(`  ${m.name.padEnd(16)} ${sourceNoteFor(m.name)}`);
}
console.log(`\n${SOURCES.length} rows, ${sourcesForMarket("United States").length} apply to the US.`);

if (failures > 0) {
  console.log(`\n${failures} FAILED — DO NOT SHIP`);
  process.exit(1);
}
console.log("\nRegistry is complete and consistent.");
