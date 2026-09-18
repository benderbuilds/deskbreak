import { NEED_BY_ID } from "./constants";
import type { PrimaryNeed, WorkoutSession } from "./types";

/**
 * Paywall headlines, one per need. Each sells the same thing (DeskBreak
 * scheduling the breaks) in terms of what brought the person here. No pain
 * or posture-correction claims: posture copy is about changing position.
 */
export const PAYWALL_NEED_HEADLINES: Record<PrimaryNeed, string> = {
  neck_shoulders: "Give your neck and shoulders a break before the laptop lean sets in.",
  back_hips: "Get out of the chair before the long sits add up.",
  wrists_hands: "Give your keyboard hands a break every few hours, without remembering to.",
  energy: "Beat the 3 PM slump without another coffee.",
  stress: "Build a few calm minutes into every workday.",
  posture: "Change position before you've been stuck in one all afternoon.",
  general: "Make moving part of your workday, automatically.",
};

/** "Neck + shoulders", "Posture": the need's label without a trailing "reset". */
function needName(need: PrimaryNeed): string {
  return NEED_BY_ID[need].label.replace(/\s+reset$/i, "");
}

/**
 * The person's own result for this need, when there is one worth quoting:
 * rated at least twice, and helped at least once. Null otherwise.
 */
export function paywallOutcomeLine(
  need: PrimaryNeed,
  history: Pick<WorkoutSession, "primaryNeed" | "perceivedEffect">[],
): string | null {
  const relevant = need === "general" ? history : history.filter((session) => session.primaryNeed === need);
  const rated = relevant.filter((session) => session.perceivedEffect);
  const helped = rated.filter((session) => session.perceivedEffect === "better").length;
  if (rated.length < 2 || helped < 1) return null;
  const subject = need === "general" ? "Your resets" : `${needName(need)} resets`;
  return `${subject} helped you ${helped} of ${rated.length} times. Pro schedules the next one for you.`;
}
