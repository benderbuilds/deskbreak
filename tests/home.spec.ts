import { expect, test } from "@playwright/test";
import { dailyReminderDecision } from "../src/lib/daily-reminder";
import { clearAppState, grantPro } from "./helpers";

/** A Monday morning, inside default working hours, in the browser's own time zone. */
const MONDAY_9AM = new Date(2026, 8, 21, 9, 0, 0);

test.describe("analytics", () => {
  test("a test run never loads the live measurement tag", async ({ page }) => {
    const analytics: string[] = [];
    page.on("request", (request) => {
      if (/googletagmanager\.com|google-analytics\.com|i\.posthog\.com/.test(request.url())) {
        analytics.push(request.url());
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(analytics).toEqual([]);
    expect(await page.content()).not.toContain("googletagmanager");
  });
});

test.describe("today", () => {
  test("posture is a target, and Change routine sets focus without doubling the title", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app");
    await page.getByRole("button", { name: /^posture reset$/i }).click();
    await expect(page.getByRole("heading", { name: /^posture reset$/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/reset reset/i);

    await page.getByRole("button", { name: /^change routine$/i }).click();
    await page.getByRole("button", { name: /^full body$/i }).click();
    await expect(page.getByRole("heading", { name: /your desk reset/i })).toBeVisible();
  });

  test("greets without an email local part", async ({ page }) => {
    await clearAppState(page);
    await page.evaluate(() => {
      const raw = JSON.parse(window.localStorage.getItem("deskbreak.app.v2") ?? "{}");
      window.localStorage.setItem(
        "deskbreak.app.v2",
        JSON.stringify({ ...raw, account: { profileId: null, email: "jesse.bender14@example.com", signedInAt: null, lastSyncedAt: null } }),
      );
    });
    await page.goto("/app");
    await expect(page.getByText(/^good (morning|afternoon|evening)$/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("jesse.bender14");
  });

  test("confirms a sign-in once, then strips the params", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app?saved=1&signed_in=1&merged=1");
    await expect(page.getByRole("status").filter({ hasText: /saved\. 1 reset is now on your account/i })).toBeVisible();
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole("button", { name: /^dismiss$/i }).click();
    await expect(page.getByText(/now on your account/i)).toHaveCount(0);
  });
});

test.describe("explore", () => {
  test("offers posture as a body-area target", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/explore");
    await page.getByRole("button", { name: /^posture reset$/i }).click();
    await expect(page).toHaveURL(/need=posture/);
  });
});

test.describe("workday plan edits", () => {
  test("offers push after the first build, and saves edits only on Save plan", async ({ page }) => {
    await page.clock.setFixedTime(MONDAY_9AM);
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/plan");
    await page.getByLabel(/^start$/i).fill("08:00");
    await page.getByLabel(/^finish$/i).fill("17:00");
    await page.getByRole("button", { name: /build my workday/i }).click();

    await expect(page.getByText(/your workday is set/i)).toBeVisible();
    // Headless Chromium here has no VAPID key, so the card explains instead of offering a dead button.
    await expect(
      page.getByRole("switch", { name: /get these as notifications/i }).or(page.getByText(/aren't available here/i)),
    ).toBeVisible();

    const save = page.getByRole("button", { name: /^save plan$/i });
    await expect(save).toBeDisabled();
    await page.getByRole("button", { name: /^skip$/i }).first().click();
    await expect(page.getByText(/^unsaved changes$/i)).toBeVisible();
    await expect(save).toBeEnabled();

    // Leaving with unsaved edits asks first; dismissing keeps the draft.
    page.once("dialog", (dialog) => void dialog.dismiss());
    await page.getByRole("link", { name: /^today$/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/app\/plan/);

    await save.click();
    await expect(page.getByRole("button", { name: /^saved$/i })).toBeDisabled();
    await page.reload();
    await expect(page.getByText(/^skipped$/i).first()).toBeVisible();
  });
});

test.describe("you", () => {
  test("uses switch rows and a Go easy on section", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/you");
    const sound = page.getByRole("switch", { name: /^sound/i });
    const before = await sound.getAttribute("aria-checked");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");

    const flag = page.getByRole("switch", { name: /dizziness or vertigo/i });
    await expect(flag).toHaveAttribute("aria-checked", "false");
    await flag.click();
    await expect(flag).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/these answers stay on this device/i)).toBeVisible();
    await expect(page.getByRole("switch", { name: /include floor exercises/i })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: /stand-up nudge/i })).toHaveAttribute("aria-checked", "true");
  });

  test("a rate-limited sign-in says when to retry, under the field, with a countdown", async ({ page }) => {
    await clearAppState(page);
    await page.route("**/api/auth/magic-link", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "rate_limited", retryAfterSeconds: 60 }),
      }),
    );
    await page.goto("/app/you");
    await page.getByLabel(/email address/i).fill("me@work.com");
    await page.getByRole("button", { name: /^send sign-in link$/i }).click();
    await expect(page.locator("#you-email-notice")).toContainText(/60 seconds/);
    await expect(page.getByLabel(/email address/i)).toHaveAttribute("aria-describedby", "you-email-notice");
    await expect(page.getByRole("button", { name: /^send again in 0:\d\d$/i })).toBeDisabled();
  });

  test("a Pro user never sees a disabled Turn on for push", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/you");
    await expect(page.getByLabel("DeskBreak Pro subscriber")).toBeVisible();
    await expect(page.getByRole("button", { name: /^turn on$/i })).toHaveCount(0);
  });
});

