import { findBlogPost } from "@/content/blog";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-image";
import { shortCitation } from "@/lib/seo-content";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A DeskBreak post";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = findBlogPost(slug);
  if (!post) {
    return ogImage({ title: "DeskBreak", footnote: "Three-minute desk resets." });
  }
  // The sources are the point of these posts, so the card names them.
  const cited = post.sources.slice(0, 2).map(shortCitation).join(" · ");
  return ogImage({
    title: post.title,
    kicker: "Research",
    footnote: cited || undefined,
  });
}
