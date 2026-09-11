import type {
  DiscomfortReason,
  DurationMinutes,
  FunctionalConstraint,
  PerceivedEffect,
  PrimaryNeed,
  SetupId,
} from "./types";

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
export const PRO_PROMISE = "DeskBreak manages your workday.";

export const MOVEMENT_DISCLAIMER =
  "Move comfortably and stop if something hurts. DeskBreak provides general movement guidance and isn't medical care.";

export const SAFETY_LINE =
  "Stop this movement if it causes sharp or worsening pain, numbness, weakness or dizziness.";

export const SUPPORT_EMAIL = "hello@deskbreak.app";

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
  { id: "energy", label: "Energy", chip: "Energy", blurb: "Wake yourself up without another coffee." },
  { id: "stress", label: "Stress reset", chip: "Stress", blurb: "Slow things down for a few minutes." },
  { id: "general", label: "Full body", chip: "Full body", blurb: "A balanced reset for a desk day." },
];

export const NEED_BY_ID: Record<PrimaryNeed, NeedOption> = NEED_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.id]: option }),
  {} as Record<PrimaryNeed, NeedOption>,
);

/** The four "Need something specific?" buttons. */
export const TARGETED_OPTIONS: NeedOption[] = NEED_OPTIONS.filter((option) =>
  ["neck_shoulders", "back_hips", "wrists_hands", "energy"].includes(option.id),
);

/** The landing page says "Low energy" where the app says "Energy". */
export const LANDING_TARGETED_LABELS: Record<PrimaryNeed, string> = {
  neck_shoulders: "Neck + shoulders",
  back_hips: "Back + hips",
  wrists_hands: "Wrists + hands",
  energy: "Low energy",
  stress: "Stress",
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

export const CONSTRAINT_OPTIONS: { id: FunctionalConstraint; label: string }[] = [
  { id: "overhead", label: "Overhead movements" },
  { id: "weight_through_wrists", label: "Weight through wrists" },
  { id: "deep_knee_bend", label: "Deep knee bends" },
  { id: "balance", label: "Balance-heavy movements" },
  { id: "floor", label: "Floor exercises" },
  { id: "neck_rotation", label: "Neck rotation" },
  { id: "leave_chair", label: "Getting out of my chair" },
];

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
  worse: "Sorry about that. We'll steer away from what was in this one.",
};

/** Headline on the paywall, chosen by what the user said was bothering them. */
export const PAYWALL_HEADLINES: Record<PrimaryNeed, string> = {
  neck_shoulders: "Make feeling better automatic.",
  back_hips: "Make feeling better automatic.",
  wrists_hands: "Make feeling better automatic.",
  energy: "Make the 3 PM reset automatic.",
  stress: "Make feeling better automatic.",
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
