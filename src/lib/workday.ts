import { minutesNow, todayKey, weekdayOf } from "./dates";
import type { PersonalizationSignals } from "./personalization";
import type {
  BreakType,
  DurationMinutes,
  PlannedBreak,
  PrimaryNeed,
  ReminderLevel,
  WorkdayPlan,
  WorkdayPreferences,
  WorkoutSession,
} from "./types";

export { formatMinutes, minutesNow, parseTimeInput, toTimeInput } from "./dates";

export const DEFAULT_WORKDAY_START = 8 * 60 + 30;
export const DEFAULT_WORKDAY_END = 17 * 60;
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

/** Half-hour windows: nobody fails a break because they missed 2:30 exactly. */
export const WINDOW_MINUTES = 30;

export const REMINDER_LEVELS: Record<
  ReminderLevel,
  { label: string; hint: string; recommended?: boolean }
> = {
  minimal: { label: "Minimal", hint: "A few important reminders." },
  balanced: { label: "Balanced", hint: "Recommended.", recommended: true },
  active: { label: "Active", hint: "Keep me moving throughout the day." },
};

/**
 * What each level puts into a day, in order across the workday.
 *
 * The user never sees a break count; they pick how much help they want and the
 * planner decides what that means.
 */
const LEVEL_SHAPES: Record<ReminderLevel, BreakType[]> = {
  minimal: ["move", "move"],
  balanced: ["move", "walk", "move", "energy"],
  active: ["move", "stand", "walk", "move", "energy", "eyes"],
};

export const BREAK_TYPE_COPY: Record<
  BreakType,
  { label: string; blurb: string; need: PrimaryNeed; durationMin: DurationMinutes }
> = {
  move: { label: "Desk Reset", blurb: "A short guided reset.", need: "general", durationMin: 3 },
  stand: { label: "Stand break", blurb: "A change of position.", need: "general", durationMin: 1 },
  walk: { label: "Walk break", blurb: "Away from the screen.", need: "energy", durationMin: 2 },
  eyes: { label: "Eye break", blurb: "Somewhere else to look.", need: "stress", durationMin: 1 },
  energy: { label: "Energy reset", blurb: "Standing, larger movement.", need: "energy", durationMin: 3 },
};

/** The routine a micro-break launches. Move and energy use the engine instead. */
export const BREAK_TYPE_PROGRAM: Partial<Record<BreakType, string>> = {
  stand: "stand-break-1min",
  walk: "walk-break-2min",
  eyes: "eye-break-1min",
};

export function defaultPreferences(): WorkdayPreferences {
  return {
    startMinutes: DEFAULT_WORKDAY_START,
    endMinutes: DEFAULT_WORKDAY_END,
    level: "balanced",
    enabledDays: [...DEFAULT_WORKDAYS],
    timezone:
      typeof Intl !== "undefined"
        ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? null)
        : null,
  };
}

