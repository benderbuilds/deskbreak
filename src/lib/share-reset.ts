import type { PrimaryNeed } from "./types";

/**
 * What gets shared when someone passes a reset on.
 *
 * A public, crawlable page, chosen from a fixed table keyed by the need enum.
 * Never the workout URL: that one carries a recommendation id, a source and
 * whatever attribution this visit arrived with, and none of that is anyone
 * else's business. The mapping is a table rather than a derivation so a new
 * need cannot silently produce a URL that does not exist.
 */
const SHARE_PAGES: Record<PrimaryNeed, string> = {
  neck_shoulders: "/neck-shoulder-exercises",
  back_hips: "/back-stretches-desk-workers",
  wrists_hands: "/wrist-exercises-desk-workers",
  posture: "/posture-reset",
  general: "/desk-exercises",
  // No page of their own yet: the homepage, with generic wording.
  energy: "/",
  stress: "/",
};

/** The routine named on a page that has one, without promising an outcome. */
const SHARE_ROUTINE: Partial<Record<PrimaryNeed, string>> = {
  neck_shoulders: "neck and shoulder",
  back_hips: "back and hip",
  wrists_hands: "wrist and hand",
  posture: "posture",
};

export const CANONICAL_ORIGIN = "https://deskbreak.co";

export const SHARE_TEXT = "Try a free, guided 3-minute desk reset. No signup or equipment.";

export type ShareTarget = { url: string; text: string };

export function shareTargetFor(need: PrimaryNeed, origin?: string | null): ShareTarget {
  const base = (origin || CANONICAL_ORIGIN).replace(/\/$/, "");
  const path = SHARE_PAGES[need] ?? "/";
  const routine = SHARE_ROUTINE[need];
  return {
    url: `${base}${path}`,
    text: routine ? `Try a free, guided 3-minute ${routine} reset. No signup or equipment.` : SHARE_TEXT,
  };
}
