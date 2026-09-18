// ============================================================
//  DOES THE STRIP ALONG THE TOP BEHAVE?
//
//  It was reported as "pausing and fading and not working good even on
//  mobile", and measuring found three separate faults, none of which any
//  other check can see: it ran at 118 pixels a second at every screen
//  size (a fixed 40-second pass over a row that had grown to ~4,700px),
//  a tap left a phone's lingering hover and could freeze it, and its two
//  feeds arrived separately, each widening the row mid-scroll.
//
//  So this measures the real thing, on a touch phone and a mouse desktop:
//
//    it travels at a reading speed, not a sprint
//    a finger holds it still, and it carries on afterwards
//    a market button can actually be tapped, and selects that market
//    the row does not change width after it starts moving
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-ticker.ts
// ============================================================

import { chromium, devices, type Page } from "playwright";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";

const failures: string[] = [];
function check(ok: boolean, what: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
}

const shift = (page: Page) =>
  page.evaluate(() => {
    const t = document.querySelector(".ticker-track");
    if (!t) return 0;
    return new DOMMatrixReadOnly(getComputedStyle(t).transform).m41;
  });

/** Pixels a second. Measured three times and taken as the median, and a
 *  window is thrown away if the strip wrapped inside it -- the transform
 *  jumps from -4700 back to 0 at the end of each pass, which would read as
 *  an enormous speed. */
async function speed(page: Page): Promise<number> {
  const rates: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await shift(page);
    await page.waitForTimeout(900);
    const b = await shift(page);
    if (b > a) continue; // wrapped back to the start inside this window
    rates.push((a - b) / 0.9);
  }
  if (rates.length === 0) return 0;
  return rates.sort((x, y) => x - y)[Math.floor(rates.length / 2)];
}

/** Waits until the strip is actually running before anything is measured.
 *  It holds still until both of its queries land (a four-second deadline in
 *  MarketTicker), and on a cold server -- a fresh build in CI, the first
 *  request after a deploy -- that is slower than any fixed pause. Measuring
 *  through it reported 0 px/s and failed a strip that was merely waiting.
 *  If the reader's system asks for less motion, this asks for movement the
 *  way a reader would: by pressing the button. */
async function ready(page: Page) {
  await page.waitForSelector(".ticker-row .ticker-item", { timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector(".ticker.is-waiting"), null, { timeout: 15_000 }).catch(() => {});
  if (!(await page.locator(".ticker.is-playing").count())) await page.click(".ticker-motion");
  await page.waitForSelector(".ticker.is-playing", { timeout: 10_000 });
  // One beat, so the animation has somewhere to have moved from.
  await page.waitForTimeout(600);
}

const rowWidth = (page: Page) =>
  page.evaluate(() => Math.round(document.querySelector(".ticker-row")?.getBoundingClientRect().width ?? 0));

async function phone() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  console.log("\nOn a touch phone");
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  // The reader's system may ask for less motion; this check is about the
  // strip when it is moving, so ask for movement the way a reader would.
  await ready(page);

  const widthAtStart = await rowWidth(page);
  const px = await speed(page);
  check(px > 25 && px < 75, `travels at a reading speed (${px.toFixed(0)} px/s)`);

  // A finger on the strip holds it still, which is what makes a moving
  // button tappable at all.
  // Measured in one short window on purpose: the hold lasts three seconds
  // after the finger lifts, and the three-window speed() above would
  // outlast it and report the strip moving again.
  const box = (await page.locator(".ticker").boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const held = await shift(page);
  await page.waitForTimeout(500);
  check(Math.abs((await shift(page)) - held) < 3, "a finger holds it still");

  // Still held: this is the window the reader taps in, and the whole
  // point of the pause. Before it, this tap timed out -- the button
  // never stopped moving.
  const item = page.locator('.ticker-row:not([aria-hidden]) .ticker-item:has-text("JP")').first();
  await item.tap();
  await page.waitForTimeout(400);
  check(new URL(page.url()).searchParams.get("market") === "JP", "a market button can be tapped, and selects that market");

  await page.waitForTimeout(3400);
  check((await speed(page)) > 25, "it carries on a few seconds after the finger lifts");

  check((await rowWidth(page)) === widthAtStart, `the strip does not change width while it runs (${widthAtStart}px)`);

  // WHAT A PHONE ACTUALLY SEES. The strip once led with every headline
  // and put the scores last, so the first score was ~2,400px in -- about
  // a minute of watching. And one ONS headline measured 648px, nearly two
  // screens of a single line.
  const shape = await page.evaluate(() => {
    const row = document.querySelector(".ticker-row:not([aria-hidden])")!;
    let run = 0;
    let firstScoreAt = -1;
    let widest = 0;
    let longestGapBetweenScores = 0;
    let sinceScore = 0;
    for (const el of [...row.children]) {
      const w = el.getBoundingClientRect().width;
      widest = Math.max(widest, w);
      if (el.classList.contains("ticker-item")) {
        if (firstScoreAt < 0) firstScoreAt = run;
        longestGapBetweenScores = Math.max(longestGapBetweenScores, sinceScore);
        sinceScore = 0;
      } else sinceScore += w;
      run += w;
    }
    return { firstScoreAt: Math.round(firstScoreAt), widest: Math.round(widest), longestGapBetweenScores: Math.round(longestGapBetweenScores) };
  });
  check(shape.firstScoreAt >= 0 && shape.firstScoreAt < 400, `a score is in the first screenful (${shape.firstScoreAt}px in)`);
  check(shape.widest <= 470, `no single item is wider than a phone screen and a bit (widest ${shape.widest}px)`);
  check(shape.longestGapBetweenScores <= 900, `scores keep coming round (longest run without one: ${shape.longestGapBetweenScores}px)`);
  await browser.close();
}

async function desktop() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log("\nOn a desktop");
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await ready(page);
  const px = await speed(page);
  check(px > 30 && px < 85, `travels at a reading speed (${px.toFixed(0)} px/s)`);

  // Measured, not guessed: the strip sits below the site header, so a
  // point near the top of the window is the header, not the strip.
  const strip = (await page.locator(".ticker").boundingBox())!;
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
  await page.waitForTimeout(300);
  check((await speed(page)) < 5, "a resting mouse pauses it");
  await page.mouse.move(700, 600);
  await page.waitForTimeout(300);
  check((await speed(page)) > 30, "moving the mouse away starts it again");
  await browser.close();
}

async function main() {
  console.log(`Checking the market strip against ${BASE}`);
  await phone();
  await desktop();
  console.log("");
  if (failures.length) {
    console.error(`${failures.length} problem(s) with the strip:\n  ${failures.join("\n  ")}\n`);
    process.exit(1);
  }
  console.log("The strip moves at a readable speed, stops for a finger, and can be tapped.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
export {};
