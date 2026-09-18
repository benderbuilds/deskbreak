import { expect, test, type Page } from "@playwright/test";
import { clearAppState, completeReset } from "./helpers";

const STOP_RULE = /mild stretch is fine\. stop if it's sharp/i;

async function startReset(page: Page, need = "general") {
  await page.goto(`/app/start?need=${need}&minutes=3&source=landing`);
  await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
}

/** Rates the finished reset and answers whatever else Done asks, landing on the wrap-up. */
async function rateAndWrap(page: Page, rating: RegExp) {
  await page.getByRole("button", { name: rating }).click();
  const focus = page.getByRole("button", { name: /^back \+ hips$/i });
  if (await focus.isVisible().catch(() => false)) await focus.click();
  const save = page.getByRole("heading", { name: /remember what works/i });
  if (await save.isVisible().catch(() => false)) await page.getByRole("button", { name: /^not now$/i }).click();
  await expect(page.getByRole("button", { name: /back to today/i })).toBeVisible();
}

test.describe("safety", () => {
  test("the first reset opens with a skippable safety screen, once", async ({ page }) => {
    await clearAppState(page, { firstRun: true });
    await page.goto("/app/start?need=neck_shoulders&minutes=3&source=landing");
    await expect(page.getByRole("heading", { name: /before you start/i })).toBeVisible();
    await expect(page.getByText(/not medical care/i)).toBeVisible();

    await page.getByRole("checkbox", { name: /neck pain or a recent neck injury/i }).check();
    await expect(page.getByText(/no neck stretches, turns or holds/i)).toBeVisible();
    await page.getByRole("button", { name: /^start my reset$/i }).click();
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();

    const flags = await page.evaluate(() => JSON.parse(localStorage.getItem("deskbreak.app.v2") ?? "{}").safetyFlags);
    expect(flags).toEqual(["neck"]);

    // Never again, even before the first reset is finished.
    await page.goto("/app/start?need=general&minutes=3&source=landing");
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /before you start/i })).toHaveCount(0);
  });

  test("the stop rule is on the workout screen the whole time", async ({ page }) => {
    await clearAppState(page);
    await startReset(page);
    await expect(page.getByText(STOP_RULE)).toBeVisible();
    await page.getByRole("button", { name: /^next move$/i }).click();
    await expect(page.getByText(STOP_RULE)).toBeVisible();
  });

  test("painful gets a clinician line and names the move that was taken out", async ({ page }) => {
    await clearAppState(page);
    await startReset(page, "neck_shoulders");
    const before = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

    await page.getByRole("button", { name: /doesn.t feel right/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${before} is out.`);
    await page.getByRole("button", { name: /^painful$/i }).click();
    await expect(dialog).toContainText(/let's leave that area alone today/i);
    await page.getByRole("button", { name: /^continue$/i }).click();

    const after = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    expect(after).not.toBe(before);
  });

  test("a reset with a painful move ends quietly, with the advice repeated on Done", async ({ page }) => {
    await clearAppState(page);
    await startReset(page, "neck_shoulders");
    await page.getByRole("button", { name: /doesn.t feel right/i }).click();
    await page.getByRole("button", { name: /^painful$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await completeReset(page);

    await expect(page.getByText(/let's leave that area alone today/i)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Done\./);
  });

  test("while paused, only Resume moves the reset on", async ({ page }) => {
    await clearAppState(page);
    await startReset(page);
    await page.getByRole("button", { name: /^pause$/i }).click();
    await expect(page.getByRole("button", { name: /^resume$/i })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^skip$/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^next move$/i })).toBeDisabled();
    await page.getByRole("button", { name: /^resume$/i }).click();
    await expect(page.getByRole("button", { name: /^pause$/i })).toBeVisible();
  });
});

test.describe("done", () => {
  test("the rating is neutral and Worse asks what felt worse, without a celebration", async ({ page }) => {
    await clearAppState(page);
    await startReset(page);
    await completeReset(page);

    await expect(page.getByText(/your answer tunes the next reset/i)).toBeVisible();
    // No option is pre-styled as the answer.
    const classes = await Promise.all(
      [/^worse$/i, /^about the same$/i, /^better$/i].map((name) =>
        page.getByRole("button", { name }).getAttribute("class"),
      ),
    );
    expect(new Set(classes).size).toBe(1);
    // Clicking through takes seconds; the headline never claims three minutes.
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/3 minutes/i);

    await page.getByRole("button", { name: /^worse$/i }).click();
    await expect(page.getByText(/what felt worse\?/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /nice|still counts/i })).toHaveCount(0);
    await page.getByRole("button", { name: /^neck$/i }).click();
    await page.getByRole("button", { name: /^done$/i }).click();

    const worseAreas = await page.evaluate(
      () => JSON.parse(localStorage.getItem("deskbreak.app.v2") ?? "{}").progress?.lastWorkout?.worseAreas,
    );
    expect(worseAreas).toEqual(["neck"]);
    // No reminder ask or upsell right after something made them feel worse.
    await expect(page.getByText(/same time tomorrow/i)).toHaveCount(0);
  });

  test("Back to Today goes to Today, and the Pro offer is an honest card", async ({ page }) => {
    await clearAppState(page);
    for (let run = 1; run <= 3; run += 1) {
      await startReset(page);
      await completeReset(page);
      await rateAndWrap(page, /^better$/i);
      if (run === 1) {
        await expect(page.getByText(/same time tomorrow/i)).toBeVisible();
        await expect(page.getByText(/more rated resets to see your patterns/i)).toBeVisible();
      }
      if (run < 3) {
        await expect(page.getByText(/want deskbreak to plan them for you/i)).toHaveCount(0);
        await page.getByRole("button", { name: /back to today/i }).click();
        await expect(page).toHaveURL(/\/app$/);
      }
    }
    await expect(page.getByText(/3 resets helped\. want deskbreak to plan them for you\?/i)).toBeVisible();
    await page.getByRole("button", { name: /back to today/i }).click();
    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe("move pages", () => {
  test("a retired move id redirects to the move that replaced it", async ({ page }) => {
    await page.goto("/moves/ankle-circles");
    await expect(page).toHaveURL(/\/moves\/ankle-pumps$/);
  });

  test("a floor move says it's on the floor", async ({ page }) => {
    await page.goto("/moves/glute-bridge");
    await expect(page.getByText(/on the floor/i).first()).toBeVisible();
  });
});
