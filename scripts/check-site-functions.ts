// ============================================================
//  DO THE EVERYDAY CONTROLS WORK?
//
//  Added with the September 2026 review of the site against comparable
//  data sites. Each of these is behaviour, not layout, so the other
//  browser checks walk straight past a broken one:
//
//    Back to top   absent at the top, appears two screens down, returns
//                  to the top and hands focus to the content.
//    The address   choosing a market writes ?market=; a link with it
//                  opens on that market; Back returns to the one before.
//                  Trends and Compare keep their controls there too, and
//                  a reload keeps the view.
//    Share         on a desktop, copies the address and says so.
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-site-functions.ts
// ============================================================

import { chromium, type Page } from "playwright";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";

const failures: string[] = [];
function check(ok: boolean, what: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
}

const pressed = (page: Page, selector: string) =>
  page.evaluate((s) => [...document.querySelectorAll(s)].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent?.trim()), selector);

async function backToTop(page: Page) {
  console.log("\nBack to top");
  await page.goto(`${BASE}/learn`, { waitUntil: "load" });
  check((await page.locator(".back-to-top").count()) === 0, "absent at the top of the page");
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3));
  await page.waitForSelector(".back-to-top", { timeout: 3000 }).catch(() => {});
  check((await page.locator(".back-to-top").count()) === 1, "appears once the reader is well down the page");
  await page.click(".back-to-top");
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 4000 }).catch(() => {});
  check(await page.evaluate(() => window.scrollY === 0), "returns to the top");
  check(await page.evaluate(() => document.activeElement?.id === "main-content"), "hands keyboard focus to the content");
}

async function address(page: Page) {
  console.log("\nThe address remembers the choice");
  await page.goto(`${BASE}/?market=JP`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  check((await pressed(page, ".market-chip")).some((t) => t?.includes("Japan")), "home: a link with ?market=JP opens on Japan");

  await page.click('.market-chip:has-text("Canada")');
  await page.waitForTimeout(300);
  check(new URL(page.url()).searchParams.get("market") === "CA", "home: choosing Canada writes it into the address");
  await page.goBack();
  await page.waitForTimeout(500);
  check((await pressed(page, ".market-chip")).some((t) => t?.includes("Japan")), "home: Back returns to Japan");

  await page.goto(`${BASE}/trends`, { waitUntil: "load" });
  await page.click('.market-chip:has-text("United Kingdom")');
  await page.waitForTimeout(300);
  check(new URL(page.url()).searchParams.get("market") === "UK", "trends: choosing a market writes it into the address");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  check((await pressed(page, ".market-chip")).some((t) => t?.includes("United Kingdom")), "trends: a reload keeps the market");

  // The default market must be reachable from a link that names another:
  // choosing it clears the param, and the page must then show it.
  await page.goto(`${BASE}/trends?market=JP`, { waitUntil: "load" });
  await page.click('.market-chip:has-text("United States")');
  await page.waitForTimeout(300);
  check(
    !new URL(page.url()).searchParams.has("market") && (await pressed(page, ".market-chip")).some((t) => t?.includes("United States")),
    "trends: choosing the default market from a shared link shows it"
  );

  await page.goto(`${BASE}/compare`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const before = page.url();
  const stepsBefore = await page.evaluate(() => history.length);
  const chip = page.locator('button[aria-pressed="true"]').first();
  await chip.click();
  await page.waitForTimeout(300);
  const markets = new URL(page.url()).searchParams.get("markets");
  check(!!markets && page.url() !== before, "compare: switching a market off writes the selection into the address");
  const stepsAfter = await page.evaluate(() => history.length);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  check(new URL(page.url()).searchParams.get("markets") === markets, "compare: a reload keeps the selection");
  check(stepsAfter === stepsBefore, "compare: adjusting the view adds no Back step");
}

async function share(page: Page) {
  console.log("\nShare this view");
  await page.goto(`${BASE}/trends?market=JP`, { waitUntil: "load" });
  await page.click(".share-btn");
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check(copied.includes("market=JP"), "copies the address of the current view");
  const status = await page.locator(".share-status").first().textContent();
  check((status ?? "").includes("copied"), "says the link was copied");
}

async function main() {
  console.log(`Checking everyday controls against ${BASE}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Chromium only: the permission names are Chromium's.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await context.newPage();
  await backToTop(page);
  await address(page);
  await share(page);
  await browser.close();

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} problem(s):\n  ${failures.join("\n  ")}\n`);
    process.exit(1);
  }
  console.log("Back to top, the address and sharing all behave.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
export {};
