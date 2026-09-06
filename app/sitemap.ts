import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { SITE_ROUTES } from "@/lib/routes";

/** Reads the one route list rather than keeping a second copy of it.
 *  The copy is how /stablecoins ended up linked from every page in the
 *  navigation and absent from the sitemap for as long as it existed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_ROUTES.map((r) => ({
    // "/" would produce a trailing slash the other entries do not have.
    url: r.path === "/" ? SITE_URL : `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
