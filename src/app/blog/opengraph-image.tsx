import { BLOG_POSTS } from "@/content/blog";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "What the research says about moving at your desk";

export default function Image() {
  return ogImage({
    title: "What the research says about moving at your desk",
    kicker: "Research",
    footnote: `${BLOG_POSTS.length} posts, every claim cited.`,
  });
}
