import { expect, test } from "@playwright/test";
import { completeReset } from "./helpers";

test.describe("first visit", () => {
  test("a stranger can start a reset without an account", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /your neck shouldn't pay rent/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /start a free 2-minute reset/i })
      .first()
      .click();

    // One question, then the reset. No account, no setup wizard.
    await expect(
      page.getByRole("heading", { name: /what needs attention right now/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /neck \+ shoulders/i }).click();

    const standingQuestion = page.getByRole("heading", {
      name: /can you stand right now/i,
    });
    if (await standingQuestion.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /keep me seated/i }).click();
    }

    await expect(page).toHaveURL(/\/app\/workout\//);
    await expect(page.getByText(/1 of \d+/)).toBeVisible();

    await completeReset(page);

    // Feedback, then email, then the offer.
    await expect(page.getByRole("heading", { name: /nice\./i })).toBeVisible();
    await expect(page.getByText(/did that help/i)).toBeVisible();
    await page.getByRole("button", { name: /yep, i feel better/i }).click();

    await expect(
      page.getByRole("heading", { name: /want tomorrow's deskbreak/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^not now$/i }).click();

    await page.getByRole("button", { name: /keep going/i }).click();
    await expect(page).toHaveURL(/\/app\/pro/);
    await expect(page.getByRole("heading", { name: /your neck liked that/i })).toBeVisible();
  });

  test("a landing card jumps straight into that need", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /wrists \+ hands/i }).click();
    await expect(page).toHaveURL(/need=wrists_hands/);
    await expect(page).toHaveURL(/\/app\/(start|workout)/);
  });

  test("the marketing page renders without client state", async ({ page }) => {
    // No localStorage, JS still loading: the hero must already be there.
    const response = await page.request.get("/");
    const html = await response.text();
    expect(html).toContain("Your neck shouldn&#x27;t pay rent for a laptop.");
  });
});
