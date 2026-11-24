import { expect, test, type Page } from "@playwright/test";
import { clearAppState } from "./helpers";

/** back-reset-2min opens on seated cat-cow, the first move with instructor photos. */
async function openCatCow(page: Page) {
  await page.goto("/app/start?program=back-reset-2min&source=landing");
  await expect(page.getByRole("heading", { name: "Seated cat-cow" })).toBeVisible();
  return page.getByRole("img", { name: /^Instructor demonstrating Seated cat-cow/ });
}

test.describe("instructor photo art", () => {
  test("the player shows the photo, alternates frames, and labels it as an instructor", async ({ page }) => {
    await clearAppState(page);
    const art = await openCatCow(page);
    await expect(art).toHaveAttribute("data-art-kind", "photo");
    await expect(art).toHaveAttribute("src", /seated-cat-cow(-b)?\.webp$/);
    await expect(art).toHaveAttribute("src", /seated-cat-cow-b\.webp$/, { timeout: 5_000 });
    await expect(page.getByText(/mild stretch is fine\. stop if it's sharp/i)).toBeVisible();
  });

  test("under reduced motion the photo holds the start frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearAppState(page);
    const art = await openCatCow(page);
    await expect(art).toHaveAttribute("src", /seated-cat-cow\.webp$/);
    await page.waitForTimeout(2_500);
    await expect(art).toHaveAttribute("src", /seated-cat-cow\.webp$/);
  });

  test.describe("when the photo can't load", () => {
    // The service worker would answer from its cache before the route can fail it.
    test.use({ serviceWorkers: "block" });

    test("it falls back to the old illustration, not a blank", async ({ page }) => {
      await page.route("**/character/*.webp", (route) => route.abort());
      await page.emulateMedia({ reducedMotion: "reduce" });
      await clearAppState(page);
      await page.goto("/app/start?program=back-reset-2min&source=landing");
      await expect(page.getByRole("heading", { name: "Seated cat-cow" })).toBeVisible();
      const art = page.getByRole("img", { name: /^Stretch demonstrating Seated cat-cow/ });
      await expect(art).toHaveAttribute("src", /seated-cat-cow\.svg$/);
      await expect(art).toHaveAttribute("data-art-kind", "illustration");
    });
  });
});
