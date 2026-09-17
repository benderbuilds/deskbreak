import "./setup";
import { resetStore } from "./setup";
import { expect, test } from "@playwright/test";
import { setTestCookies } from "./setup";
import {
  absorbBillingProfiles,
  applyPendingPreferences,
  consumeLoginToken,
  createLoginToken,
  currentProfile,
  LINK_NONCE_COOKIE,
  mergeAnonymousInto,
  nonceMatches,
  profileForEmail,
  SESSION_COOKIE,
  sessionCookieValue,
  verifySessionCookie,
} from "../../src/lib/server/auth";
import { ensureProfile, getEntitlementForAnonymousId, getEntitlementForUser } from "../../src/lib/server/entitlements";
import {
  findMany,
  findOne,
  insert,
  update,
  type SessionRow,
  type Subscription,
} from "../../src/lib/server/store";

const MINUTE = 60_000;
const ids = new Map<string, string>();
/** Stable uuid per label, since session ids are uuids in the database. */
const id = (label: string) => {
  if (!ids.has(label)) ids.set(label, crypto.randomUUID());
  return ids.get(label) as string;
};

function session(label: string, owner: { userId?: string | null; anonymousId?: string | null }): SessionRow {
  return {
    id: id(label),
    user_id: owner.userId ?? null,
    anonymous_id: owner.anonymousId ?? null,
    program_id: "desk-reset-3min",
    primary_need: "general",
    setup: "seated",
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: 180,
    perceived_effect: null,
  };
}

