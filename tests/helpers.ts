import { expect, type Page } from "@playwright/test";

/**
 * Clicks through every move of the active reset.
 *
 * Pressing Next rather than waiting out the timers keeps the suite fast without
 * faking anything: it is the same code path a user takes when they finish early.
 */
export async function completeReset(page: Page): Promise<void> {
  const next = page.getByRole("button", { name: /^(next|done)$/i });
  await expect(next).toBeVisible();

  // Generous cap: the longest catalog routine is 13 moves, and per-side holds
  // split into two steps each.
  for (let i = 0; i < 40; i += 1) {
    if (page.url().includes("/app/done")) break;
    const visible = await next.isVisible().catch(() => false);
    if (!visible) break;
    await next.click();
    await page.waitForTimeout(120);
  }

  await page.waitForURL(/\/app\/done/, { timeout: 20_000 });
}

/** Puts the browser in a known state: fresh visitor, no stored preferences. */
export async function clearAppState(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

/**
 * Pretends the server has already confirmed a Pro subscription.
 *
 * Only the server can actually grant Pro, so this intercepts the entitlement
 * endpoint rather than writing to local storage: it exercises the same code path
 * a real subscriber hits.
 */
export async function grantPro(
  page: Page,
  options: { status?: string; periodEnd?: string } = {},
): Promise<void> {
  const periodEnd =
    options.periodEnd ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await page.route("**/api/entitlement**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pro: true,
        status: options.status ?? "active",
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      }),
    }),
  );
}

/** The server says the subscription is over. */
export async function revokePro(page: Page): Promise<void> {
  await page.route("**/api/entitlement**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pro: false,
        status: "canceled",
        currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
        cancelAtPeriodEnd: false,
      }),
    }),
  );
}

/**
 * Our own alerts.
 *
 * Next renders an empty `role="alert"` live region for route announcements, so
 * a bare getByRole("alert") matches two things on every page.
 */
export function appAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: /./ });
}
