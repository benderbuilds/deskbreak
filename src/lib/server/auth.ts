import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ensureProfile, normalizeEmail } from "./entitlements";
import {
  findMany,
  findOne,
  insert,
  remove,
  update,
  updateMany,
  type FunctionalConstraintRow,
  type LoginTokenRow,
  type Profile,
} from "./store";
import { isFunctionalConstraint } from "../types";

/**
 * Magic-link sign in, and the rules for what a sign-in may touch.
 *
 * A link carries a random token whose hash is stored with an expiry. Opening
 * it once sets an HMAC-signed session cookie holding the profile id. No
 * password exists anywhere. The secret comes from AUTH_SECRET; without it,
 * sign-in is unavailable and the app says so rather than minting unsigned
 * cookies.
 *
 * Ownership rules, in one place:
 * - Requesting a link never changes an existing account. Preferences sent with
 *   the request wait in the token row until the link is opened.
 * - The requesting browser is remembered by a nonce cookie. Only a browser that
 *   presents both the link and that cookie has its anonymous history and
 *   pending preferences merged into the account. Opening the link elsewhere
 *   still signs in, but merges nothing.
 * - Merging only ever moves anonymous data (rows with no owner, or a profile
 *   with no email) into the verified account. Data that belongs to another
 *   emailed account is never moved.
 */
export const SESSION_COOKIE = "deskbreak_session";
export const LINK_NONCE_COOKIE = "deskbreak_link";
const SESSION_DAYS = 90;

export function linkMinutes(): number {
  const raw = Number(process.env.AUTH_LINK_TTL_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

function secret(): string | null {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || null;
}

export function authConfigured(): boolean {
  return Boolean(secret());
}

function sign(payload: string): string {
  return createHmac("sha256", secret() ?? "").update(payload).digest("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", secret() ?? "").update(`login:${token}`).digest("hex");
}

export function hashNonce(nonce: string): string {
  return createHash("sha256").update(`nonce:${nonce}`).digest("hex");
}

export type PendingPreferences = {
  primaryNeed?: string | null;
  preferredSetup?: string | null;
  preferredDuration?: number | null;
  constraints?: string[];
  attribution?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    landingPath?: string | null;
  } | null;
};

export async function createLoginToken(
  profile: Profile,
  input: {
    nextPath: string;
    anonymousId: string | null;
    pending: PendingPreferences | null;
  },
  now = Date.now(),
): Promise<{ id: string; token: string; nonce: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = new Date(now + linkMinutes() * 60_000).toISOString();
  const row: LoginTokenRow = {
    id: crypto.randomUUID(),
    profile_id: profile.id,
    token_hash: hashToken(token),
    next_path: input.nextPath.startsWith("/") ? input.nextPath : "/app",
    expires_at: expiresAt,
    used_at: null,
    created_at: new Date(now).toISOString(),
    anonymous_id: input.anonymousId,
    nonce_hash: hashNonce(nonce),
    pending: input.pending ? (input.pending as Record<string, unknown>) : null,
  };
  await insert("login_tokens", row);
  return { id: row.id, token, nonce, expiresAt };
}

export type ConsumedToken = {
  profile: Profile;
  nextPath: string;
  anonymousId: string | null;
  nonceHash: string | null;
  pending: PendingPreferences | null;
};

/** Exchanges a link token for its profile, exactly once, while it is fresh. */
export async function consumeLoginToken(
  token: string,
  now = Date.now(),
): Promise<ConsumedToken | null> {
  if (!token || !secret()) return null;
  const row = await findOne("login_tokens", { token_hash: hashToken(token) });
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < now) {
    // Dead for good: an expired link is not revived by a later, slower clock.
    await updateMany("login_tokens", { id: row.id, used_at: null }, { used_at: new Date(now).toISOString() });
    return null;
  }
  // Mark used before handing back the profile so two opens cannot both win.
  const claimed = await updateMany(
    "login_tokens",
    { id: row.id, used_at: null },
    { used_at: new Date(now).toISOString() },
  );
  if (claimed === 0) return null;
  const profile = await findOne("profiles", { id: row.profile_id });
  if (!profile) return null;
  return {
    profile,
    nextPath: row.next_path,
    anonymousId: row.anonymous_id,
    nonceHash: row.nonce_hash,
    pending: (row.pending as PendingPreferences | null) ?? null,
  };
}

