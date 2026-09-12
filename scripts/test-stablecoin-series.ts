// ============================================================
//  THE STABLECOIN CHART MUST BE IN DATE ORDER, AND KEEP EVERY POINT
//
//  Reported by the site's owner: the three-year Ethereum supply line
//  "doesn't make sense, it is like zigzag". The data was fine. The chart
//  was sorting it alphabetically.
//
//  TrendChart draws a CATEGORY axis and orders it by each point's
//  sortKey, falling back to the DISPLAY LABEL when none is supplied. The
//  page supplied none, so 38 points labelled "Sep '23", "Oct '23" and so
//  on were ordered as text. The live axis read, in order:
//
//      Apr '25, Aug '24, Aug '26, Dec '24, Feb '24, Jan '24, Jan '26,
//      Jul '25, Jun '24, Jun '26, Mar '25, May '24, ...
//
//  which is alphabetical, and hops between four different years at every
//  step. It is the same failure the bond panel hit -- the comment above
//  orderOf in components/TrendChart.tsx says it plainly: "It looked like
//  volatility. It was sorting."
//
//  A SECOND BUG HID BEHIND THE FIRST. The label carried month and year
//  only, while the backfill steps roughly thirty days and so drifts
//  across month ends. 1 and 31 August 2025 both read "Aug '25". The axis
//  is keyed by label, so the second of each pair was silently dropped --
//  three points in all, including 31 Aug 2025 at $154.1bn, which is
//  $14.8bn above the point that displaced it.
//
//    npx tsx scripts/test-stablecoin-series.ts
// ============================================================

import { ethereumSupplySeriesPoints, ETHEREUM_STABLECOIN_HISTORY } from "@/lib/stablecoinHistory";

let fails = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? `   (${detail})` : ""}`);
};

const points = ethereumSupplySeriesPoints();

console.log("\nEVERY POINT SURVIVES\n");
ok(
  "one chart point per stored observation",
  points.length === ETHEREUM_STABLECOIN_HISTORY.length,
  `${points.length} of ${ETHEREUM_STABLECOIN_HISTORY.length}`,
);
const labels = points.map((p) => p.year);
ok("no two points share a label", new Set(labels).size === labels.length, `${new Set(labels).size} unique`);

// The specific casualty, named so a regression is recognisable.
const aug31 = points.find((p) => p.sortKey === "2025-08-31");
ok("31 Aug 2025 is present", aug31?.value === 154.1, aug31 ? `$${aug31.value}bn` : "missing");

console.log("\nORDER IS CHRONOLOGICAL\n");
ok("every point carries an ISO sortKey", points.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)));
ok(
  "sortKeys match the stored dates, in order",
  points.every((p, i) => p.sortKey === ETHEREUM_STABLECOIN_HISTORY[i].date),
);

// Exactly what TrendChart does with the axis.
const asChartOrders = [...points].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
ok(
  "the chart's own comparator leaves them chronological",
  asChartOrders.every((p, i) => p.sortKey === points[i].sortKey),
);

console.log("\nAND THE SORT KEY IS LOAD-BEARING\n");
// Without sortKey, TrendChart falls back to the label. Prove that this
// would still scramble the series, so nobody "simplifies" it away.
const byLabel = [...points].sort((a, b) => a.year.localeCompare(b.year));
ok(
  "ordering by the display label would NOT be chronological",
  !byLabel.every((p, i) => p.sortKey === points[i].sortKey),
);

// And that the old month-only label was not merely ugly but lossy.
const monthOnly = new Set(
  ETHEREUM_STABLECOIN_HISTORY.map((p) => `${p.date.slice(0, 4)}-${p.date.slice(5, 7)}`),
);
ok(
  "a month-only label would collapse points that must stay apart",
  monthOnly.size < ETHEREUM_STABLECOIN_HISTORY.length,
  `${ETHEREUM_STABLECOIN_HISTORY.length - monthOnly.size} would vanish`,
);

console.log("\nVALUES ARE SANE\n");
ok("all values are finite and positive", points.every((p) => Number.isFinite(p.value) && p.value > 0));
ok(
  "in billions, not dollars",
  points.every((p) => p.value < 1000),
  `largest ${Math.max(...points.map((p) => p.value))}`,
);

console.log("");
if (fails > 0) {
  console.error(`${fails} check(s) failed.\n`);
  process.exit(1);
}
console.log(`All ${points.length} points in date order, none dropped.\n`);
export {};
