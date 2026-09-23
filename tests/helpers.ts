import { expect, type Page } from "@playwright/test";

/**
 * Clicks through every move of the active reset.
 *
 * Pressing the Next control rather than waiting out the timers keeps the suite
 * fast without faking anything: it is the same code path a user takes when
 * they finish a move early.
 */
export async function completeReset(page: Page): Promise<void> {
  const next = page.getByRole("button", { name: /^(next move|finish)$/i });
  await expect(next).toBeVisible();

  // Generous cap: the longest routine is 13 moves, and per-side holds split
  // into two steps each.
  for (let i = 0; i < 40; i += 1) {
    if (page.url().includes("/app/done")) break;
    const visible = await next.isVisible().catch(() => false);
    if (!visible) break;
    await next.click();
    await page.waitForTimeout(120);
  }

  await page.waitForURL(/\/app\/done/, { timeout: 20_000 });
}

/**
 * Puts the browser in a known state: fresh visitor, no stored preferences.
 *
 * The one-time safety screen is marked as seen unless `firstRun` is set, so
 * tests about other flows start on the first move. Tests of the first visit
 * itself pass `{ firstRun: true }`.
 */
export async function clearAppState(page: Page, options: { firstRun?: boolean } = {}): Promise<void> {
  await page.goto("/");
  await page.evaluate((firstRun) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (!firstRun) window.localStorage.setItem("deskbreak.safetyNote.v1", "1");
  }, Boolean(options.firstRun));
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
    options.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
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
        currentPeriodEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      }),
    }),
  );
}

/**
 * Answers the one question Done asks, landing on the summary.
 *
 * Nothing else is clicked. The summary's other offers are optional, and a
 * blind "Not now" here used to dismiss whichever one happened to render
 * first, which quietly changed the state a test then asserted on.
 */
export async function finishDoneFlow(page: Page): Promise<void> {
  const feel = page.getByRole("button", { name: /^better$/i });
  if (await feel.isVisible().catch(() => false)) await feel.click();
  await expect(page.getByRole("button", { name: /back to today/i })).toBeVisible();
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

/**
 * Records the events the app sends, without sending any.
 *
 * `track()` hands events to `window.posthog` when it is there, so a stub
 * standing in for it exercises the real call path. Analytics stay off in the
 * test build, so nothing leaves the browser either way.
 */
export async function captureEvents(page: Page): Promise<() => Promise<string[]>> {
  // Kept in sessionStorage, not a variable: the events of interest span a
  // reload, and an init script starts over on every navigation.
  await page.addInitScript(() => {
    const KEY = "__deskbreak_test_events";
    window.posthog = {
      capture: (event: string) => {
        const seen = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]") as string[];
        seen.push(event);
        window.sessionStorage.setItem(KEY, JSON.stringify(seen));
      },
      identify: () => {},
      register: () => {},
    };
  });
  return () =>
    page.evaluate(
      () => JSON.parse(window.sessionStorage.getItem("__deskbreak_test_events") ?? "[]") as string[],
    );
}
