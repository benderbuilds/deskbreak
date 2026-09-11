import "server-only";

import { createHmac } from "node:crypto";
import { findMany, insert, removeWhere, type AuthRequestRow } from "./store";

/**
 * Abuse limits for sign-in link requests.
 *
 * Every request is written to `auth_requests` before it is judged, so the
 * limits hold across server instances: each instance counts the same rows.
 * Only hashes are stored (address and requester, keyed with the auth secret),
 * and the answer is the same for an address that has an account and one that
 * does not, so the endpoint cannot be used to find out which is which.
 *
 * Three limits:
 * - a resend cooldown per address, measured from the last request that
 *   actually produced a link, so hammering a locked address cannot keep its
 *   owner locked out;
 * - an hourly cap per address, counting links actually produced;
 * - a more generous hourly cap per requester (IP), counting every attempt.
 *
 * Being throttled never touches existing links: a valid link stays valid.
 */
const HOUR_MS = 60 * 60 * 1000;

export type LinkLimits = {
  cooldownSeconds: number;
  emailHourlyCap: number;
  requesterHourlyCap: number;
};

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function linkLimits(): LinkLimits {
  return {
    cooldownSeconds: positiveInt(process.env.AUTH_LINK_COOLDOWN_SECONDS, 60),
    emailHourlyCap: positiveInt(process.env.AUTH_LINK_HOURLY_CAP, 5),
    requesterHourlyCap: positiveInt(process.env.AUTH_LINK_IP_HOURLY_CAP, 30),
  };
}

function keyed(kind: string, value: string): string {
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET || "";
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

export function emailHash(normalizedEmail: string): string {
  return keyed("email", normalizedEmail);
}

/** The requester, as the platform reports it. Vercel sets x-forwarded-for. */
export function requesterHash(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return keyed("requester", ip);
}

export type LinkRequestVerdict =
  | { allowed: true }
  | { allowed: false; reason: "cooldown" | "email_cap" | "requester_cap"; retryAfterSeconds: number };

export async function judgeLinkRequest(
  input: { emailHash: string; requesterHash: string },
  limits: LinkLimits = linkLimits(),
  now = new Date(),
): Promise<LinkRequestVerdict> {
  const since = new Date(now.getTime() - HOUR_MS).toISOString();
  const own: AuthRequestRow = {
    id: crypto.randomUUID(),
    email_hash: input.emailHash,
    requester_hash: input.requesterHash,
    allowed: false,
    created_at: now.toISOString(),
  };
  // Written first, so a concurrent request on another instance sees it.
  await insert("auth_requests", own);

  const forEmail = (
    await findMany("auth_requests", { email_hash: input.emailHash, allowed: true }, {
      filters: [{ column: "created_at", op: "gte", value: since }],
    })
  ).filter((row) => row.id !== own.id);

  if (limits.cooldownSeconds > 0) {
    const latest = forEmail.reduce<number>((max, row) => Math.max(max, new Date(row.created_at).getTime()), 0);
    const elapsed = (now.getTime() - latest) / 1000;
    if (latest && elapsed < limits.cooldownSeconds) {
      return { allowed: false, reason: "cooldown", retryAfterSeconds: Math.ceil(limits.cooldownSeconds - elapsed) };
    }
  }

  if (forEmail.length >= limits.emailHourlyCap) {
    const oldest = forEmail.reduce<number>(
      (min, row) => Math.min(min, new Date(row.created_at).getTime()),
      Number.POSITIVE_INFINITY,
    );
    return {
      allowed: false,
      reason: "email_cap",
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + HOUR_MS - now.getTime()) / 1000)),
    };
  }

  const forRequester = await findMany("auth_requests", { requester_hash: input.requesterHash }, {
    filters: [{ column: "created_at", op: "gte", value: since }],
  });
  if (forRequester.length > limits.requesterHourlyCap) {
    const oldest = forRequester.reduce<number>(
      (min, row) => Math.min(min, new Date(row.created_at).getTime()),
      Number.POSITIVE_INFINITY,
    );
    return {
      allowed: false,
      reason: "requester_cap",
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + HOUR_MS - now.getTime()) / 1000)),
    };
  }

  const { update } = await import("./store");
  await update("auth_requests", { id: own.id }, { allowed: true });
  return { allowed: true };
}

/** Rows older than a day have no bearing on any limit; drop them. */
export async function pruneLinkRequests(now = new Date()): Promise<void> {
  await removeWhere("auth_requests", {
    column: "created_at",
    op: "lt",
    value: new Date(now.getTime() - 24 * HOUR_MS).toISOString(),
  });
}
