import { expect, test } from "@playwright/test";
import { applyFeedbackToSignals, applySessionToSignals, signalsFromHistory } from "../src/lib/personalization";
import { APP_STATE_VERSION, migrateV2State, normalizeSession } from "../src/lib/storage";

const v2Session = {
  sessionId: "old-1",
  programId: "neck-reset-2min",
  programName: "2-Minute Neck Reset",
  primaryNeed: "neck_shoulders",
  setup: "seated",
  durationMin: 2,
  completedExerciseIds: ["chin-tuck", "shoulder-rolls"],
  skippedExerciseIds: ["neck-side-stretch"],
  elapsedSec: 118,
  startedAt: "2026-09-01T14:00:00.000Z",
  finishedAt: "2026-09-01T14:02:00.000Z",
  perceivedEffect: "somewhat",
};

test.describe("state migration", () => {
  test("a V2 blob comes forward with its history, feedback and plan intact", async () => {
    const migrated = migrateV2State({
      version: 2,
      anonymousId: "anon-1",
      email: "jesse@example.com",
      primaryNeed: "neck_shoulders",
      preferredSetup: "seated",
      progress: {
        streak: 3,
        lastWorkoutDate: "2026-09-01",
        totalWorkouts: 7,
        xp: 120,
        history: [v2Session],
        lastWorkout: v2Session,
      },
      plan: {
        startMinutes: 540,
        endMinutes: 1020,
        preference: "frequent",
        troubleSpots: ["neck_shoulders"],
        generatedFor: "2026-09-01",
        breaks: [],
      },
      challenge: { startedOn: "2026-08-31", baseline: "stiff", finalRating: null, primaryProblem: null, completedDays: [], completedAt: null },
    } as never);

    expect(migrated.version).toBe(APP_STATE_VERSION);
    expect(migrated.progress.totalWorkouts).toBe(7);
    expect(migrated.progress.history[0].perceivedEffect).toBe("same");
    expect(migrated.progress.history[0].exercises).toEqual([]);
    expect(migrated.progress.history[0].source).toBe("unknown");
    expect(migrated.plan?.preferences.level).toBe("active");
    expect(migrated.plan?.preferences.startMinutes).toBe(540);
    expect(migrated.plan?.generatedFor).toBeNull();
    expect(migrated.challenge.baseline).toBe(3);
    expect(migrated.account.email).toBe("jesse@example.com");
    expect(migrated.constraints).toEqual([]);
    // Signals are rebuilt from the history so the engine learns from day one.
    expect(migrated.signals["chin-tuck"]?.completed).toBe(1);
    expect(migrated.signals["neck-side-stretch"]?.skipped).toBe(1);
  });

  test("normalizeSession maps every legacy perceived effect", async () => {
    expect(normalizeSession({ ...v2Session, perceivedEffect: "not_better" } as never).perceivedEffect).toBe("worse");
    expect(normalizeSession({ ...v2Session, perceivedEffect: "better" } as never).perceivedEffect).toBe("better");
    expect(normalizeSession({ ...v2Session, perceivedEffect: undefined } as never).perceivedEffect).toBeUndefined();
  });
});

test.describe("signals", () => {
  test("outcomes credit completed moves and debit skipped or swapped ones", async () => {
    const session = {
      ...normalizeSession(v2Session as never),
      exercises: [
        { exerciseId: "chin-tuck", sequence: 0, plannedSec: 30, actualSec: 30, completed: true, skipped: false, swapped: false, swappedToExerciseId: null, discomfortReported: false, discomfortReason: null },
        { exerciseId: "neck-side-stretch", sequence: 1, plannedSec: 30, actualSec: 4, completed: true, skipped: false, swapped: true, swappedToExerciseId: "shoulder-rolls", discomfortReported: true, discomfortReason: "painful" as const },
        { exerciseId: "unshrug", sequence: 2, plannedSec: 30, actualSec: 0, completed: false, skipped: true, swapped: false, swappedToExerciseId: null, discomfortReported: false, discomfortReason: null },
      ],
    };
    let signals = applySessionToSignals({}, session);
    expect(signals["chin-tuck"].completed).toBe(1);
    expect(signals["neck-side-stretch"].swapped).toBe(1);
    expect(signals["neck-side-stretch"].discomfort).toBe(1);
    expect(signals["shoulder-rolls"].completed).toBe(1);
    expect(signals["unshrug"].skipped).toBe(1);

    signals = applyFeedbackToSignals(signals, session, "better");
    expect(signals["chin-tuck"].better).toBe(1);
    expect(signals["shoulder-rolls"].better).toBe(1);
    expect(signals["neck-side-stretch"].better ?? 0).toBe(0);

    signals = applyFeedbackToSignals(signals, session, "worse");
    expect(signals["chin-tuck"].worse).toBe(1);
    expect(signals["unshrug"].worse).toBe(2);
  });

  test("history rolls up into setup, need and time-of-day outcomes", async () => {
    const base = normalizeSession(v2Session as never);
    const history = [
      { ...base, sessionId: "a", setup: "standing" as const, perceivedEffect: "better" as const },
      { ...base, sessionId: "b", setup: "standing" as const, perceivedEffect: "better" as const },
      { ...base, sessionId: "c", setup: "seated" as const, perceivedEffect: "worse" as const, durationMin: 3 as const },
    ];
    const signals = signalsFromHistory(history, {});
    expect(signals.sessionCount).toBe(3);
    expect(signals.setupOutcomes.standing.better).toBe(2);
    expect(signals.setupOutcomes.seated.worse).toBe(1);
    expect(signals.needOutcomes.neck_shoulders?.rated).toBe(3);
    expect(signals.durationCounts[2]).toBe(2);
    expect(signals.durationCounts[3]).toBe(1);
    expect(signals.recentExerciseIds).toContain("chin-tuck");
  });
});
