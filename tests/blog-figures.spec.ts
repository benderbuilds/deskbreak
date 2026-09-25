import { expect, test, type Page } from "@playwright/test";
import { getBlogFigure, type BlogFigureId } from "../src/content/blog-figures";
import { getSource, shortCitation } from "../src/lib/seo-content";

/**
 * The research figures as a reader meets them.
 *
 * The point of these checks is that the finding survives without the picture:
 * caption, source link, transcript and the chart's numbers are all real HTML.
 * The art-directed <picture> also has to pick the right composition, because a
 * desktop chart squeezed into a phone is unreadable.
 */

const PILOTS: { slug: string; figures: BlogFigureId[] }[] = [
  { slug: "how-often-should-you-get-up-from-your-desk", figures: ["break-frequency-protocol", "break-frequency-interpretation"] },
  { slug: "does-the-20-20-20-rule-work", figures: ["eye-break-mnemonic", "eye-break-study"] },
  { slug: "are-standing-desks-worth-it", figures: ["standing-desk-trial", "standing-desk-results"] },
];

async function isMobileLayout(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia("(max-width: 639.98px)").matches);
}

for (const { slug, figures } of PILOTS) {
  test.describe(`figures in ${slug}`, () => {
    test("both figures load the composition made for this viewport", async ({ page }) => {
      await page.goto(`/blog/${slug}`);
      const mobile = await isMobileLayout(page);

      for (const id of figures) {
        const figure = page.locator(`figure#${id}`);
        await expect(figure).toHaveCount(1);
        await figure.scrollIntoViewIfNeeded();

        const image = figure.locator("img");
        // Lazy images only decode once they are in view.
        await expect(async () => {
          const loaded = await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0);
          expect(loaded).toBe(true);
        }).toPass({ timeout: 10_000 });

        const currentSrc = await image.evaluate((node: HTMLImageElement) => node.currentSrc);
        expect(currentSrc, `${id} on ${mobile ? "mobile" : "desktop"}`).toContain(
          mobile ? `${id}--mobile.webp` : `${id}--desktop.webp`,
        );

        const naturalWidth = await image.evaluate((node: HTMLImageElement) => node.naturalWidth);
        expect(naturalWidth).toBe(mobile ? 600 : 1200);
      }
    });

    test("captions carry the takeaway and a working source link", async ({ page }) => {
      await page.goto(`/blog/${slug}`);

      for (const id of figures) {
        const asset = getBlogFigure(id);
        const caption = page.locator(`figure#${id} figcaption`);
        await expect(caption).toContainText(asset.caption);

        for (const sourceId of asset.sourceIds) {
          const link = caption.getByRole("link", { name: shortCitation(sourceId) });
          await expect(link).toBeVisible();
          await expect(link).toHaveAttribute("href", getSource(sourceId).url);
        }
      }
    });

    test("the full text equivalent opens from the keyboard", async ({ page }) => {
      await page.goto(`/blog/${slug}`);

      for (const id of figures) {
        const asset = getBlogFigure(id);
        const details = page.locator(`figure#${id} details`);
        const summary = details.locator("summary");

        await expect(details).not.toHaveAttribute("open", /.*/);
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(details).toHaveAttribute("open", /.*/);

        for (const paragraph of asset.longDescription) {
          await expect(details).toContainText(paragraph);
        }
      }
    });

    test("the article never forces the page sideways", async ({ page }) => {
      await page.goto(`/blog/${slug}`);
      // Open every disclosure: a wide table must scroll itself, not the page.
      for (const id of figures) {
        await page.locator(`figure#${id} summary`).click();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test("the reset CTA and the reference list still work", async ({ page }) => {
      await page.goto(`/blog/${slug}`);
      const cta = page.getByRole("link", { name: /^start the /i });
      await expect(cta).toBeVisible();
      // The figures must not disturb where the article hands the reader over.
      await expect(cta).toHaveAttribute("href", /^\/app\/start\?.*source=seo/);
      await expect(page.getByRole("heading", { name: /^references$/i })).toBeVisible();
      await expect(page.locator("section[aria-labelledby='references'] ol li")).not.toHaveCount(0);
    });

    test("the original publication date is kept and the revision is shown separately", async ({ page }) => {
      await page.goto(`/blog/${slug}`);
      await expect(page.locator("time[datetime='2026-09-18']")).toBeVisible();
      await expect(page.getByText(/Updated/)).toBeVisible();
    });
  });
}

test.describe("the standing-desk chart", () => {
  const slug = "are-standing-desks-worth-it";

  test("its numbers are a real table, with labels and published values", async ({ page }) => {
    await page.goto(`/blog/${slug}`);
    const asset = getBlogFigure("standing-desk-results");
    expect(asset.dataTable).toBeDefined();
    const data = asset.dataTable!;

    await page.locator("figure#standing-desk-results summary").click();
    const table = page.locator("figure#standing-desk-results table");
    await expect(table).toBeVisible();
    await expect(table.locator("caption")).toHaveText(data.caption);

    for (const column of data.columns) {
      await expect(table.locator("th", { hasText: column }).first()).toBeVisible();
    }
    for (const row of data.rows) {
      const rowHeader = table.locator("tbody tr", { has: page.locator(`th:text-is("${row[0]}")`) });
      await expect(rowHeader).toHaveCount(1);
      for (const cell of row.slice(1)) {
        await expect(rowHeader.locator("td", { hasText: String(cell) }).first()).toBeVisible();
      }
    }
    // The note explains the sign and what "daily sitting" covers.
    await expect(page.locator("figure#standing-desk-results")).toContainText(data.note);
  });

  test("with images blocked, the finding is still on the page", async ({ page }) => {
    await page.route("**/blog/figures/**", (route) => route.abort());
    await page.goto(`/blog/${slug}`);

    const asset = getBlogFigure("standing-desk-results");
    await expect(page.locator("figure#standing-desk-results figcaption")).toContainText(asset.caption);
    await page.locator("figure#standing-desk-results summary").click();
    await expect(page.locator("figure#standing-desk-results table")).toContainText("-63.7");
    await expect(
      page.locator("figure#standing-desk-results").getByRole("link", { name: shortCitation("edwardson-2022") }),
    ).toBeVisible();
  });
});

test.describe("articles without figures", () => {
  test("are unchanged: no figure, no update line", async ({ page }) => {
    await page.goto("/blog/walking-breaks-blood-sugar-after-lunch");
    await expect(page.locator("figure[id]")).toHaveCount(0);
    await expect(page.getByText(/Updated/)).toHaveCount(0);
    await expect(page.locator("time[datetime='2026-09-18']")).toBeVisible();
  });
});
