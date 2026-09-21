import { findLandingPage, startMinutes, startRoutineName } from "@/lib/seo-content";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A DeskBreak guide";

export default async function Image({ params }: { params: Promise<{ landing: string }> }) {
  const { landing } = await params;
  const page = findLandingPage(landing);
  if (!page) {
    return ogImage({ title: "DeskBreak", footnote: "Three-minute desk resets." });
  }
  // The footnote names the routine the page actually starts.
  const routine = startRoutineName(page.need, startMinutes(page.durationMinutes), page.setup);
  return ogImage({ title: page.title, footnote: routine });
}
