import { expect, test } from "@playwright/test";
import { appAlert, clearAppState, completeReset, grantPro, revokePro } from "./helpers";

test.describe("free user", () => {
  test("can do a free reset and hits the paywall on a locked routine", async ({
    page,
  }) => {
    await clearAppState(page);
    await page.goto("/app");

    await expect(page.getByText(/recommended now/i)).toBeVisible();
    await page.getByRole("button", { name: /^start$/i }).click();
    await completeReset(page);

    await page.goto("/app");
    const lockedRoutine = page
      .locator("button", { has: page.getByText("Pro", { exact: true }) })
      .first();
    await lockedRoutine.click();

    await expect(page).toHaveURL(/\/app\/pro/);
    await expect(page.getByText(/\$39/)).toBeVisible();
    await expect(page.getByRole("button", { name: /start deskbreak pro/i })).toBeVisible();
  });

  test("locked routines stay visible rather than hidden", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app");
    await expect(page.getByText("Neck Rescue")).toBeVisible();
    await expect(page.getByText("Lower Back Reset")).toBeVisible();
  });

  test("the paywall never leaks configuration details", async ({ page }) => {
    await clearAppState(page);
    // Make checkout fail the way an unconfigured deploy would.
    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable" }),
      }),
    );

    await page.goto("/app/pro?from=test");
    await page.getByRole("button", { name: /start deskbreak pro/i }).click();

    await expect(appAlert(page)).toContainText(
      /pro checkout is temporarily unavailable/i,
    );
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/STRIPE_|SUPABASE_|PRICE_ID|env/i);
  });

  test("a 503 names the reason for operators but not for customers", async ({
    page,
  }) => {
    await clearAppState(page);
    // Stand in for a deploy with no price id configured.
    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable", reason: "price_not_configured" }),
      }),
    );

    await page.goto("/app/pro");
    await page.getByRole("button", { name: /start deskbreak pro/i }).click();

    // The operator's reason code must never reach the page.
    await expect(appAlert(page)).toContainText(
      /pro checkout is temporarily unavailable/i,
    );
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/price_not_configured|identity_unavailable|provider_rejected/i);
  });

  test("both billing periods are offered with the configured prices", async ({
    page,
  }) => {
    await page.goto("/app/pro");
    await expect(page.getByText("$39")).toBeVisible();
    await page.getByRole("radio", { name: /monthly/i }).click();
    await expect(page.getByText("$5.99")).toBeVisible();
  });
});

test.describe("pro entitlement", () => {
  test("survives a refresh and unlocks Pro routines", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);

    await page.goto("/app");
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toBeVisible();

    // A Pro routine now runs instead of bouncing to the paywall.
    await page.goto("/app/workout/neck-rescue-3min?need=neck_shoulders&setup=seated");
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
    await expect(page).not.toHaveURL(/\/app\/pro/);
  });

  test("ends when the server says the subscription ended", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app");
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toBeVisible();

    // Same browser, same storage: only the server's answer changed.
    await page.unrouteAll();
    await revokePro(page);
    await page.reload();

    await expect(page.getByLabel("DeskBreak Pro subscriber")).toHaveCount(0);
    await page.goto("/app/workout/neck-rescue-3min?need=neck_shoulders&setup=seated");
    await expect(page).toHaveURL(/\/app\/pro/);
  });

  test("can be restored from Settings with the checkout email", async ({ page }) => {
    await clearAppState(page);
    await page.route("**/api/restore", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pro: true,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
          cancelAtPeriodEnd: false,
          email: "paid@work.com",
        }),
      }),
    );

    await page.goto("/app/settings");
    await page.getByLabel(/checkout email/i).fill("paid@work.com");
    await page.getByRole("button", { name: /^restore pro$/i }).click();

    await expect(page.getByRole("status")).toContainText(/pro restored/i);
  });
});
