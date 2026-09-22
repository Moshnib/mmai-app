import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/pageMetadata";
import { GROUP_NAMES, routesIn, SITE_ROUTES, type RouteGroup } from "@/lib/routes";

export const metadata: Metadata = pageMetadata({
  title: "Site map",
  description: "Every page on MMAI at a glance: the scores, the pages that track without scoring, and how the index is built.",
  path: "/site-map",
});

/** What the homepage holds, top to bottom. KEEP IN STEP with the section
 *  order in app/page.tsx (a comment there points back here): six short
 *  items, so a new section is one line to add. */
const ON_THE_HOME_PAGE = [
  "Every market's score, and the map",
  "Live press conferences and recent videos",
  "The calendar: what lands next",
  "Latest signals: what just changed",
  "Gulf Watch at a glance",
  "Email alerts",
];

const GROUPS: RouteGroup[] = ["scores", "beyond", "about"];

/**
 * EVERY PAGE ON THE SITE, AS A TREE.
 *
 * Built entirely from lib/routes.ts -- the list the navigation, the
 * sitemap and the browser checks already read -- so a page added there
 * appears here with its name and description, and a page cannot be on the
 * site but missing from its map. Lists all the way down (ul/li), so a
 * screen reader hears the structure; the connecting lines are decoration
 * drawn in CSS.
 */
export default function SiteMapPage() {
  const home = SITE_ROUTES.find((r) => r.path === "/")!;
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">SITE MAP</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>Every page, at a glance</h1>
          <p className="sub">
            Where everything on MMAI lives: the scores, the pages that track countries without scoring them, and
            how the index is built. Every page is a link.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="sm-tree">
            <div className="sm-root">
              <Link href="/" className="sm-card sm-card--root">
                <span className="sm-label">{home.label}</span>
                <span className="sm-desc">{home.description}</span>
              </Link>
              <p className="sm-onpage-head">On the home page</p>
              <ul className="sm-onpage">
                {ON_THE_HOME_PAGE.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <ul className="sm-groups">
              {GROUPS.map((g) => (
                <li key={g} className="sm-group">
                  <h2 className="sm-group-head">{GROUP_NAMES[g]}</h2>
                  <ul className="sm-pages">
                    {routesIn(g).map((r) => (
                      <li key={r.path}>
                        <Link href={r.path} className="sm-card">
                          <span className="sm-label">{r.label}</span>
                          <span className="sm-desc">{r.description}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
