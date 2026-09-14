// ============================================================
//  WHAT A SEARCH ENGINE AND A SHARED LINK ACTUALLY GET
//
//  Checked against the RENDERED HTML from a running server, not the
//  source. Metadata is assembled by the framework from several layers —
//  a root layout, a page's own export, a title template — and reading
//  the source tells you what was asked for rather than what came out.
//  This project's own rule, learned when "five pillars" was greppable
//  nowhere in the source and still on the page.
//
//  THREE THINGS IT WOULD HAVE CAUGHT, all live on 14 September 2026:
//
//    1. NO PAGE EMITTED A CANONICAL URL. That matters most during a
//       domain move: without one, a crawler reaching both the vercel.app
//       address and the real domain has no instruction about which is
//       authoritative and may treat the new site as a duplicate.
//
//    2. EVERY PAGE SHARED ONE SOCIAL CARD. Ten pages set their own
//       title and description, none set openGraph, so all of them
//       inherited the root layout's. Sharing /dashboard or /learn showed
//       the generic homepage card. Invisible on the site, visible in
//       every place the site gets shared.
//
//    3. NO STRUCTURED DATA AT ALL. For a site publishing an index built
//       from official statistics, that is the difference between being
//       read as a blog and being eligible for Google Dataset Search.
//
//  Needs a server on PORT (default 3123), like the other browser checks.
//
//    npx tsx scripts/check-seo.ts
// ============================================================

import { SITE_ROUTES } from "@/lib/routes";
import { SITE_URL } from "@/lib/siteUrl";

const BASE = process.env.SEO_BASE_URL ?? "http://localhost:3123";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

function tag(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

const canonicalOf = (h: string) => tag(h, /<link rel="canonical" href="([^"]*)"/);
const ogTitleOf = (h: string) => tag(h, /<meta property="og:title" content="([^"]*)"/);
const ogDescOf = (h: string) => tag(h, /<meta property="og:description" content="([^"]*)"/);
const descOf = (h: string) => tag(h, /<meta name="description" content="([^"]*)"/);
const titleOf = (h: string) => tag(h, /<title>([^<]*)<\/title>/);

