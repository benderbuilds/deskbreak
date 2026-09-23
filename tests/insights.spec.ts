import { expect, test } from "@playwright/test";
import { activeDayKeys, activityOn } from "../src/lib/insights";

// A fixed zone, set before any date is read, so "the same evening" means the
// same thing on every machine that runs the suite.
process.env.TZ = "America/New_York";

function reset(finishedAt: string, elapsedSec = 180) {
  return { finishedAt, elapsedSec, exercises: [] };
}

test.describe("active days", () => {
  test("two resets on one local evening are one active day", async () => {
    // 7:30 pm and 9:30 pm on a Tuesday in New York: one day here, two in UTC.
    const days = activeDayKeys([reset("2026-09-01T23:30:00.000Z"), reset("2026-09-02T01:30:00.000Z")]);
    expect(days).toEqual(["2026-09-01"]);
  });

  test("resets on separate local days stay separate", async () => {
    const days = activeDayKeys([reset("2026-09-01T16:00:00.000Z"), reset("2026-09-02T16:00:00.000Z")]);
    expect(days).toEqual(["2026-09-01", "2026-09-02"]);
  });

  test("a late-evening reset counts towards the day it was done", async () => {
    // Same 9:30 pm reset: Today should see it, not tomorrow.
    const history = [reset("2026-09-02T01:30:00.000Z")];
    expect(activityOn(history, [], "2026-09-01").resets).toBe(1);
    expect(activityOn(history, [], "2026-09-02").resets).toBe(0);
  });
});
