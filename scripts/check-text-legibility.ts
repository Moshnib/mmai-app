// ============================================================
//  IS THE TEXT IN THE CHARTS BIG ENOUGH TO READ?
//
//  An SVG with a viewBox scales everything inside it, INCLUDING TEXT.
//  A chart drawn on a 900-wide canvas and rendered into a 292px card is
//  scaled to 0.32, and its 10px axis labels arrive on screen at 3.2px.
//
//  That is what /compare and /gulf-watch were doing on a 390px phone,
//  measured. Nothing caught it and nothing could: the chart fitted its
//  container perfectly, so check-layout saw no overflow; nothing threw,
//  so check-runtime-errors saw nothing; and the source says
//  fontSize={10}, which looks entirely reasonable. It was
//  legible-looking and unreadable.
//
//  check-type-scale polices the sizes a component DECLARES. This polices
//  the size a reader actually gets, which is the declared size times
//  whatever the SVG's own scale turns out to be.
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-text-legibility.ts
// ============================================================

import { chromium } from "playwright";
import { SITE_PATHS } from "@/lib/routes";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";

/** Below this, text is decoration rather than information. Deliberately
 *  under the 11px type-scale floor: a chart label may legitimately be
 *  the smallest thing on a page, and a sub-pixel measurement of a
 *  correctly-sized label should not fail a build. Three point two is
 *  what this was written to catch. */
const MIN_ON_SCREEN_PX = 9;

/** The width that matters. Scaling problems only bite when the container
 *  is narrower than the canvas, which on this site means a phone. */
const VIEWPORT = { width: 390, height: 844 };

interface Finding { page: string; detail: string }

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const findings: Finding[] = [];

  console.log(`\nMeasuring on-screen text size at ${VIEWPORT.width}px across ${SITE_PATHS.length} pages\n`);

  for (const path of SITE_PATHS) {
    const page = await context.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    // Charts measure their own container and re-render; reading before
    // that settles measures a frame no reader sees.
    await page.waitForTimeout(2_500);

    // NO NAMED INNER FUNCTIONS -- this body is re-run inside the browser
    // where esbuild's __name helper does not exist. See check-layout.ts.
    const result = await page.evaluate((floor) => {
      const bad: string[] = [];
      let smallest = Infinity;
      let smallestText = "";

      document.querySelectorAll("svg").forEach((svg) => {
        const el = svg as SVGSVGElement;
        const vb = el.viewBox?.baseVal;
        const rendered = el.getBoundingClientRect().width;
        if (!rendered) return;
        // No viewBox means no scaling: the declared size is the real one.
        const scale = vb && vb.width ? rendered / vb.width : 1;

        el.querySelectorAll("text").forEach((t) => {
          const content = (t.textContent || "").trim();
          if (!content) return;
          const onScreen = parseFloat(getComputedStyle(t).fontSize) * scale;
          if (onScreen < smallest) { smallest = onScreen; smallestText = content.slice(0, 24); }
          if (onScreen < floor) {
            bad.push(`"${content.slice(0, 24)}" renders at ${onScreen.toFixed(1)}px (viewBox ${Math.round(vb!.width)} scaled to ${Math.round(rendered)}, x${scale.toFixed(2)})`);
          }
        });
      });

      return {
        bad: [...new Set(bad)].slice(0, 6),
        smallest: smallest === Infinity ? null : Math.round(smallest * 10) / 10,
        smallestText,
      };
    }, MIN_ON_SCREEN_PX);

    if (result.smallest == null) {
      console.log(`  ok    ${path.padEnd(14)} no SVG text`);
    } else {
      const ok = result.bad.length === 0;
      console.log(`  ${ok ? "ok  " : "FAIL"}  ${path.padEnd(14)} smallest ${result.smallest}px  "${result.smallestText}"`);
      for (const d of result.bad) {
        console.log(`          ${d}`);
        findings.push({ page: path, detail: d });
      }
    }

    await page.close();
  }

  await context.close();
  await browser.close();

  console.log("");
  if (findings.length > 0) {
    console.error(`${findings.length} unreadable label(s):\n`);
    for (const f of findings) console.error(`  ${f.page.padEnd(14)} ${f.detail}`);
    console.error("\nAn SVG scales its text with its viewBox. Either match the viewBox to the");
    console.error("rendered width (TimeSliderScatter measures its container and does this),");
    console.error("or give the scroller a minWidth equal to the viewBox width so the scale");
    console.error("is 1 (ScoreDiagram and CorrelationMatrix do that).\n");
    process.exit(1);
  }

  console.log(`Every chart label is at least ${MIN_ON_SCREEN_PX}px on a ${VIEWPORT.width}px screen.\n`);
}

main();
export {};
