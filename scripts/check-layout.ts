// ============================================================
//  DOES ANYTHING SPILL OUT OF ITS BOX?
//
//  Loads every page in a real browser at three widths and fails if any
//  element escapes the container holding it, or if the page scrolls
//  sideways.
//
//  THIS EXISTS BECAUSE I CHECKED BY HAND AND GOT IT WRONG TWICE.
//
//  The contact form was broken on a phone -- its email field ended 118px
//  past the edge of its card -- and I had reported mobile as verified. Two
//  reasons, and both are designed out here.
//
//    1. I swept seven pages and listed eight. PAGES below is the single
//       list, and a page missing from it is a page nobody checks.
//
//    2. My check asked "does the PAGE scroll sideways", which is a
//       symptom rather than the fault. An element can spill out of its
//       card while the page still fits, and a card with overflow hidden
//       swallows the evidence entirely. This asks the real question --
//       does any element escape the box that contains it -- and only then
//       also checks the document.
//
//  When that stricter question was finally asked, it immediately found a
//  3px horizontal scroll on /compare, on a page that had passed twice: a
//  range input inside flex:1 could not shrink below its intrinsic width.
//  Small enough to look like nothing, and enough to give the whole page a
//  scrollbar.
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-layout.ts
// ============================================================

import { chromium, type Page } from "playwright";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";

/** Every page on the site. Adding a route means adding it here. */
const PAGES = [
  "/",
  "/trends",
  "/compare",
  "/gulf-watch",
  "/stablecoins",
  "/sources",
  "/learn",
  "/about",
  "/contact",
];

/** The widths that actually matter: the narrowest phone still in wide use,
 *  a tablet, and a desktop. Chosen as the sizes readers hold, not as the
 *  breakpoints the stylesheet happens to declare -- testing a layout at
 *  its own breakpoints is how you miss everything between them. */
const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

/** The boxes worth policing. Anything the site draws a border around and
 *  puts content inside. */
const CONTAINERS = [
  ".mmai-card", "form", ".ind-card", ".dim-card", ".coin-row",
  ".signal-row", ".compare-chip", ".learn-calls", ".learn-note",
  ".snapshot-card", ".chart-card", ".gulf-card",
].join(", ");

interface Finding { page: string; viewport: string; detail: string }

async function inspect(page: Page, containers: string): Promise<{ overflows: string[]; scrollWidth: number; clientWidth: number }> {
  // NO NAMED INNER FUNCTIONS IN HERE. This body is serialised and re-run
  // inside the browser, where esbuild's __name helper -- which it attaches
  // to named function expressions -- does not exist. A tidy little
  // `const inScroller = () => ...` fails with "__name is not defined", and
  // the error points at the evaluate call rather than at the helper.
  return page.evaluate((sel) => {
    const out: string[] = [];

    document.querySelectorAll(sel).forEach((box) => {
      const b = box.getBoundingClientRect();
      if (b.width === 0) return;
      box.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        // width 0 is hidden; far-left is the deliberate off-screen honeypot
        if (r.width === 0 || r.left < -1000) return;

        // Skip anything inside a container that is MEANT to scroll
        // sideways -- a wide table or a diagram in its own scroller is
        // doing what it was told to.
        let inScroller = false;
        let p = el.parentElement;
        while (p && p !== box) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll") { inScroller = true; break; }
          p = p.parentElement;
        }
        if (inScroller) return;

        const over = Math.round(Math.max(r.right - b.right, b.left - r.left));
        if (over > 1) {
          const cls = String((el as HTMLElement).className || "").split(" ")[0];
          const text = (el.textContent || "").trim().slice(0, 24);
          out.push(`${box.className.split(" ")[0] || box.tagName} <- ${el.tagName}${cls ? "." + cls : ""} "${text}" by ${over}px`);
        }
      });
    });

    return {
      overflows: [...new Set(out)],
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  }, containers);
}

async function main() {
  const browser = await chromium.launch();
  const findings: Finding[] = [];
  let checked = 0;

  console.log(`\nChecking ${PAGES.length} pages at ${VIEWPORTS.length} widths against ${BASE}\n`);

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
      // Client components fetch their own data and reflow after; a check
      // that runs before that measures a layout no reader ever sees.
      await page.waitForTimeout(1_500);

      const { overflows, scrollWidth, clientWidth } = await inspect(page, CONTAINERS);
      checked++;

      for (const o of overflows) findings.push({ page: path, viewport: vp.name, detail: o });
      if (scrollWidth > clientWidth) {
        findings.push({
          page: path,
          viewport: vp.name,
          detail: `the page itself scrolls sideways by ${scrollWidth - clientWidth}px`,
        });
      }

      const bad = overflows.length + (scrollWidth > clientWidth ? 1 : 0);
      console.log(`  ${bad === 0 ? "ok  " : "FAIL"}  ${vp.name.padEnd(8)} ${path}`);
    }

    await context.close();
  }

  await browser.close();

  console.log("");
  if (findings.length > 0) {
    console.error(`${findings.length} layout problem(s) across ${checked} page-widths:\n`);
    for (const f of findings) console.error(`  ${f.viewport.padEnd(8)} ${f.page}\n            ${f.detail}`);
    console.error("\nSomething is wider than the box holding it. Usually a grid or flex");
    console.error("child that cannot shrink: min-width defaults to auto, so it refuses");
    console.error("to go below its own content. minWidth: 0 is the usual fix.\n");
    process.exit(1);
  }

  console.log(`Every page holds its layout at every width — ${checked} page-widths checked.`);
}

main();
export {};
