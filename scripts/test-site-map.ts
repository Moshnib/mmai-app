// ============================================================
//  EVERY PAGE IS NAMED, DESCRIBED AND GROUPED
//
//  lib/routes.ts is the one list of pages; the sitemap, the browser
//  checks, the navigation and the site map (app/site-map) all read it. The
//  site map shows each page's name and one-line description under its
//  group, and the navigation shows the same words -- so a page added
//  without them would appear as an empty box on the map and a blank line
//  in a menu. scripts/check-routes.ts already pins that every page file is
//  in the list; this pins what each entry must carry.
//
//  Run: npx tsx scripts/test-site-map.ts
// ============================================================

import { SITE_ROUTES, GROUP_NAMES, routesIn, type RouteGroup } from "../lib/routes";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const groups = Object.keys(GROUP_NAMES) as RouteGroup[];
check("every page has a name", SITE_ROUTES.filter((r) => !r.label.trim()).map((r) => r.path), []);
check("every page has a one-line description (under 80 characters)",
  SITE_ROUTES.filter((r) => !r.description.trim() || r.description.length > 80).map((r) => r.path), []);
check("every page is in a known group", SITE_ROUTES.filter((r) => !groups.includes(r.group)).map((r) => r.path), []);
check("no two pages share a path", new Set(SITE_ROUTES.map((r) => r.path)).size, SITE_ROUTES.length);
check("no two pages share a name", new Set(SITE_ROUTES.map((r) => r.label)).size, SITE_ROUTES.length);
check("the home group is the homepage alone", routesIn("home").map((r) => r.path), ["/"]);
check("every other group has pages on the map", ["scores", "beyond", "about"].map((g) => routesIn(g as RouteGroup).length > 0), [true, true, true]);
check("the site map is itself on the map", SITE_ROUTES.some((r) => r.path === "/site-map"), true);
check("Contact and the site map stay out of the top navigation (they are in the footer)",
  SITE_ROUTES.filter((r) => r.nav === false).map((r) => r.path).sort(), ["/contact", "/site-map"]);
check("the navigation's three scored tools, in the order a reader uses them",
  routesIn("scores", true).map((r) => r.path), ["/dashboard", "/compare", "/trends"]);

console.log(failures === 0 ? "\nAll site-map checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
