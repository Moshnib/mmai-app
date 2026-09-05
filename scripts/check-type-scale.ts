// ============================================================
//  THE TYPE SCALE HAS TO BE ENFORCED, NOT JUST DECLARED
//
//  The site reached twenty-seven distinct font sizes without anyone
//  deciding to have twenty-seven. Nobody added a bad one; each was a
//  reasonable local choice, and 12, 12.5 and 13 ended up coexisting with
//  no rule for which to reach for.
//
//  A comment in globals.css saying "use the scale" would have prevented
//  none of that, because the drift came from copying a neighbouring
//  component rather than from reading the stylesheet. So the scale is a
//  build failure instead.
//
//    npx tsx scripts/check-type-scale.ts
// ============================================================

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SCALE = [11, 12, 13, 15, 17, 21, 27, 34, 46, 52];

/** Both files render a 1200x630 social card through Satori. Different
 *  canvas, different viewing distance; the page's scale does not apply
 *  and forcing it on would shrink the card to nothing. */
const EXCLUDED_FILES = new Set(["app/opengraph-image.tsx", "app/icon.tsx"]);

const ROOTS = ["app", "components", "lib"];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const problems: string[] = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (EXCLUDED_FILES.has(file)) continue;
    const src = readFileSync(join(process.cwd(), file), "utf8");
    const lines = src.split(/\r?\n/);

    lines.forEach((line, i) => {
      // The :root block is where the scale is DEFINED, so px is correct there.
      if (/--t-[a-z0-9]+:\s*[0-9.]+px/.test(line)) return;

      // CSS: a literal px size anywhere else means someone bypassed the
      // tokens. This catches the endpoints of a clamp() too, which is how
      // the one fluid heading on the site slipped past the first version
      // of this check -- the values BETWEEN a clamp's endpoints are
      // deliberately off-scale, which is the whole point of a fluid size,
      // but the endpoints themselves are ordinary design decisions and
      // belong on it.
      if (file.endsWith(".css")) {
        const decl = line.match(/font-size:\s*([^;]+)/);
        if (decl) {
          const px = decl[1].match(/([0-9.]+)px/g);
          if (px) {
            problems.push(
              `${file}:${i + 1}  font-size: ${decl[1].trim()} — use var(--t-*) tokens` +
                (decl[1].includes("clamp") ? " for both clamp endpoints" : "")
            );
          }
        }
        return;
      }

      // TSX style objects. `fontSize={N}` is deliberately NOT checked:
      // that form is an SVG attribute, measured in viewBox units rather
      // than screen pixels, so an 11 there is roughly 6px once the
      // diagram is drawn at phone width. Holding it to a screen-pixel
      // scale would be arithmetic with no meaning.
      const m = line.match(/fontSize:\s*([0-9.]+)/);
      if (m && !SCALE.includes(parseFloat(m[1]))) {
        problems.push(`${file}:${i + 1}  fontSize: ${m[1]} — not on the scale`);
      }
    });
  }
}

if (problems.length) {
  console.error(`\n${problems.length} font size(s) off the scale [${SCALE.join(", ")}]:\n`);
  for (const p of problems) console.error("  " + p);
  console.error(
    "\nPick the nearest step, or change the scale in app/globals.css if the\n" +
      "site genuinely needs a tenth one. Do not add a one-off.\n"
  );
  process.exit(1);
}

console.log(`Type scale clean — every size is one of [${SCALE.join(", ")}].`);
export {};
