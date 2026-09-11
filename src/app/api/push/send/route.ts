import { NextResponse } from "next/server";
import { hasProAccess } from "@/lib/server/entitlements";
import { pushConfigured, sendPush } from "@/lib/server/push";
import { signalsFor } from "@/lib/server/signals";
import {
  findMany,
  insertMany,
  isDurable,
  update,
  type PlannedBreakRow,
  type PushSubscriptionRow,
  type WorkdayPreferencesRow,
} from "@/lib/server/store";
import { generateBreaks, isDue, reminderCopy, breakHref } from "@/lib/workday";
import type { PlannedBreak, ReminderLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The push scheduler. Meant to be hit every 10 to 15 minutes by a cron.
 *
 * For every Pro profile with workday preferences and a live push subscription:
 * make sure today's breaks exist, find the ones whose window has just opened,
 * and send one notification each. Windows, snoozes and skips are honoured; a
 * break is delivered at most once.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function localNow(timezone: string | null): { date: string; minutes: number; weekday: number } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone ?? "UTC",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      minutes: Number(get("hour")) % 24 * 60 + Number(get("minute")),
      weekday: weekdays.indexOf(get("weekday")),
    };
  } catch {
    return { date: now.toISOString().slice(0, 10), minutes: now.getUTCHours() * 60 + now.getUTCMinutes(), weekday: now.getUTCDay() };
  }
}

function enabledDays(prefs: WorkdayPreferencesRow): number[] {
  const flags = [
    prefs.sunday_enabled,
    prefs.monday_enabled,
    prefs.tuesday_enabled,
    prefs.wednesday_enabled,
    prefs.thursday_enabled,
    prefs.friday_enabled,
    prefs.saturday_enabled,
  ];
  return flags.flatMap((enabled, index) => (enabled ? [index] : []));
}

function toBreak(row: PlannedBreakRow): PlannedBreak {
  return {
    id: row.id,
    date: row.date,
    startMinutes: row.start_window,
    endMinutes: row.end_window,
    type: row.type as PlannedBreak["type"],
    need: row.need as PlannedBreak["need"],
    durationMin: row.duration_minutes as PlannedBreak["durationMin"],
    status: row.status as PlannedBreak["status"],
    snoozedUntilMinutes: row.snoozed_until,
    completedSessionId: row.completed_session_id,
    recommendationId: row.recommendation_id,
  };
}

async function run() {
  const preferences = await findMany("workday_preferences", {});
  let sent = 0;
  let considered = 0;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(/\/$/, "");

  for (const prefs of preferences) {
    if (!(await hasProAccess(prefs.profile_id))) continue;
    const subscriptions = (await findMany("push_subscriptions", { profile_id: prefs.profile_id, revoked_at: null })) as PushSubscriptionRow[];
    if (!subscriptions.length) continue;

    const timezone = prefs.timezone ?? subscriptions[0].timezone ?? null;
    const { date, minutes, weekday } = localNow(timezone);
    const days = enabledDays(prefs);
    if (!days.includes(weekday)) continue;

    let rows = await findMany("planned_breaks", { profile_id: prefs.profile_id, date });
    if (!rows.length) {
      const signals = await signalsFor({ profileId: prefs.profile_id }).catch(() => null);
      const responded = signals?.completionMinutes ?? [];
      const generated = generateBreaks({
        preferences: {
          startMinutes: prefs.workday_start,
          endMinutes: prefs.workday_end,
          level: prefs.reminder_level as ReminderLevel,
          enabledDays: days,
          timezone,
        },
        date,
        plan: { responseMinutes: responded, ignoredMinutes: [] },
        signals,
      });
      rows = generated.map((entry) => ({
        id: `${prefs.profile_id.slice(0, 8)}-${entry.id}`,
        profile_id: prefs.profile_id,
        date,
        start_window: entry.startMinutes,
        end_window: entry.endMinutes,
        type: entry.type,
        need: entry.need,
        duration_minutes: entry.durationMin,
        recommendation_id: null,
        status: "planned",
        snoozed_until: null,
        completed_session_id: null,
        delivered_at: null,
        updated_at: new Date().toISOString(),
      }));
      await insertMany("planned_breaks", rows);
    }

    // Anything completed in the last hour or so satisfies the current window.
    const recent = await findMany("sessions", { user_id: prefs.profile_id }, {
      orderBy: "started_at",
      descending: true,
      limit: 3,
    });
    const recentMinutes = recent
      .map((row) => localNow(timezone).date === row.started_at.slice(0, 10) ? new Date(row.started_at) : null)
      .filter((value): value is Date => value !== null)
      .map((value) => {
        const local = new Intl.DateTimeFormat("en-US", { timeZone: timezone ?? "UTC", hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(value);
        const get = (type: string) => Number(local.find((part) => part.type === type)?.value ?? 0);
        return get("hour") % 24 * 60 + get("minute");
      });

    for (const row of rows) {
      const entry = toBreak(row);
      considered += 1;
      if (row.status !== "planned" && row.status !== "snoozed") continue;
      if (!isDue(entry, minutes)) continue;
      if (recentMinutes.some((minute) => Math.abs(minute - entry.startMinutes) <= 45)) {
        await update("planned_breaks", { id: row.id }, { status: "completed", updated_at: new Date().toISOString() });
        continue;
      }
      if (row.status === "snoozed" && row.delivered_at && entry.snoozedUntilMinutes && minutes < entry.snoozedUntilMinutes) continue;

      const copy = reminderCopy(entry);
      const url = `${appUrl}${breakHref(entry)}`;
      let delivered = false;
      for (const subscription of subscriptions) {
        const result = await sendPush(subscription, {
          title: copy.title,
          body: copy.body,
          url,
          tag: `deskbreak-break-${row.id}`,
          breakId: row.id,
          actions: [
            { action: "start", title: "Start" },
            { action: "snooze", title: "15 min" },
            { action: "skip", title: "Skip" },
          ],
        });
        delivered = delivered || result.delivered;
      }
      if (delivered) {
        sent += 1;
        await update(
          "planned_breaks",
          { id: row.id },
          { status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        );
      }
    }
  }
  return { sent, considered };
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDurable()) {
    return NextResponse.json({ error: "no_store", sent: 0 }, { status: 503 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "push_not_configured", sent: 0 }, { status: 503 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[deskbreak] push send failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

/** Vercel Cron calls GET; anything else can POST. Both need the bearer secret. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
