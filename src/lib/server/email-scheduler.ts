import "server-only";

import {
  claimDelivery,
  deliveryPayload,
  emailDedupeKey,
  emailIdempotencyKey,
  emailTarget,
  markDelivered,
  markFailed,
} from "./deliveries";
import { reminderEmail, sendEmail } from "./email";
import { emailDecision, type EmailDecision } from "./scheduler";
import { findMany, findOne, type WorkdayPreferencesRow } from "./store";
import { reminderLineFor } from "../reminders";

/**
 * The daily reminder mailer.
 *
 * Recipients are profiles that opted in to a daily reminder and whose local
 * clock is inside the afternoon window right now. A delivery record per
 * profile per local day means the caller's cadence is irrelevant: call it
 * every minute or once an hour, late or twice at once, each person still gets
 * at most one email a day.
 */
function workdays(prefs: WorkdayPreferencesRow | null): number[] | null {
  if (!prefs) return null;
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

export type EmailRunSummary = {
  sent: number;
  due: number;
  duplicates: number;
  failed: number;
  skipped: Record<Exclude<EmailDecision, { send: true }>["reason"], number>;
};

export async function runEmailScheduler(
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<EmailRunSummary> {
  const now = options.now ?? new Date();
  const summary: EmailRunSummary = {
    sent: 0,
    due: 0,
    duplicates: 0,
    failed: 0,
    skipped: { no_email: 0, opted_out: 0, not_workday: 0, outside_window: 0 },
  };
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(/\/$/, "");

  const profiles = await findMany("profiles", { reminder_frequency: "daily" }, { limit: 5000 });
  for (const profile of profiles) {
    const prefs = await findOne("workday_preferences", { profile_id: profile.id });
    const decision = emailDecision(
      {
        email: profile.email,
        reminderFrequency: profile.reminder_frequency,
        timezone: profile.timezone ?? prefs?.timezone ?? null,
        workdays: workdays(prefs),
      },
      now,
    );
    if (!decision.send) {
      summary.skipped[decision.reason] += 1;
      continue;
    }
    summary.due += 1;
    if (options.dryRun) continue;

    const claim = await claimDelivery(
      {
        kind: "email",
        dedupeKey: emailDedupeKey(profile.id, decision.localDate),
        profileId: profile.id,
        target: emailTarget(profile.email as string),
      },
      now,
    );
    if (!claim.claimed) {
      summary.duplicates += 1;
      continue;
    }

    // Rendered once per delivery record; a retry reuses the stored message
    // under the same idempotency key, so the provider sees one logical send.
    const message = await deliveryPayload(claim.row, () =>
      reminderEmail({
        line: reminderLineFor(decision.localDate),
        need: profile.primary_need ?? null,
        appUrl,
      }),
    );
    const result = await sendEmail({
      to: profile.email as string,
      ...message,
      idempotencyKey: emailIdempotencyKey(claim.row.id),
    });
    if (result.delivered) {
      summary.sent += 1;
      await markDelivered(claim.row.id, now);
    } else {
      summary.failed += 1;
      // Try again later in the window; the record stops a second send today.
      await markFailed(claim.row.id, result.reason ?? "send_failed", { retryMinutes: 30 }, now);
    }
  }
  return summary;
}

