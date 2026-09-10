import type { MetadataRoute } from "next";
import { AREA_PAGES, GUIDE_PAGES } from "@/lib/seo-content";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(
  /\/$/,
  "",
);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, priority: 1 },
    { url: `${BASE}/desk-exercises`, lastModified: now, priority: 0.8 },
    ...AREA_PAGES.map((page) => ({
      url: `${BASE}/desk-exercises/${page.slug}`,
      lastModified: now,
      priority: 0.7,
    })),
    ...GUIDE_PAGES.map((page) => ({
      url: `${BASE}/guides/${page.slug}`,
      lastModified: now,
      priority: 0.6,
    })),
    { url: `${BASE}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${BASE}/terms`, lastModified: now, priority: 0.2 },
    { url: `${BASE}/support`, lastModified: now, priority: 0.3 },
  ];
}
