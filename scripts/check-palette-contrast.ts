// ============================================================
//  EVERY TEXT COLOUR, AGAINST BOTH GROUNDS, WITHOUT A BROWSER
//
//  scripts/check-accessibility.ts measures contrast on rendered pages,
//  which is the truth for what a reader saw that day -- and blind to two
//  things. It only sees TODAY'S scores, so a score colour that fails at
//  63 passes on a day nothing scores 63; and it never measures SVG text.
//
//  The navy ground of the September 2026 restyle made both real. Against
//  it, the Euro Area's violet, the UK's red and the middle of the score
//  ramp all fell under 4.5:1, and CI would have gone red or green
//  depending on the day's data. Three colours were lifted; this holds
//  every colour that is ever drawn as text on the two surfaces text sits
//  on, and sweeps the whole score ramp rather than sampling it.
//
//  The grounds are read from app/globals.css, so changing the palette
//  there re-runs every measurement below against the new values.
//
//    npx tsx scripts/check-palette-contrast.ts
// ============================================================

import { readFileSync } from "fs";
import { MARKET_COLORS } from "@/lib/markets";
import { colorForScore } from "@/lib/indicators";
import { DIMENSION_TONE } from "@/lib/composite";
import { STABLECOIN_TOKEN_COLORS } from "@/lib/stablecoinHistory";

const AA = 4.5;

const css = readFileSync("app/globals.css", "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
function token(name: string): string {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\b`));
  if (!m) throw new Error(`--${name} is not a 6-digit hex in :root -- this check cannot measure it`);
  return m[1];
}

function lum(hex: string): number {
  // Anything but #RRGGBB would parse to NaN, and NaN < 4.5 is false -- so
  // a colour this cannot read would pass silently. Refuse it instead.
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`"${hex}" is not #RRGGBB, so its contrast cannot be measured; write it as a 6-digit hex`);
  }
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

let failed = 0;
const GROUNDS = { page: token("paper"), card: token("white") };

// --card-bg and --glass must be the same solid colour as --white, or the
// "card" measured here is not the card a reader sees.
for (const alias of ["card-bg", "glass"]) {
  if (token(alias).toLowerCase() !== GROUNDS.card.toLowerCase()) {
    console.error(`  FAIL  --${alias} (${token(alias)}) differs from --white (${GROUNDS.card}); measure it too`);
    failed++;
  }
}

function check(label: string, fg: string) {
  for (const [g, bg] of Object.entries(GROUNDS)) {
    const r = ratio(fg, bg);
    if (r < AA) {
      console.error(`  FAIL  ${label} ${fg} on ${g} ${bg}: ${r.toFixed(2)}:1, needs ${AA}`);
      failed++;
    }
  }
}

console.log(`\nContrast against page ${GROUNDS.page} and card ${GROUNDS.card}\n`);

/** Prints "ok" only if nothing in the group failed, so the log never
 *  says a group passed directly under a FAIL line from that group. */
function group(label: string, run: () => void) {
  const before = failed;
  run();
  if (failed === before) console.log(`  ok    ${label}`);
}

group("text tokens", () => {
  for (const t of ["ink", "ink-soft", "slate", "accent", "accent-2", "status-live"]) check(`--${t}`, token(t));
});

// THE TOKENS THAT ARE NOT FOR TEXT, ASSERTED AS SUCH.
//
// This list used to be only the six above, which meant the check passed
// by not looking: on 2 October 2026 a new credit line on the homepage was
// coloured with --mid, the token for centre lines on axes and tracks. It
// renders at 2.49:1 -- below even the large-text floor -- and this script
// reported "every text colour reads at 4.5:1 or better", because --mid
// was outside the set it treats as text.
//
// So the structural rules are checked instead of the colours: these
// tokens must not appear in a `color:` declaration anywhere, and if one
// ever legitimately needs to, it has to clear 4.5:1 first and move into
// the list above.
const NOT_FOR_TEXT = ["mid", "hair", "hair-strong", "track"];
group(`${NOT_FOR_TEXT.length} tokens that may not be used as text`, () => {
  for (const t of NOT_FOR_TEXT) {
    // THE `color` PROPERTY ITSELF, not anything ending in it. A bare
    // `color:` match also catches `border-color:`, `scrollbar-color:`
    // and `caret-color:`, which are exactly where these tokens belong --
    // the first version of this check reported three honest borders as
    // failures. So the character before must be the start of the
    // declaration: a brace, a semicolon, or the start of the file.
    //
    // A LINE MAY OPT OUT BY SAYING `decorative` IN A COMMENT ON IT, and
    // two do: the middot between facts in the live bar and the ticker's
    // "▸" bullet. Those are glyphs carrying no information -- the rule
    // is about text a reader has to read, and a separator is furniture
    // that happens to be drawn with a character. Writing the exemption
    // down beats dropping the token from the list, which would let the
    // next real misuse through silently.
    const lines = css.split("\n").filter((l) =>
      new RegExp(`(^|[{;\\s])color:\\s*var\\(--${t}\\)`).test(l) && !/decorative/.test(l)
    );
    if (lines.length === 0) continue;
    const r = ratio(token(t), token("paper"));
    console.error(
      `  FAIL  --${t} is used as a text colour and reads ${r.toFixed(2)}:1 on the page ground. ` +
        `It is a rule-and-axis colour, not a text one -- use --slate.`
    );
    failed++;
  }
});

const onRatio = ratio(token("on-ink"), token("on-bg"));
if (onRatio < AA) { console.error(`  FAIL  selected control text: ${onRatio.toFixed(2)}:1`); failed++; }
else console.log(`  ok    selected control text ${onRatio.toFixed(2)}:1`);

group(`${Object.keys(MARKET_COLORS).length} market colours`, () => {
  for (const [code, hex] of Object.entries(MARKET_COLORS)) check(`market ${code}`, hex);
});
group("3 dimension tones", () => {
  for (const [k, hex] of Object.entries(DIMENSION_TONE)) check(`dimension ${k}`, hex);
});
group(`${Object.keys(STABLECOIN_TOKEN_COLORS).length} stablecoin colours`, () => {
  for (const [k, hex] of Object.entries(STABLECOIN_TOKEN_COLORS)) check(`token ${k}`, hex);
});
group("missing-score grey", () => check("missing-score grey", colorForScore(null)));

let worst = { score: -1, r: Infinity };
group("score ramp swept 0-100", () => {
  for (let s = 0; s <= 100; s += 0.5) {
    const hex = colorForScore(s);
    const r = Math.min(ratio(hex, GROUNDS.page), ratio(hex, GROUNDS.card));
    if (r < worst.r) worst = { score: s, r };
    if (r < AA) { console.error(`  FAIL  score ${s} draws ${hex} at ${r.toFixed(2)}:1`); failed++; }
  }
});
console.log(`        weakest ramp point: ${worst.score} at ${worst.r.toFixed(2)}:1`);

// ---------- the check must be able to fail ----------
// The old violet on the new card is the case this exists for.
if (ratio("#8B5CF6", GROUNDS.card) >= AA) {
  console.error("  FAIL  self-test: the retired violet #8B5CF6 passes on this card, so the check is not measuring what it claims");
  failed++;
}

console.log("");
if (failed) {
  console.error(`${failed} failure(s).\n`);
  process.exit(1);
}
console.log("Every text colour reads at 4.5:1 or better on both surfaces.\n");
