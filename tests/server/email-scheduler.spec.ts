import "./setup";
import { expect, test } from "@playwright/test";

// The mailer reads its key at module load, so set it before importing.
process.env.RESEND_API_KEY = "re_test_only";

import { runEmailScheduler } from "../../src/lib/server/email-scheduler";
import { ensureProfile } from "../../src/lib/server/entitlements";
import { findMany, resetMemoryStore, update, upsert } from "../../src/lib/server/store";

const sent: string[] = [];
const realFetch = globalThis.fetch;

test.beforeEach(() => {
  resetMemoryStore();
  sent.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.resend.com/")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { to?: string[] };
      sent.push(body.to?.[0] ?? "?");
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

async function subscriber(email: string, timezone: string) {
  const profile = await ensureProfile({ email, primaryNeed: "neck_shoulders" });
  await update("profiles", { id: profile.id }, { reminder_frequency: "daily", timezone });
  return profile;
}

test("repeated, overlapping and late runs send one email per person per day", async () => {
  await subscriber("london@example.com", "Europe/London");
  const inWindow = new Date("2026-09-11T13:30:00Z"); // Friday 14:30 London

  // Two overlapping runs at the same instant.
  const [a, b] = await Promise.all([
    runEmailScheduler({ now: inWindow }),
    runEmailScheduler({ now: inWindow }),
  ]);
  expect(a.sent + b.sent).toBe(1);
  expect(a.duplicates + b.duplicates).toBe(1);

  // A retried run fifteen minutes later, and a late one an hour later.
  expect((await runEmailScheduler({ now: new Date("2026-09-11T13:45:00Z") })).sent).toBe(0);
  expect((await runEmailScheduler({ now: new Date("2026-09-11T14:45:00Z") })).sent).toBe(0);
  expect(sent).toEqual(["london@example.com"]);

  // The next working day sends again.
  expect((await runEmailScheduler({ now: new Date("2026-09-14T13:30:00Z") })).sent).toBe(1);
  expect(sent).toHaveLength(2);
  expect(await findMany("notification_deliveries", { kind: "email" })).toHaveLength(2);
});

test("a run at an odd minute, or well past the hour, still sends inside the window", async () => {
  await subscriber("late@example.com", "Europe/London");
  // 13:03Z is 14:03 in London: the runner fired late, the window is open.
  expect((await runEmailScheduler({ now: new Date("2026-09-11T13:03:00Z") })).sent).toBe(1);
  const delivered = await findMany("notification_deliveries", { kind: "email" });
  expect(delivered).toHaveLength(1);
  expect(delivered[0].status).toBe("delivered");
  expect(delivered[0].target).not.toContain("@");
});

test("time zones, opt-out and non-working days decide per person", async () => {
  await subscriber("tokyo@example.com", "Asia/Tokyo");
  await subscriber("la@example.com", "America/Los_Angeles");
  const optedOut = await subscriber("off@example.com", "Asia/Tokyo");
  await update("profiles", { id: optedOut.id }, { reminder_frequency: "off" });
  const weekend = await subscriber("weekend@example.com", "Asia/Tokyo");
  await upsert(
    "workday_preferences",
    {
      profile_id: weekend.id,
      timezone: "Asia/Tokyo",
      workday_start: 540,
      workday_end: 1020,
      monday_enabled: true,
      tuesday_enabled: true,
      wednesday_enabled: true,
      thursday_enabled: true,
      friday_enabled: false,
      saturday_enabled: false,
      sunday_enabled: false,
      reminder_level: "balanced",
      updated_at: new Date().toISOString(),
    },
    "profile_id",
  );

  // Friday 14:30 in Tokyo; 22:30 Thursday in Los Angeles.
  const summary = await runEmailScheduler({ now: new Date("2026-09-11T05:30:00Z") });
  expect(sent).toEqual(["tokyo@example.com"]);
  expect(summary.skipped.outside_window).toBe(1);
  expect(summary.skipped.not_workday).toBe(1);
  // Opted-out profiles are not even candidates.
  expect(summary.skipped.opted_out).toBe(0);
  expect(summary.sent).toBe(1);
});

test("a dry run reports who is due without sending or claiming", async () => {
  await subscriber("dry@example.com", "Europe/London");
  const summary = await runEmailScheduler({ now: new Date("2026-09-11T13:30:00Z"), dryRun: true });
  expect(summary.due).toBe(1);
  expect(sent).toEqual([]);
  expect(await findMany("notification_deliveries", {})).toHaveLength(0);
  // The real run afterwards still sends: the dry run held nothing.
  expect((await runEmailScheduler({ now: new Date("2026-09-11T13:30:00Z") })).sent).toBe(1);
});

test("a failed send is retried later in the window, but never doubled", async () => {
  await subscriber("flaky@example.com", "Europe/London");
  let calls = 0;
  const flaky = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    if (calls === 1) return new Response("provider hiccup", { status: 500 });
    return flaky(input, init);
  }) as typeof fetch;

  const first = await runEmailScheduler({ now: new Date("2026-09-11T13:15:00Z") });
  expect(first.failed).toBe(1);
  expect(sent).toEqual([]);

  // Ten minutes later: still inside the retry delay, so nothing happens.
  const soon = await runEmailScheduler({ now: new Date("2026-09-11T13:25:00Z") });
  expect(soon.duplicates).toBe(1);

  // Half an hour later: retried, delivered, recorded once.
  const retry = await runEmailScheduler({ now: new Date("2026-09-11T13:50:00Z") });
  expect(retry.sent).toBe(1);
  expect(sent).toEqual(["flaky@example.com"]);
  expect((await runEmailScheduler({ now: new Date("2026-09-11T14:20:00Z") })).sent).toBe(0);
});
