import { expect, test } from "@playwright/test";

const MONDAY_9AM = new Date(2026, 8, 21, 9, 0, 0);

test.describe("desk break timer", () => {
  test("counts down the chosen interval, then offers a free reset", async ({ page }) => {
    await page.clock.install({ time: MONDAY_9AM });
    await page.goto("/desk-break-timer");
    await page.getByRole("button", { name: "20 min" }).click();
    await page.getByRole("button", { name: "Start timer" }).click();
    await page.clock.runFor(60_000);
    await expect(page.getByText("19:00", { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/until your break/);

    await page.clock.runFor(19 * 60_000);
    await expect(page.getByText("Time for a break.")).toBeVisible();
    const reset = page.getByRole("link", { name: "Start a guided 3-minute reset" });
    await expect(reset).toHaveAttribute("href", /\/app\/start\?.*need=general.*minutes=3/);
  });

  test("survives a reload mid-interval", async ({ page }) => {
    await page.clock.install({ time: MONDAY_9AM });
    await page.goto("/desk-break-timer");
    await page.getByRole("button", { name: "30 min" }).click();
    await page.getByRole("button", { name: "Start timer" }).click();
    await page.clock.runFor(10 * 60_000);
    await page.reload();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByText(/^(20:00|19:5\d)$/)).toBeVisible();
  });

  test("snooze starts a five-minute timer", async ({ page }) => {
    await page.clock.install({ time: MONDAY_9AM });
    await page.goto("/desk-break-timer");
    await page.getByRole("button", { name: "20 min" }).click();
    await page.getByRole("button", { name: "Start timer" }).click();
    await page.clock.runFor(20 * 60_000 + 2_000);
    await page.getByRole("button", { name: "Snooze 5 minutes" }).click();
    await expect(page.getByText(/^(5:00|4:5\d)$/)).toBeVisible();
  });
});
