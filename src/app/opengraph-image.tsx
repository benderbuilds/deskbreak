import { PRODUCT_PROMISE } from "@/lib/constants";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = `DeskBreak. ${PRODUCT_PROMISE}`;

export default function Image() {
  return ogImage({
    title: "Sitting all day? Do this.",
    footnote: "Three-minute desk resets. No equipment, no signup.",
  });
}
