import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(
  /\/$/,
  "",
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // The app itself is personal state, not search results.
      { userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