async function main() {
  console.log(`\nSEO, against the rendered HTML at ${BASE}\n`);

  const pages = new Map<string, string>();
  for (const route of SITE_ROUTES) {
    const res = await fetch(`${BASE}${route.path}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      fail(`${route.path} returned HTTP ${res.status}`);
      continue;
    }
    pages.set(route.path, await res.text());
  }
  if (pages.size === 0) {
    fail("no pages could be fetched — is the server running?");
    process.exit(1);
  }

  // ---------- 1. every page identifies itself ----------
  const canonicals = new Map<string, string>();
  const ogTitles = new Map<string, string>();
  const ogDescs = new Map<string, string>();

  for (const [path, html] of pages) {
    const canonical = canonicalOf(html);
    const expected = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
    if (!canonical) fail(`${path} has no canonical URL`);
    else if (canonical !== expected) fail(`${path} canonical is "${canonical}", expected "${expected}"`);
    else canonicals.set(path, canonical);

    if (!titleOf(html)) fail(`${path} has no <title>`);
    if (!descOf(html)) fail(`${path} has no meta description`);

    const ogTitle = ogTitleOf(html);
    const ogDesc = ogDescOf(html);
    if (!ogTitle) fail(`${path} has no og:title`);
    else ogTitles.set(path, ogTitle);
    if (!ogDesc) fail(`${path} has no og:description`);
    else ogDescs.set(path, ogDesc);
  }
  if (!failed) ok(`all ${pages.size} pages carry a canonical URL, a title, a description and a social card`);

  // ---------- 2. and identifies itself DISTINCTLY ----------
  // The bug was not a missing tag, it was the same tag everywhere.
  for (const [label, map] of [["canonical", canonicals], ["og:title", ogTitles], ["og:description", ogDescs]] as const) {
    const seen = new Map<string, string[]>();
    for (const [path, value] of map) {
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value)!.push(path);
    }
    const shared = [...seen.entries()].filter(([, paths]) => paths.length > 1);
    for (const [value, paths] of shared) {
      fail(`${paths.join(", ")} share one ${label}: "${value.slice(0, 60)}" — each page needs its own`);
    }
  }
  if (!failed) ok("no two pages share a canonical, an og:title or an og:description");

  // ---------- 3. structured data ----------
  const home = pages.get("/");
  if (!home) {
    fail("the homepage could not be read");
  } else {
    const blocks = [...home.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (blocks.length === 0) fail("the homepage emits no JSON-LD");

    const types: string[] = [];
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block.replace(/\\u003c/g, "<"));
        const graph = parsed["@graph"] ?? [parsed];
        for (const node of graph) types.push(node["@type"]);
      } catch (e) {
        fail(`JSON-LD on the homepage is not valid JSON: ${(e as Error).message.slice(0, 60)}`);
      }
    }
    for (const required of ["Organization", "WebSite", "Dataset"]) {
      if (!types.includes(required)) fail(`the homepage JSON-LD has no ${required} node`);
    }
    if (!failed) ok(`the homepage describes itself as ${[...new Set(types)].join(", ")}`);
  }

  // The Dataset describes the index as a whole and belongs at ONE
  // address. On every page it would claim eleven datasets exist.
  const elsewhere = [...pages.entries()].filter(([path]) => path !== "/");
  const duplicated = elsewhere.filter(([, html]) => /"@type":"Dataset"/.test(html)).map(([p]) => p);
  if (duplicated.length > 0) fail(`Dataset markup also appears on ${duplicated.join(", ")} — it belongs on the homepage alone`);
  else ok("Dataset markup appears once, on the homepage");

  // ---------- 4. claims nothing it cannot back ----------
  // Structured data is read by a machine that will not check it, which
  // makes it the place an exaggeration survives longest. A `license`
  // was written here as CC BY 4.0 and removed before shipping: the site
  // states no licence for its own output, and asserting one publicly is
  // not a metadata detail.
  if (home) {
    for (const forbidden of ["SearchAction", "AggregateRating", "Review"]) {
      if (home.includes(`"${forbidden}"`)) {
        fail(`the homepage JSON-LD claims ${forbidden}, which this site has no basis for`);
      }
    }
    const dsLicense = home.match(/"@type":"Dataset"[\s\S]*?"license":"([^"]*)"/);
    if (dsLicense) {
      fail(
        `the Dataset declares a licence (${dsLicense[1]}). The site states no licence for its own ` +
          `output — only the ones its sources grant it. Add one to the site first, deliberately.`,
      );
    }
    if (!failed) ok("the structured data claims nothing the site cannot back");
  }

  // ---------- 5. robots and sitemap ----------
  const robots = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(20_000) }).then((r) => r.text());
  if (!robots.includes("Sitemap:")) fail("robots.txt does not point at the sitemap");
  if (!/Disallow: \/api\//.test(robots)) fail("robots.txt does not keep crawlers out of /api/");

  const sitemap = await fetch(`${BASE}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) }).then((r) => r.text());
  const urls = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const route of SITE_ROUTES) {
    const expected = route.path === "/" ? SITE_URL : `${SITE_URL}${route.path}`;
    if (!urls.includes(expected)) fail(`${expected} is missing from the sitemap`);
  }
  if (!/<lastmod>/i.test(sitemap)) fail("the sitemap has no lastmod dates");
  if (!failed) ok(`robots.txt and the sitemap agree with the ${SITE_ROUTES.length} declared routes`);

  console.log("");
  if (failed) {
    console.error("None of this is visible on the site itself. It is what a search engine reads,");
    console.error("and what a person sees when a link is pasted into a chat.\n");
    process.exit(1);
  }
  console.log("Every page identifies itself, distinctly, and claims only what it can back.\n");
}

void main();
