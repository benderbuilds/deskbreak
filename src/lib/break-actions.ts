"use client";

import { track } from "./analytics";
import { recordMicroBreak } from "./storage";
import { breakHref, isMicroBreak } from "./workday";
import type { PlannedBreak, WorkdayPlan } from "./types";

/** One wording for planned breaks on Today and Plan. */
export const BREAK_ACTION_COPY = {
  start: "Start break",
  startEarly: "Start early",
  snooze: "In 15 min",
  skip: "Skip",
  missed: "Missed",
  skipped: "Skipped",
  done: "Done",
} as const;

/** What a micro-break's "done" button says. */
export function microActionLabel(entry: Pick<PlannedBreak, "type">): string {
  return entry.type === "stand" ? "I stood up" : "Done";
}

/** The title a planned break shows: a one-minute stand reads as an instruction. */
export function breakTitle(entry: Pick<PlannedBreak, "type">, fallback: string): string {
  if (entry.type === "stand") return "Stand up";
  if (entry.type === "eyes") return "Look away from the screen";
  return fallback;
}

export function startBreakHref(entry: PlannedBreak, source: "today" | "plan"): string {
  track("planned_break_started", { break_id: entry.id, break_type: entry.type, source });
  return breakHref(entry);
}

/**
 * "I stood up": a micro-break done without opening a routine. Counted as
 * activity, and the planned break is marked complete here and on the server.
 */
export function completeMicroBreak(entry: PlannedBreak, source: "today" | "plan"): void {
  if (!isMicroBreak(entry)) return;
  recordMicroBreak({ plannedBreakId: entry.id });
  track("planned_break_completed", { break_id: entry.id, break_type: entry.type, source, micro: true });
  void fetch("/api/planned-breaks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: entry.id, status: "completed" }),
  }).catch(() => {});
}

/** Sends today's breaks to the server so push reminders follow the edits. */
export async function syncBreaks(plan: WorkdayPlan): Promise<void> {
  if (!plan.generatedFor) return;
  try {
    await fetch("/api/planned-breaks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: plan.generatedFor, breaks: plan.breaks }),
    });
  } catch {
    /* the push scheduler regenerates from preferences if this never lands */
  }
}
