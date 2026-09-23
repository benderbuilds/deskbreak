import { expect, test } from "@playwright/test";
import { captureEvents, clearAppState, completeReset } from "./helpers";

test.describe("free entry", () => {
  test("the free three-minute promise and its button are in the first phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /sit all day\? take three minutes/i })).toBeVisible();
    await expect(page.getByText(/3 minutes\. no signup\. no equipment\./i).first()).toBeVisible();

    const cta = page.getByRole("link", { name: /^start my free reset$/i }).first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    // Visible without scrolling, at the default text size.
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);

    // Nothing runs off the side at the narrowest phone we support.
    await page.setViewportSize({ width: 320, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("every generic free CTA asks for three minutes", async ({ page }) => {
    await page.goto("/");
    const generic = page.locator('a[href*="/app/start"]').filter({ hasText: /start (my )?free/i });
    const count = await generic.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i += 1) {
      expect(await generic.nth(i).getAttribute("href")).toContain("minutes=3");
    }
  });

  test("the focus shortcuts keep their need and still ask for three minutes", async ({ page }) => {
    await page.goto("/");
    const neck = page.getByRole("link", { name: /neck \+ shoulders/i }).first();
    const href = await neck.getAttribute("href");
    expect(href).toContain("need=neck_shoulders");
    expect(href).toContain("minutes=3");
  });

  test("the phone start bar appears past the hero and steps aside at the closing CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bar = page.getByRole("complementary", { name: /start a free reset/i });

    // Hidden while the hero's own button is on screen.
    await expect(bar).toBeHidden();

    await page.getByRole("heading", { name: /how it works/i }).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(bar).toBeVisible();
    expect(await bar.getByRole("link").first().getAttribute("href")).toContain("minutes=3");

    // The closing CTA does the same job, so the bar gets out of its way.
    await page
      .getByRole("region", { name: /your next three minutes/i })
      .getByRole("link")
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(bar).toBeHidden();
  });

  test("an intent page's start bar keeps that page's reset", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/neck-shoulder-exercises");
    // Past the page's own start card, where the bar earns its place.
    await page.evaluate(() => window.scrollTo(0, 1600));
    const bar = page.getByRole("complementary", { name: /start a free reset/i });
    await expect(bar).toBeVisible();
    const href = await bar.getByRole("link").first().getAttribute("href");
    expect(href).toContain("need=neck_shoulders");
    expect(href).toContain("source=seo");
  });

  test("the preview can be paused and never starts a real reset", async ({ page }) => {
    const events = await captureEvents(page);
    await clearAppState(page);
    await page.goto("/");

    const pause = page.getByRole("button", { name: /^pause preview$/i });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(page.getByRole("button", { name: /^play preview$/i })).toBeVisible();

    // Stepping through the preview is not a workout.
    await page.getByRole("button", { name: /^next move in preview$/i }).click();
    const seen = await events();
    expect(seen).not.toContain("reset_started");
    expect(seen).not.toContain("recommendation_started");
    expect(seen).not.toContain("reset_completed");
    const state = await page.evaluate(() => window.localStorage.getItem("deskbreak.app.v2"));
    expect(state ?? "").not.toContain("lastWorkout\":{");
  });
});

test.describe("first visit", () => {
  test("a stranger reaches movement in one tap and is asked how they feel afterwards", async ({
    page,
  }) => {
    await clearAppState(page, { firstRun: true });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /sit all day\? take three minutes/i })).toBeVisible();
    await expect(page.getByText("3-minute Desk Reset").first()).toBeVisible();

    // One button, no account. The first time only, one safety screen whose
    // questions are optional: starting is still a single tap.
    await page.getByRole("link", { name: /^start my free reset$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/workout\//);
    await expect(page.getByRole("heading", { name: /before you start/i })).toBeVisible();
    await expect(page.getByText(/stop if it's sharp/i)).toBeVisible();
    await page.getByRole("button", { name: /^start my reset$/i }).click();
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^pause$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /doesn.t feel right/i })).toBeVisible();

    await completeReset(page);

    // How do you feel? Then, first time only, where desk work lands. Then save.
    // Honest time: clicking through takes seconds, and the headline says so.
    await expect(page.getByRole("heading", { name: /short one|nice\./i })).toBeVisible();
    await expect(page.getByText(/your answer tunes the next reset/i)).toBeVisible();
    await expect(page.getByText(/how do you feel/i)).toBeVisible();
    await page.getByRole("button", { name: /^better$/i }).click();
    await expect(page.getByText(/we'll use that to make your next reset better/i)).toBeVisible();

    await expect(page.getByText(/where do you usually feel desk work/i)).toBeVisible();
    await page.getByRole("button", { name: /^back \+ hips$/i }).click();

    await expect(page.getByRole("heading", { name: /remember what works for you/i })).toBeVisible();
    await page.getByRole("button", { name: /^not now$/i }).click();

    await expect(page.getByRole("button", { name: /back to today/i })).toBeVisible();
    await page.getByRole("button", { name: /back to today/i }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(/recommended now/i)).toBeVisible();
    await expect(page.getByText(/1 reset/)).toBeVisible();
  });

  test("a landing shortcut jumps straight into that need", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/");
    await page.getByRole("link", { name: /wrists \+ hands/i }).click();
    await expect(page).toHaveURL(/\/app\/workout\/.*need=wrists_hands/);
  });

  test("the marketing page renders without client state", async ({ page }) => {
    const response = await page.request.get("/");
    const html = await response.text();
    expect(html).toContain("Sit all day? Take three minutes.");
    expect(html).toContain("3-minute Desk Reset");
    expect(html).toContain("/app/start?minutes=3&amp;source=landing");
  });

  test("today offers targeted resets and a way to change the length", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app");
    await expect(page.getByRole("button", { name: /^start reset$/i })).toBeVisible();
    await page.getByRole("button", { name: /^neck \+ shoulders$/i }).click();
    await expect(page.getByRole("heading", { name: /neck \+ shoulders reset/i })).toBeVisible();

    await page.getByRole("button", { name: /^change routine$/i }).click();
    await page.getByRole("button", { name: /quick 2 min/i }).click();
    await expect(page.getByText(/2 minutes ·/)).toBeVisible();

    // Deeper is Pro; asking for it shows the offer rather than a locked screen.
    await page.getByRole("button", { name: /deeper 5 min/i }).click();
    await expect(page).toHaveURL(/\/app\/pro/);
  });

  test("swap and doesn't-feel-right replace the move without stopping the reset", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/start?need=general&minutes=3&source=landing");
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
    const before = await page.getByRole("heading", { level: 1 }).innerText();

    await page.getByRole("button", { name: /doesn.t feel right/i }).click();
    await expect(page.getByRole("dialog")).toContainText(/let's switch it/i);
    await page.getByRole("button", { name: /^awkward at my desk$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    const after = await page.getByRole("heading", { level: 1 }).innerText();
    expect(after).not.toBe(before);
    await expect(page.getByText(/1 of \d+/)).toBeVisible();

    await page.getByRole("button", { name: /^swap$/i }).click();
    await expect(page.getByRole("dialog")).toContainText(/swap this move/i);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
