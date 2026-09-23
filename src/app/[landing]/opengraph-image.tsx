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
  // The footnote names the routine the page actually starts, and says it is
  // free. A guide titled "5-Minute Office Workout" starts a free three-minute
  // one, so the card has to distinguish the two.
  const minutes = startMinutes(page.durationMinutes);
  const routine = startRoutineName(page.need, minutes, page.setup);
  return ogImage({ title: page.title, footnote: `Free ${minutes}-minute ${routine}. No signup.` });
}
