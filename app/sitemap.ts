import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { SITE_ROUTES } from "@/lib/routes";

/** Reads the one route list rather than keeping a second copy of it.
 *  The copy is how /stablecoins ended up linked from every page in the
 *  navigation and absent from the sitemap for as long as it existed. */
export default function sitemap(): MetadataRoute.Sitemap {
  // A single build timestamp rather than a per-page date.
  //
  // Every page here is generated from data that changes daily, so a
  // deploy IS the moment the content last changed -- there is no
  // per-page edit history to draw a truer date from. Claiming a more
  // precise lastModified than the site can actually justify is the kind
  // of small untruth crawlers learn to discount.
  const lastModified = new Date();

  return SITE_ROUTES.map((r) => ({
    // "/" would produce a trailing slash the other entries do not have.
    url: r.path === "/" ? SITE_URL : `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
