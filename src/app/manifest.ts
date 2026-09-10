import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DeskBreak",
    short_name: "DeskBreak",
    description:
      "Tiny guided movement breaks for stiff necks, tight backs, tired shoulders, and desk-brain.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
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
