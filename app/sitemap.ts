import type { MetadataRoute } from "next";

const SITE_URL = "https://mmai-app.vercel.app";

const ROUTES = [
  { path: "", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/trends", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/compare", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/learn", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/sources", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
