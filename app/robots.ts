import type { MetadataRoute } from "next";

// Mainly here to keep crawlers out of /api/ (there's nothing useful for them
// there, and /api/refresh shouldn't be probed) and to point them at the
// sitemap. For a six-page site with full navigation, neither file is load-
// bearing for discovery -- Google finds these pages by following links.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://mmai-app.vercel.app/sitemap.xml",
  };
}
