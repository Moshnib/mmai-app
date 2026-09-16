// ============================================================
//  THE OLD LOOK CANNOT CREEP BACK
//
//  In September 2026 the site moved from near-black with neon cyan and
//  violet, gradient buttons, frosted glass and glow, to the "Editorial
//  Dark" palette in app/globals.css. The owner chose it because the old
//  combination is the look most generated sites now share.
//
//  The restyle touched about forty files, and the first review of the
//  plan found twenty-five places the plan itself had missed -- a glow on
//  the homepage score line, a blur filter inside an SVG, "Space Grotesk"
//  spelled four different ways. Every one of them would have come back
//  the next time a component was copied from an old one, which is how
//  this site's drift has always happened (see check-type-scale.ts).
//  So each marker of the old look is a build failure.
//
//  Data colours are NOT policed here: market lines, dimension tones and
//  the score ramp keep their meaning and live in lib/. Their legibility
//  is checked by scripts/check-palette-contrast.ts instead.
//
//    npx tsx scripts/check-palette.ts
// ============================================================

import { readFileSync, readdirSync } from "fs";

const ROOTS = ["app", "components", "lib"];

interface Rule {
  name: string;
  pattern: RegExp;
  why: string;
  /** Files where this pattern is data, not chrome. Keep this short. */
  allow?: string[];
}

