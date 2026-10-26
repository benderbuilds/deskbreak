import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/content/blog";
import { getExercises } from "@/lib/content";
import { AREA_PAGES, GUIDE_PAGES, LANDING_PAGES } from "@/lib/seo-content";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.co").replace(/\/$/, "");

// Only blog posts carry lastModified: they have real revision dates. A build
// timestamp on every page teaches crawlers to ignore the field.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/science`, priority: 0.8 },
    { url: `${BASE}/desk-break-timer`, priority: 0.9 },
    ...LANDING_PAGES.map((page) => ({
      url: `${BASE}/${page.slug}`,
      priority: 0.9,
    })),
    { url: `${BASE}/guides`, priority: 0.7 },
    { url: `${BASE}/moves`, priority: 0.6 },
    { url: `${BASE}/blog`, priority: 0.7 },
    ...BLOG_POSTS.map((post) => ({
      url: `${BASE}/blog/${post.slug}`,
      // A revision date when there is a real one, never the build clock.
      lastModified: new Date(post.updatedAt ?? post.published),
      priority: 0.7,
    })),
    ...AREA_PAGES.map((page) => ({
      url: `${BASE}/desk-exercises/${page.slug}`,
      priority: 0.7,
    })),
    ...GUIDE_PAGES.map((page) => ({
      url: `${BASE}/guides/${page.slug}`,
      priority: 0.6,
    })),
    ...getExercises().map((exercise) => ({
      url: `${BASE}/moves/${exercise.id}`,
      priority: 0.5,
    })),
    { url: `${BASE}/privacy`, priority: 0.2 },
    { url: `${BASE}/terms`, priority: 0.2 },
    { url: `${BASE}/support`, priority: 0.3 },
  ];
}
