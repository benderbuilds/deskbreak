import { expect, test } from "@playwright/test";
import { appAlert, clearAppState, completeReset, grantPro } from "./helpers";

test.describe("workday plan", () => {
  test("is gated behind Pro for free users", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/plan");
    await expect(
      page.getByRole("heading", { name: /workday plans are part of pro/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: /see pro/i }).click();
    await expect(page).toHaveURL(/\/app\/pro/);
  });

  test("a Pro user can build a schedule and see it on Home", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);

    await page.goto("/app/plan");
    await page.getByLabel(/^start$/i).fill("09:00");
    await page.getByLabel(/^finish$/i).fill("17:00");
    await page.getByRole("button", { name: /balanced/i }).click();
    await page.getByRole("button", { name: /^neck$/i }).click();
    await page.getByRole("button", { name: /create schedule/i }).click();

    await expect(page.getByRole("heading", { name: /today's plan/i })).toBeVisible();
    // Balanced is three breaks, evenly spread inside the working window.
    await expect(page.getByRole("button", { name: /start now/i })).toHaveCount(3);

    await page.goto("/app");
    await expect(page.getByText(/today's deskbreaks/i)).toBeVisible();
    await expect(page.getByText(/0 of 3 done/i)).toBeVisible();
  });

  test("rejects a workday that is too short to plan around", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/plan");
    await page.getByLabel(/^start$/i).fill("09:00");
    await page.getByLabel(/^finish$/i).fill("10:00");
    await page.getByRole("button", { name: /create schedule/i }).click();
    await expect(appAlert(page)).toContainText(/two hours/i);
  });
});

test.describe("progress", () => {
  test("starts empty and fills in after a reset", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/progress");
    await expect(page.getByText(/nothing here yet/i)).toBeVisible();

    await page.goto("/app");
    await page.getByRole("button", { name: /^start$/i }).click();
    await completeReset(page);

    await page.goto("/app/progress");
    await expect(page.getByText(/this week/i)).toBeVisible();
    await expect(page.getByText(/consistency/i)).toBeVisible();
  });
});

test.describe("7-day desk reset", () => {
  test("takes a baseline before it starts counting days", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/challenge");
    await expect(
      page.getByRole("heading", { name: /try the 7-day desk reset/i }),
    ).toBeVisible();

    // The start button stays disabled until the baseline question is answered.
    const start = page.getByRole("button", { name: /start day 1/i });
    await expect(start).toBeDisabled();
    await page.getByRole("button", { name: /^stiff$/i }).click();
    await expect(start).toBeEnabled();

    await start.click();
    await expect(page.getByRole("heading", { name: /day 1 of 7/i })).toBeVisible();
  });
});

test.describe("legal and support", () => {
  for (const path of ["/privacy", "/terms", "/support"]) {
    test(`${path} is reachable and server-rendered`, async ({ page }) => {
      const response = await page.request.get(path);
      expect(response.status()).toBe(200);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("the movement disclaimer appears on public pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/isn't medical care/i)).toBeVisible();
  });
});

test.describe("seo pages hand off into the product", () => {
  test("a neck page starts a neck reset", async ({ page }) => {
    await page.goto("/desk-exercises/neck");
    await expect(
      page.getByRole("heading", { name: /5 tiny neck resets/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /start the 2-minute reset/i })
      .first()
      .click();
    await expect(page).toHaveURL(/need=neck_shoulders/);
  });

  test("the app itself is kept out of the index", async ({ page }) => {
    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /app/");
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/desk-exercises/neck");
    expect(sitemap).not.toContain("/app/");
  });
});
