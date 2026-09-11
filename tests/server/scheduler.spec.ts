import "./setup";
import { expect, test } from "@playwright/test";
import {
  EMAIL_WINDOW_END,
  EMAIL_WINDOW_START,
  emailDecision,
  localMoment,
  pushDecision,
} from "../../src/lib/server/scheduler";

const candidate = {
  email: "person@example.com",
  reminderFrequency: "daily",
  timezone: "Europe/London",
  workdays: null,
};

test.describe("localMoment", () => {
  test("reads the clock in the profile's zone, not the runner's", () => {
    const at = new Date("2026-09-11T13:30:00Z"); // Friday
    expect(localMoment("Europe/London", at)).toEqual({ date: "2026-09-11", minutes: 14 * 60 + 30, weekday: 5 });
    expect(localMoment("Asia/Tokyo", at)).toEqual({ date: "2026-09-11", minutes: 22 * 60 + 30, weekday: 5 });
    expect(localMoment("Pacific/Auckland", new Date("2026-09-11T13:30:00Z"))).toMatchObject({
      date: "2026-09-12",
      weekday: 6,
    });
    expect(localMoment("Not/AZone", at)).toEqual({ date: "2026-09-11", minutes: 13 * 60 + 30, weekday: 5 });
  });
});

test.describe("emailDecision", () => {
  test("sends inside the local afternoon window on a workday", () => {
    // 14:30 in London on a Friday.
    expect(emailDecision(candidate, new Date("2026-09-11T13:30:00Z"))).toEqual({
      send: true,
      localDate: "2026-09-11",
    });
  });

  test("a delayed runner still sends anywhere inside the window, and not after", () => {
    const start = EMAIL_WINDOW_START / 60;
    expect(emailDecision(candidate, new Date(`2026-09-11T${String(start - 1).padStart(2, "0")}:59:00Z`))).toMatchObject({
      send: true,
    }); // 15:59 London (BST) is 14:59 UTC... window in local time
    // Just before the window closes (15:59 local = 14:59Z in BST).
    expect(emailDecision(candidate, new Date("2026-09-11T14:59:00Z"))).toMatchObject({ send: true });
    // At the close (16:00 local).
    expect(emailDecision(candidate, new Date("2026-09-11T15:00:00Z"))).toEqual({
      send: false,
      reason: "outside_window",
    });
    // Before it opens (13:59 local).
    expect(emailDecision(candidate, new Date("2026-09-11T12:59:00Z"))).toEqual({
      send: false,
      reason: "outside_window",
    });
    expect(EMAIL_WINDOW_END).toBeGreaterThan(EMAIL_WINDOW_START);
  });

  test("time zones: the same instant is due in one zone and not another", () => {
    const at = new Date("2026-09-11T05:30:00Z");
    expect(emailDecision({ ...candidate, timezone: "Asia/Tokyo" }, at)).toMatchObject({ send: true }); // 14:30 JST
    expect(emailDecision({ ...candidate, timezone: "America/Los_Angeles" }, at)).toEqual({
      send: false,
      reason: "outside_window",
    }); // 22:30 previous evening
    expect(emailDecision({ ...candidate, timezone: null }, new Date("2026-09-11T14:30:00Z"))).toMatchObject({
      send: true,
      localDate: "2026-09-11",
    }); // no zone recorded: UTC
  });

  test("non-working days are skipped, by default and by preference", () => {
    // Saturday 14:30 London.
    expect(emailDecision(candidate, new Date("2026-09-12T13:30:00Z"))).toEqual({
      send: false,
      reason: "not_workday",
    });
    // Someone who works weekends gets it.
    expect(emailDecision({ ...candidate, workdays: [0, 6] }, new Date("2026-09-12T13:30:00Z"))).toMatchObject({
      send: true,
    });
    // And not on their Friday off.
    expect(emailDecision({ ...candidate, workdays: [1, 2, 3, 4] }, new Date("2026-09-11T13:30:00Z"))).toEqual({
      send: false,
      reason: "not_workday",
    });
  });

  test("opt-out and no-email are never sent", () => {
    const at = new Date("2026-09-11T13:30:00Z");
    expect(emailDecision({ ...candidate, reminderFrequency: "off" }, at)).toEqual({ send: false, reason: "opted_out" });
    expect(emailDecision({ ...candidate, reminderFrequency: null }, at)).toEqual({ send: false, reason: "opted_out" });
    expect(emailDecision({ ...candidate, email: null }, at)).toEqual({ send: false, reason: "no_email" });
  });
});

test.describe("pushDecision", () => {
  const planned = { status: "planned" as const, startMinutes: 600, endMinutes: 630, snoozedUntilMinutes: null };

  test("sends when the window opens, tolerates a late runner, then expires", () => {
    expect(pushDecision(planned, 599)).toEqual({ send: false, reason: "not_due" });
    expect(pushDecision(planned, 600)).toEqual({ send: true });
    expect(pushDecision(planned, 640)).toEqual({ send: true }); // 10 minutes late
    expect(pushDecision(planned, 646)).toEqual({ send: false, reason: "expired" });
  });

  test("snooze delays to the snoozed time, then sends once", () => {
    const snoozed = { ...planned, status: "snoozed" as const, snoozedUntilMinutes: 615 };
    expect(pushDecision(snoozed, 605)).toEqual({ send: false, reason: "snoozed" });
    expect(pushDecision(snoozed, 615)).toEqual({ send: true });
    expect(pushDecision(snoozed, 631)).toEqual({ send: false, reason: "expired" });
  });

  test("skipped, completed and delivered breaks never send", () => {
    expect(pushDecision({ ...planned, status: "skipped" }, 600)).toEqual({ send: false, reason: "not_open" });
    expect(pushDecision({ ...planned, status: "completed" }, 600)).toEqual({ send: false, reason: "not_open" });
    expect(pushDecision({ ...planned, status: "delivered" }, 600)).toEqual({ send: false, reason: "already_delivered" });
  });

  test("a reset just done near the window satisfies it instead of nagging", () => {
    expect(pushDecision(planned, 605, [590])).toEqual({ send: false, reason: "satisfied" });
    expect(pushDecision(planned, 605, [500])).toEqual({ send: true });
  });
});
