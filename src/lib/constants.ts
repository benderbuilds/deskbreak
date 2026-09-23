import type {
  DiscomfortReason,
  DurationMinutes,
  FunctionalConstraint,
  PerceivedEffect,
  PrimaryNeed,
  SetupId,
} from "./types";
import { TARGETED_NEEDS } from "./types";

export const FREE_RESET_PROGRAM_ID = "desk-reset-3min";
export const FREE_STANDING_RESET_PROGRAM_ID = "desk-reset-3min-standing";
export const QUICK_RESET_PROGRAM_ID = "desk-reset-2min";

/** The default the whole product hangs off. */
export const DEFAULT_DURATION: DurationMinutes = 3;

export const PRODUCT_NAME = "DeskBreak";
export const PRODUCT_PROMISE = "The workout for people who sit all day.";
export const PRODUCT_SUBHEAD =
  "Short, guided workouts made for computer workers. No equipment. No planning.";
export const HERO_ALT_HEADLINE = "Feel better at your desk.";
export const HERO_SUBHEAD =
  "DeskBreak gives you a quick, guided reset for your neck, shoulders, back, wrists, hips and legs.";

/**
 * The public promise, in one place so the page, the start bar and the social
 * card cannot drift apart.
 *
 * The length is a constant because every generic free CTA has to ask for it
 * explicitly: without it, a browser that once preferred a 10-minute Pro
 * routine would be handed one by a button that just said "free".
 */
export const FREE_RESET_MINUTES: DurationMinutes = 3;
export const HERO_HEADLINE = "Sit all day? Take three minutes.";
export const HERO_SUPPORT =
  "A free, guided movement break you can do right at your desk. Follow along, then get back to your day.";
export const FREE_CTA_LABEL = "Start my free reset";
export const FREE_REASSURANCE = "3 minutes. No signup. No equipment.";
/** One joke, kept subordinate to the promise and the button. */
export const HERO_ASIDE = "Your 37 open tabs can wait.";
export const FREE_RESET_NAME = "3-minute Desk Reset";
export const CLOSING_CTA_HEADING = "Your next three minutes are ready.";
export const FREE_OFFER_HEADING = "A useful desk break, free.";
export const FREE_OFFER_TERMS = "No trial countdown. No card needed for free resets.";
export const PRO_PROMISE = "DeskBreak manages your workday.";

export const MOVEMENT_DISCLAIMER =
  "Move comfortably and stop if something hurts. DeskBreak provides general movement guidance and isn't medical care.";

export const SAFETY_LINE =
  "Stop this movement if it causes sharp or worsening pain, numbness, weakness or dizziness.";

/** The one-line stop rule for the workout screen, under the dose. */
export const STOP_RULE =
  "Mild stretch is fine. Stop if it's sharp, spreads down an arm or leg, tingles, or makes you dizzy.";

/** Shown once, before the first workout, with STOP_RULE. */
export const FIRST_RUN_SAFETY_NOTE =
  "Not medical care. See a clinician for pain lasting more than 2 weeks, pain after a fall or injury, or pain with fever, weight loss, night pain, or new weakness.";

/** What "Doesn't feel right" -> "Painful" says. The engine leaves that area alone for 7 days. */
export const PAINFUL_RESPONSE =
  "Let's leave that area alone today. If this pain is new, sharp, or lasts more than a couple of weeks, check with a physical therapist or doctor.";

/** After "Worse": the follow-up question. The answer feeds recordWorseAreas(). */
export const WORSE_AREA_PROMPT = "What felt worse?";

/** Shown when the same area has been rated worse twice or more in 7 days. */
export const WORSE_REPEAT_CLINICIAN_LINE =
  "That area has felt worse more than once this week, so we're leaving it out for now. If it keeps bothering you, check with a physical therapist or doctor.";

export const SUPPORT_EMAIL = "hello@deskbreak.co";

export type NeedOption = {
  id: PrimaryNeed;
  label: string;
  /** Short label for chips. */
  chip: string;
  blurb: string;
};

/** Every need, in display order. Today only shows TARGETED_OPTIONS. */
export const NEED_OPTIONS: NeedOption[] = [
  { id: "neck_shoulders", label: "Neck + shoulders", chip: "Neck", blurb: "Undo the laptop lean." },
  { id: "back_hips", label: "Back + hips", chip: "Back", blurb: "Loosen up after sitting." },
  { id: "wrists_hands", label: "Wrists + hands", chip: "Wrists", blurb: "Give keyboard hands a break." },
  { id: "energy", label: "Energy", chip: "Energy", blurb: "Move a little and wake yourself up." },
  { id: "stress", label: "Stress reset", chip: "Stress", blurb: "Slow things down for a few minutes." },
  { id: "posture", label: "Posture reset", chip: "Posture", blurb: "Change position and open up your upper back." },
  { id: "general", label: "Full body", chip: "Full body", blurb: "A balanced reset for a desk day." },
];

