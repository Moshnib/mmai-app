// ============================================================
//  A DAILY PRICE, WITH ITS DATE AND ITS BASELINE
//
//  The oil price is the first figure on this site that moves every
//  trading day, and daily data brings two mistakes the rest of the site
//  never had the chance to make:
//
//    the baseline   Monday's move is measured against FRIDAY. Taking
//                   "yesterday" by calendar is wrong once a week, every
//                   week. components/BondYieldPanel.tsx does the
//                   arithmetic correctly and then calls it "vs prev.
//                   day", which is false every Monday -- the mechanism
//                   is worth copying, the label is not.
//
//    the date       the EIA publishes two to four days in arrears, so the
//                   newest price is never today's. A figure that is
//                   correct and looks wrong is this project's recurring
//                   failure (the Fed's target range; the UTC timestamp),
//                   and the fix each time was to make the date part of
//                   the figure.
//
//  The fixture is the real published series around the fall the owner was
//  watching, so the Friday-to-Monday case is a real weekend rather than
//  one invented to pass.
//
//  CI RUNS THIS UNDER America/New_York AS WELL AS UTC, and the last
//  assertion is the reason. A date-only string formatted in the reader's
//  own zone moves BACKWARDS west of UTC -- 2026-01-01 renders as "31
//  December" in New York -- so dropping the UTC option from
//  formatPriceDay is invisible in Europe, in the Gulf and on a UTC
//  runner, and wrong for every American reader. One zone is not coverage.
//  (Node on Windows ignores TZ, so a local run only covers your own.)
//
//  Run: npx tsx scripts/test-commodity-prices.ts
// ============================================================

import { latestWithChange, describeChange, formatPrice, formatPriceDay, type PricePoint } from "../lib/commodityPrices";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

// Europe Brent Spot Price FOB (RBRTE), as the EIA published it. 26 and 27
// September were a weekend: there is no price, because there was no
// trading, and that gap is the point of several checks below.
const REAL: PricePoint[] = [
  { date: "2026-09-15", price: 130.8 },
  { date: "2026-09-16", price: 127.84 },
  { date: "2026-09-17", price: 121.18 },
  { date: "2026-09-18", price: 119.66 },
  { date: "2026-09-21", price: 116.15 },
  { date: "2026-09-22", price: 114.89 },
  { date: "2026-09-23", price: 117.45 },
  { date: "2026-09-24", price: 120.92 },
  { date: "2026-09-25", price: 116.01 },
  { date: "2026-09-28", price: 119.97 },
  { date: "2026-09-29", price: 113.96 },
];
// 2 October 2026, the day this was written: three days after the newest
// price, which is the source behaving normally.
const WRITTEN = Date.parse("2026-10-02T13:00:00Z");

// ---- the newest reading ---------------------------------------------

const r = latestWithChange(REAL, WRITTEN)!;
check("the newest price", r.price, 113.96);
check("dated to its own trading day", r.date, "2026-09-29");
check("the baseline is the previous PUBLISHED day", r.prevDate, "2026-09-28");
check("the move in dollars", Number(r.absChange?.toFixed(2)), -6.01);
check("the move in percent, against the previous price", Number(r.pctChange?.toFixed(2)), -5.01);
check("three days behind is not stale -- that is the source's normal lag", r.stale, false);

// THE FRIDAY-TO-MONDAY CASE, the one a calendar lookup gets wrong every
// week. Monday 28 September's baseline is Friday the 25th; there is no
// 26th or 27th to find.
const monday = latestWithChange(REAL.filter((p) => p.date <= "2026-09-28"), WRITTEN)!;
check("Monday's baseline is Friday, not the day before", monday.prevDate, "2026-09-25");
check("Monday's move is measured from Friday's price", Number(monday.absChange?.toFixed(2)), 3.96);
check("and the sentence names Friday", describeChange(monday), "+$3.96 (+3.4%) since 25 September");

// ---- the shapes that must not produce a number ----------------------

check("nothing at all", latestWithChange([], WRITTEN), null);
// ONE POINT IS NOT A ZERO CHANGE. `prev ?? last` would publish
// "unchanged" on the first day the series exists, which is a claim about
// the market made from having no data.
const one = latestWithChange([{ date: "2026-09-29", price: 113.96 }], WRITTEN)!;
check("one point: a price, but no change", [one.price, one.absChange, one.pctChange], [113.96, null, null]);
check("one point: nothing to say about a move", describeChange(one), null);

// ---- input the database can really hand it ---------------------------

check("unsorted input still finds the newest two",
  latestWithChange([...REAL].reverse(), WRITTEN)!.date, "2026-09-29");
// The upsert can replace a price when the EIA revises it; a read that
// kept both would compare a day against itself.
check("a repeated date collapses, newest row winning",
  latestWithChange([...REAL, { date: "2026-09-29", price: 114.5 }], WRITTEN)!.price, 114.5);
check("a repeated date does not become its own baseline",
  latestWithChange([...REAL, { date: "2026-09-29", price: 114.5 }], WRITTEN)!.prevDate, "2026-09-28");

// A PRICE OF ZERO IS A PRICE. Brent settled negative in 2020 and WTI went
// below zero; a truthiness test here would silently drop real history.
check("zero is kept, not treated as missing",
  latestWithChange([{ date: "2026-04-20", price: 0 }, { date: "2026-04-21", price: 1.5 }], Date.parse("2026-04-22T00:00:00Z"))!.prevPrice, 0);
check("and a zero baseline yields no percentage rather than infinity",
  latestWithChange([{ date: "2026-04-20", price: 0 }, { date: "2026-04-21", price: 1.5 }], Date.parse("2026-04-22T00:00:00Z"))!.pctChange, null);
check("a non-number is dropped",
  latestWithChange([...REAL, { date: "2026-09-30", price: Number.NaN }], WRITTEN)!.date, "2026-09-29");

// ---- when the source goes quiet --------------------------------------

// Three weeks later and still nothing new: that is no longer a lag.
check("a fortnight with no new price is stale",
  latestWithChange(REAL, Date.parse("2026-10-20T00:00:00Z"))!.stale, true);
check("the boundary: six days is not stale",
  latestWithChange(REAL, Date.parse("2026-10-05T00:00:00Z"))!.stale, false);
check("the boundary: seven days is",
  latestWithChange(REAL, Date.parse("2026-10-06T12:00:00Z"))!.stale, true);

// ---- how it reads ----------------------------------------------------

check("the price", formatPrice(113.96), "$113.96");
check("two decimals, as the EIA publishes it", formatPrice(114), "$114.00");
check("the day, written out", formatPriceDay("2026-09-29"), "29 September");
check("with the year where one is needed", formatPriceDay("2026-09-29", true), "29 September 2026");
// A date-only string must not be shifted by a timezone -- west of UTC
// that would print the 28th. See formatWhen in lib/liveTime.ts.
check("the day does not drift with the machine's zone", formatPriceDay("2026-01-01"), "1 January");
check("the fall, in words", describeChange(r), "−$6.01 (−5.0%) since 28 September");

console.log(failures === 0 ? "\nThe daily price carries its date and its baseline." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
