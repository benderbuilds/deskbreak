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
  active: { label: "Active", hint: "A one-minute stand about every hour, plus full resets." },
};

/**
 * What each level puts into a day, in order across the workday.
 *
 * The user never sees a break count; they pick how much help they want and the
 * planner decides what that means. "Active" is built differently (see
 * generateActiveBreaks): a one-minute stand every 45 to 60 minutes, which is
 * what the evidence on breaking up sitting points at, plus three full resets.
 */
const LEVEL_SHAPES: Record<Exclude<ReminderLevel, "active">, BreakType[]> = {
  minimal: ["move", "move"],
  balanced: ["move", "walk", "move", "energy"],
};

/** Active level: micro-breaks this far apart, in minutes. */
export const MICRO_BREAK_SPACING = { min: 45, target: 50, max: 60 } as const;
/** A one-minute stand needs a shorter window than a full reset. */
export const MICRO_WINDOW_MINUTES = 15;
/** The full resets inside an Active day, and roughly where they fall (share of the day). */
const ACTIVE_FULL_RESETS: { type: BreakType; at: number }[] = [
  { type: "move", at: 0.2 },
  { type: "move", at: 0.5 },
  { type: "energy", at: 0.8 },
];

/** One-minute stand or walk breaks. They count as activity like any reset. */
export function isMicroBreak(entry: Pick<PlannedBreak, "type">): boolean {
  return entry.type === "stand" || entry.type === "eyes";
}

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

type GenerateInput = {
  preferences: WorkdayPreferences;
  date: string;
  plan?: Pick<WorkdayPlan, "responseMinutes" | "ignoredMinutes"> | null;
  signals?: PersonalizationSignals | null;
  preferredDuration?: DurationMinutes | null;
};

function plannedBreak(
  input: GenerateInput,
  index: number,
  type: BreakType,
  startMinutes: number,
  windowMinutes: number,
): PlannedBreak {
  const copy = BREAK_TYPE_COPY[type];
  const durationMin: DurationMinutes =
    type === "move" && input.preferredDuration && input.preferredDuration <= 3
      ? input.preferredDuration
      : copy.durationMin;
  return {
    id: `${input.date}-${index + 1}-${type}`,
    date: input.date,
    startMinutes,
    endMinutes: startMinutes + windowMinutes,
    type,
    need: copy.need,
    durationMin,
    status: "planned",
    snoozedUntilMinutes: null,
    completedSessionId: null,
    recommendationId: null,
  };
}

/**
 * The Active day: an even grid of breaks 45 to 60 minutes apart across the
 * workday. Three of them are full resets (morning, midday, afternoon energy);
 * the rest are one-minute stands. Full resets drift toward when the person
 * actually moves, by at most 15 minutes so the spacing holds.
 */
function generateActiveBreaks(input: GenerateInput): PlannedBreak[] {
  const { preferences } = input;
  const first = preferences.startMinutes + 45;
  const last = preferences.endMinutes - 30;
  const span = Math.max(0, last - first);
  let count = Math.max(1, Math.round(span / MICRO_BREAK_SPACING.target) + 1);
  if (count > 1 && span / (count - 1) > MICRO_BREAK_SPACING.max) count += 1;
  if (count > 2 && span / (count - 1) < MICRO_BREAK_SPACING.min) count -= 1;
  const spacing = count > 1 ? span / (count - 1) : 0;
  const starts = Array.from({ length: count }, (_, index) => roundToFive(first + spacing * index));

  const fullAt = new Map<number, BreakType>();
  for (const reset of ACTIVE_FULL_RESETS.slice(0, count)) {
    let index = Math.round(reset.at * (count - 1));
    while (fullAt.has(index) && index < count - 1) index += 1;
    while (fullAt.has(index) && index > 0) index -= 1;
    fullAt.set(index, reset.type);
  }

  return starts.map((nominal, index) => {
    const full = fullAt.get(index);
    if (!full) return plannedBreak(input, index, "stand", nominal, MICRO_WINDOW_MINUTES);
    const adapted = adaptStart(nominal, input.plan ?? null, input.signals ?? null, {
      start: preferences.startMinutes,
      end: preferences.endMinutes,
    });
    const start = roundToFive(Math.max(nominal - 15, Math.min(nominal + 15, adapted)));
    return plannedBreak(input, index, full, start, Math.min(WINDOW_MINUTES, preferences.endMinutes - start));
  });
}

export function generateBreaks(input: GenerateInput): PlannedBreak[] {
  const { preferences, date } = input;
  if (!preferences.enabledDays.includes(weekdayOf(date))) return [];
  if (preferences.level === "active") return generateActiveBreaks(input);

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
    return plannedBreak(input, index, type, windowStart, WINDOW_MINUTES);
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

/** Breaks done out of breaks planned. A one-minute stand counts like a full reset. */
export function planProgress(plan: WorkdayPlan): {
  done: number;
  total: number;
  microDone: number;
  microTotal: number;
} {
  const micro = plan.breaks.filter(isMicroBreak);
  return {
    done: plan.breaks.filter((entry) => entry.status === "completed").length,
    total: plan.breaks.length,
    microDone: micro.filter((entry) => entry.status === "completed").length,
    microTotal: micro.length,
  };
}

/**
 * Credits a one-minute stand or walk taken outside a workout (the "I stood
 * up" button) to the open micro-break it falls nearest, within 20 minutes.
 */
export function satisfyMicroBreak(plan: WorkdayPlan, at: Date): WorkdayPlan {
  if (plan.generatedFor !== todayKey(at)) return plan;
  const minute = at.getHours() * 60 + at.getMinutes();
  const target = plan.breaks
    .filter((entry) => isOpen(entry) && isMicroBreak(entry))
    .map((entry) => ({ entry, distance: Math.abs(effectiveStart(entry) - minute) }))
    .filter(({ distance }) => distance <= 20)
    .sort((a, b) => a.distance - b.distance)[0]?.entry;
  if (!target) return plan;
  return {
    ...plan,
    responseMinutes: [minute, ...plan.responseMinutes].slice(0, 30),
    breaks: plan.breaks.map((entry) =>
      entry.id === target.id ? { ...entry, status: "completed" as const } : entry,
    ),
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
