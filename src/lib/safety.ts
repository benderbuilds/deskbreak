import {
  SAFETY_FLAGS,
  type Exercise,
  type FunctionalConstraint,
  type SafetyFlag,
} from "./types";

/**
 * "Go easy on": the person's own screening answers, and what each one leaves
 * out of a routine.
 *
 * Each flag maps onto the screening tags already on the moves (`skipIf`) and
 * the functional constraints (`constraints`). A move carrying any mapped tag
 * or constraint is a hard exclusion for that person, on every path: generated
 * routines, authored routines, the fallback, swaps and "Doesn't feel right".
 *
 * The answers are health information, so they stay on the device. The labels
 * are plain language and never a diagnosis.
 */
export type SafetyFlagRule = {
  /** Screening tags (Exercise.skipIf) this flag excludes. */
  skipIf: string[];
  /** Functional constraints this flag switches on. */
  constraints: FunctionalConstraint[];
};

export const SAFETY_FLAG_RULES: Record<SafetyFlag, SafetyFlagRule> = {
  // End-range and loaded neck work: side stretch, trap release, rotation, holds.
  neck: {
    skipIf: [
      "acute_neck_injury",
      "sharp_neck_pain",
      "recent_neck_surgery",
      "cervical_disc_flare",
      "severe_neck_spasm",
    ],
    constraints: ["neck_rotation"],
  },
  // Head movement and balance-heavy moves.
  dizziness: {
    skipIf: ["dizziness", "vertigo", "migraine_aura", "balance_risk", "balance_issues_without_support"],
    constraints: ["neck_rotation", "balance"],
  },
  // Nerve-tension positions: neck side bends, wrist and chest stretches.
  arm_tingling: {
    skipIf: ["arm_tingling", "cervical_disc_flare", "carpal_tunnel_flare"],
    constraints: [],
  },
  // Wrist stretches and weight through the hands. Gentle circles and finger work stay.
  wrist: {
    skipIf: ["carpal_tunnel_flare", "recent_wrist_sprain", "wrist_tendinitis_flare", "wrist_pain"],
    constraints: ["weight_through_wrists"],
  },
  // Loaded flexion, hinging and end-range twisting. Pelvic tilts and position changes stay.
  low_back: {
    skipIf: ["acute_disc_pain", "recent_spinal_surgery", "low_back_flare"],
    constraints: [],
  },
  // Overhead range, end-range chest stretches and weight through the arms.
  shoulder: {
    skipIf: ["shoulder_impingement", "recent_shoulder_dislocation", "frozen_shoulder"],
    constraints: ["overhead", "weight_through_wrists"],
  },
  // Deep hip flexion and rotation, lunges, deep knee bends.
  knee_hip: {
    skipIf: ["hip_replacement_restrictions", "knee_pain_in_position", "knee_injury", "groin_pain"],
    constraints: ["deep_knee_bend"],
  },
  // Breath holds, lying on the back, deep twists, abdominal bracing.
  pregnancy: {
    skipIf: ["pregnancy", "cannot_get_to_floor_safely"],
    constraints: ["floor"],
  },
  // Loaded end-range spinal flexion, twisting and extension over the chair.
  osteoporosis: {
    skipIf: ["osteoporosis"],
    constraints: [],
  },
  balance: {
    skipIf: ["balance_risk", "balance_issues_without_support"],
    constraints: ["balance"],
  },
};

export type SafetyFlagOption = {
  id: SafetyFlag;
  /** The checkbox label, in the person's words. */
  label: string;
  /** What changes when it is on. */
  hint: string;
};

/** "Go easy on" choices for the You screen, in display order. */
export const SAFETY_FLAG_OPTIONS: SafetyFlagOption[] = [
  { id: "neck", label: "Neck pain or a recent neck injury", hint: "No neck stretches, turns or holds." },
  { id: "dizziness", label: "Dizziness or vertigo", hint: "No head turns or balance-heavy moves." },
  { id: "arm_tingling", label: "Tingling or numbness in an arm or hand", hint: "No neck side bends or wrist and chest stretches." },
  { id: "wrist", label: "Wrist or hand pain, or carpal tunnel", hint: "No wrist stretches or leaning on your hands." },
  { id: "low_back", label: "A low-back flare-up", hint: "No hinging, deep bending or twisting." },
  { id: "shoulder", label: "Shoulder pain or a shoulder that slips", hint: "No overhead reaches or deep chest stretches." },
  { id: "knee_hip", label: "Knee or hip pain, or a hip replacement", hint: "No deep hip bends, lunges or sit-to-stands." },
  { id: "pregnancy", label: "Pregnancy", hint: "No breath holds, floor work, deep twists or planks." },
  { id: "osteoporosis", label: "Osteoporosis or low bone density", hint: "No deep rounding, twisting or leaning back over the chair." },
  { id: "balance", label: "Balance concerns", hint: "No single-leg or balance-heavy moves." },
];

export function safetyFlagLabel(flag: SafetyFlag): string {
  return SAFETY_FLAG_OPTIONS.find((option) => option.id === flag)?.label ?? flag;
}

/** The constraints a set of flags implies, de-duplicated. */
export function constraintsForFlags(flags: readonly SafetyFlag[] | undefined): FunctionalConstraint[] {
  if (!flags?.length) return [];
  return [...new Set(flags.flatMap((flag) => SAFETY_FLAG_RULES[flag]?.constraints ?? []))];
}

/** The flags that exclude this move, empty when none do. */
export function flagsExcluding(exercise: Exercise, flags: readonly SafetyFlag[] | undefined): SafetyFlag[] {
  if (!flags?.length) return [];
  return flags.filter((flag) => {
    const rule = SAFETY_FLAG_RULES[flag];
    if (!rule) return false;
    return (
      exercise.skipIf.some((tag) => rule.skipIf.includes(tag)) ||
      exercise.constraints.some((constraint) => rule.constraints.includes(constraint))
    );
  });
}

/** True when any "Go easy on" answer rules this move out. */
export function excludedBySafety(exercise: Exercise, flags: readonly SafetyFlag[] | undefined): boolean {
  return flagsExcluding(exercise, flags).length > 0;
}

export function normalizeSafetyFlags(value: unknown): SafetyFlag[] {
  if (!Array.isArray(value)) return [];
  return SAFETY_FLAGS.filter((flag) => value.includes(flag));
}