test.describe("you on an iPhone browser tab", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });

  test("shows the Add to Home Screen step for push", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/you");
    await expect(page.getByText(/add deskbreak to your home screen first/i)).toBeVisible();
    await expect(page.getByText(/tap add to home screen/i)).toBeVisible();
  });
});

test.describe("pro page", () => {
  test("the paywall names the price on its button and says how checkout works", async ({ page }) => {
    await clearAppState(page);
    await page.goto("/app/pro?need=posture");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/change position/i);
    await expect(page.getByRole("button", { name: /\$39\/year/ })).toBeVisible();
    await expect(page.getByText(/secure checkout with stripe/i)).toBeVisible();
    await expect(page.getByText(/your workday with pro/i)).toBeVisible();
  });

  test("a Pro user gets You're Pro, not the paywall", async ({ page }) => {
    await clearAppState(page);
    await grantPro(page);
    await page.goto("/app/pro");
    await expect(page.getByRole("heading", { name: /you're pro/i })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: /billing period/i })).toHaveCount(0);
  });
});

test.describe("stand-up nudge", () => {
  test("appears after about 50 minutes open in working hours, and I stood up counts", async ({ page }) => {
    await page.clock.install({ time: MONDAY_9AM });
    await clearAppState(page);
    await page.goto("/app");
    // Hydrated, so the runner has started counting from now.
    await expect(page.getByRole("button", { name: /^start reset$/i })).toBeVisible();
    await expect(page.getByText(/time to stand up/i)).toHaveCount(0);

    await page.clock.runFor(51 * 60_000);
    await expect(page.getByText(/time to stand up/i)).toBeVisible();
    await page.getByRole("button", { name: /^i stood up$/i }).click();
    await expect(page.getByText(/time to stand up/i)).toHaveCount(0);

    // Counted as activity in today's list.
    await expect(page.getByText(/^stood up$/i)).toBeVisible();
  });
});

test.describe("daily reminder in the tab", () => {
  const daily = { id: "daily", minutes: 14 * 60 + 30, weekdaysOnly: true, kind: "daily" as const, enabled: true };
  const at = (h: number, m: number, day = 21) => new Date(2026, 8, day, h, m);

  test("fires once a day, at its time, on working days only", () => {
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 29), lastShownDate: null })).toBe("wait");
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 30), lastShownDate: null })).toBe("due");
    expect(dailyReminderDecision({ reminder: daily, now: at(15, 10), lastShownDate: "2026-09-21" })).toBe("wait");
    // Opening DeskBreak in the evening doesn't earn the afternoon nudge.
    expect(dailyReminderDecision({ reminder: daily, now: at(20, 0), lastShownDate: null })).toBe("wait");
    // Saturday, weekdays only.
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 30, 26), lastShownDate: null })).toBe("wait");
    // A Pro plan's own working days win.
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 30, 26), lastShownDate: null, workdays: [6] })).toBe("due");
    expect(dailyReminderDecision({ reminder: { ...daily, enabled: false }, now: at(14, 30), lastShownDate: null })).toBe("wait");
  });

  test("a reset just before the time answers it, and a snooze brings it back", () => {
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 35), lastShownDate: null, lastActiveAt: at(13, 50) })).toBe(
      "answered",
    );
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 35), lastShownDate: null, lastActiveAt: at(12, 0) })).toBe("due");
    expect(dailyReminderDecision({ reminder: daily, now: at(14, 40), lastShownDate: null, snoozedUntil: at(14, 45) })).toBe("wait");
    expect(dailyReminderDecision({ reminder: daily, now: at(16, 50), lastShownDate: null, snoozedUntil: at(16, 45) })).toBe("due");
  });

  test("shows a card in the app at the chosen time when notifications aren't allowed", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 8, 21, 14, 25) });
    await clearAppState(page);
    await page.goto("/app/you");
    await page.getByRole("switch", { name: /daily reminder/i }).click();
    await expect(page.getByRole("switch", { name: /daily reminder/i })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/time for your desk reset/i)).toHaveCount(0);

    await page.clock.runFor(6 * 60_000);
    await expect(page.getByText(/time for your desk reset/i)).toBeVisible();
    await page.getByRole("button", { name: /^in 15 min$/i }).click();
    await expect(page.getByText(/time for your desk reset/i)).toHaveCount(0);

    await page.clock.runFor(16 * 60_000);
    await expect(page.getByText(/time for your desk reset/i)).toBeVisible();
    await page.getByRole("button", { name: /dismiss today's reminder/i }).click();
    await page.clock.runFor(30 * 60_000);
    await expect(page.getByText(/time for your desk reset/i)).toHaveCount(0);
  });
});
