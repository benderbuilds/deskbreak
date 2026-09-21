import { allSources } from "@/lib/seo-content";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "The evidence behind DeskBreak";

export default function Image() {
  return ogImage({
    title: "What we know, and what we don't",
    kicker: "Science",
    footnote: `${allSources().length} studies, linked and summarised.`,
  });
}
