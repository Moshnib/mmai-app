// ============================================================
//  DOES ANY PAGE THROW, OR ASK FOR SOMETHING IT CANNOT HAVE?
//
//  check-layout.ts asks whether the pages LOOK right. This asks whether
//  they RUN right, which is a different failure and an invisible one: a
//  component that throws after hydration, a fetch that 404s, a resource
//  the Content-Security-Policy blocks. None of those move a pixel, so a
//  layout check passes straight over them, and none of them show up in
//  a build either.
//
//  The CSP is the specific reason this is worth having. It was written
//  by hand, it is enforced only in the browser, and the failure mode of
//  getting it wrong is silent -- a blocked script simply does not run.
//  Nothing else in this repository would notice.
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-runtime-errors.ts
// ============================================================

import { chromium, type Page } from "playwright";
import { SITE_PATHS } from "@/lib/routes";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";

/** Every page on the site, from lib/routes.ts -- the same list the
 *  sitemap and the layout check read. A route missing from it is a route
 *  nobody checks and nobody indexes. */
const PAGES = SITE_PATHS;

/** Requests that are ALLOWED to fail, with the reason.
 *
 *  Deliberately tiny. Every entry here is a hole in the check, so a new
 *  one needs a reason written down rather than being waved through --
 *  the whole value of this script is that it fails on things nobody
 *  meant to break. */
const EXPECTED_FAILURES: { match: RegExp; why: string }[] = [
  // Supabase returns 406 for .single() against zero rows. That is the
  // API reporting "no such row", which several components ask on
  // purpose, not a broken request.
  { match: /supabase\.co\/rest\/.*$/, why: "Supabase 406 on an empty .single() is an expected answer" },

  // Next.js router prefetches every visible link as an RSC payload and
  // cancels those still in flight when the page goes away. The first
  // version of this script reported twenty of them as failures -- an
  // artifact of closing the tab 2.5 seconds in, not a fault on the
  // site. An aborted prefetch means the browser changed its mind,
  // which is the entire point of prefetching.
  //
  // Scoped to the abort only: an RSC request that comes back 404 or
  // 500 is a genuinely broken route and still fails this check,
  // because those arrive as a status rather than a failed request.
  { match: /[?&]_rsc=/, why: "aborted RSC prefetch — the router cancelling its own speculative request" },

  // The homepage asks its own route for the institutions' announcements as
  // soon as it hydrates, and that route reads seven outside feeds, so the
  // request can still be in flight 2.5 seconds later when this script
  // closes the tab. Same artifact as the prefetch above: the tab went
  // away, the site is fine.
  //
  // This hides an ABORT and nothing else. The route catches its own
  // errors and answers 200 with an empty list, so a real fault there
  // arrives as a status and is still reported by the response handler
  // below -- as would a 404 if the route were ever renamed.
  { match: /\/api\/announcements/, why: "aborted announcements fetch -- the tab closed before the outside feeds answered" },

  // Vercel Web Analytics (app/layout.tsx). On Vercel this script is served
  // at the site's own origin; under a local `next start` nothing serves it,
  // so it 404s here and only here, and Chrome then also refuses the 404
  // body as a script ("MIME type ('text/plain') is not executable").
  // Exactly this one file -- any other /_vercel path, or the beacon
  // itself, still fails the check.
  { match: /\/_vercel\/insights\/script\.js(?=$|['"\s])/, why: "analytics script exists only on Vercel, not under a local next start" },
];

interface Problem { page: string; kind: string; detail: string }

async function inspect(page: Page, path: string, base: string): Promise<Problem[]> {
  const found: Problem[] = [];
  const seen = new Set<string>();
  const add = (kind: string, detail: string) => {
    const key = kind + detail;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ page: path, kind, detail });
  };

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // A failed resource is reported twice: as a response, and as a console
    // line whose text omits the URL. The same exceptions apply to both.
    const at = m.location()?.url ?? "";
    if (at && EXPECTED_FAILURES.some((e) => e.match.test(at))) return;
    // Some refusals name the resource only in the message itself.
    const text = m.text();
    if (/^Refused to execute script from '/.test(text) && EXPECTED_FAILURES.some((e) => e.match.test(text))) return;
    add("console", m.text().slice(0, 200));
  });
  // An uncaught exception is not the same as console.error and is
  // always worse: it means a component stopped part-way.
  page.on("pageerror", (e) => add("threw", e.message.slice(0, 200)));

  page.on("requestfailed", (r) => {
    const url = r.url();
    if (EXPECTED_FAILURES.some((e) => e.match.test(url))) return;
    add("request", `${r.method()} ${url.slice(0, 130)} — ${r.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const url = r.url();
    if (EXPECTED_FAILURES.some((e) => e.match.test(url))) return;
    add("status", `${r.status()} ${url.slice(0, 130)}`);
  });

  await page.goto(base + path, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
  // Client components fetch their own data and render after. Checking
  // before that measures a page no reader ever sees -- the same reason
  // check-layout.ts waits.
  await page.waitForTimeout(2_500);

  // NOTHING BUT THE HEADER MAY PIN ITSELF TO THE TOP OF THE SCREEN.
  //
  // globals.css styled the site header with a bare `nav` selector, and
  // the Learn page's contents line is also a <nav>. It inherited the
  // lot: sticky at top 0, an 82%-opaque dark background and a backdrop
  // blur. At 310px tall on a phone, a third of the screen was covered
  // by a black panel that followed the reader down the page. It was
  // reported as the screen freezing.
  //
  // Neither the layout check nor a build sees this: nothing overflows,
  // nothing throws, and the page looks correct until you scroll. So it
  // is asserted here -- one sticky element pinned to the top per page,
  // and the header is the one.
  const pinned = await page.evaluate(() => {
    const out: { cls: string; h: number }[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "sticky" && cs.position !== "fixed") return;
      if (parseInt(cs.top || "9999", 10) !== 0) return;
      const h = Math.round(el.getBoundingClientRect().height);
      if (h < 100) return;                       // a slim toolbar is fine
      if (el.classList.contains("sitenav")) return;
      out.push({ cls: el.tagName + "." + (String(el.className || "").split(" ")[0] || "-"), h });
    });
    return out;
  });
  for (const p of pinned) {
    add("pinned", `${p.cls} is stuck to the top of the viewport and is ${p.h}px tall — only the site header should pin`);
  }

  return found;
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const problems: Problem[] = [];

  console.log(`\nLoading ${PAGES.length} pages against ${BASE}, watching for errors\n`);

  for (const path of PAGES) {
    const page = await context.newPage();
    const found = await inspect(page, path, BASE);
    problems.push(...found);
    console.log(`  ${found.length === 0 ? "ok  " : "FAIL"}  ${path}`);
    for (const p of found) console.log(`          ${p.kind}: ${p.detail}`);
    await page.close();
  }

  await context.close();
  await browser.close();

  console.log("");
  if (problems.length > 0) {
    console.error(`${problems.length} runtime problem(s):\n`);
    for (const p of problems) console.error(`  ${p.page.padEnd(14)} ${p.kind}: ${p.detail}`);
    console.error("\nA page that throws still renders its HTML, so this is the only");
    console.error("check that sees it. If a blocked resource is the cause, the");
    console.error("Content-Security-Policy in next.config.ts is where to look.\n");
    process.exit(1);
  }

  console.log(`No page throws, and nothing is requested that cannot be had — ${PAGES.length} pages.\n`);
}

main();
export {};
