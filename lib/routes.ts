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
// ============================================================

export interface SiteRoute {
  /** URL path. "/" for the homepage -- the sitemap adds the origin. */
  path: string;
  /** Sitemap priority, 0 to 1. */
  priority: number;
  /** How often the CONTENT changes, which is not how often it is
   *  fetched. The scored pages genuinely change with a daily refresh;
   *  Learn changes when the method does. */
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}

export const SITE_ROUTES: readonly SiteRoute[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/dashboard", priority: 0.9, changeFrequency: "daily" },
  { path: "/trends", priority: 0.8, changeFrequency: "daily" },
  { path: "/compare", priority: 0.8, changeFrequency: "daily" },
  { path: "/gulf-watch", priority: 0.7, changeFrequency: "daily" },
  // Was missing from the sitemap entirely until 6 September 2026, while
  // being linked from every page's navigation.
  { path: "/stablecoins", priority: 0.6, changeFrequency: "daily" },
  { path: "/learn", priority: 0.6, changeFrequency: "monthly" },
  { path: "/sources", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
];

/** Just the paths, for the browser checks. */
export const SITE_PATHS: readonly string[] = SITE_ROUTES.map((r) => r.path);
