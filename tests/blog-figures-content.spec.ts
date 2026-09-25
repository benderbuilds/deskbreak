import { test, expect } from "@playwright/test";
import { BLOG_POSTS, blogWordCount, findBlogPost } from "../src/content/blog";
import { BLOG_FIGURES, BLOG_FIGURE_BASE_PATH, getBlogFigure, type BlogFigureId } from "../src/content/blog-figures";
import { getSource } from "../src/lib/seo-content";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Content checks for the research figures.
 *
 * These run in Node, not a browser: they guard the manifest contract and the
 * citation rules that the article body depends on. The rendered pages are
 * covered by blog-figures.spec.ts.
 */

const PILOTS: Record<string, BlogFigureId[]> = {
  "how-often-should-you-get-up-from-your-desk": ["break-frequency-protocol", "break-frequency-interpretation"],
  "does-the-20-20-20-rule-work": ["eye-break-mnemonic", "eye-break-study"],
  "are-standing-desks-worth-it": ["standing-desk-trial", "standing-desk-results"],
};

test.describe("figure manifest", () => {
  test("every figure has the text a reader needs, and real dimensions", () => {
    expect(BLOG_FIGURES).toHaveLength(6);
    expect(new Set(BLOG_FIGURES.map((figure) => figure.id)).size).toBe(6);

    for (const figure of BLOG_FIGURES) {
      expect(figure.alt.trim(), `${figure.id} alt`).not.toBe("");
      expect(figure.caption.trim(), `${figure.id} caption`).not.toBe("");
      expect(figure.longDescription.length, `${figure.id} description`).toBeGreaterThan(0);
      for (const paragraph of figure.longDescription) expect(paragraph.trim()).not.toBe("");
      expect(figure.sourceIds.length, `${figure.id} sources`).toBeGreaterThan(0);

      for (const rendition of [figure.files.desktop, figure.files.mobile]) {
        expect(rendition.width).toBeGreaterThan(0);
        expect(rendition.height).toBeGreaterThan(0);
        // A served path is joined onto the public base: it must stay inside it.
        expect(rendition.webp).not.toMatch(/^\//);
        expect(rendition.webp.split("/")).not.toContain("..");
        expect(rendition.webp).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
      }
      expect(figure.files.desktop.width).toBe(1200);
      expect(figure.files.mobile.width).toBe(600);
    }
  });

  test("the WebP files the manifest names are actually shipped", () => {
    for (const figure of BLOG_FIGURES) {
      for (const rendition of [figure.files.desktop, figure.files.mobile]) {
        const file = join(process.cwd(), "public", BLOG_FIGURE_BASE_PATH, rendition.webp);
        expect(existsSync(file), `missing ${rendition.webp}`).toBe(true);
      }
    }
  });

  test("every figure source is a verified library source", () => {
    for (const figure of BLOG_FIGURES) {
      for (const id of figure.sourceIds) {
        const source = getSource(id);
        expect(source.verified, `${figure.id} cites unverified ${id}`).toBe(true);
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  test("source checking is recorded, and is never clinical review", () => {
    for (const figure of BLOG_FIGURES) {
      expect(figure.sourceChecked, `${figure.id}`).toBe(true);
      expect(figure.clinicallyReviewed, `${figure.id} must not claim clinical review`).toBe(false);
    }
  });

  test("getBlogFigure throws rather than showing a different asset", () => {
    expect(() => getBlogFigure("not-a-figure" as BlogFigureId)).toThrow(/Unknown blog figure/);
  });

  test("the numeric table has labelled, well-formed rows", () => {
    const table = getBlogFigure("standing-desk-results").dataTable;
    expect(table, "standing-desk-results must carry its data table").toBeDefined();
    if (!table) return;
    expect(table.columns.length).toBeGreaterThan(1);
    for (const row of table.rows) {
      // A short row would shift values under the wrong header.
      expect(row).toHaveLength(table.columns.length);
      expect(typeof row[0]).toBe("string");
      for (const cell of row.slice(1)) expect(Number.isFinite(Number(cell))).toBe(true);
    }
    // The published differences are negative: less sitting than usual practice.
    expect(table.rows.map((row) => row[1])).toEqual([-22.2, -63.7]);
    expect(table.rows[0].slice(2)).toEqual([-38.8, -5.7]);
    expect(table.rows[1].slice(2)).toEqual([-80.1, -47.4]);
  });
});

test.describe("pilot integration", () => {
  test("each pilot carries exactly its two figures, in manifest order", () => {
    for (const [slug, expected] of Object.entries(PILOTS)) {
      const post = findBlogPost(slug);
      expect(post, slug).toBeDefined();
      const ids = post!.blocks.flatMap((block) => (block.type === "figure" ? [block.figureId] : []));
      expect(ids, slug).toEqual(expected);
    }
  });

  test("a figure only ever appears in the post the manifest assigns it to", () => {
    for (const post of BLOG_POSTS) {
      for (const block of post.blocks) {
        if (block.type !== "figure") continue;
        expect(getBlogFigure(block.figureId).postSlug).toBe(post.slug);
      }
    }
  });

  test("the five other articles gained no figures", () => {
    for (const post of BLOG_POSTS) {
      if (post.slug in PILOTS) continue;
      expect(post.blocks.some((block) => block.type === "figure"), post.slug).toBe(false);
    }
  });

  test("a figure's sources are in its post's reference list", () => {
    for (const post of BLOG_POSTS) {
      for (const block of post.blocks) {
        if (block.type !== "figure") continue;
        for (const id of getBlogFigure(block.figureId).sourceIds) {
          expect(post.sources, `${post.slug} must list ${id}`).toContain(id);
        }
      }
    }
  });

  test("all eight articles keep finite reading times and their original dates", () => {
    expect(BLOG_POSTS).toHaveLength(8);
    for (const post of BLOG_POSTS) {
      const words = blogWordCount(post);
      expect(Number.isFinite(words), post.slug).toBe(true);
      expect(words, post.slug).toBeGreaterThan(0);
      expect(post.published, post.slug).toBe("2026-09-18");
      if (post.updatedAt !== undefined) {
        expect(post.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(post.updatedAt >= post.published, `${post.slug} updatedAt precedes published`).toBe(true);
      }
    }
  });

  test("only the revised pilots claim an update", () => {
    for (const post of BLOG_POSTS) {
      expect(post.updatedAt !== undefined, post.slug).toBe(post.slug in PILOTS);
    }
  });

  test("a figure's caption and description count toward reading time once", () => {
    const post = findBlogPost("are-standing-desks-worth-it")!;
    const words = blogWordCount(post);
    const figureWords = PILOTS["are-standing-desks-worth-it"]
      .map(getBlogFigure)
      .flatMap((figure) => [figure.caption, ...figure.longDescription])
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;

    const withoutFigures = blogWordCount({ ...post, blocks: post.blocks.filter((block) => block.type !== "figure") });
    expect(words - withoutFigures).toBe(figureWords);
    // Alt text and file paths are not reader-facing prose.
    for (const figure of PILOTS["are-standing-desks-worth-it"].map(getBlogFigure)) {
      expect(words).toBeLessThan(withoutFigures + figureWords + figure.alt.split(/\s+/).length);
    }
  });
});

test.describe("required editorial corrections", () => {
  const eye = () => findBlogPost("does-the-20-20-20-rule-work")!;
  const prose = (slug: string) =>
    findBlogPost(slug)!
      .blocks.flatMap((block) => (block.type === "p" ? [block.text] : block.type === "list" ? block.items : []))
      .join(" ");

  test("the eye study's two-week baseline is described", () => {
    expect(prose("does-the-20-20-20-rule-work")).toContain("two weeks without reminders");
  });

  test("the accommodative-facility result is acknowledged", () => {
    const text = prose("does-the-20-20-20-rule-work");
    expect(text).toContain("accommodative facility");
    expect(text).not.toContain("their eyes didn't measurably change");
  });

  test("symptom change after reminders stopped is not stated categorically", () => {
    const post = eye();
    const text = `${prose("does-the-20-20-20-rule-work")} ${post.metaDescription} ${post.guardrail}`;
    expect(text).not.toContain("the improvement was gone");
    expect(text).not.toContain("came back once they stopped");
    expect(text).not.toContain("only while the reminders ran");
  });

  test("the standing chart's outcome is total daily sitting versus usual practice", () => {
    const text = prose("are-standing-desks-worth-it");
    expect(text).toContain("sitting at work and outside work");
    expect(text).toContain("usual work habits");
    // The combined intervention is never presented as a desk-alone result.
    expect(text).toContain("support program plus a desk");
    // The program is named and explained before the results lean on it.
    expect(text).toContain("The support program was education, goal setting and reminders");
  });

  test("no official break interval is claimed", () => {
    const post = findBlogPost("how-often-should-you-get-up-from-your-desk")!;
    expect(post.guardrail).toContain("No official guideline");
    expect(prose(post.slug)).not.toContain("every 20 minutes is the right number");
  });
});
