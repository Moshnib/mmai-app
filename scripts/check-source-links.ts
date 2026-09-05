// ============================================================
//  DO THE SOURCE LINKS STILL GO ANYWHERE?
//
//  Every figure on this site names its source and links to it, and that
//  link is the whole basis of the "check it yourself" claim. A dead one is
//  worse than no link: it looks like provenance and isn't.
//
//  Found this way on 5 September 2026: Japan's GDP citation pointed at an
//  e-Stat table URL that had 404'd. Nothing on the site could have noticed
//  -- the page rendered perfectly, the data kept flowing from the API, and
//  only the human-facing citation was broken.
//
//  NOT WIRED INTO CI ON EVERY PUSH. It calls thirty government servers, and
//  doing that on every commit is rude and flaky. Run it on a schedule, or
//  by hand before anything that matters:
//
//    npx tsx scripts/check-source-links.ts
// ============================================================

import { SOURCES } from "@/lib/sources";
import { GULF_SOURCES } from "@/lib/gulfSources";

/** Government sites routinely refuse a script's user agent while serving
 *  the identical page to a browser. Verified by hand on 5 September:
 *  bls.gov and rba.gov.au both answer 403 to curl and load fine in Chrome.
 *  So a 403 is reported, never failed on -- the check would otherwise cry
 *  wolf every run and get ignored, which is how a real 404 slips past. */
const BOT_BLOCKED = new Set([403, 401, 429]);

/** e-Stat answers 200 with "Page not found" for a dead table, so status
 *  alone is not enough for it.
 *
 *  MATCHED AGAINST THE <title> ONLY, and that restriction is the whole
 *  point. The first version of this check searched the entire response
 *  body and immediately failed Norway's SSB consumer-price page -- a page
 *  that loads perfectly, and merely contains one of these strings
 *  somewhere in 200KB of navigation and boilerplate. A checker that cries
 *  wolf gets ignored, and an ignored checker is how the real 404 gets
 *  through.
 *
 *  A page that has genuinely failed says so in its title. e-Stat's dead
 *  table titles itself "ページが見つかりません"; SSB's live page titles
 *  itself "Consumer price index". Both verified by hand in a browser. */
const SOFT_404_TITLE_MARKERS = [
  "page not found",
  "not found",
  "cannot be found",
  "404",
  "ページが見つかりません",
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Row = { label: string; url: string };

const rows: Row[] = [
  ...SOURCES.filter((s) => s.url).map((s) => ({ label: `${s.market} · ${s.indicator}`, url: s.url! })),
  ...GULF_SOURCES.filter((s) => s.url).map((s) => ({ label: `Gulf · ${s.country} · ${s.indicator}`, url: s.url! })),
];

const seen = new Map<string, Row[]>();
for (const r of rows) {
  if (!seen.has(r.url)) seen.set(r.url, []);
  seen.get(r.url)!.push(r);
}

async function main() {
  const dead: string[] = [];
  const blocked: string[] = [];

  console.log(`\nChecking ${seen.size} distinct source URLs across ${rows.length} citations.\n`);

  for (const [url, cites] of seen) {
    let status = 0;
    let soft = false;
    let pageTitle = "";
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(25_000),
      });
      status = res.status;
      if (status === 200) {
        const body = await res.text();
        const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim().toLowerCase();
        soft = title !== "" && SOFT_404_TITLE_MARKERS.some((m) => title.includes(m));
        if (soft) pageTitle = title;
      }
    } catch (err) {
      console.log(`  DEAD   ${url}\n         ${(err as Error).message}`);
      dead.push(`${url} — ${(err as Error).message}`);
      continue;
    }

    if (soft) {
      console.log(`  SOFT404 ${url}
          200, but the page titles itself "${pageTitle}"`);
      dead.push(`${url} — soft 404`);
    } else if (status >= 200 && status < 400) {
      console.log(`  ok     ${status}  ${url}`);
    } else if (BOT_BLOCKED.has(status)) {
      console.log(`  BLOCKED ${status}  ${url}  (refuses scripts; verify by hand)`);
      blocked.push(`${status} ${url}`);
    } else {
      console.log(`  DEAD   ${status}  ${url}`);
      dead.push(`${url} — HTTP ${status}`);
      for (const c of cites) console.log(`         cited by: ${c.label}`);
    }
  }

  console.log("");
  if (blocked.length) {
    console.log(`${blocked.length} link(s) refused this script but are probably fine in a browser:`);
    for (const b of blocked) console.log("  " + b);
    console.log("");
  }

  if (dead.length) {
    console.error(`${dead.length} DEAD SOURCE LINK(S):`);
    for (const d of dead) console.error("  " + d);
    console.error("\nA citation that does not resolve is worse than no citation.\n");
    process.exit(1);
  }

  console.log("Every source link resolves.");
}

main();

export {};
