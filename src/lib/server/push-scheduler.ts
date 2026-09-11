import "server-only";

import { claimDelivery, markDelivered, markFailed, pushDedupeKey } from "./deliveries";
import { hasProAccess } from "./entitlements";
import { sendPush } from "./push";
import { localMoment, pushDecision } from "./scheduler";
import { signalsFor } from "./signals";
import {
  findMany,
  update,
  upsert,
  type PlannedBreakRow,
  type PushSubscriptionRow,
  type WorkdayPreferencesRow,
} from "./store";
import { generateBreaks, reminderCopy, breakHref } from "../workday";
import type { PlannedBreak, ReminderLevel } from "../types";

/**
 * The push scheduler.
 *
 * For every Pro profile with workday preferences and a live push subscription:
 * make sure today's breaks exist, decide (in the profile's own time zone)
 * which are due, and send one notification per device. Every send is claimed
 * in `notification_deliveries` before it happens, so an overlapping, late or
 * retried run finds the claim and skips. Snoozes start a new claim; skips,
 * completions and expiry end the break.
 */
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

export type PushRunSummary = {
  sent: number;
  considered: number;
  /** Sends another run had already claimed. */
  duplicates: number;
  failed: number;
};

async function ensureTodaysBreaks(
  prefs: WorkdayPreferencesRow,
  date: string,
  days: number[],
  timezone: string | null,
): Promise<PlannedBreakRow[]> {
  const rows = await findMany("planned_breaks", { profile_id: prefs.profile_id, date });
  if (rows.length) return rows;
  const signals = await signalsFor({ profileId: prefs.profile_id }).catch(() => null);
  const generated = generateBreaks({
    preferences: {
      startMinutes: prefs.workday_start,
      endMinutes: prefs.workday_end,
      level: prefs.reminder_level as ReminderLevel,
      enabledDays: days,
      timezone,
    },
    date,
    plan: { responseMinutes: signals?.completionMinutes ?? [], ignoredMinutes: [] },
    signals,
  });
  const fresh: PlannedBreakRow[] = generated.map((entry) => ({
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
  // Upsert by id: two runs generating the same day cannot double up.
  for (const row of fresh) await upsert("planned_breaks", row, "id");
  return findMany("planned_breaks", { profile_id: prefs.profile_id, date });
}

export async function runPushScheduler(now = new Date()): Promise<PushRunSummary> {
  const summary: PushRunSummary = { sent: 0, considered: 0, duplicates: 0, failed: 0 };
  const preferences = await findMany("workday_preferences", {});
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(/\/$/, "");

  for (const prefs of preferences) {
    if (!(await hasProAccess(prefs.profile_id))) continue;
    const subscriptions = (await findMany("push_subscriptions", {
      profile_id: prefs.profile_id,
      revoked_at: null,
    })) as PushSubscriptionRow[];
    if (!subscriptions.length) continue;

    const timezone = prefs.timezone ?? subscriptions[0].timezone ?? null;
    const { date, minutes, weekday } = localMoment(timezone, now);
    const days = enabledDays(prefs);
    if (!days.includes(weekday)) continue;

    const rows = await ensureTodaysBreaks(prefs, date, days, timezone);

    // Anything completed today near a window satisfies it instead of nagging.
    const recent = await findMany("sessions", { user_id: prefs.profile_id }, {
      orderBy: "started_at",
      descending: true,
      limit: 5,
    });
    const recentMinutes = recent
      .map((row) => localMoment(timezone, new Date(row.started_at)))
      .filter((moment) => moment.date === date)
      .map((moment) => moment.minutes);

    for (const row of rows) {
      const entry = toBreak(row);
      summary.considered += 1;
      const decision = pushDecision(entry, minutes, recentMinutes);
      if (!decision.send) {
        if (decision.reason === "satisfied") {
          await update("planned_breaks", { id: row.id }, { status: "completed", updated_at: now.toISOString() });
        }
        continue;
      }

      const copy = reminderCopy(entry);
      const payload = {
        title: copy.title,
        body: copy.body,
        url: `${appUrl}${breakHref(entry)}`,
        tag: `deskbreak-break-${row.id}`,
        breakId: row.id,
        actions: [
          { action: "start", title: "Start" },
          { action: "snooze", title: "15 min" },
          { action: "skip", title: "Skip" },
        ],
      };

      let delivered = false;
      for (const subscription of subscriptions) {
        const claim = await claimDelivery(
          {
            kind: "push",
            dedupeKey: pushDedupeKey({
              breakId: row.id,
              date,
              endpoint: subscription.endpoint,
              attempt: row.status === "snoozed" ? row.snoozed_until : null,
            }),
            profileId: prefs.profile_id,
            target: subscription.endpoint,
          },
          now,
        );
        if (!claim.claimed) {
          summary.duplicates += 1;
          continue;
        }
        const result = await sendPush(subscription, payload);
        if (result.delivered) {
          await markDelivered(claim.row.id, now);
          delivered = true;
        } else {
          summary.failed += 1;
          await markFailed(claim.row.id, result.gone ? "endpoint_gone" : "send_failed", {
            retryMinutes: result.gone ? null : 10,
          }, now);
        }
      }
      if (delivered) {
        summary.sent += 1;
        await update(
          "planned_breaks",
          { id: row.id },
          { status: "delivered", delivered_at: now.toISOString(), updated_at: now.toISOString() },
        );
      }
    }
  }
  return summary;
}

