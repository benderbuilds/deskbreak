import type { PrimaryNeed, SetupId } from "./types";

export const FREE_RESET_PROGRAM_ID = "desk-reset-2min";
export const FREE_STANDING_RESET_PROGRAM_ID = "desk-reset-2min-standing";

export const PRODUCT_PROMISE = "Feel better at your desk in 2 minutes.";
export const PRODUCT_SUBHEAD =
  "Tiny guided movement breaks for stiff necks, tight backs, tired shoulders, and desk-brain.";
export const PRO_PROMISE =
  "DeskBreak Pro plans your movement breaks around your workday so you don't have to remember.";

export const MOVEMENT_DISCLAIMER =
  "Move comfortably and stop if something hurts. DeskBreak provides general movement guidance and isn't medical care.";

export const SUPPORT_EMAIL = "hello@deskbreak.app";

export type NeedOption = {
  id: PrimaryNeed;
  label: string;
  /** Short label for Home chips. */
  chip: string;
  blurb: string;
};

/** The one question the whole product hangs off. Order is the display order. */
export const NEED_OPTIONS: NeedOption[] = [
  {
    id: "neck_shoulders",
    label: "Neck + shoulders",
    chip: "Neck",
    blurb: "Undo the laptop hunch.",
  },
  {
    id: "back_hips",
    label: "Back + hips",
    chip: "Back",
    blurb: "Loosen up after sitting.",
  },
  {
    id: "wrists_hands",
    label: "Wrists + hands",
    chip: "Wrists",
    blurb: "Give keyboard hands a break.",
  },
  {
    id: "energy",
    label: "Low energy",
    chip: "Tired",
    blurb: "Wake yourself up without another coffee.",
  },
  {
    id: "stress",
    label: "Stress",
    chip: "Stressed",
    blurb: "Slow things down for two minutes.",
  },
  {
    id: "general",
    label: "Surprise me",
    chip: "Good",
    blurb: "Just get me moving.",
  },
];

export const NEED_BY_ID: Record<PrimaryNeed, NeedOption> = NEED_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.id]: option }),
  {} as Record<PrimaryNeed, NeedOption>,
);

export const SETUP_COPY: Record<SetupId, { label: string; hint: string }> = {
  seated: { label: "Keep me seated", hint: "Chair-first moves." },
  standing: { label: "Yep", hint: "We'll use the space beside your desk." },
};

/** Headline on the paywall, chosen by what the user said was bothering them. */
export const PAYWALL_HEADLINES: Record<PrimaryNeed, string> = {
  neck_shoulders: "Your neck liked that.",
  back_hips: "Your back deserves more than one break.",
  wrists_hands: "Your hands are going back to the keyboard either way.",
  energy: "Make the 3 PM reset automatic.",
  stress: "Two minutes of quiet, on a schedule.",
  general: "Keep feeling better through the workday.",
};

export const FEEDBACK_RESPONSES = {
  better: "Good. Don't wait until you're stiff again.",
  somewhat: "That's a start.",
  not_better: "Got it. We'll try a different kind of reset next time.",
} as const;

/** Reminder copy in DeskBreak's voice. Never shames a skipped break. */
export const REMINDER_LINES = [
  "Your shoulders are creeping toward your ears again. Two-minute DeskBreak?",
  "Before the 3 PM slump wins...",
  "Unfold yourself.",
  "Your laptop has had enough of you.",
  "Neck check.",
];
