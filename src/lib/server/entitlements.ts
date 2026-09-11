import "server-only";

import { findOne, insert, upsert, type Profile, type Subscription } from "./store";

/**
 * Stripe subscription statuses that grant Pro.
 *
 * `past_due` is included on purpose: Stripe is still retrying the card and
 * locking a paying customer out mid-dunning loses them for good.
 */
const ENTITLING_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

export type ServerEntitlement = {
  pro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export const FREE_ENTITLEMENT: ServerEntitlement = {
  pro: false,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

function entitlementFrom(subscription: Subscription | null): ServerEntitlement {
  if (!subscription) return FREE_ENTITLEMENT;

  const statusGrants = ENTITLING_STATUSES.has(subscription.status);
  // A cancelled subscription still runs to the end of the period it paid for.
  const withinPaidPeriod = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime() > Date.now()
    : false;

  return {
    pro: statusGrants && (withinPaidPeriod || !subscription.current_period_end),
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/** The single server-side answer to "does this user have Pro?". */
export async function hasProAccess(userId: string): Promise<boolean> {
  const subscription = await findOne("subscriptions", { user_id: userId });
  return entitlementFrom(subscription).pro;
}

export async function getEntitlementForUser(
  userId: string,
): Promise<ServerEntitlement> {
  return entitlementFrom(await findOne("subscriptions", { user_id: userId }));
}

export async function getEntitlementForEmail(
  email: string,
): Promise<ServerEntitlement> {
  const profile = await findOne("profiles", { email: normalizeEmail(email) });
  if (!profile) return FREE_ENTITLEMENT;
  return getEntitlementForUser(profile.id);
}

export async function getEntitlementForAnonymousId(
  anonymousId: string,
): Promise<ServerEntitlement> {
  const profile = await findOne("profiles", { anonymous_id: anonymousId });
  if (!profile) return FREE_ENTITLEMENT;
  return getEntitlementForUser(profile.id);
}

/**
 * The profile an anonymous browser may write to without a session.
 *
 * Either the shell profile already keyed on this anonymous id, or a new one.
 * A profile that has signed in is never returned: an anonymous id alone does
 * not prove the caller is that account, so its rows stay ownerless until a
 * verified sign-in merges them.
 */
export async function anonymousProfile(
  anonymousId: string,
  seed: Pick<ProfileSeed, "primaryNeed" | "preferredSetup"> = {},
): Promise<Profile | null> {
  const existing = await findOne("profiles", { anonymous_id: anonymousId });
  if (existing) return existing.email ? null : existing;
  return ensureProfile({ anonymousId, ...seed });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export type ProfileSeed = {
  email?: string | null;
  anonymousId?: string | null;
  primaryNeed?: string | null;
  preferredSetup?: string | null;
  attribution?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    landingPath?: string | null;
  };
};

/**
 * Finds or creates the lightweight identity behind an email or anonymous id.
 *
 * First-touch attribution is written only when the profile is created, so a
 * later visit carrying different UTMs cannot rewrite where someone came from.
 */
export async function ensureProfile(seed: ProfileSeed): Promise<Profile> {
  const email = seed.email ? normalizeEmail(seed.email) : null;

  const existing =
    (email ? await findOne("profiles", { email }) : null) ??
    (seed.anonymousId
      ? await findOne("profiles", { anonymous_id: seed.anonymousId })
      : null);

  if (existing) {
    const patch: Partial<Profile> = {};
    if (email && !existing.email) patch.email = email;
    if (seed.anonymousId && !existing.anonymous_id) {
      patch.anonymous_id = seed.anonymousId;
    }
    if (seed.primaryNeed) patch.primary_need = seed.primaryNeed;
    if (seed.preferredSetup) patch.preferred_setup = seed.preferredSetup;
    if (Object.keys(patch).length) {
      return (await upsert("profiles", { ...existing, ...patch }, "id")) ?? existing;
    }
    return existing;
  }

  const profile: Profile = {
    id: crypto.randomUUID(),
    email,
    anonymous_id: seed.anonymousId ?? null,
    billing_email: null,
    created_at: new Date().toISOString(),
    primary_need: seed.primaryNeed ?? null,
    preferred_setup: seed.preferredSetup ?? null,
    workday_start: null,
    workday_end: null,
    timezone: null,
    reminder_frequency: null,
    first_utm_source: seed.attribution?.source ?? null,
    first_utm_medium: seed.attribution?.medium ?? null,
    first_utm_campaign: seed.attribution?.campaign ?? null,
    first_utm_content: seed.attribution?.content ?? null,
    first_landing_path: seed.attribution?.landingPath ?? null,
  };

  return insert("profiles", profile);
}
