import { expect, test } from "@playwright/test";
import { emptySignals } from "../src/lib/personalization";
import {
  createPlan,
  generateBreaks,
  isDue,
  isMicroBreak,
  MICRO_BREAK_SPACING,
  MICRO_WINDOW_MINUTES,
  nextBreak,
  planForToday,
  planProgress,
  satisfyBreak,
  satisfyMicroBreak,
  skipBreak,
  snoozeBreak,
} from "../src/lib/workday";
import {
  defaultStandNudge,
  isStandNudgeDue,
  lastActiveAt,
  markStandNudgeShown,
  nextStandNudgeAt,
  snoozeStandNudge,
  STAND_NUDGE_INTERVAL_MINUTES,
  isDailyReminderDue,
} from "../src/lib/reminders";
import { todayKey } from "../src/lib/dates";
import {
  activeSecondsFor,
  activityOn,
  formatActiveTime,
  isHelpfulEnough,
  patternsReady,
  ratingsUntilPatterns,
  sessionMovedLabel,
  totalActiveSeconds,
} from "../src/lib/insights";
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
    expect(active.length).toBeGreaterThan(balanced.length);
    for (const entry of [...minimal, ...balanced, ...active]) {
      expect(entry.startMinutes).toBeGreaterThanOrEqual(prefs.startMinutes + 30);
      expect(entry.endMinutes).toBeLessThanOrEqual(prefs.endMinutes);
      expect(entry.endMinutes - entry.startMinutes).toBe(isMicroBreak(entry) ? MICRO_WINDOW_MINUTES : 30);
    }
    // Different moments call for different interventions.
    expect(new Set(balanced.map((entry) => entry.type)).size).toBeGreaterThan(1);
  });

  test("Active means a one-minute stand every 45 to 60 minutes plus two or three full resets", async () => {
    for (const [start, end] of [
      [8 * 60 + 30, 17 * 60],
      [9 * 60, 18 * 60],
      [7 * 60, 15 * 60 + 30],
      [10 * 60, 16 * 60],
    ]) {
      // Someone who keeps moving around 12:25 pulls the midday reset toward it.
      const day = generateBreaks({
        preferences: { ...prefs, level: "active", startMinutes: start, endMinutes: end },
        date: DATE,
        plan: { responseMinutes: [745, 745, 745], ignoredMinutes: [] },
      });
      const label = `${start}-${end}`;
      const full = day.filter((entry) => !isMicroBreak(entry));
      const micro = day.filter(isMicroBreak);
      expect(full.length, label).toBeGreaterThanOrEqual(2);
      expect(full.length, label).toBeLessThanOrEqual(3);
      expect(micro.length, label).toBeGreaterThan(0);
      for (const entry of micro) {
        expect(entry.type).toBe("stand");
        expect(entry.durationMin).toBe(1);
      }
      for (let i = 1; i < day.length; i += 1) {
        const gap = day[i].startMinutes - day[i - 1].startMinutes;
        // Full resets may drift up to 15 minutes toward when the person moves.
        expect(gap, `${label}: gap ${i}`).toBeGreaterThanOrEqual(MICRO_BREAK_SPACING.min - 15);
        expect(gap, `${label}: gap ${i}`).toBeLessThanOrEqual(MICRO_BREAK_SPACING.max + 15);
      }
      const nominal = generateBreaks({ preferences: { ...prefs, level: "active", startMinutes: start, endMinutes: end }, date: DATE });
      for (let i = 1; i < nominal.length; i += 1) {
        const gap = nominal[i].startMinutes - nominal[i - 1].startMinutes;
        expect(gap).toBeGreaterThanOrEqual(MICRO_BREAK_SPACING.min - 5);
        expect(gap).toBeLessThanOrEqual(MICRO_BREAK_SPACING.max + 5);
      }
    }
  });

  test("a one-minute stand counts as activity", async () => {
    const plan = { ...createPlan({ ...prefs, level: "active" }), generatedFor: todayKey() };
    const stand = plan.breaks.find(isMicroBreak)!;
    const at = new Date();
    at.setHours(Math.floor(stand.startMinutes / 60), stand.startMinutes % 60 + 5, 0, 0);
    const done = satisfyMicroBreak(plan, at);
    expect(done.breaks.find((entry) => entry.id === stand.id)!.status).toBe("completed");
    const progress = planProgress(done);
    expect(progress.done).toBe(1);
    expect(progress.microDone).toBe(1);
    expect(progress.microTotal).toBeGreaterThan(0);
    // A running session near the stand satisfies it too.
    const bySession = satisfyBreak(plan, session(stand.startMinutes + 2));
    expect(bySession.breaks.find((entry) => entry.id === stand.id)!.status).toBe("completed");
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

/** Local time on the test Wednesday. */
function at(hours: number, minutes = 0, day = 9): Date {
  return new Date(2026, 8, day, hours, minutes);
}

test.describe("free stand-up nudge", () => {
  test("is on by default and fires about 50 minutes after the last movement", async () => {
    const settings = defaultStandNudge();
    expect(settings.enabled).toBe(true);
    expect(STAND_NUDGE_INTERVAL_MINUTES).toBeGreaterThanOrEqual(45);
    expect(STAND_NUDGE_INTERVAL_MINUTES).toBeLessThanOrEqual(60);

    const next = nextStandNudgeAt({ settings, now: at(10), lastActiveAt: at(9, 40) });
    expect(next).toEqual(at(10, 30));
    expect(isStandNudgeDue({ settings, now: at(10, 29), lastActiveAt: at(9, 40) })).toBe(false);
    expect(isStandNudgeDue({ settings, now: at(10, 30), lastActiveAt: at(9, 40) })).toBe(true);
  });

  test("counts from the start of the working day, not from yesterday", async () => {
    const next = nextStandNudgeAt({ settings: defaultStandNudge(), now: at(8, 31), lastActiveAt: at(16, 0, 8) });
    expect(next).toEqual(at(9, 20));
  });

  test("respects quiet hours, weekends, snooze and the off switch", async () => {
    const settings = defaultStandNudge();
    // Late in the day: rolls to tomorrow morning.
    expect(nextStandNudgeAt({ settings, now: at(16, 30), lastActiveAt: at(16, 20) })).toEqual(at(9, 20, 10));
    // Friday evening: rolls to Monday.
    expect(nextStandNudgeAt({ settings, now: at(18, 0, 11), lastActiveAt: at(17, 30, 11) })).toEqual(at(9, 20, 14));
    // Snooze pushes it back.
    const snoozed = snoozeStandNudge(settings, at(10, 30), 15);
    expect(nextStandNudgeAt({ settings: snoozed, now: at(10, 30), lastActiveAt: at(9, 40) })).toEqual(at(10, 45));
    // Showing a nudge restarts the interval.
    const shown = markStandNudgeShown(settings, at(10, 30));
    expect(nextStandNudgeAt({ settings: shown, now: at(10, 31), lastActiveAt: at(9, 40) })).toEqual(at(11, 20));
    expect(nextStandNudgeAt({ settings: { ...settings, enabled: false }, now: at(10) })).toBeNull();
    // Custom hours.
    expect(
      nextStandNudgeAt({ settings, now: at(6, 0), hours: { startMinutes: 7 * 60, endMinutes: 15 * 60, enabledDays: [3] } }),
    ).toEqual(at(7, 50));
  });

  test("steps aside for a planned break that is due anyway", async () => {
    const next = nextStandNudgeAt({
      settings: defaultStandNudge(),
      now: at(10),
      lastActiveAt: at(9, 40),
      plannedBreaks: [{ date: DATE, startMinutes: 10 * 60 + 35, endMinutes: 11 * 60 + 5, status: "planned" }],
    });
    expect(next).toEqual(at(11, 10));
  });

  test("the last movement is the latest session or micro-break", async () => {
    expect(
      lastActiveAt({ history: [{ finishedAt: at(9).toISOString() }], microBreaks: [at(9, 50).toISOString()] }),
    ).toEqual(at(9, 50));
    expect(lastActiveAt({ history: [], microBreaks: [] })).toBeNull();
  });
});

test.describe("honest numbers", () => {
  test("time moved is what was actually done, not the routine's length", async () => {
    const quit = {
      ...session(600),
      durationMin: 3 as const,
      elapsedSec: 41,
      exercises: [
        { exerciseId: "chin-tuck", sequence: 0, plannedSec: 30, actualSec: 30, completed: true, skipped: false, swapped: false, swappedToExerciseId: null, discomfortReported: false, discomfortReason: null },
        { exerciseId: "shoulder-rolls", sequence: 1, plannedSec: 30, actualSec: 11, completed: false, skipped: true, swapped: false, swappedToExerciseId: null, discomfortReported: false, discomfortReason: null },
      ],
    };
    expect(activeSecondsFor(quit)).toBe(41);
    expect(sessionMovedLabel(quit)).toBe("41 seconds moved");
    // Older sessions without records use the measured time.
    expect(activeSecondsFor({ exercises: [], elapsedSec: 175 })).toBe(175);
    expect(formatActiveTime(179)).toBe("2 minutes");
    expect(totalActiveSeconds([quit, { ...session(700), elapsedSec: 180 }])).toBe(221);
  });

  test("patterns wait for five rated sessions, and 'most helpful' needs to have helped half the time", async () => {
    const rated = (n: number) => Array.from({ length: n }, (_, i) => ({ ...session(600 + i), perceivedEffect: "better" as const }));
    expect(patternsReady(rated(4))).toBe(false);
    expect(ratingsUntilPatterns(rated(4))).toBe(1);
    expect(patternsReady([...rated(5), session(900)])).toBe(true);
    expect(isHelpfulEnough(1, 4)).toBe(false);
    expect(isHelpfulEnough(2, 4)).toBe(true);
    expect(isHelpfulEnough(1, 1)).toBe(false);
  });

  test("a day's activity counts resets and micro-breaks", async () => {
    const day = activityOn([session(600), session(700)], [new Date(2026, 8, 9, 11).toISOString(), new Date(2026, 8, 8, 11).toISOString()], DATE);
    expect(day.resets).toBe(2);
    expect(day.microBreaks).toBe(1);
    expect(day.activeSeconds).toBe(360);
  });
});

test.describe("free daily reminder in the open tab", () => {
  const reminder = { id: "daily", minutes: 12 * 60 + 5, weekdaysOnly: true, kind: "daily" as const, enabled: true };
  // Friday 18 September 2026, local time.
  const at = (h: number, m: number, day = 18) => new Date(2026, 8, day, h, m);

  test("fires from its time until the grace window closes, once a day", () => {
    expect(isDailyReminderDue({ reminder, now: at(12, 4), firedOn: null, lastActiveAt: null })).toBe(false);
    expect(isDailyReminderDue({ reminder, now: at(12, 5), firedOn: null, lastActiveAt: null })).toBe(true);
    expect(isDailyReminderDue({ reminder, now: at(14, 5), firedOn: null, lastActiveAt: null })).toBe(true);
    expect(isDailyReminderDue({ reminder, now: at(14, 6), firedOn: null, lastActiveAt: null })).toBe(false);
    expect(isDailyReminderDue({ reminder, now: at(12, 30), firedOn: "2026-09-18", lastActiveAt: null })).toBe(false);
    expect(isDailyReminderDue({ reminder, now: at(12, 30), firedOn: "2026-09-17", lastActiveAt: null })).toBe(true);
  });

  test("skips weekends when weekday-only, and stays quiet when switched off", () => {
    expect(isDailyReminderDue({ reminder, now: at(12, 30, 19), firedOn: null, lastActiveAt: null })).toBe(false);
    expect(
      isDailyReminderDue({ reminder: { ...reminder, weekdaysOnly: false }, now: at(12, 30, 19), firedOn: null, lastActiveAt: null }),
    ).toBe(true);
    expect(isDailyReminderDue({ reminder: { ...reminder, enabled: false }, now: at(12, 30), firedOn: null, lastActiveAt: null })).toBe(false);
    expect(isDailyReminderDue({ reminder: undefined, now: at(12, 30), firedOn: null, lastActiveAt: null })).toBe(false);
  });

  test("does not ask when they already moved after the reminder time", () => {
    expect(isDailyReminderDue({ reminder, now: at(12, 30), firedOn: null, lastActiveAt: at(12, 10) })).toBe(false);
    expect(isDailyReminderDue({ reminder, now: at(12, 30), firedOn: null, lastActiveAt: at(11, 50) })).toBe(true);
  });
});
