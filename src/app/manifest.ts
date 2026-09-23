import type { MetadataRoute } from "next";
import { BRAND_MARK_COLOR, BRAND_PAGE_COLOR, brandAsset } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DeskBreak",
    short_name: "DeskBreak",
    description:
      "Short, guided workouts made for computer workers. No equipment. No planning.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    categories: ["health", "productivity", "fitness"],
    shortcuts: [
      {
        name: "Start my free reset",
        url: "/app/start?minutes=3&source=landing",
        description: "3-minute Desk Reset",
      },
      { name: "Quick 2-minute reset", url: "/app/start?minutes=2&source=landing" },
    ],
    background_color: BRAND_PAGE_COLOR,
    theme_color: BRAND_MARK_COLOR,
    icons: [
      {
        src: brandAsset("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandAsset("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandAsset("/icons/icon-512-maskable.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