/** Whether the browser opening a link is the one that asked for it. */
export function nonceMatches(nonceHash: string | null, cookieNonce: string | undefined): boolean {
  if (!nonceHash || !cookieNonce) return false;
  const a = Buffer.from(hashNonce(cookieNonce));
  const b = Buffer.from(nonceHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookieValue(profileId: string, now = Date.now()): string {
  const expires = now + SESSION_DAYS * 86_400_000;
  const payload = `${profileId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Cookies are Secure whenever the app is served over https. `next start` on a
 * plain http origin (local smoke tests) is the only case where they are not.
 */
export function cookieSecure(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://";
  return !appUrl.startsWith("http://");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

export function linkNonceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge: linkMinutes() * 60,
  };
}

export function verifySessionCookie(value: string | undefined, now = Date.now()): string | null {
  if (!value || !secret()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [profileId, expires, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < now) return null;
  const expected = sign(`${profileId}.${expires}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return profileId;
}

/** The signed-in profile for this request, or null. */
export async function currentProfile(): Promise<Profile | null> {
  const jar = await cookies();
  const profileId = verifySessionCookie(jar.get(SESSION_COOKIE)?.value);
  if (!profileId) return null;
  return findOne("profiles", { id: profileId });
}

/** Finds the profile behind an email, creating a bare one for a new address. */
export async function profileForEmail(email: string): Promise<Profile> {
  const normalized = normalizeEmail(email);
  const existing = await findOne("profiles", { email: normalized });
  if (existing) return existing;
  return ensureProfile({ email: normalized });
}

/**
 * Applies preferences a browser captured before it signed in.
 *
 * Only called once the link has been opened by the browser that asked for it.
 * Constraints replace the stored set; that browser's list is the current one.
 */
export async function applyPendingPreferences(
  profile: Profile,
  pending: PendingPreferences | null,
): Promise<void> {
  if (!pending) return;
  const patch: Partial<Profile> = { updated_at: new Date().toISOString() };
  if (pending.primaryNeed) patch.primary_need = pending.primaryNeed;
  if (pending.preferredSetup !== undefined) patch.preferred_setup = pending.preferredSetup;
  if (pending.preferredDuration !== undefined) patch.preferred_duration = pending.preferredDuration;
  if (pending.attribution && !profile.first_utm_source && !profile.first_landing_path) {
    patch.first_utm_source = pending.attribution.source ?? null;
    patch.first_utm_medium = pending.attribution.medium ?? null;
    patch.first_utm_campaign = pending.attribution.campaign ?? null;
    patch.first_utm_content = pending.attribution.content ?? null;
    patch.first_landing_path = pending.attribution.landingPath ?? null;
  }
  await update("profiles", { id: profile.id }, patch);

  if (Array.isArray(pending.constraints)) {
    await replaceConstraints(profile.id, pending.constraints.filter(isFunctionalConstraint));
  }
}

export async function replaceConstraints(profileId: string, wanted: string[]): Promise<void> {
  const existing = await findMany("functional_constraints", { profile_id: profileId });
  for (const row of existing) {
    if (!wanted.includes(row.constraint_key)) await remove("functional_constraints", { id: row.id });
  }
  for (const key of wanted) {
    if (!existing.some((row) => row.constraint_key === key)) {
      const row: FunctionalConstraintRow = {
        id: crypto.randomUUID(),
        profile_id: profileId,
        constraint_key: key,
        created_at: new Date().toISOString(),
      };
      await insert("functional_constraints", row);
    }
  }
}

export type MergeSummary = {
  sessions: number;
  pushSubscriptions: number;
  recommendations: number;
  subscriptions: number;
  /** Set when the anonymous id belonged to another signed-in account. */
  blocked: boolean;
  /**
   * Set when the anonymous id belongs to a device-bound paid profile and the
   * caller could not prove it is that device: the paid profile is left whole so
   * it keeps its Pro, and only ownerless rows move.
   */
  keptPaidProfile: boolean;
};

/**
 * Folds an anonymous browser into a verified account.
 *
 * Moves rows that have no owner (anonymous sessions, push subscriptions and
 * recommendations) and, when the anonymous id belonged to a profile that has
 * no email, that profile's rows too. An anonymous id already attached to a
 * different emailed account is left alone: nothing crosses between accounts.
 *
 * Subscriptions move only when `includeSubscriptions` is set, which callers
 * pass only for a browser that proved it is the one that asked to sign in.
 */
export async function mergeAnonymousInto(
  profile: Profile,
  anonymousId: string | null,
  options: { includeSubscriptions?: boolean } = {},
): Promise<MergeSummary> {
  const summary: MergeSummary = {
    sessions: 0,
    pushSubscriptions: 0,
    recommendations: 0,
    subscriptions: 0,
    blocked: false,
    keptPaidProfile: false,
  };
  if (!anonymousId) return summary;

  const owner = await findOne("profiles", { anonymous_id: anonymousId });
  if (owner && owner.id !== profile.id) {
    if (owner.email) {
      // Another real account owns this browser id. Not ours to take.
      summary.blocked = true;
      return summary;
    }
    const paid = await findOne("subscriptions", { user_id: owner.id });
    if (paid && !options.includeSubscriptions) {
      summary.keptPaidProfile = true;
      return summary;
    }
    // An anonymous shell profile: absorb it.
    summary.sessions += await updateMany("sessions", { user_id: owner.id }, { user_id: profile.id });
    summary.pushSubscriptions += await updateMany(
      "push_subscriptions",
      { profile_id: owner.id },
      { profile_id: profile.id },
    );
    summary.recommendations += await updateMany(
      "recommendations",
      { profile_id: owner.id },
      { profile_id: profile.id },
    );
    if (options.includeSubscriptions) {
      summary.subscriptions += await updateMany(
        "subscriptions",
        { user_id: owner.id },
        { user_id: profile.id },
      );
    }
    await update("profiles", { id: owner.id }, { anonymous_id: null });
    if (owner.billing_email && !profile.billing_email) {
      await update("profiles", { id: profile.id }, { billing_email: owner.billing_email });
    }
  }

  summary.sessions += await updateMany(
    "sessions",
    { anonymous_id: anonymousId, user_id: null },
    { user_id: profile.id },
  );
  summary.pushSubscriptions += await updateMany(
    "push_subscriptions",
    { anonymous_id: anonymousId, profile_id: null },
    { profile_id: profile.id },
  );
  summary.recommendations += await updateMany(
    "recommendations",
    { anonymous_id: anonymousId, profile_id: null },
    { profile_id: profile.id },
  );
  if (!profile.anonymous_id) {
    await update("profiles", { id: profile.id }, { anonymous_id: anonymousId });
  }
  return summary;
}

/**
 * Attaches purchases made under this verified address.
 *
 * Checkout records the address Stripe collected as `billing_email` on the
 * anonymous profile that paid. Nothing trusts that address until someone opens
 * a sign-in link sent to it; at that point the paid profile, and the history
 * on it, becomes part of the verified account. Profiles that have their own
 * login email are never touched here.
 */
export async function absorbBillingProfiles(profile: Profile): Promise<number> {
  if (!profile.email) return 0;
  const shells = await findMany("profiles", { billing_email: profile.email, email: null });
  let moved = 0;
  for (const shell of shells) {
    if (shell.id === profile.id) continue;
    moved += await updateMany("subscriptions", { user_id: shell.id }, { user_id: profile.id });
    await updateMany("sessions", { user_id: shell.id }, { user_id: profile.id });
    await updateMany("push_subscriptions", { profile_id: shell.id }, { profile_id: profile.id });
    await updateMany("recommendations", { profile_id: shell.id }, { profile_id: profile.id });
    // The shell keeps its anonymous id and billing address: the device that
    // paid stays recognisable, and entitlement lookups for that device follow
    // the billing address to this account (see getEntitlementForAnonymousId).
    // If the account has no device of its own yet, it adopts this one.
    if (shell.anonymous_id && !profile.anonymous_id) {
      const deviceId = shell.anonymous_id;
      await update("profiles", { id: shell.id }, { anonymous_id: null });
      await update("profiles", { id: profile.id }, { anonymous_id: deviceId });
      profile.anonymous_id = deviceId;
    }
  }
  if (moved && !profile.billing_email) {
    await update("profiles", { id: profile.id }, { billing_email: profile.email });
  }
  return moved;
}
