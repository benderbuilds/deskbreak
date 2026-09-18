import type { NextConfig } from "next";
import { EXERCISE_ALIASES } from "./src/lib/exercise-aliases";

const nextConfig = {
  agentRules: false,
  async redirects() {
    // V2 routes, kept alive for bookmarks and old reminder emails.
    return [
      { source: "/app/library", destination: "/app/explore", permanent: true },
      { source: "/app/settings", destination: "/app/you", permanent: true },
      // Merged or renamed moves: old links keep working.
      ...Object.entries(EXERCISE_ALIASES).flatMap(([from, to]) => [
        { source: `/moves/${from}`, destination: `/moves/${to}`, permanent: true },
        { source: `/app/explore/move/${from}`, destination: `/app/explore/move/${to}`, permanent: true },
      ]),
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
