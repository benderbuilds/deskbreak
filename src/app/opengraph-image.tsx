import { FREE_REASSURANCE, HERO_HEADLINE, PRODUCT_PROMISE } from "@/lib/constants";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = `DeskBreak. ${PRODUCT_PROMISE}`;

export default function Image() {
  // The card says what the link gives you, in the page's own words.
  return ogImage({
    title: HERO_HEADLINE,
    footnote: `A free, guided desk break. ${FREE_REASSURANCE}`,
  });
}
