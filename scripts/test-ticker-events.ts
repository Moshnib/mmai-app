// ============================================================
//  THE TICKER SAYS WHAT CHANGED, AND ONLY IF IT IS RECENT
//
//  The strip along the top of the homepage carries the site's own figures
//  moving. Three things can go wrong with that, and none of them throws:
//
//    it prints a change that did not happen   (rounding read as a move)
//    it prints a change nobody cares about    (three weeks old, scrolling
//                                              as if it were this morning)
//    it prints the same change nine times     (a quarterly source moves
//                                              every market on one day)
//
//  The second makes a site look abandoned; the third makes it look stuck.
//  All three are pinned here, on fixtures with a pinned clock -- a
//  date-dependent test that reads Date.now() passes today and fails in a
//  fortnight.
//
//    npx tsx scripts/test-ticker-events.ts
// ============================================================

import { buildTickerEvents, MAX_EVENT_AGE_DAYS } from "@/lib/tickerEvents";
import type { WeeklyChangesResult, WeeklyMarketResult } from "@/lib/weeklyChanges";
import type { RawIndicators } from "@/lib/indicators";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const NOW = Date.parse("2026-09-16T06:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const RAW = (o: Partial<RawIndicators>): RawIndicators => ({
  inflation: 2.0, gdpGrowth: 1.5, unemployment: 4.0, policyRate: 3.0, debtPctGdp: 90, brentYoY: 0, ...o,
});

function market(over: Partial<WeeklyMarketResult> & { marketCode: string }): WeeklyMarketResult {
  return {
    marketCode: over.marketCode,
    marketName: over.marketName ?? over.marketCode,
    isStale: false,
    buckets: over.buckets ?? [],
    latest: over.latest ?? null,
    steadySince: null,
    // By default the change arrived with the newest reading. The cases
    // below that matter set it apart from that on purpose.
    changedAt: "changedAt" in over ? over.changedAt ?? null : over.buckets?.length === 2 ? over.buckets[0].fetchedAt : null,
  };
}

const wrap = (markets: WeeklyMarketResult[]): WeeklyChangesResult => ({ ok: true, markets });

// ---------- a figure that moved ----------
{
  const r = buildTickerEvents(wrap([market({
    marketCode: "UK", marketName: "United Kingdom",
    buckets: [
      { fetchedAt: ago(1), raw: RAW({ inflation: 3.1 }), composite: 60.8 },
      { fetchedAt: ago(8), raw: RAW({ inflation: 2.9 }), composite: 60.1 },
    ],
  })]), NOW);
  if (r.length !== 1) fail(`one figure moved, ${r.length} events produced`);
  else if (!/inflation 2\.9% → 3\.1%/.test(r[0].text)) fail(`wrong text: ${r[0].text}`);
  else ok(`a moved figure reads: "${r[0].text}"`);
}

// ---------- a rounding artefact is not a move ----------
{
  const r = buildTickerEvents(wrap([market({
    marketCode: "US",
    buckets: [
      { fetchedAt: ago(1), raw: RAW({ inflation: 2.02 }), composite: 64.9 },
      { fetchedAt: ago(8), raw: RAW({ inflation: 2.0 }), composite: 64.9 },
    ],
  })]), NOW);
  if (r.length !== 0) fail(`0.02 of movement produced an event: ${r[0]?.text}`);
  else ok("a change too small to print is not an event");
}

// ---------- a band change is the line a market gets ----------
{
  const r = buildTickerEvents(wrap([market({
    marketCode: "JP", marketName: "Japan",
    buckets: [
      { fetchedAt: ago(1), raw: RAW({ unemployment: 2.5 }), composite: 62.0 },
      { fetchedAt: ago(9), raw: RAW({ unemployment: 3.4 }), composite: 53.4 },
    ],
  })]), NOW);
  if (r.length !== 1) fail(`a market says one thing; got ${r.length}`);
  else if (r[0].kind !== "band") fail(`the band change must win, got "${r[0].text}"`);
  else if (!/Japan moved up into Above average/.test(r[0].text)) fail(`wrong band text: ${r[0].text}`);
  else ok(`a band change beats a moved figure: "${r[0].text}"`);
}

// ---------- old news is not news ----------
{
  const stale = wrap([market({
    marketCode: "CA", marketName: "Canada",
    buckets: [
      { fetchedAt: ago(MAX_EVENT_AGE_DAYS + 1), raw: RAW({ policyRate: 2.25 }), composite: 39.9 },
      { fetchedAt: ago(MAX_EVENT_AGE_DAYS + 9), raw: RAW({ policyRate: 2.75 }), composite: 39.9 },
    ],
  })]);
  if (buildTickerEvents(stale, NOW).length !== 0) fail(`a change older than ${MAX_EVENT_AGE_DAYS} days still scrolls`);
  else ok(`nothing older than ${MAX_EVENT_AGE_DAYS} days reaches the strip`);

  // ...and the same fixture one day younger DOES, or the gate above is
  // passing because the builder is broken rather than because it filtered.
  const fresh = wrap([market({
    marketCode: "CA", marketName: "Canada",
    buckets: [
      { fetchedAt: ago(MAX_EVENT_AGE_DAYS - 1), raw: RAW({ policyRate: 2.25 }), composite: 39.9 },
      { fetchedAt: ago(MAX_EVENT_AGE_DAYS + 9), raw: RAW({ policyRate: 2.75 }), composite: 39.9 },
    ],
  })]);
  if (buildTickerEvents(fresh, NOW).length === 0) fail("the age gate rejects a change inside the window");
  else ok("a change inside the window is kept, so the gate filters by age and nothing else");
}