const RULES: Rule[] = [
  { name: "Space Grotesk", pattern: /space[ -]?grotesk/i, why: "headings use var(--font-display), figures var(--font-num)" },
  { name: "backdrop blur", pattern: /backdrop-?filter/i, why: "surfaces are solid; glass was a marker of the old look" },
  { name: "text glow", pattern: /text-?shadow/i, why: "emphasis comes from weight and the accent, not glow" },
  { name: "drop-shadow glow", pattern: /drop-shadow\(/, why: "no glow on marks or lines" },
  { name: "SVG blur", pattern: /feGaussianBlur/, why: "no glow inside diagrams either" },
  { name: "brightness filter", pattern: /brightness\(/, why: "colours are chosen to read as they are" },
  {
    name: "CSS gradient",
    // A MASK is not a fill. The ticker fades its own edges with
    // mask-image, which paints no colour at all -- it only decides where
    // the strip is visible. Every other gradient stays banned.
    pattern: /(?<!mask-image:\s*)(?<!repeating-)(linear|radial)-gradient\(/,
    why: "flat fills; a selected control is var(--on-bg)",
  },
  { name: "old deep violet", pattern: /#6D28D9/i, why: "the gradient button colour" },
  {
    name: "old violet tint",
    pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246/,
    why: "violet tints were chrome; use var(--hover) or var(--on-bg)",
  },
  {
    name: "old cyan tint",
    pattern: /rgba\(\s*34\s*,\s*211\s*,\s*238/,
    why: "cyan tints were chrome; use var(--hover)",
    // The cash-backed stablecoin fill: backing type, which is data.
    allow: ["components/StablecoinTokens.tsx"],
  },
  { name: "old page black", pattern: /#08080D|rgba\(\s*8\s*,\s*8\s*,\s*13/i, why: "the page is var(--paper)" },
  { name: "old card black", pattern: /#12121A|#0B0B12|rgba\(\s*6\s*,\s*6\s*,\s*10/i, why: "cards are var(--card-bg)" },
  { name: "old text greys", pattern: /#F5F6FA|#C7C9D9|#8A8EA3|#6B7086/i, why: "text is var(--ink), var(--ink-soft) or var(--slate)" },
  { name: "undefined --bg", pattern: /var\(--bg\)/, why: "there is no --bg token; the dot ring silently never drew" },
  {
    name: "old orchid",
    pattern: /#B98CFF|rgba\(\s*185\s*,\s*140\s*,\s*255/i,
    why: "the old secondary accent; not chrome any more",
    // The crypto-backed stablecoin ring and the Tron network segment: data.
    allow: ["components/StablecoinTokens.tsx"],
  },
  {
    name: "pre-lift data colours",
    pattern: /#E14B4B|#8B5CF6/i,
    why: "lifted to #E85A5A and #9B70F8 so they read on navy; copying an old component would bring back the failing ones",
  },
  {
    name: "coloured glow shadow",
    // A blur radius above zero. "0 0 0 1px" (Flag's hairline ring) has a
    // zero blur and a spread, and is not a glow.
    // The lookbehinds stop "0 0 0 1px" matching from its second zero.
    pattern: /box-?shadow[^;\n]*(?<![\d.])(?<![\d.]\s)0 0 [1-9]\d*px/i,
    why: "no glow around controls or bars",
  },
  { name: "saturate filter", pattern: /saturate\(/, why: "colours are chosen to read as they are" },
];

/** The one way to keep a glow: end the declaration with a CSS comment
 *  containing the marker below, naming what it is for.
 *
 *  It exists because the owner asked for the live indicator to glow a
 *  little, and a small halo on a 7px dot is not what made the old site
 *  look generated -- 34px auras behind 46px numerals were. Marking each
 *  use keeps that judgement visible, and keeps it from spreading: every
 *  unmarked glow still fails. */
const GLOW_ALLOWED = "allow-glow:";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const problems: string[] = [];
let scanned = 0;

for (const file of ROOTS.flatMap((r) => walk(r))) {
  scanned++;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.allow?.includes(file)) continue;
      if (rule.name === "coloured glow shadow" && line.includes(GLOW_ALLOWED)) continue;
      if (rule.pattern.test(line)) {
        problems.push(`  ${file}:${i + 1}  ${rule.name} -- ${rule.why}\n      ${line.trim().slice(0, 110)}`);
      }
    }
  });
}

// ---------- the rules must be able to fail ----------
// A pattern that cannot match is a check that always passes. Each rule
// is run against a sample of exactly what it exists to catch.
const SAMPLES: Record<string, string> = {
  "Space Grotesk": `fontFamily: "'Space Grotesk', sans-serif"`,
  "backdrop blur": `backdropFilter: "blur(14px)"`,
  "text glow": `textShadow: "0 0 10px red"`,
  "drop-shadow glow": `filter: "drop-shadow(0 0 4px red)"`,
  "SVG blur": `<feGaussianBlur stdDeviation="7" />`,
  "brightness filter": `filter: "brightness(1.15)"`,
  "CSS gradient": `background: linear-gradient(135deg, a, b)`,
  "old deep violet": `#6d28d9`,
  "old violet tint": `rgba(139, 92, 246, 0.18)`,
  "old cyan tint": `rgba(34,211,238,0.1)`,
  "old page black": `background: #08080D`,
  "old card black": `background: "#12121A"`,
  "old text greys": `color: "#C7C9D9"`,
  "undefined --bg": `border: 2px solid var(--bg)`,
  "old orchid": `background: "#B98CFF"`,
  "pre-lift data colours": `UK: "#E14B4B"`,
  "coloured glow shadow": "boxShadow: `0 0 16px 0 ${band.color}`",
  "saturate filter": `filter: "saturate(1.1)"`,
};
if (RULES.find((r) => r.name === "coloured glow shadow")!.pattern.test(`boxShadow: "0 0 0 1px var(--hair-strong)"`)) {
  problems.push(`  rule "coloured glow shadow" matches Flag's zero-blur hairline ring, which is not a glow`);
}
// The marked exception must work, and must not leak: a glow with no
// marker on it still has to fail.
{
  const glow = RULES.find((r) => r.name === "coloured glow shadow")!;
  const marked = `  box-shadow: 0 0 9px rgba(1,2,3,.4); /* ${GLOW_ALLOWED} the live dot */`;
  const bare = "  box-shadow: 0 0 9px rgba(1,2,3,.4);";
  if (!glow.pattern.test(marked)) problems.push('  the glow rule no longer matches a marked glow, so the marker proves nothing');
  if (!glow.pattern.test(bare)) problems.push('  the glow rule no longer matches an unmarked glow');
  const glowCount = ROOTS.flatMap((r) => walk(r))
    .flatMap((f) => readFileSync(f, "utf8").split(/\r?\n/))
    .filter((l) => l.includes(GLOW_ALLOWED)).length;
  if (glowCount > 2) problems.push(`  ${glowCount} glows are marked allowed; the exception was for the live indicator alone`);
}
for (const rule of RULES) {
  const sample = SAMPLES[rule.name];
  if (!sample || !rule.pattern.test(sample)) problems.push(`  rule "${rule.name}" does not match its own sample -- it can never fail`);
}
// The two gradients that are not fills, and must stay allowed.
const gradientRule = RULES.find((r) => r.name === "CSS gradient")!.pattern;
for (const allowed of [
  "repeating-linear-gradient(",
  ".ticker { mask-image: linear-gradient(90deg, transparent, #000 40px); }",
  ".ticker { -webkit-mask-image: linear-gradient(90deg, transparent, #000 40px); }",
]) {
  if (gradientRule.test(allowed)) {
    problems.push(`  rule "CSS gradient" matches ${JSON.stringify(allowed)}, which is legitimate`);
  }
}

console.log(`\nChecking ${scanned} files for the retired palette\n`);
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s). See app/globals.css for the palette and its rules.\n`);
  process.exit(1);
}
console.log("No glow, glass, gradients or retired colours anywhere in app/, components/ or lib/.\n");
