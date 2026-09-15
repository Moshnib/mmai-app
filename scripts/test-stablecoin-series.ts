// ============================================================
//  THE STABLECOIN CHART MUST BE IN DATE ORDER, AND KEEP EVERY POINT
//
//  Reported by the site's owner: the three-year Ethereum supply line
//  "doesn't make sense, it is like zigzag". The data was fine. The chart
//  was sorting it alphabetically.
//
//  TrendChart draws a CATEGORY axis and orders it by each point's
//  sortKey, falling back to the DISPLAY LABEL when none is supplied. The
//  page supplied none, so 37 points labelled "Sep '23", "Oct '23" and so
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

import {
  ethereumSupplySeriesPoints,
  ethereumCompositionSeries,
  ETHEREUM_STABLECOIN_HISTORY,
  STABLECOIN_TOKEN_COLORS,
  STABLECOIN_TOKEN_ORDER,
} from "@/lib/stablecoinHistory";

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

// ============================================================
//  COMPOSITION: SHARE OF SUPPLY BY TOKEN
// ============================================================

const composition = ethereumCompositionSeries();

console.log("\nCOMPOSITION COVERS EVERY TOKEN, EVERY POINT\n");
ok("one series per token", composition.length === STABLECOIN_TOKEN_ORDER.length, `${composition.length}`);
ok(
  "each series has a point for every observation",
  composition.every((s) => s.data.length === ETHEREUM_STABLECOIN_HISTORY.length),
);
ok(
  "every point carries an ISO sortKey, in order",
  composition.every((s) => s.data.every((d, i) => d.sortKey === ETHEREUM_STABLECOIN_HISTORY[i].date)),
);

console.log("\nA TOKEN THAT DID NOT EXIST IS A GAP, NOT A ZERO\n");
// USDS, USDe and PYUSD all launched inside the window. Drawing their
// early points as 0 would claim a token existed holding nothing.
const usds = composition.find((s) => s.name === "USDS")!;
const beforeLaunch = usds.data.filter((d) => d.sortKey < "2024-09-03");
ok(
  "USDS reads null before it launched",
  beforeLaunch.length > 0 && beforeLaunch.every((d) => d.value === null),
  `${beforeLaunch.length} points`,
);
// ...but a REAL zero survives: USDS had launched and held nothing.
const usdsAtLaunch = usds.data.find((d) => d.sortKey === "2024-09-03");
ok("a genuine zero is kept, not turned into a gap", usdsAtLaunch?.value === 0, String(usdsAtLaunch?.value));

console.log("\nSHARES ADD UP\n");
for (const i of [0, Math.floor(ETHEREUM_STABLECOIN_HISTORY.length / 2), ETHEREUM_STABLECOIN_HISTORY.length - 1]) {
  const date = ETHEREUM_STABLECOIN_HISTORY[i].date;
  const sum = composition.reduce((t, s) => t + (s.data[i].value ?? 0), 0);
  // Each share is rounded to 0.1 and six are summed, so the total can
  // drift by a few tenths without anything being wrong.
  ok(`${date} sums to about 100%`, Math.abs(sum - 100) < 0.6, `${sum.toFixed(1)}%`);
}

console.log("\nNO TWO TOKEN COLOURS CAN BE CONFUSED\n");
// CIE76, the same crude-but-adequate measure test-market-colours.ts uses.
// Below about 20, two 2px lines stop being tellable apart.
function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = rgb;
  const xyz = [
    (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    r * 0.2126 + g * 0.7152 + b * 0.0722,
    (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883,
  ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
const dE = (a: string, b: string) => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
};

ok(
  "every token has a colour",
  STABLECOIN_TOKEN_ORDER.every((t) => /^#[0-9a-f]{6}$/i.test(STABLECOIN_TOKEN_COLORS[t] ?? "")),
);
let closest = { pair: "", d: Infinity };
for (let i = 0; i < STABLECOIN_TOKEN_ORDER.length; i++) {
  for (let j = i + 1; j < STABLECOIN_TOKEN_ORDER.length; j++) {
    const a = STABLECOIN_TOKEN_ORDER[i];
    const b = STABLECOIN_TOKEN_ORDER[j];
    const d = dE(STABLECOIN_TOKEN_COLORS[a], STABLECOIN_TOKEN_COLORS[b]);
    if (d < closest.d) closest = { pair: `${a}/${b}`, d };
  }
}
ok("the closest pair is still distinguishable", closest.d >= 20, `${closest.pair} at dE ${closest.d.toFixed(1)}`);

// AND EVERY COLOUR MUST BE READABLE, not merely distinct. TrendChart
// paints each legend label in its own series colour, so these are TEXT
// colours as well as line colours. Circle blue (#2775CA) measured
// 4.27:1 against the page, just under the 4.5 WCAG AA needs at 12px --
// caught by scripts/check-accessibility.ts only after a five-minute CI
// run against a rendered page. Checking it here fails in a second.
// The CARD, not the page: the legend sits inside a card, and the navy card
// (September 2026) is the lighter, stricter of the two grounds.
const PAGE_BG = "#131D2E";
const relLum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a: string, b: string) => {
  const x = relLum(a);
  const y = relLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
for (const token of STABLECOIN_TOKEN_ORDER) {
  const r = contrast(STABLECOIN_TOKEN_COLORS[token], PAGE_BG);
  ok(`${token} is legible as legend text`, r >= 4.5, `${r.toFixed(2)}:1`);
}


console.log("");
if (fails > 0) {
  console.error(`${fails} check(s) failed.\n`);
  process.exit(1);
}
console.log(
  `All ${points.length} points in date order, none dropped; ${composition.length} token shares add up.\n`,
);
export {};
