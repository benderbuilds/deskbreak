import { expect, test } from "@playwright/test";
import { appAlert, clearAppState, completeReset, finishDoneFlow, grantPro } from "./helpers";

test.describe("workday plan", () => {
  test("is gated behind Pro for free users", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/plan");
    await expect(page.getByRole("heading", { name: /let deskbreak manage your workday/i })).toBeVisible();
    await page.getByRole("link", { name: /see pro/i }).click();
    await expect(page).toHaveURL(/\/app\/pro/);
  });

  test("a Pro user picks hours and a help level, never a break count", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);

    await page.goto("/app/plan");
    await expect(page.getByRole("heading", { name: /when do you normally work/i })).toBeVisible();
    await page.getByLabel(/^start$/i).fill("09:00");
    await page.getByLabel(/^finish$/i).fill("17:00");
    await page.getByRole("button", { name: /^balanced/i }).click();
    await page.getByRole("button", { name: /build my workday/i }).click();

    await expect(page.getByRole("heading", { name: /today's plan/i })).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\d+ breaks/i);

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /^today$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /change plan/i })).toBeVisible();
  });

  test("rejects a workday that is too short to plan around", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/plan");
    await page.getByLabel(/^start$/i).fill("09:00");
    await page.getByLabel(/^finish$/i).fill("10:00");
    await page.getByRole("button", { name: /build my workday/i }).click();
    await expect(appAlert(page)).toContainText(/two hours/i);
  });
});

test.describe("progress", () => {
  test("starts empty and fills in after a reset", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/progress");
    await expect(page.getByText(/nothing here yet/i)).toBeVisible();

    await page.goto("/app");
    await page.getByRole("button", { name: /^start reset$/i }).click();
    await completeReset(page);
    await finishDoneFlow(page);

    await page.goto("/app/progress");
    await expect(page.getByText(/this week/i)).toBeVisible();
    await expect(page.getByText(/active day/i).first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\bXP\b/);
  });
});

test.describe("5-day desk reset", () => {
  test("takes a baseline on a 1 to 5 scale before it starts counting days", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/challenge");
    await expect(page.getByRole("heading", { name: /try the 5-day desk reset/i })).toBeVisible();

    const start = page.getByRole("button", { name: /start today/i });
    await expect(start).toBeDisabled();
    await page.getByRole("button", { name: /^3\s*stiff$/i }).click();
    await expect(start).toBeEnabled();

    await start.click();
    await expect(page.getByRole("heading", { name: /day 1 of 5/i })).toBeVisible();
  });
});

test.describe("you", () => {
  test("movements to avoid are a setting, not a questionnaire", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/you");
    await expect(page.getByText(/movements to avoid/i)).toBeVisible();
    await page.getByRole("button", { name: /^overhead movements$/i }).click();
    await expect(page.getByRole("button", { name: /^overhead movements$/i })).toHaveAttribute("aria-pressed", "true");

    // The constraint is honoured by the next reset.
    await page.goto("/app/start?need=energy&minutes=3&setup=standing&source=landing");
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
    for (let i = 0; i < 12; i += 1) {
      if (page.url().includes("/app/done")) break;
      const title = await page.getByRole("heading", { level: 1 }).innerText();
      expect(title).not.toMatch(/overhead reach/i);
      const next = page.getByRole("button", { name: /^(next move|finish)$/i });
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(80);
    }
  });
});

test.describe("legal and support", () => {
  for (const path of ["/privacy", "/terms", "/support", "/science"]) {
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

  test("the science page never claims a review that has not happened", async ({ page }) => {
    const html = await (await page.request.get("/science")).text();
    expect(html).not.toMatch(/clinically proven|reverse the damage|fix your posture|treat neck pain/i);
  });
});

test.describe("seo pages hand off into the product", () => {
  test("an intent page starts the matching reset, with structured data", async ({ page }) => {
    const html = await (await page.request.get("/neck-shoulder-exercises")).text();
    expect(html).toContain("application/ld+json");
    expect(html).toContain("Neck and Shoulder Exercises for Desk Workers");

    await page.goto("/neck-shoulder-exercises");
    await page.getByRole("button", { name: /start the 3-minute neck \+ shoulder reset/i }).first().click();
    await expect(page).toHaveURL(/\/app\/workout\/.*need=neck_shoulders/);
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
  });

  test("older area pages still work", async ({ page }) => {
    await page.goto("/desk-exercises/neck");
    await expect(page.getByRole("heading", { name: /5 tiny neck resets/i })).toBeVisible();
    await page.getByRole("button", { name: /start the 3-minute reset/i }).first().click();
    await expect(page).toHaveURL(/need=neck_shoulders/);
  });

  test("a movement has a public page and an in-app page", async ({ page }) => {
    const response = await page.request.get("/moves/chin-tuck");
    expect(response.status()).toBe(200);
    await page.goto("/moves/chin-tuck");
    await expect(page.getByRole("heading", { name: /chin tuck/i })).toBeVisible();
    await expect(page.getByText(/why deskbreak uses it/i)).toBeVisible();
    await expect(page.getByText(/avoid this movement if/i)).toBeVisible();
    expect((await page.request.get("/moves/not-a-move")).status()).toBe(404);
  });

  test("the app itself is kept out of the index", async ({ page }) => {
    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /app/");
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/desk-exercises");
    expect(sitemap).toContain("/office-workout");
    expect(sitemap).toContain("/science");
    expect(sitemap).toContain("/moves/chin-tuck");
    expect(sitemap).not.toContain("/app/");
  });

  test("renamed app routes redirect", async ({ page }) => {
    await page.goto("/app/library");
    await expect(page).toHaveURL(/\/app\/explore/);
    await page.goto("/app/settings");
    await expect(page).toHaveURL(/\/app\/you/);
  });
});

test.describe("offline", () => {
  test("the service worker and offline page are served", async ({ page }) => {
    const sw = await page.request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(await sw.text()).toContain("notificationclick");
    expect((await page.request.get("/offline")).status()).toBe(200);
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
  });
});