function roundToFive(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Nudges a window toward the times this person actually moves, and away from
 * the times they ignore reminders. Simple rules, no model: a shift of at most
 * thirty minutes, and never outside the workday.
 */
function adaptStart(
  start: number,
  plan: Pick<WorkdayPlan, "responseMinutes" | "ignoredMinutes"> | null,
  signals: PersonalizationSignals | null,
  bounds: { start: number; end: number },
): number {
  const responded = [
    ...(plan?.responseMinutes ?? []),
    ...(signals?.completionMinutes ?? []),
  ].filter((minute) => Math.abs(minute - start) <= 90);
  const ignored = (plan?.ignoredMinutes ?? []).filter((minute) => Math.abs(minute - start) <= 45);

  let next = start;
  const target = median(responded);
  if (target !== null && responded.length >= 2) {
    next += Math.max(-30, Math.min(30, target - start));
  }
  if (ignored.length >= 2 && responded.length < 2) {
    // People who ignore a slot repeatedly get it moved later, not more often.
    next += 30;
  }
  const latest = bounds.end - WINDOW_MINUTES - 15;
  return roundToFive(Math.max(bounds.start + 45, Math.min(latest, next)));
}

export function generateBreaks(input: {
  preferences: WorkdayPreferences;
  date: string;
  plan?: Pick<WorkdayPlan, "responseMinutes" | "ignoredMinutes"> | null;
  signals?: PersonalizationSignals | null;
  preferredDuration?: DurationMinutes | null;
}): PlannedBreak[] {
  const { preferences, date } = input;
  if (!preferences.enabledDays.includes(weekdayOf(date))) return [];

  const shape = LEVEL_SHAPES[preferences.level];
  const start = preferences.startMinutes + 45;
  const end = preferences.endMinutes - 30;
  const span = Math.max(60, end - start);
  const slot = span / shape.length;

  return shape.map((type, index) => {
    const nominal = start + slot * index + slot / 2 - WINDOW_MINUTES / 2;
    const windowStart = adaptStart(nominal, input.plan ?? null, input.signals ?? null, {
      start: preferences.startMinutes,
      end: preferences.endMinutes,
    });
    const copy = BREAK_TYPE_COPY[type];
    const durationMin: DurationMinutes =
      type === "move" && input.preferredDuration && input.preferredDuration <= 3
        ? input.preferredDuration
        : copy.durationMin;
    return {
      id: `${date}-${index + 1}-${type}`,
      date,
      startMinutes: windowStart,
      endMinutes: windowStart + WINDOW_MINUTES,
      type,
      need: copy.need,
      durationMin,
      status: "planned",
      snoozedUntilMinutes: null,
      completedSessionId: null,
      recommendationId: null,
    };
  });
}

export function createPlan(preferences: WorkdayPreferences): WorkdayPlan {
  const date = todayKey();
  const plan: WorkdayPlan = {
    preferences,
    generatedFor: date,
    breaks: [],
    responseMinutes: [],
    ignoredMinutes: [],
  };
  plan.breaks = generateBreaks({ preferences, date });
  return plan;
}

/** Rebuilds today's breaks when the stored plan was generated on an earlier day. */
export function planForToday(
  plan: WorkdayPlan,
  options: {
    signals?: PersonalizationSignals | null;
    preferredDuration?: DurationMinutes | null;
    date?: string;
  } = {},
): WorkdayPlan {
  const date = options.date ?? todayKey();
  if (plan.generatedFor === date) return plan;

  // Anything left unanswered yesterday counts as ignored, quietly.
  const ignored = plan.breaks
    .filter((entry) => entry.status === "planned" || entry.status === "delivered")
    .map((entry) => entry.startMinutes);

  const next: WorkdayPlan = {
    ...plan,
    ignoredMinutes: [...ignored, ...plan.ignoredMinutes].slice(0, 30),
    generatedFor: date,
  };
  next.breaks = generateBreaks({
    preferences: plan.preferences,
    date,
    plan: next,
    signals: options.signals,
    preferredDuration: options.preferredDuration,
  });
  return next;
}

/** Statuses as they stand right now, with missed windows marked expired. */
export function withExpiry(plan: WorkdayPlan, now = minutesNow()): WorkdayPlan {
  return {
    ...plan,
    breaks: plan.breaks.map((entry) => {
      const open = entry.status === "planned" || entry.status === "delivered" || entry.status === "snoozed";
      const deadline = entry.snoozedUntilMinutes ?? entry.endMinutes;
      if (open && deadline + 15 < now) return { ...entry, status: "expired" as const };
      return entry;
    }),
  };
}

export function isOpen(entry: PlannedBreak): boolean {
  return (
    entry.status === "planned" || entry.status === "delivered" || entry.status === "snoozed"
  );
}

export function effectiveStart(entry: PlannedBreak): number {
  return entry.snoozedUntilMinutes ?? entry.startMinutes;
}

export function nextBreak(plan: WorkdayPlan, now = minutesNow()): PlannedBreak | null {
  const open = plan.breaks
    .filter(isOpen)
    .filter((entry) => (entry.snoozedUntilMinutes ?? entry.endMinutes) + 15 >= now)
    .sort((a, b) => effectiveStart(a) - effectiveStart(b));
  return open[0] ?? null;
}

/** Whether a break is inside its window (or snoozed time) right now. */
export function isDue(entry: PlannedBreak, now = minutesNow()): boolean {
  if (!isOpen(entry)) return false;
  const start = effectiveStart(entry);
  const end = entry.snoozedUntilMinutes ? entry.snoozedUntilMinutes + 15 : entry.endMinutes;
  return now >= start && now <= end + 15;
}

export function planProgress(plan: WorkdayPlan): { done: number; total: number } {
  return {
    done: plan.breaks.filter((entry) => entry.status === "completed").length,
    total: plan.breaks.length,
  };
}

/**
 * Credits a finished session to the break it most plausibly satisfies.
 *
 * A session started inside a window satisfies that window. Otherwise the
 * nearest open break within 45 minutes is satisfied, so doing a reset at 2:20
 * quietly clears the 2:30 one instead of nagging twenty minutes later.
 */
export function satisfyBreak(plan: WorkdayPlan, session: WorkoutSession): WorkdayPlan {
  if (plan.generatedFor !== todayKey()) return plan;
  const started = new Date(session.startedAt);
  const minute = started.getHours() * 60 + started.getMinutes();

  const explicit = session.plannedBreakId
    ? plan.breaks.find((entry) => entry.id === session.plannedBreakId && isOpen(entry))
    : null;
  const inWindow = plan.breaks.find(
    (entry) => isOpen(entry) && minute >= effectiveStart(entry) - 5 && minute <= entry.endMinutes + 15,
  );
  const nearest = plan.breaks
    .filter(isOpen)
    .map((entry) => ({ entry, distance: Math.abs(effectiveStart(entry) - minute) }))
    .filter(({ distance }) => distance <= 45)
    .sort((a, b) => a.distance - b.distance)[0]?.entry;

  const target = explicit ?? inWindow ?? nearest;
  if (!target) return plan;

  return {
    ...plan,
    responseMinutes: [minute, ...plan.responseMinutes].slice(0, 30),
    breaks: plan.breaks.map((entry) =>
      entry.id === target.id
        ? { ...entry, status: "completed" as const, completedSessionId: session.sessionId }
        : entry,
    ),
  };
}

export function snoozeBreak(plan: WorkdayPlan, id: string, minutes = 15): WorkdayPlan {
  const now = minutesNow();
  return {
    ...plan,
    breaks: plan.breaks.map((entry) =>
      entry.id === id
        ? { ...entry, status: "snoozed" as const, snoozedUntilMinutes: now + minutes }
        : entry,
    ),
  };
}

export function skipBreak(plan: WorkdayPlan, id: string): WorkdayPlan {
  const entry = plan.breaks.find((item) => item.id === id);
  return {
    ...plan,
    ignoredMinutes: entry ? [entry.startMinutes, ...plan.ignoredMinutes].slice(0, 30) : plan.ignoredMinutes,
    breaks: plan.breaks.map((item) =>
      item.id === id ? { ...item, status: "skipped" as const } : item,
    ),
  };
}

export function markDelivered(plan: WorkdayPlan, id: string): WorkdayPlan {
  return {
    ...plan,
    breaks: plan.breaks.map((item) =>
      item.id === id && item.status === "planned" ? { ...item, status: "delivered" as const } : item,
    ),
  };
}

/** Deep link a reminder should open. Micro-breaks go straight to their routine. */
export function breakHref(entry: PlannedBreak): string {
  const program = BREAK_TYPE_PROGRAM[entry.type];
  const base = program
    ? `/app/workout/${program}?need=${entry.need}`
    : `/app/start?need=${entry.need}&minutes=${entry.durationMin}`;
  return `${base}&source=planned_break&break=${encodeURIComponent(entry.id)}`;
}

/** Copy for the reminder itself. Utility over cheer. */
export function reminderCopy(entry: PlannedBreak): { title: string; body: string } {
  const copy = BREAK_TYPE_COPY[entry.type];
  switch (entry.type) {
    case "walk":
      return { title: "Good time to walk", body: "Two minutes away from the screen." };
    case "stand":
      return { title: "Stand up for a minute", body: "A change of position is enough." };
    case "eyes":
      return { title: "Eyes off the screen", body: "One minute. Look at something far away." };
    case "energy":
      return { title: "Afternoon slump?", body: `Your ${entry.durationMin}-minute Energy Reset is ready.` };
    default:
      return { title: "Good time to move", body: `Your ${entry.durationMin}-minute ${copy.label} is ready.` };
  }
}
