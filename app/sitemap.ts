import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

const ROUTES = [
  { path: "", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/trends", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/compare", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/gulf-watch", priority: 0.7, changeFrequency: "daily" as const },
  { path: "/learn", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/sources", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
