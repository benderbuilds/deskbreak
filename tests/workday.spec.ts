import { expect, test } from "@playwright/test";
import { emptySignals } from "../src/lib/personalization";
import {
  createPlan,
  generateBreaks,
  isDue,
  nextBreak,
  planForToday,
  satisfyBreak,
  skipBreak,
  snoozeBreak,
} from "../src/lib/workday";
import { todayKey } from "../src/lib/dates";
import type { WorkdayPreferences, WorkoutSession } from "../src/lib/types";

const prefs: WorkdayPreferences = {
  startMinutes: 8 * 60 + 30,
  endMinutes: 17 * 60,
  level: "balanced",
  enabledDays: [1, 2, 3, 4, 5],
  timezone: null,
};

// A Wednesday.
const DATE = "2026-09-09";

function session(startMinutes: number): WorkoutSession {
  const started = new Date(2026, 8, 9, Math.floor(startMinutes / 60), startMinutes % 60);
  return {
    sessionId: `s-${startMinutes}`,
    programId: "desk-reset-3min",
    programName: "3-Minute Desk Reset",
    primaryNeed: "general",
    setup: "either",
    durationMin: 3,
    completedExerciseIds: [],
    skippedExerciseIds: [],
    exercises: [],
    elapsedSec: 180,
    startedAt: started.toISOString(),
    finishedAt: new Date(started.getTime() + 180_000).toISOString(),
    recommendationId: null,
    algorithmVersion: null,
    source: "today",
    plannedBreakId: null,
    generated: false,
  };
}

test.describe("workday planner", () => {
  test("levels produce a sensible number of windows inside the workday", async () => {
    const minimal = generateBreaks({ preferences: { ...prefs, level: "minimal" }, date: DATE });
    const balanced = generateBreaks({ preferences: prefs, date: DATE });
    const active = generateBreaks({ preferences: { ...prefs, level: "active" }, date: DATE });
    expect(minimal.length).toBe(2);
    expect(balanced.length).toBe(4);
    expect(active.length).toBe(6);
    for (const entry of [...minimal, ...balanced, ...active]) {
      expect(entry.startMinutes).toBeGreaterThanOrEqual(prefs.startMinutes + 30);
      expect(entry.endMinutes).toBeLessThanOrEqual(prefs.endMinutes);
      expect(entry.endMinutes - entry.startMinutes).toBe(30);
    }
    // Different moments call for different interventions.
    expect(new Set(balanced.map((entry) => entry.type)).size).toBeGreaterThan(1);
  });

  test("weekends and disabled days get no breaks", async () => {
    expect(generateBreaks({ preferences: prefs, date: "2026-09-12" })).toEqual([]);
    expect(generateBreaks({ preferences: { ...prefs, enabledDays: [1] }, date: DATE })).toEqual([]);
  });

  test("a reset done just before a window satisfies it", async () => {
    const plan = { ...createPlan(prefs), generatedFor: todayKey() };
    const target = plan.breaks[1];
    const satisfied = satisfyBreak(plan, session(target.startMinutes - 10));
    expect(satisfied.breaks[1].status).toBe("completed");
    expect(satisfied.breaks[0].status).toBe("planned");
    expect(satisfied.responseMinutes[0]).toBe(target.startMinutes - 10);
  });

  test("snooze, skip and due detection", async () => {
    const plan = { ...createPlan(prefs), generatedFor: todayKey() };
    const first = plan.breaks[0];
    expect(isDue(first, first.startMinutes + 5)).toBe(true);
    expect(isDue(first, first.startMinutes - 5)).toBe(false);

    const skipped = skipBreak(plan, first.id);
    expect(skipped.breaks[0].status).toBe("skipped");
    expect(skipped.ignoredMinutes).toContain(first.startMinutes);
    expect(nextBreak(skipped, first.startMinutes)?.id).toBe(plan.breaks[1].id);

    const snoozed = snoozeBreak(plan, first.id, 15);
    expect(snoozed.breaks[0].status).toBe("snoozed");
    expect(snoozed.breaks[0].snoozedUntilMinutes).toBeGreaterThan(0);
  });

  test("windows drift toward the times a person actually moves", async () => {
    const base = generateBreaks({ preferences: prefs, date: DATE });
    // The person keeps taking the second break 25 minutes into its window.
    const late = base[1].startMinutes + 25;
    const adapted = generateBreaks({
      preferences: prefs,
      date: DATE,
      plan: { responseMinutes: [late, late, late], ignoredMinutes: [] },
    });
    expect(adapted[1].startMinutes).toBeGreaterThan(base[1].startMinutes);
    expect(adapted[1].startMinutes - base[1].startMinutes).toBeLessThanOrEqual(30);
    expect(adapted[0].startMinutes).toBe(base[0].startMinutes);
    expect(adapted[3].startMinutes).toBe(base[3].startMinutes);

    // Ignoring a window twice pushes it later rather than nagging sooner.
    const nudged = generateBreaks({
      preferences: prefs,
      date: DATE,
      plan: { responseMinutes: [], ignoredMinutes: [base[0].startMinutes, base[0].startMinutes] },
    });
    expect(nudged[0].startMinutes).toBeGreaterThan(base[0].startMinutes);
  });

  test("a stale plan is regenerated for today and yesterday's unanswered breaks count as ignored", async () => {
    const stale = { ...createPlan(prefs), generatedFor: "2026-09-08" };
    const fresh = planForToday(stale, { signals: emptySignals(), date: DATE });
    expect(fresh.generatedFor).toBe(DATE);
    expect(fresh.ignoredMinutes.length).toBe(stale.breaks.length);
    expect(fresh.breaks.every((entry) => entry.status === "planned")).toBe(true);
  });
});
