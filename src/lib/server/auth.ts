import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ensureProfile, normalizeEmail } from "./entitlements";
import { findOne, insert, update, type LoginTokenRow, type Profile } from "./store";

/**
 * Magic-link sign in.
 *
 * A link carries a random token whose hash is stored with an expiry. Opening it
 * once sets an HMAC-signed session cookie holding the profile id. No password
 * exists anywhere. The secret comes from AUTH_SECRET; without it, sign-in is
 * unavailable and the app says so rather than minting unsigned cookies.
 */
export const SESSION_COOKIE = "deskbreak_session";
const SESSION_DAYS = 90;
const LINK_MINUTES = 30;

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

export async function createLoginToken(
  profile: Profile,
  nextPath: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_MINUTES * 60_000).toISOString();
  const row: LoginTokenRow = {
    id: crypto.randomUUID(),
    profile_id: profile.id,
    token_hash: hashToken(token),
    next_path: nextPath.startsWith("/") ? nextPath : "/app",
    expires_at: expiresAt,
    used_at: null,
    created_at: new Date().toISOString(),
  };
  await insert("login_tokens", row);
  return { token, expiresAt };
}

/** Exchanges a link token for its profile, once. */
export async function consumeLoginToken(
  token: string,
): Promise<{ profile: Profile; nextPath: string } | null> {
  if (!token) return null;
  const row = await findOne("login_tokens", { token_hash: hashToken(token) });
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const profile = await findOne("profiles", { id: row.profile_id });
  if (!profile) return null;
  await update("login_tokens", { id: row.id }, { used_at: new Date().toISOString() });
  return { profile, nextPath: row.next_path };
}

export function sessionCookieValue(profileId: string): string {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${profileId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

export function verifySessionCookie(value: string | undefined): string | null {
  if (!value || !secret()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [profileId, expires, signature] = parts;
  if (Number(expires) < Date.now()) return null;
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

/**
 * Attaches an anonymous browser to a signed-in profile and folds its history in.
 *
 * Sessions written under the anonymous id get the profile id. If the anonymous
 * id belonged to a separate, email-less profile, that shell profile is merged
 * by moving its sessions and subscription pointer across.
 */
export async function mergeAnonymousInto(profile: Profile, anonymousId: string | null): Promise<void> {
  if (!anonymousId) return;
  const orphan = await findOne("profiles", { anonymous_id: anonymousId });
  if (orphan && orphan.id !== profile.id) {
    if (!orphan.email) {
      await update("sessions", { user_id: orphan.id }, { user_id: profile.id });
      await update("subscriptions", { user_id: orphan.id }, { user_id: profile.id });
      await update("push_subscriptions", { profile_id: orphan.id }, { profile_id: profile.id });
      await update("profiles", { id: orphan.id }, { anonymous_id: null });
    } else {
      // Two real accounts in one browser: leave the other one alone.
      return;
    }
  }
  await update("sessions", { anonymous_id: anonymousId, user_id: null }, { user_id: profile.id });
  await update("push_subscriptions", { anonymous_id: anonymousId }, { profile_id: profile.id });
  await update("recommendations", { anonymous_id: anonymousId }, { profile_id: profile.id });
  if (!profile.anonymous_id) {
    await update("profiles", { id: profile.id }, { anonymous_id: anonymousId });
  }
}

export async function profileForEmail(email: string, anonymousId: string | null): Promise<Profile> {
  return ensureProfile({ email: normalizeEmail(email), anonymousId });
}
