import type { NextConfig } from "next";

const nextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
} as NextConfig;

export default nextConfig;
