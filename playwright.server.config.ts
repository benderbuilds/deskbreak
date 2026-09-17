import { defineConfig } from "@playwright/test";

/**
 * Server-side unit tests.
 *
 * These import the route handlers' building blocks directly (auth, deliveries,
 * scheduler decisions, the in-memory store) and run them in Node with no
 * browser and no web server. `tests/server/setup.ts` stands in for the two
 * Next-only modules those files import.
 */
export default defineConfig({
  testDir: "./tests/server",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  projects: [{ name: "server" }],
});
