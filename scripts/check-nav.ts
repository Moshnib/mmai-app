// ============================================================
//  DOES THE TOP BAR WORK?
//
//  In September 2026 the bar went from eleven links to six entries, two
//  of which open a panel (Home, three tools, and the two groups). A panel is behaviour, and behaviour is what the
//  other browser checks walk past: a menu that never closes, or one that
//  hangs off the right edge of the screen, moves no layout box that
//  check-layout polices while it is shut, throws nothing, and names every
//  control correctly.
//
//  So this opens them, at the width just above the breakpoint (where the
//  row is tightest) and on a desktop, and asks what a reader would:
//
//    does each group open, and does its panel stay on the screen?
//    does Escape close it and put focus back on its button?
//    does a click elsewhere close it?
//    does following a link inside it close it?
//    does the group holding the current page say so?
//    on a phone, does the menu show every page, grouped?
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-nav.ts
// ============================================================

import { chromium, type Page } from "playwright";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";
const GROUPS = ["beyond", "about"];

const failures: string[] = [];
function check(ok: boolean, what: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
}

const isOpen = (page: Page, id: string) =>
  page.evaluate((g) => document.getElementById(`navgroup-btn-${g}`)?.getAttribute("aria-expanded") === "true", id);

async function desktop(width: number) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  console.log(`\nAt ${width}px`);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });

  const burgerShown = await page.locator(".navburger").isVisible();
  check(!burgerShown, "the full bar shows, not the menu button");

  for (const g of GROUPS) {
    await page.click(`#navgroup-btn-${g}`);
    check(await isOpen(page, g), `${g}: opens on click`);
    const box = await page.locator(`#navmenu-${g}`).boundingBox();
    check(!!box && box.x >= 0 && box.x + box.width <= width, `${g}: its panel stays on the screen`);

    await page.keyboard.press("Escape");
    check(!(await isOpen(page, g)), `${g}: Escape closes it`);
    const focused = await page.evaluate(() => document.activeElement?.id);
    check(focused === `navgroup-btn-${g}`, `${g}: Escape returns focus to its button`);

    await page.click(`#navgroup-btn-${g}`);
    await page.mouse.click(width / 2, 700);
    check(!(await isOpen(page, g)), `${g}: a click elsewhere closes it`);
  }

  // Opening one group closes the other: two panels over each other would
  // hide half of both.
  await page.click("#navgroup-btn-beyond");
  await page.click("#navgroup-btn-about");
  check((await isOpen(page, "about")) && !(await isOpen(page, "beyond")), "only one group is open at a time");

  await page.click('#navmenu-about a[href="/sources"]');
  await page.waitForURL(`${BASE}/sources`);
  check(!(await isOpen(page, "about")), "following a link closes its panel");
  const marked = await page.evaluate(() => document.getElementById("navgroup-btn-about")?.classList.contains("has-active"));
  check(!!marked, "the group holding the current page is marked");
  const current = await page.evaluate(() => document.querySelector('#navmenu-about a[aria-current="page"]')?.getAttribute("href"));
  check(current === "/sources", "the current page is marked inside its group");

  // Following the link to the page you are already on changes no address,
  // so nothing that watches the address would close the panel.
  await page.click("#navgroup-btn-about");
  await page.click('#navmenu-about a[href="/sources"]');
  check(!(await isOpen(page, "about")), "following the link to the current page closes its panel");

  await browser.close();
}

async function phone() {
  const browser = await chromium.launch();
  // Held sideways: the shortest screen the panel has to fit.
  const page = await browser.newPage({ viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true });
  console.log("\nOn a phone held sideways");
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.click(".navburger");
  const links = await page.locator("#mobile-nav-panel a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const expected = ["/", "/dashboard", "/compare", "/trends", "/gulf-watch", "/observatory", "/stablecoins", "/learn", "/sources", "/about"];
  check(expected.every((h) => links.includes(h)), `the menu lists every page (${links.length} links)`);
  const labels = await page.locator("#mobile-nav-panel .navpanel-label").count();
  check(labels === 2, "the menu labels both groups");
  // A reader deep inside the site must be able to get home from the menu,
  // not only by knowing the logo is a link.
  check(links.includes("/"), "the menu has a way home");
  // isVisible() says nothing about the screen edge, so measure: the panel
  // must scroll, and once scrolled the last link must sit inside 360px.
  const scrolls = await page.evaluate(() => { const p = document.getElementById("mobile-nav-panel")!; return p.scrollHeight > p.clientHeight; });
  check(scrolls, "the menu scrolls when it is taller than the screen");
  const last = page.locator('#mobile-nav-panel a[href="/about"]');
  await last.scrollIntoViewIfNeeded();
  const lastBox = await last.boundingBox();
  check(!!lastBox && lastBox.y >= 0 && lastBox.y + lastBox.height <= 360, "the last link can be scrolled onto the screen");
  await browser.close();
}

async function main() {
  console.log(`Checking the top bar against ${BASE}`);
  await desktop(821);
  await desktop(1280);
  await phone();
  console.log("");
  if (failures.length) {
    console.error(`${failures.length} top-bar problem(s):\n  ${failures.join("\n  ")}\n`);
    process.exit(1);
  }
  console.log("The top bar opens, closes and marks the current page as it should.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
export {};
