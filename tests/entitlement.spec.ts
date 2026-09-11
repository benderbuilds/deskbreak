import { expect, test } from "@playwright/test";
import { appAlert, clearAppState, completeReset, finishDoneFlow, grantPro, revokePro } from "./helpers";

test.describe("free user", () => {
  test("can do the daily reset and hits the paywall on a Pro routine", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app");

    await expect(page.getByText(/recommended now/i)).toBeVisible();
    await page.getByRole("button", { name: /^start reset$/i }).click();
    await completeReset(page);
    await finishDoneFlow(page);

    await page.goto("/app/explore");
    const lockedRoutine = page.locator("button", { has: page.getByText("Pro", { exact: true }) }).first();
    await lockedRoutine.click();

    await expect(page).toHaveURL(/\/app\/pro/);
    await expect(page.getByText(/\$39/)).toBeVisible();
    await expect(page.getByRole("button", { name: /build my workday/i })).toBeVisible();
  });

  test("locked routines stay visible rather than hidden", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/explore");
    await expect(page.getByText("Neck Rescue", { exact: true })).toBeVisible();
    await expect(page.getByText("5-Minute Deeper Reset")).toBeVisible();
  });

  test("the paywall never leaks configuration details", async ({ page }) => {
    await clearAppState(page);
    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable" }),
      }),
    );

    await page.goto("/app/pro?from=test");
    await page.getByRole("button", { name: /build my workday/i }).click();

    await expect(appAlert(page)).toContainText(/pro checkout is temporarily unavailable/i);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/STRIPE_|SUPABASE_|PRICE_ID|env/i);
  });

  test("a 503 names the reason for operators but not for customers", async ({ page }) => {
    await clearAppState(page);
    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable", reason: "price_not_configured" }),
      }),
    );

    await page.goto("/app/pro");
    await page.getByRole("button", { name: /build my workday/i }).click();

    await expect(appAlert(page)).toContainText(/pro checkout is temporarily unavailable/i);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/price_not_configured|identity_unavailable|provider_rejected/i);
  });

  test("both billing periods are offered with the configured prices", async ({ page }) => {
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

    await page.goto("/app/workout/neck-rescue-3min?need=neck_shoulders&setup=seated");
    await expect(page.getByText(/1 of \d+/)).toBeVisible();
    await expect(page).not.toHaveURL(/\/app\/pro/);
  });

  test("ends when the server says the subscription ended", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app");
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toBeVisible();

    await page.unrouteAll();
    await revokePro(page);
    await page.reload();

    await expect(page.getByLabel("DeskBreak Pro subscriber")).toHaveCount(0);
    await page.goto("/app/workout/neck-rescue-3min?need=neck_shoulders&setup=seated");
    await expect(page).toHaveURL(/\/app\/pro/);
  });

  test("restoring Pro from You sends a sign-in link instead of trusting the address", async ({ page }) => {
    await clearAppState(page);
    let restoreBody: Record<string, unknown> | null = null;
    await page.route("**/api/auth/magic-link", async (route) => {
      restoreBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, delivered: true, minutes: 30 }),
      });
    });
    // The typed address alone must never produce an entitlement.
    const entitlementQueries: string[] = [];
    await page.route("**/api/entitlement**", (route) => {
      entitlementQueries.push(route.request().url());
      return route.continue();
    });

    await page.goto("/app/you");
    await page.getByLabel(/email address/i).fill("paid@work.com");
    await page.getByRole("button", { name: /^restore pro$/i }).click();

    await expect(page.getByRole("status")).toContainText(/sign-in link/i);
    expect(restoreBody).toMatchObject({ email: "paid@work.com", next: "/app/you?restored=1" });
    expect(entitlementQueries.every((url) => !url.includes("email="))).toBe(true);
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toHaveCount(0);
  });

  test("a signed-out Pro device is told to sign in to manage billing, never a support address", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/you");
    await expect(page.getByText(/sign in above with the email you used at checkout/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /manage subscription/i })).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/mailto/);
  });

  test("a signed-in Pro user sees Manage subscription instead of a support address", async ({ page }) => {
    await clearAppState(page);
    // Sign in through the real link flow; the server hands the link back
    // because the test server runs with AUTH_DEV_LINKS=1.
    const response = await page.request.post("/api/auth/magic-link", {
      data: { email: `pro-${Date.now()}@example.com`, next: "/app/you" },
    });
    const { devLink } = (await response.json()) as { devLink?: string };
    expect(devLink).toBeTruthy();
    await page.goto(devLink as string);
    await grantPro(page);
    await page.goto("/app/you");
    await expect(page.getByRole("button", { name: /manage subscription/i })).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/mailto/);
  });
});
