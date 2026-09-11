import type { MetadataRoute } from "next";

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
      { name: "Start my Desk Reset", url: "/app/start?source=landing", description: "3-minute Desk Reset" },
      { name: "Quick 2-minute reset", url: "/app/start?minutes=2&source=landing" },
    ],
    background_color: "#F7F4EF",
    theme_color: "#FF5A36",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