export const NEED_BY_ID: Record<PrimaryNeed, NeedOption> = NEED_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.id]: option }),
  {} as Record<PrimaryNeed, NeedOption>,
);

/** The "Need something specific?" buttons, in TARGETED_NEEDS order. */
export const TARGETED_OPTIONS: NeedOption[] = NEED_OPTIONS.filter((option) =>
  TARGETED_NEEDS.includes(option.id),
);

/** The landing page says "Low energy" where the app says "Energy". */
export const LANDING_TARGETED_LABELS: Record<PrimaryNeed, string> = {
  neck_shoulders: "Neck + shoulders",
  back_hips: "Back + hips",
  wrists_hands: "Wrists + hands",
  energy: "Low energy",
  stress: "Stress",
  posture: "Posture reset",
  general: "Full body",
};

export const DURATION_OPTIONS: {
  minutes: DurationMinutes;
  label: string;
  hint: string;
  pro: boolean;
}[] = [
  { minutes: 2, label: "Quick", hint: "2 min · 3 to 4 movements", pro: false },
  { minutes: 3, label: "Daily", hint: "3 min · 4 to 6 movements", pro: false },
  { minutes: 5, label: "Deeper", hint: "5 min · 5 to 8 movements", pro: true },
  { minutes: 10, label: "Full workout", hint: "10 min · 8 to 12 movements", pro: true },
];

export const SETUP_COPY: Record<SetupId | "either", { label: string; hint: string }> = {
  either: { label: "Mix", hint: "Seated and standing, whatever fits." },
  seated: { label: "Seated only", hint: "Chair-first moves." },
  standing: { label: "Standing only", hint: "We'll use the space beside your desk." },
};

/**
 * "Movements to avoid". Floor work is not listed: it is off by default and
 * switched on with the "Include floor exercises" preference instead.
 */
export const CONSTRAINT_OPTIONS: { id: FunctionalConstraint; label: string }[] = [
  { id: "overhead", label: "Overhead movements" },
  { id: "weight_through_wrists", label: "Weight through wrists" },
  { id: "deep_knee_bend", label: "Deep knee bends" },
  { id: "balance", label: "Balance-heavy movements" },
  { id: "neck_rotation", label: "Neck rotation" },
  { id: "leave_chair", label: "Getting out of my chair" },
];

export const FLOOR_WORK_OPTION = {
  label: "Include floor exercises",
  hint: "Off by default. Only turn this on if you have space and can get down to the floor and up again easily.",
};

export const DISCOMFORT_REASONS: { id: DiscomfortReason; label: string }[] = [
  { id: "uncomfortable", label: "Uncomfortable" },
  { id: "painful", label: "Painful" },
  { id: "awkward", label: "Awkward at my desk" },
  { id: "too_hard", label: "Too difficult" },
  { id: "dislike", label: "Don't like it" },
];

export const FEEDBACK_OPTIONS: { id: PerceivedEffect; label: string }[] = [
  { id: "better", label: "Better" },
  { id: "same", label: "About the same" },
  { id: "worse", label: "Worse" },
];

export const FEEDBACK_RESPONSES: Record<PerceivedEffect, string> = {
  better: "We'll use that to make your next reset better.",
  same: "Got it. We'll adjust what comes next.",
  worse: "Sorry about that. Tell us what felt worse and we'll leave it alone for a while.",
};

/** Headline on the paywall, chosen by what the user said was bothering them. */
export const PAYWALL_HEADLINES: Record<PrimaryNeed, string> = {
  neck_shoulders: "Make feeling better automatic.",
  back_hips: "Make feeling better automatic.",
  wrists_hands: "Make feeling better automatic.",
  energy: "Make the 3 PM reset automatic.",
  stress: "Make feeling better automatic.",
  posture: "Make changing position automatic.",
  general: "Make feeling better automatic.",
};

export const PRO_FEATURES = [
  "Smart workday plan",
  "Personalized resets",
  "Multiple reminders",
  "5- and 10-minute workouts",
  "Full progress insights",
  "Sync across devices",
];

/** Reminder copy in DeskBreak's voice. Never shames a skipped break. */
export const REMINDER_LINES = [
  "Good time to move. Your Desk Reset is ready.",
  "Before the 3 PM slump wins, three minutes of movement.",
  "You've been sitting a while. Time for a reset.",
  "A quick reset for your neck, back and hips.",
  "Stand up, move a little, sit down differently.",
];

/** Sessions completed before we suggest installing the app. */
export const INSTALL_PROMPT_AFTER_SESSIONS = 3;
/** Sessions completed before we offer the 5-Day Desk Reset. */
export const CHALLENGE_OFFER_AFTER_SESSIONS = 1;
