import { expect, test } from "@playwright/test";
import { appAlert, clearAppState } from "./helpers";

/**
 * Checkout, end to end, without a live Stripe account.
 *
 * The parts that can be exercised for real are: the checkout call carries the
 * right period and identity, the return leg reads entitlement from the server,
 * and Pro then survives a reload. The Stripe-hosted page itself is Stripe's.
 *
 * Point STRIPE_TEST_MODE at a test-mode key to run the live variant instead.
 */
test.describe("checkout", () => {
  test("sends the selected period and lands on the Stripe URL", async ({ page }) => {
    await clearAppState(page);

    let requestBody: Record<string, unknown> = {};
    await page.route("**/api/checkout", async (route) => {
      requestBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "/app/welcome?session_id=cs_test_123",
          userId: "user_1",
        }),
      });
    });

    // The return leg: this is what the webhook will have written.
    await page.route("**/api/entitlement**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pro: true,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          cancelAtPeriodEnd: false,
          email: "buyer@work.com",
        }),
      }),
    );

    await page.goto("/app/pro?from=done&need=neck_shoulders");
    await page.getByRole("radio", { name: /monthly/i }).click();
    await page.getByRole("button", { name: /start deskbreak pro/i }).click();

    await page.waitForURL(/\/app\/welcome/);
    expect(requestBody).toMatchObject({
      period: "monthly",
      primaryNeed: "neck_shoulders",
      paywallSource: "done",
    });
    expect(requestBody.anonymousId).toBeTruthy();

    await expect(page.getByRole("heading", { name: /you're in/i })).toBeVisible();

    // Refresh: still Pro, because the server said so, not local storage.
    await page.goto("/app");
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toBeVisible();
  });

  test("a failed checkout keeps the free product working", async ({ page }) => {
    await clearAppState(page);
    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable" }),
      }),
    );

    await page.goto("/app/pro");
    await page.getByRole("button", { name: /start deskbreak pro/i }).click();
    await expect(appAlert(page)).toBeVisible();

    await page.getByRole("button", { name: /keep using deskbreak free/i }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(/recommended now/i)).toBeVisible();
  });
});