// ---------- a clock that is wrong is not news either ----------
{
  const future = wrap([market({
    marketCode: "SE",
    buckets: [
      { fetchedAt: new Date(NOW + 3 * 86_400_000).toISOString(), raw: RAW({ inflation: 1.0 }), composite: 47.3 },
      { fetchedAt: ago(2), raw: RAW({ inflation: 2.0 }), composite: 47.3 },
    ],
  })]);
  if (buildTickerEvents(future, NOW).length !== 0) fail("a reading stamped in the future scrolls as news");
  else ok("a stamp in the future is a broken clock, not an event");
}

// ---------- nothing to say is a valid answer ----------
{
  if (buildTickerEvents({ ok: false, reason: "unavailable" }, NOW).length !== 0) fail("an unavailable feed produced events");
  else if (buildTickerEvents(wrap([market({ marketCode: "NO", buckets: [] })]), NOW).length !== 0) fail("a market with no history produced events");
  else ok("no data, no events -- and no invented ones");
}

// ---------- one line per market ----------
// BIS published government debt on 16 September and every market moved
// the same day: the live strip filled with nine near-identical debt
// lines, which reads as a stuck feed rather than a busy one.
{
  const quarterly = wrap(["US", "UK", "JP"].map((c) =>
    market({
      marketCode: c,
      buckets: [
        { fetchedAt: ago(1), raw: RAW({ debtPctGdp: 120, inflation: 3.5, unemployment: 5.5 }), composite: 50 },
        { fetchedAt: ago(8), raw: RAW({ debtPctGdp: 118, inflation: 2.5, unemployment: 4.5 }), composite: 50 },
      ],
    })));
  const r = buildTickerEvents(quarterly, NOW);
  const codes = r.map((e) => e.marketCode);
  if (new Set(codes).size !== codes.length) fail(`a market appears twice: ${codes.join(", ")}`);
  else if (r.length !== 3) fail(`three markets moved, ${r.length} lines produced`);
  else ok("three figures moved in each of three markets, and each market says one thing");
}

// ---------- newest first, and capped ----------
{
  const many = wrap(["US", "UK", "JP", "CA", "SE", "NO"].map((c, i) =>
    market({
      marketCode: c,
      buckets: [
        { fetchedAt: ago(i * 0.5), raw: RAW({ inflation: 3 + i }), composite: 50 },
        { fetchedAt: ago(9), raw: RAW({ inflation: 2 }), composite: 50 },
      ],
    })));
  const r = buildTickerEvents(many, NOW, 4);
  if (r.length !== 4) fail(`the limit is not applied: ${r.length} events`);
  else if (Date.parse(r[0].at) < Date.parse(r[r.length - 1].at)) fail("events are not newest first");
  else ok("newest first, and no more than asked for");
}

// ---------- the age is the CHANGE's age, not the newest reading's ----------
// The refresh writes every market every day, so the newest reading is
// always this morning. The strip used to date events by it, and the age
// gate above never fired on live data: a move from three weeks ago
// scrolled as if it had happened today.
{
  const r = buildTickerEvents(wrap([market({
    marketCode: "CA", marketName: "Canada",
    buckets: [
      { fetchedAt: ago(0.1), raw: RAW({ debtPctGdp: 97.1 }), composite: 39.9 },
      { fetchedAt: ago(MAX_EVENT_AGE_DAYS + 7), raw: RAW({ debtPctGdp: 96.1 }), composite: 39.9 },
    ],
    changedAt: ago(MAX_EVENT_AGE_DAYS + 6),
  })]), NOW);
  if (r.length !== 0) fail(`a change first seen ${MAX_EVENT_AGE_DAYS + 6} days ago scrolls because the newest reading is today`);
  else ok("an old change stays old, however recently the market was re-read");
}

// ---------- one refresh, many markets: the site's order, not the write order ----------
// 19 September, as it happened: one run wrote every market a few seconds
// apart, US first. Sorted by the second, the US always came last, and with
// five places the strip dropped the US rate rise.
{
  const run = (s: number) => new Date(Date.parse("2026-09-16T03:03:00Z") + s * 1000).toISOString();
  const codes = ["US", "EA", "CA", "UK", "JP", "AU", "SE", "NO", "KR"];
  const markets = codes.map((c, i) => market({
    marketCode: c,
    buckets: [
      { fetchedAt: run(12 + i * 3), raw: RAW({ unemployment: 4.5 }), composite: 50 },
      { fetchedAt: ago(3), raw: RAW({ unemployment: 4.0 }), composite: 50 },
    ],
  }));
  const r = buildTickerEvents(wrap(markets), NOW, 5).map((e) => e.marketCode);
  if (r.join(",") !== "US,EA,CA,UK,JP") fail(`one run's changes came out in write order: ${r.join(", ")}`);
  else ok("changes from one refresh lead in the site's own market order, US first");
}

// ---------- a newer day still beats that order ----------
{
  const r = buildTickerEvents(wrap([
    market({ marketCode: "US", buckets: [
      { fetchedAt: ago(2), raw: RAW({ inflation: 3 }), composite: 50 },
      { fetchedAt: ago(9), raw: RAW({ inflation: 2 }), composite: 50 },
    ] }),
    market({ marketCode: "KR", buckets: [
      { fetchedAt: ago(0.5), raw: RAW({ inflation: 3 }), composite: 50 },
      { fetchedAt: ago(9), raw: RAW({ inflation: 2 }), composite: 50 },
    ] }),
  ]), NOW).map((e) => e.marketCode);
  if (r.join(",") !== "KR,US") fail(`an older day was put first: ${r.join(", ")}`);
  else ok("a change from a newer day comes first, whichever market it is");
}

console.log("");
if (failed) {
  console.error("The ticker would print something it should not.\n");
  process.exit(1);
}
console.log("One line per market, newest first, and only while it is still news.\n");
