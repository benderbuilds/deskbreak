import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT) || 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Smoke tests run against a production build.
 *
 * Mobile viewport by default: that is the primary design target, and a flow that
 * only works at desktop width is a flow that does not work.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      // Deterministic prices so assertions do not depend on a deploy's env.
      NEXT_PUBLIC_PRO_MONTHLY_PRICE: "5.99",
      NEXT_PUBLIC_PRO_ANNUAL_PRICE: "39",
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
