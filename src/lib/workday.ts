import { generatedProgramId } from "./recommendation";
import { todayKey } from "./storage";
import type {
  BreakPreference,
  PlannedBreak,
  PrimaryNeed,
  SetupId,
  WorkdayPlan,
} from "./types";

export const DEFAULT_WORKDAY_START = 8 * 60 + 30;
export const DEFAULT_WORKDAY_END = 17 * 60;

export const BREAK_PREFERENCES: Record<
  BreakPreference,
  { label: string; hint: string; count: number }
> = {
  light: { label: "Light", hint: "2 breaks", count: 2 },
  balanced: { label: "Balanced", hint: "3 breaks", count: 3 },
  frequent: { label: "Frequent", hint: "4 breaks", count: 4 },
};

export function formatMinutes(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${period}`;
}

export function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function toTimeInput(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Rounds to the nearest quarter hour so a plan reads like a calendar, not a cron. */
function roundToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/**
 * Spreads the day's breaks across the workday.
 *
 * Deliberately simple: evenly spaced inside the working window, avoiding the
 * first and last stretch so nothing lands the minute someone sits down or as
 * they are closing the laptop. No calendar integration, no meeting awareness.
 */
export function generateBreaks(input: {
  startMinutes: number;
  endMinutes: number;
  preference: BreakPreference;
  troubleSpots: PrimaryNeed[];
  setup: SetupId;
}): PlannedBreak[] {
  const { count } = BREAK_PREFERENCES[input.preference];
  const span = Math.max(60, input.endMinutes - input.startMinutes);
  const slot = span / (count + 1);

  const needs = input.troubleSpots.length ? input.troubleSpots : ["general" as PrimaryNeed];

  return Array.from({ length: count }, (_, index) => {
    const need = needs[index % needs.length];
    const minutes = roundToQuarter(input.startMinutes + slot * (index + 1));
    // The last break of the day is the one people most often need to be short.
    const durationMin = index === count - 1 ? 2 : index % 2 === 1 ? 3 : 2;
    return {
      id: `break-${index + 1}`,
      minutes,
      need,
      durationMin,
      programId: generatedProgramId({
        need,
        setup: input.setup,
        durationMinutes: durationMin as 2 | 3,
      }),
      status: "pending" as const,
    };
  });
}

export function createPlan(input: {
  startMinutes: number;
  endMinutes: number;
  preference: BreakPreference;
  troubleSpots: PrimaryNeed[];
  setup: SetupId;
}): WorkdayPlan {
  return {
    startMinutes: input.startMinutes,
    endMinutes: input.endMinutes,
    preference: input.preference,
    troubleSpots: input.troubleSpots,
    generatedFor: todayKey(),
    breaks: generateBreaks(input),
  };
}

/** Rebuilds today's breaks when the stored plan was generated on an earlier day. */
export function planForToday(plan: WorkdayPlan, setup: SetupId): WorkdayPlan {
  if (plan.generatedFor === todayKey()) return plan;
  return {
    ...plan,
    generatedFor: todayKey(),
    breaks: generateBreaks({ ...plan, setup }),
  };
}

export function nextBreak(plan: WorkdayPlan, nowMinutes: number): PlannedBreak | null {
  const pending = plan.breaks
    .filter((entry) => entry.status === "pending" || entry.status === "snoozed")
    .sort((a, b) => a.minutes - b.minutes);
  return pending.find((entry) => entry.minutes >= nowMinutes) ?? pending[0] ?? null;
}

export function planProgress(plan: WorkdayPlan): { done: number; total: number } {
  return {
    done: plan.breaks.filter((entry) => entry.status === "done").length,
    total: plan.breaks.length,
  };
}

export function minutesNow(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}
