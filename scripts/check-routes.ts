// ============================================================
//  IS EVERY PAGE THAT EXISTS ACTUALLY DECLARED?
//
//  /stablecoins was in the navigation on every page, linked from the 404
//  page, and covered by both browser checks -- and absent from the
//  sitemap for as long as it existed. Search engines were never told
//  about it, on a site whose entire purpose is to be found and read.
//
//  Nothing caught it, because there were three separate route lists and
//  each was individually plausible. There is one list now, in
//  lib/routes.ts, and this compares it against what is actually on disk.
//  A list can still fall behind a new page; the filesystem cannot.
//
//    npx tsx scripts/check-routes.ts
// ============================================================

import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { SITE_ROUTES, SITE_PATHS } from "@/lib/routes";

const APP = join(process.cwd(), "app");

/** Directories under app/ that are not reader-facing pages. */
const NOT_A_PAGE = new Set(["api"]);

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

// ---------- what is actually on disk ----------
// A route exists when app/<name>/page.tsx does. Route groups and private
// folders are skipped: "(group)" does not appear in the URL and "_name"
// is Next's opt-out convention.
const onDisk: string[] = [];
if (existsSync(join(APP, "page.tsx"))) onDisk.push("/");
for (const entry of readdirSync(APP)) {
  if (NOT_A_PAGE.has(entry)) continue;
  if (entry.startsWith("_") || entry.startsWith("(") || entry.startsWith(".")) continue;
  const dir = join(APP, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (existsSync(join(dir, "page.tsx"))) onDisk.push(`/${entry}`);
}

console.log(`\nComparing ${onDisk.length} page files against ${SITE_PATHS.length} declared routes\n`);

// ---------- every page on disk must be declared ----------
for (const path of onDisk) {
  if (!SITE_PATHS.includes(path)) {
    fail(`${path} has a page.tsx but is not in lib/routes.ts — it will not be in the sitemap, and neither browser check will load it`);
  }
}

// ---------- and nothing declared may be missing ----------
for (const path of SITE_PATHS) {
  if (!onDisk.includes(path)) {
    fail(`${path} is declared in lib/routes.ts but has no page.tsx — the sitemap would advertise a 404`);
  }
}

if (!failed) ok(`all ${onDisk.length} pages are declared, and every declared route exists`);

// ---------- the metadata has to be usable ----------
const seen = new Set<string>();
for (const r of SITE_ROUTES) {
  if (seen.has(r.path)) fail(`${r.path} is declared twice`);
  seen.add(r.path);
  if (!(r.priority > 0 && r.priority <= 1)) fail(`${r.path} has priority ${r.priority}, outside 0-1`);
  if (!r.path.startsWith("/")) fail(`${r.path} does not start with a slash`);
  // Only the homepage may be a bare slash; a trailing slash anywhere
  // else produces a duplicate URL in the sitemap.
  if (r.path !== "/" && r.path.endsWith("/")) fail(`${r.path} has a trailing slash`);
}
if (!failed) ok("priorities, paths and uniqueness are all sane");

console.log("");
if (failed) {
  console.error("lib/routes.ts is the single list the sitemap and both browser");
  console.error("checks read. Adding a page means adding it there, once.\n");
  process.exit(1);
}
console.log("Every page is declared once, indexed, and checked.\n");
export {};
