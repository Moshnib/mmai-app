// ============================================================
//  EVERY PAGE ON THE SITE, IN ONE PLACE
//
//  There were three lists of routes: the sitemap, the layout check and
//  the runtime check. They drifted, and the drift was invisible --
//  /stablecoins was in the navigation, in the 404 page's links, and
//  covered by both checks, but ABSENT FROM THE SITEMAP. A page search
//  engines were never told about, on a site whose whole purpose is to be
//  found and read.
//
//  Nothing catches that by reading the code, because each list was
//  individually plausible. So there is now one list, and the sitemap and
//  both checks read from it: adding a route makes it indexed AND checked,
//  or neither. scripts/check-routes.ts fails if a route file exists that
//  is not declared here.
//
//  SINCE 22 SEPTEMBER 2026 THE NAVIGATION AND THE SITE MAP READ IT TOO.
//  Each page's name, one-line description and group live here, and
//  components/NavBar.tsx and app/site-map build themselves from them -- the
//  site map would otherwise have been a fourth list, and a menu entry
//  missing from the map (or described differently) the first drift.
//  scripts/test-site-map.ts pins that every page has all three.
//
//  ORDER MATTERS: it is the order of the navigation and of the site map.
// ============================================================

export type RouteGroup = "home" | "scores" | "beyond" | "about";

/** How each group is named where it is shown: the navigation's dropdowns
 *  and the site map's column headings. */
export const GROUP_NAMES: Record<RouteGroup, string> = {
  home: "Home",
  scores: "The scores",
  beyond: "Beyond the score",
  about: "About the index",
};

export interface SiteRoute {
  /** URL path. "/" for the homepage -- the sitemap adds the origin. */
  path: string;
  /** What the page is called, in the navigation and on the site map. */
  label: string;
  /** One line on what is inside, shown under the label in the navigation's
   *  dropdowns and on the site map. */
  description: string;
  group: RouteGroup;
  /** False for pages kept out of the top navigation (Contact and the site
   *  map live in the footer). Defaults to true. */
  nav?: boolean;
  /** Sitemap priority, 0 to 1. */
  priority: number;
  /** How often the CONTENT changes, which is not how often it is
   *  fetched. The scored pages genuinely change with a daily refresh;
   *  Learn changes when the method does. */
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}

export const SITE_ROUTES: readonly SiteRoute[] = [
  { path: "/", label: "Home", description: "Every market's score, the live calendar and videos, on one page", group: "home", priority: 1.0, changeFrequency: "daily" },
  { path: "/dashboard", label: "Dashboard", description: "Every scored market's figures, side by side", group: "scores", priority: 0.9, changeFrequency: "daily" },
  { path: "/compare", label: "Compare", description: "Markets against each other over any years", group: "scores", priority: 0.8, changeFrequency: "daily" },
  { path: "/trends", label: "Trends", description: "How each score and its figures have moved since 2019", group: "scores", priority: 0.8, changeFrequency: "daily" },
  // Gulf Watch and the Observatory side by side deliberately: both show
  // countries with real figures and no score.
  { path: "/gulf-watch", label: "Gulf Watch", description: "Six Gulf economies, figure by figure", group: "beyond", priority: 0.7, changeFrequency: "daily" },
  { path: "/observatory", label: "Observatory", description: "Tracked, not scored", group: "beyond", priority: 0.7, changeFrequency: "daily" },
  // Was missing from the sitemap entirely until 6 September 2026, while
  // being linked from every page's navigation.
  { path: "/stablecoins", label: "Stablecoins", description: "How many dollars exist on a blockchain", group: "beyond", priority: 0.6, changeFrequency: "daily" },
  { path: "/videos", label: "Central bank videos", description: "Press conferences and speeches, from the banks themselves", group: "beyond", priority: 0.6, changeFrequency: "daily" },
  { path: "/learn", label: "How the score works", description: "Every indicator and formula, in plain words", group: "about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/sources", label: "Data sources", description: "Where each number comes from, and its licence", group: "about", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", label: "About MMAI", description: "Who makes it, and why", group: "about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", label: "Contact", description: "Send a message; every one is read", group: "about", nav: false, priority: 0.4, changeFrequency: "yearly" },
  { path: "/site-map", label: "Site map", description: "Every page on the site, at a glance", group: "about", nav: false, priority: 0.3, changeFrequency: "monthly" },
];

/** Just the paths, for the browser checks. */
export const SITE_PATHS: readonly string[] = SITE_ROUTES.map((r) => r.path);

/** The pages of one group, in order; `navOnly` drops those kept out of the
 *  top navigation. */
export function routesIn(group: RouteGroup, navOnly = false): SiteRoute[] {
  return SITE_ROUTES.filter((r) => r.group === group && (!navOnly || r.nav !== false));
}
