// ============================================================
//  ONE COLOUR PER MARKET, AND NO TWO ALIKE
//
//  There were two market colour maps -- one in the Compare chart, one in
//  the bond-yield panel -- and they disagreed on five of six markets.
//  Three colours were SWAPPED between countries: red was the Euro Area
//  on one page and the United Kingdom on the other, amber was the UK
//  here and Canada there, violet was Japan here and the Euro Area there.
//
//  A reader who learned "red is the Euro Area" on Compare read the red
//  line on the bond chart as the Euro Area when it was the UK. Both
//  palettes were individually well chosen; the damage came from their
//  disagreeing, and nothing measured that. The design audit counted
//  hardcoded hex colours without ever checking whether they agreed.
//
//  There is one map now, so divergence is no longer possible. What still
//  needs holding is the property that made each palette good on its own:
//  every market has a colour, and no two are close enough to be confused
//  on a 2px line.
//
//    npx tsx scripts/test-market-colours.ts
// ============================================================

import { MARKET_COLORS, FALLBACK_MARKETS } from "@/lib/markets";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

/** CIE76 dE. Crude next to dE2000 and entirely adequate for the only
 *  question here: would a reader take these two lines for one line. */
function lab(hex: string): [number, number, number] {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = v.map((x) => (x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92));
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a: string, b: string) => {
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
};

/** Below about 20 two colours read as one on a thin line. Japan and the
 *  US sat at 10.3 before 6 September and were indistinguishable on a
 *  phone; 20 is the floor, and the set currently clears it by a wide
 *  margin. */
const MIN_SEPARATION = 20;

console.log(`\nChecking ${Object.keys(MARKET_COLORS).length} market colours\n`);

// ---------- every market has one, and nothing extra ----------
for (const m of FALLBACK_MARKETS) {
  if (!MARKET_COLORS[m.code]) fail(`${m.code} (${m.name}) has no colour — its lines fall back to grey`);
}
for (const code of Object.keys(MARKET_COLORS)) {
  if (!FALLBACK_MARKETS.some((m) => m.code === code)) {
    fail(`${code} has a colour but is not a market — Compare carried a Norway entry like this long after Norway stopped being scored`);
  }
}
if (!failed) ok(`every market has a colour, and no colour belongs to a market that does not exist`);

// ---------- valid hex ----------
for (const [code, hex] of Object.entries(MARKET_COLORS)) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) fail(`${code} has "${hex}", which is not a six-digit hex`);
}

// ---------- and no two alike ----------
const codes = Object.keys(MARKET_COLORS);
let closest = { pair: "", d: Infinity };
for (let i = 0; i < codes.length; i++) {
  for (let j = i + 1; j < codes.length; j++) {
    const d = dE(MARKET_COLORS[codes[i]], MARKET_COLORS[codes[j]]);
    if (d < closest.d) closest = { pair: `${codes[i]}–${codes[j]}`, d };
    if (d < MIN_SEPARATION) {
      fail(`${codes[i]} and ${codes[j]} are ${d.toFixed(1)} apart (dE), under the ${MIN_SEPARATION} floor — they will read as one line`);
    }
  }
}
if (!failed) ok(`closest pair is ${closest.pair} at dE ${closest.d.toFixed(1)}, clear of the ${MIN_SEPARATION} floor`);

// ---------- the site-wide rule ----------
// Green is reserved out of the palette entirely, so a rising line is
// never mistaken for a "good" line.
for (const [code, hex] of Object.entries(MARKET_COLORS)) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  if (g > r + 40 && g > b + 40) fail(`${code} (${hex}) is green, and the site does not use green`);
}
if (!failed) ok("no green, per the site-wide rule");

console.log("");
if (failed) {
  console.error("Market colours are an identity. One map, in lib/markets.ts, read by every");
  console.error("chart — two maps is how the same red came to mean two different countries.\n");
  process.exit(1);
}
console.log("One colour per market, all distinguishable.\n");
export {};
