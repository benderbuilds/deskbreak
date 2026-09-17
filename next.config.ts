import type { NextConfig } from "next";

const nextConfig = {
  agentRules: false,
  async redirects() {
    // V2 routes, kept alive for bookmarks and old reminder emails.
    return [
      { source: "/app/library", destination: "/app/explore", permanent: true },
      { source: "/app/settings", destination: "/app/you", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
} as NextConfig;

export default nextConfig;
