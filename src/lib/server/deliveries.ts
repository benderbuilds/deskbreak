import "server-only";

import { createHash } from "node:crypto";
import { findOne, insertUnique, update, updateMany, type NotificationDeliveryRow } from "./store";

/**
 * Persistent delivery records for every scheduled notification.
 *
 * Every logical send has one dedupe key. A run claims the key before it sends
 * anything; a second run, overlapping or retried, finds the key taken and
 * skips. Only a send that failed becomes claimable again, after its retry
 * delay, and claiming it is itself a conditional update so two retries cannot
 * both proceed.
 */
export type DeliveryKind = "push" | "email";

export type DeliveryClaim =
  | { claimed: true; row: NotificationDeliveryRow }
  | { claimed: false; reason: "already_sent" | "in_progress" | "not_yet" | "skipped" };

export function emailTarget(email: string): string {
  return `sha256:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

/**
 * One key per break, per day, per device, per attempt. A snooze starts a new
 * attempt (keyed on the snoozed-until minute) so the reminder can go out again
 * at the snoozed time while the original send stays deduplicated.
 */
export function pushDedupeKey(input: {
  breakId: string;
  date: string;
  endpoint: string;
  attempt: string | number | null;
}): string {
  const device = createHash("sha256").update(input.endpoint).digest("hex").slice(0, 16);
  return `push:${input.date}:${input.breakId}:${input.attempt ?? "first"}:${device}`;
}

export function emailDedupeKey(profileId: string, localDate: string): string {
  return `email:${localDate}:${profileId}`;
}

export async function claimDelivery(
  input: {
    kind: DeliveryKind;
    dedupeKey: string;
    profileId: string | null;
    target: string | null;
  },
  now = new Date(),
): Promise<DeliveryClaim> {
  const row: NotificationDeliveryRow = {
    id: crypto.randomUUID(),
    profile_id: input.profileId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    target: input.target,
    status: "sending",
    attempted_at: now.toISOString(),
    delivered_at: null,
    error: null,
    retry_after: null,
  };
  const inserted = await insertUnique("notification_deliveries", row, "dedupe_key");
  if (inserted) return { claimed: true, row: inserted };

  const existing = await findOne("notification_deliveries", { dedupe_key: input.dedupeKey });
  if (!existing) return { claimed: false, reason: "in_progress" };
  if (existing.status === "delivered") return { claimed: false, reason: "already_sent" };
  if (existing.status === "skipped") return { claimed: false, reason: "skipped" };
  if (existing.status === "failed") {
    if (existing.retry_after && new Date(existing.retry_after).getTime() > now.getTime()) {
      return { claimed: false, reason: "not_yet" };
    }
    // Conditional: only one retry can flip failed -> sending.
    const taken = await updateMany(
      "notification_deliveries",
      { id: existing.id, status: "failed" },
      { status: "sending", attempted_at: now.toISOString(), error: null },
    );
    if (taken === 1) return { claimed: true, row: { ...existing, status: "sending" } };
  }
  return { claimed: false, reason: "in_progress" };
}

export async function markDelivered(id: string, now = new Date()): Promise<void> {
  await update(
    "notification_deliveries",
    { id },
    { status: "delivered", delivered_at: now.toISOString(), error: null },
  );
}

export async function markFailed(
  id: string,
  error: string,
  options: { retryMinutes?: number | null } = {},
  now = new Date(),
): Promise<void> {
  // null means "never retry"; undefined means the default delay.
  const retryMinutes = options.retryMinutes === undefined ? 10 : options.retryMinutes;
  await update(
    "notification_deliveries",
    { id },
    {
      status: retryMinutes === null ? "skipped" : "failed",
      error: error.slice(0, 200),
      retry_after: retryMinutes === null ? null : new Date(now.getTime() + retryMinutes * 60_000).toISOString(),
    },
  );
}

/** Records a decision not to send, so the key is held and nobody retries it. */
export async function markSkipped(id: string, reason: string): Promise<void> {
  await update("notification_deliveries", { id }, { status: "skipped", error: reason.slice(0, 200) });
}
