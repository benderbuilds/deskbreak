import { expect, test } from "@playwright/test";
import { clearAppState, completeReset } from "./helpers";

test.describe("first visit", () => {
  test("a stranger reaches movement in one tap and is asked how they feel afterwards", async ({
    page,
  }) => {
    await clearAppState(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /sitting all day\? do this/i })).toBeVisible();
    await expect(page.getByText("3-Minute Desk Reset")).toBeVisible();

    // One button, no questions, no account.
    await page.getByRole("button", { name: /^start my reset$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/workout\//);
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^pause$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /doesn.t feel right/i })).toBeVisible();

    await completeReset(page);

    // How do you feel? Then, first time only, where desk work lands. Then save.
    await expect(page.getByRole("heading", { name: /nice\./i })).toBeVisible();
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
    await page.getByRole("button", { name: /wrists \+ hands/i }).click();
    await expect(page).toHaveURL(/\/app\/workout\/.*need=wrists_hands/);
  });

  test("the marketing page renders without client state", async ({ page }) => {
    const response = await page.request.get("/");
    const html = await response.text();
    expect(html).toContain("Sitting all day? Do this.");
    expect(html).toContain("3-Minute Desk Reset");
  });

  test("today offers targeted resets and a way to change the length", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app");
    await expect(page.getByRole("button", { name: /^start reset$/i })).toBeVisible();
    await page.getByRole("button", { name: /^neck \+ shoulders$/i }).click();
    await expect(page.getByRole("heading", { name: /neck \+ shoulders reset/i })).toBeVisible();

    await page.getByRole("button", { name: /^change$/i }).click();
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