function subscription(userId: string): Subscription {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    stripe_customer_id: `cus_${userId.slice(0, 6)}`,
    stripe_subscription_id: `sub_${userId.slice(0, 6)}`,
    stripe_price_id: "price_x",
    status: "active",
    current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    cancel_at_period_end: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

test.beforeEach(async () => {
  await resetStore();
  setTestCookies({});
});

test.describe("login tokens", () => {
  test("a token signs in once, then is rejected", async () => {
    const profile = await profileForEmail("once@example.com");
    const now = Date.now();
    const { token } = await createLoginToken(profile, { nextPath: "/app", anonymousId: null, pending: null }, now);

    const first = await consumeLoginToken(token, now + MINUTE);
    expect(first?.profile.id).toBe(profile.id);

    const second = await consumeLoginToken(token, now + 2 * MINUTE);
    expect(second).toBeNull();
  });

  test("an expired token is rejected", async () => {
    const profile = await profileForEmail("late@example.com");
    const now = Date.now();
    const { token } = await createLoginToken(profile, { nextPath: "/app", anonymousId: null, pending: null }, now);

    expect(await consumeLoginToken(token, now + 31 * MINUTE)).toBeNull();
    // And a rejected-for-expiry token cannot be "un-expired" by a later clock.
    expect(await consumeLoginToken(token, now + MINUTE)).toBeNull();
  });

  test("garbage and forged tokens are rejected", async () => {
    expect(await consumeLoginToken("")).toBeNull();
    expect(await consumeLoginToken("not-a-token")).toBeNull();
  });

  test("two simultaneous opens of one link admit exactly one", async () => {
    const profile = await profileForEmail("race@example.com");
    const { token } = await createLoginToken(profile, { nextPath: "/app", anonymousId: null, pending: null });
    const results = await Promise.all([consumeLoginToken(token), consumeLoginToken(token)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test("the nonce only matches the browser that asked", async () => {
    const profile = await profileForEmail("nonce@example.com");
    const { nonce, token } = await createLoginToken(profile, { nextPath: "/app", anonymousId: "anon-1", pending: null });
    const consumed = await consumeLoginToken(token);
    expect(nonceMatches(consumed!.nonceHash, nonce)).toBe(true);
    expect(nonceMatches(consumed!.nonceHash, "some-other-nonce")).toBe(false);
    expect(nonceMatches(consumed!.nonceHash, undefined)).toBe(false);
  });
});

test.describe("session cookies", () => {
  test("a valid cookie names its profile; a tampered one names nobody", () => {
    const value = sessionCookieValue("profile-1");
    expect(verifySessionCookie(value)).toBe("profile-1");
    const [id, expires, signature] = value.split(".");
    expect(verifySessionCookie(`profile-2.${expires}.${signature}`)).toBeNull();
    expect(verifySessionCookie(`${id}.${Number(expires) + 1}.${signature}`)).toBeNull();
    expect(verifySessionCookie(undefined)).toBeNull();
  });

  test("an expired cookie is not a session", () => {
    const value = sessionCookieValue("profile-1", Date.now() - 91 * 86_400_000);
    expect(verifySessionCookie(value)).toBeNull();
  });

  test("currentProfile reads only the signed cookie", async () => {
    const profile = await profileForEmail("cookie@example.com");
    setTestCookies({ [SESSION_COOKIE]: sessionCookieValue(profile.id) });
    expect((await currentProfile())?.id).toBe(profile.id);
    setTestCookies({ [SESSION_COOKIE]: `${profile.id}.${Date.now() + 10_000}.forged` });
    expect(await currentProfile()).toBeNull();
    setTestCookies({ [LINK_NONCE_COOKIE]: "irrelevant" });
    expect(await currentProfile()).toBeNull();
  });
});

test.describe("requesting a link leaves the account alone", () => {
  test("pending preferences stay on the token until verification", async () => {
    const profile = await ensureProfile({ email: "owner@example.com", primaryNeed: "neck_shoulders" });
    await applyPendingPreferences(profile, { constraints: ["overhead"] });

    // An attacker asks for a link with different preferences and no constraints.
    const { token } = await createLoginToken(profile, {
      nextPath: "/app",
      anonymousId: "attacker-browser",
      pending: { primaryNeed: "energy", constraints: [] },
    });

    const untouched = await findOne("profiles", { id: profile.id });
    expect(untouched?.primary_need).toBe("neck_shoulders");
    expect(untouched?.anonymous_id).toBeNull();
    expect((await findMany("functional_constraints", { profile_id: profile.id })).map((r) => r.constraint_key)).toEqual([
      "overhead",
    ]);

    // Even after the token is consumed elsewhere (no nonce), nothing is applied
    // unless the caller chooses to, which the verify route does only for the
    // originating browser.
    const consumed = await consumeLoginToken(token);
    expect(consumed?.pending?.primaryNeed).toBe("energy");
    const still = await findOne("profiles", { id: profile.id });
    expect(still?.primary_need).toBe("neck_shoulders");
  });

  test("profileForEmail never links an anonymous id or rewrites preferences", async () => {
    const created = await ensureProfile({ email: "steady@example.com", primaryNeed: "back_hips" });
    const again = await profileForEmail("Steady@Example.com ");
    expect(again.id).toBe(created.id);
    expect(again.primary_need).toBe("back_hips");
    expect(again.anonymous_id).toBeNull();
  });
});

test.describe("anonymous merge", () => {
  test("ownerless history moves in; another account's history does not", async () => {
    const alice = await profileForEmail("alice@example.com");
    const bob = await ensureProfile({ email: "bob@example.com", anonymousId: "bob-browser" });
    await insert("sessions", session("mine-1", { anonymousId: "alice-browser" }));
    await insert("sessions", session("mine-2", { anonymousId: "alice-browser" }));
    await insert("sessions", session("bobs", { userId: bob.id, anonymousId: "bob-browser" }));

    const summary = await mergeAnonymousInto(alice, "alice-browser", { includeSubscriptions: true });
    expect(summary.sessions).toBe(2);
    expect(summary.blocked).toBe(false);
    expect((await findMany("sessions", { user_id: alice.id })).map((r) => r.id).sort()).toEqual([id("mine-1"), id("mine-2")].sort());

    // Alice presents Bob's browser id: nothing crosses.
    const blocked = await mergeAnonymousInto(alice, "bob-browser", { includeSubscriptions: true });
    expect(blocked.blocked).toBe(true);
    expect(blocked.sessions).toBe(0);
    expect((await findOne("sessions", { id: id("bobs") }))?.user_id).toBe(bob.id);
    expect((await findOne("profiles", { id: bob.id }))?.anonymous_id).toBe("bob-browser");
  });

  test("a device-bound Pro purchase only moves for the browser that proved itself", async () => {
    const shell = await ensureProfile({ anonymousId: "paid-device" });
    await insert("subscriptions", subscription(shell.id));
    await insert("sessions", session("paid-1", { userId: shell.id, anonymousId: "paid-device" }));
    const account = await profileForEmail("payer@example.com");

    // Signed-in elsewhere, naming the id without the nonce: the paid profile is kept whole.
    const kept = await mergeAnonymousInto(account, "paid-device");
    expect(kept.keptPaidProfile).toBe(true);
    expect(kept.subscriptions).toBe(0);
    expect((await findOne("subscriptions", { user_id: shell.id }))).not.toBeNull();
    expect((await findOne("profiles", { id: shell.id }))?.anonymous_id).toBe("paid-device");

    // The originating browser (nonce verified): everything follows.
    const moved = await mergeAnonymousInto(account, "paid-device", { includeSubscriptions: true });
    expect(moved.subscriptions).toBe(1);
    expect(moved.sessions).toBe(1);
    expect((await findOne("subscriptions", { user_id: account.id }))).not.toBeNull();
    expect((await findOne("profiles", { id: account.id }))?.anonymous_id).toBe("paid-device");
  });

  test("a purchase under a billing address attaches only after that address signs in", async () => {
    const paid = await ensureProfile({ anonymousId: "checkout-device" });
    await insert("subscriptions", subscription(paid.id));
    await update("profiles", { id: paid.id }, { billing_email: "buyer@example.com" });

    const stranger = await profileForEmail("stranger@example.com");
    expect(await absorbBillingProfiles(stranger)).toBe(0);
    expect((await findOne("subscriptions", { user_id: paid.id }))).not.toBeNull();

    const buyer = await profileForEmail("buyer@example.com");
    expect(await absorbBillingProfiles(buyer)).toBe(1);
    expect((await findOne("subscriptions", { user_id: buyer.id }))).not.toBeNull();
    // The account had no device, so it adopts the one that paid.
    expect((await findOne("profiles", { id: buyer.id }))?.anonymous_id).toBe("checkout-device");
    expect((await getEntitlementForAnonymousId("checkout-device")).pro).toBe(true);
  });

  test("the device that paid keeps Pro after another device claims the purchase", async () => {
    const paid = await ensureProfile({ anonymousId: "phone-that-paid" });
    await insert("subscriptions", subscription(paid.id));
    await update("profiles", { id: paid.id }, { billing_email: "buyer@example.com" });
    expect((await getEntitlementForAnonymousId("phone-that-paid")).pro).toBe(true);

    // The buyer signs in on a laptop that already has its own anonymous id.
    const buyer = await ensureProfile({ email: "buyer@example.com", anonymousId: "laptop" });
    expect(await absorbBillingProfiles(buyer)).toBe(1);
    expect((await findOne("subscriptions", { user_id: buyer.id }))).not.toBeNull();

    // Laptop is Pro through the account; the phone is still Pro through the
    // address it paid with; the laptop keeps its own id.
    expect((await getEntitlementForUser(buyer.id)).pro).toBe(true);
    expect((await getEntitlementForAnonymousId("phone-that-paid")).pro).toBe(true);
    expect((await findOne("profiles", { id: buyer.id }))?.anonymous_id).toBe("laptop");
    expect((await findOne("profiles", { id: paid.id }))?.anonymous_id).toBe("phone-that-paid");

    // A stranger's device with the same billing address but no verified
    // account behind it gets nothing extra.
    const stranger = await ensureProfile({ anonymousId: "stranger-device" });
    await update("profiles", { id: stranger.id }, { billing_email: "nobody@example.com" });
    expect((await getEntitlementForAnonymousId("stranger-device")).pro).toBe(false);
  });
});
