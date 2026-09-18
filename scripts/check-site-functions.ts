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
//    Sources       jump links and a #hash open their folded group;
//                  Open all opens every group.
//    Downloads     a chart's CSV has the right header and credit lines;
//                  its PNG is a real image, not an empty file.
//    Terms         a term opens on tap, speaks, stays on a phone screen,
//                  and closes on Escape.
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-site-functions.ts
// ============================================================

import { readFileSync } from "node:fs";
import { request } from "node:http";
import { chromium, devices, type Browser, type Page } from "playwright";

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

async function sources(page: Page) {
  console.log("\nSources page");
  await page.goto(`${BASE}/sources`, { waitUntil: "load" });
  const openCount = () => page.evaluate(() => [...document.querySelectorAll("details.sources-group")].filter((d) => (d as HTMLDetailsElement).open).length);
  check((await openCount()) === 0, "groups start folded");
  await page.click('.sources-jump a[href="#src-japan"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => (document.getElementById("src-japan") as HTMLDetailsElement | null)?.open === true), "a jump link opens its group");
  await page.click(".sources-folds-btn >> text=Open all");
  await page.waitForTimeout(200);
  const total = await page.evaluate(() => document.querySelectorAll("details.sources-group").length);
  check((await openCount()) >= Math.min(total, 10), "Open all opens the groups");

  await page.goto(`${BASE}/sources#gulf-oman`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  check(await page.evaluate(() => (document.getElementById("gulf-oman") as HTMLDetailsElement | null)?.open === true), "an address ending #gulf-oman opens Oman");
}

async function downloads(page: Page) {
  console.log("\nChart downloads");
  await page.goto(`${BASE}/trends?market=JP`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const row = page.locator(".chart-download").first();

  const [csv] = await Promise.all([page.waitForEvent("download"), row.locator("button", { hasText: "Data" }).click()]);
  // The file starts with a byte-order mark so Excel reads it as UTF-8.
  const csvText = readFileSync((await csv.path())!, "utf8").replace(/^\uFEFF/, "");
  check(csvText.startsWith("Period,") && /\n\d{4},/.test(csvText), `CSV starts with a Period column and yearly rows (${csv.suggestedFilename()})`);
  check(/\nSource,/.test(csvText), "CSV carries its credit line");

  const [png] = await Promise.all([page.waitForEvent("download"), row.locator("button", { hasText: "Image" }).click()]);
  const bytes = readFileSync((await png.path())!);
  const size = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  }, bytes.toString("base64")).catch(() => ({ w: 0, h: 0 }));
  // Drawn at 2x, and the chart alone is 320px tall, so anything under
  // 640px high has lost the chart and kept only its title and footer.
  check(size.w > 800 && size.h > 640, `PNG is a real image with the chart in it (${size.w}×${size.h})`);
}

async function terms(browser: Browser) {
  console.log("\nTerm explanations, on a phone");
  const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const btn = page.locator(".term-btn", { hasText: "market-years" }).first();
  await btn.tap();
  await page.waitForTimeout(200);
  const said = await page.locator(".term", { has: btn }).locator(".term-status").textContent();
  check((said ?? "").includes("economy in one year"), "tapping a term fills its explanation");
  const box = await page.locator(".term-bubble").first().boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= 375, "the explanation stays on the screen");
  const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  check(docWidth <= 375, "opening it does not make the page scroll sideways");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check((await page.locator(".term-bubble").count()) === 0, "Escape closes it");
  await context.close();

  // With a mouse: resting on the word previews it, a click pins it, and a
  // second click closes it even though the pointer is still on the word.
  console.log("\nTerm explanations, with a mouse");
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await desk.newPage();
  await dp.goto(`${BASE}/`, { waitUntil: "load" });
  const word = dp.locator(".term-btn", { hasText: "market-years" }).first();
  await word.hover();
  await dp.waitForTimeout(150);
  check((await dp.locator(".term-bubble").count()) === 1, "resting the pointer on it previews it");
  await word.click();
  await dp.waitForTimeout(150);
  check((await dp.locator(".term-bubble").count()) === 1, "a click pins it open");
  await word.click();
  await dp.waitForTimeout(150);
  check((await dp.locator(".term-bubble").count()) === 0, "a second click closes it with the pointer still on it");
  await desk.close();
}

/** ONE ADDRESS. The project's mmai-app.vercel.app alias is permanent and
 *  answered every request beside mmai.markets, which split the visitor
 *  counts and let either be bookmarked or shared. next.config.ts forwards
 *  it -- matched on the EXACT host, because every preview deployment is
 *  also a *.vercel.app address and those must keep working.
 *
 *  Checked by asking the local server with each Host header in turn, which
 *  is the only way to exercise a host rule without deploying. */
async function oneAddress() {
  console.log("\nOne address for the site");
  // node:http, not fetch: fetch refuses to set a Host header (it is on the
  // forbidden list), so the request arrives with the server's own host and
  // the rule never matches -- which read as "the redirect is broken" when
  // it was the test that could not ask the question.
  const ask = (host: string, path = "/") =>
    new Promise<{ status: number; location: string | null }>((resolve, reject) => {
      const url = new URL(BASE);
      const req = request(
        { hostname: url.hostname, port: url.port, path, method: "GET", headers: { host } },
        (res) => {
          res.resume();
          resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null });
        }
      );
      req.on("error", reject);
      req.end();
    });

  // Asked for a real page, not the root: this also proves the reader keeps
  // the page they were on rather than being dropped on the homepage.
  const old = await ask("mmai-app.vercel.app", "/dashboard");
  check(
    old.status === 308 && old.location === "https://www.mmai.markets/dashboard",
    `the old address forwards to the real one, keeping the page (${old.status} -> ${old.location ?? "nowhere"})`
  );

  const preview = await ask("mmai-app-git-some-branch-mmai2.vercel.app");
  check(preview.status === 200, `a preview link still answers for itself (${preview.status})`);

  const real = await ask("www.mmai.markets");
  check(real.status === 200, `the real address answers for itself (${real.status})`);
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
  await sources(page);
  await downloads(page);
  await terms(browser);
  await oneAddress();
  await browser.close();

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} problem(s):\n  ${failures.join("\n  ")}\n`);
    process.exit(1);
  }
  console.log("Back to top, the address, sharing, sources, downloads and terms all behave.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
export {};
