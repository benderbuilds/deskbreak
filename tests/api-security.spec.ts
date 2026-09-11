import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * Ownership at the HTTP boundary, against the real server.
 *
 * Each "browser" is an isolated request context with its own cookie jar. The
 * server runs on the in-memory store with AUTH_DEV_LINKS=1, so the sign-in
 * link comes back in the response instead of an email; that is the only test
 * seam, and production ignores it.
 */
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

test.describe.configure({ mode: "serial" });

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function browser(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BASE });
}

async function requestLink(
  ctx: APIRequestContext,
  email: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const response = await ctx.post("/api/auth/magic-link", { data: { email, next: "/app", ...extra } });
  expect(response.status(), await response.text()).toBe(200);
  const data = (await response.json()) as { ok: boolean; delivered: boolean; devLink?: string };
  expect(data.ok).toBe(true);
  expect(data.delivered).toBe(false);
  expect(data.devLink).toBeTruthy();
  return data.devLink as string;
}

async function openLink(ctx: APIRequestContext, link: string): Promise<string> {
  const response = await ctx.get(link, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(response.status());
  return response.headers()["location"] ?? "";
}

async function signIn(ctx: APIRequestContext, email: string, extra: Record<string, unknown> = {}) {
  const link = await requestLink(ctx, email, extra);
  const location = await openLink(ctx, link);
  expect(location).toContain("signed_in=1");
}

async function me(ctx: APIRequestContext, anonymousId?: string) {
  const response = await ctx.get(`/api/auth/me${anonymousId ? `?anonymousId=${anonymousId}` : ""}`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    signedIn: boolean;
    profile?: { id: string; email: string | null; constraints: string[] };
    sessions?: { sessionId: string }[];
  };
}

async function recordSession(ctx: APIRequestContext, sessionId: string, anonymousId?: string) {
  const response = await ctx.post("/api/sessions", {
    data: {
      sessionId,
      anonymousId,
      programId: "desk-reset-3min",
      programName: "Desk Reset",
      primaryNeed: "general",
      setup: "seated",
      durationMinutes: 3,
      startedAt: new Date(Date.now() - 180_000).toISOString(),
      completedAt: new Date().toISOString(),
      durationSeconds: 180,
      exercises: [{ exerciseId: "seated-march", sequence: 0, plannedSec: 30, actualSec: 30, completed: true }],
    },
  });
  return response;
}

test("an unauthenticated caller cannot obtain a billing-portal link", async () => {
  const ctx = await browser();
  const bare = await ctx.post("/api/billing/portal");
  expect(bare.status()).toBe(401);

  // Knowing an address or an anonymous id changes nothing.
  const withHints = await ctx.post("/api/billing/portal", {
    data: { email: "anyone@example.com", anonymousId: uid("anon") },
  });
  expect(withHints.status()).toBe(401);

  // A forged session cookie is not a session.
  const forged = await browser();
  await forged.get("/api/health"); // establish origin for the jar
  const forgedResponse = await forged.post("/api/billing/portal", {
    headers: { cookie: `deskbreak_session=00000000-0000-0000-0000-000000000000.${Date.now() + 100000}.forged` },
  });
  expect(forgedResponse.status()).toBe(401);
  await ctx.dispose();
  await forged.dispose();
});

test("a signed-in account without a subscription gets no portal link either", async () => {
  const ctx = await browser();
  await signIn(ctx, `${uid("free")}@example.com`);
  const response = await ctx.post("/api/billing/portal");
  // 404 (no customer) or 503 (Stripe not configured in this environment); never a URL.
  expect([404, 503]).toContain(response.status());
  expect(((await response.json()) as { url?: string }).url).toBeUndefined();
  await ctx.dispose();
});

test("account A cannot read or modify account B's data", async () => {
  const a = await browser();
  const b = await browser();
  const emailA = `${uid("a")}@example.com`;
  const emailB = `${uid("b")}@example.com`;
  await signIn(a, emailA, { constraints: ["overhead"] });
  await signIn(b, emailB, { constraints: ["floor"] });

  const meA = await me(a);
  const meB = await me(b);
  expect(meA.profile?.email).toBe(emailA);
  expect(meB.profile?.email).toBe(emailB);
  expect(meA.profile?.constraints).toEqual(["overhead"]);
  expect(meB.profile?.constraints).toEqual(["floor"]);

  // B rewrites its own preferences; A's are untouched.
  expect((await b.patch("/api/profile", { data: { constraints: ["balance"], preferredDuration: 10 } })).ok()).toBe(true);
  expect((await me(a)).profile?.constraints).toEqual(["overhead"]);
  const profileA = (await (await a.get("/api/profile")).json()) as { profile: { preferredDuration: number | null } };
  expect(profileA.profile.preferredDuration).toBeNull();

  // B's plan is invisible to A.
  const today = new Date().toISOString().slice(0, 10);
  expect(
    (
      await b.put("/api/planned-breaks", {
        data: {
          date: today,
          breaks: [
            { id: "b-1", date: today, startMinutes: 600, endMinutes: 630, type: "move", need: "general", durationMin: 3, status: "planned", snoozedUntilMinutes: null, completedSessionId: null, recommendationId: null },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  expect(((await (await b.get(`/api/planned-breaks?date=${today}`)).json()) as { breaks: unknown[] }).breaks).toHaveLength(1);
  expect(((await (await a.get(`/api/planned-breaks?date=${today}`)).json()) as { breaks: unknown[] }).breaks).toHaveLength(0);
  // A cannot flip B's break.
  await a.patch("/api/planned-breaks", { data: { id: "b-1", status: "skipped" } });
  const bBreaks = (await (await b.get(`/api/planned-breaks?date=${today}`)).json()) as { breaks: { status: string }[] };
  expect(bBreaks.breaks[0].status).toBe("planned");

  // B's session is B's: A cannot rate it, overwrite it, or list it.
  const sessionB = crypto.randomUUID();
  expect((await recordSession(b, sessionB)).ok()).toBe(true);
  expect(
    (await a.post("/api/sessions", { data: { sessionId: sessionB, programId: "desk-reset-3min", perceivedEffect: "worse" } })).status(),
  ).toBe(403);
  expect((await recordSession(a, sessionB)).status()).toBe(403);
  expect((await me(a)).sessions?.map((entry) => entry.sessionId)).not.toContain(sessionB);
  expect((await me(b)).sessions?.map((entry) => entry.sessionId)).toContain(sessionB);
  const historyA = (await (await a.get("/api/sessions")).json()) as { sessions: { sessionId: string }[] };
  expect(historyA.sessions.map((entry) => entry.sessionId)).not.toContain(sessionB);

  // Anonymous callers get nothing from a profile lookup.
  const anon = await browser();
  expect((await anon.get("/api/profile")).status()).toBe(401);
  expect((await anon.patch("/api/profile", { data: { constraints: [] } })).status()).toBe(401);
  await a.dispose();
  await b.dispose();
  await anon.dispose();
});

test("a login-link request cannot change an existing account's restrictions or ownership", async () => {
  const owner = await browser();
  const email = `${uid("owner")}@example.com`;
  await signIn(owner, email, { constraints: ["neck_rotation", "leave_chair"], primaryNeed: "neck_shoulders" });
  const before = await me(owner);
  expect(before.profile?.constraints.sort()).toEqual(["leave_chair", "neck_rotation"]);

  // Someone else asks for a link to the owner's address with different settings.
  const stranger = await browser();
  const strangerAnon = uid("stranger");
  await recordSession(stranger, crypto.randomUUID(), strangerAnon);
  const link = await requestLink(stranger, email, {
    constraints: [],
    primaryNeed: "energy",
    preferredDuration: 10,
    anonymousId: strangerAnon,
  });

  // Nothing changed for the owner, and no history was attached.
  const after = await me(owner);
  expect(after.profile?.constraints.sort()).toEqual(["leave_chair", "neck_rotation"]);
  expect(after.sessions).toHaveLength(0);
  const ownerProfile = (await (await owner.get("/api/profile")).json()) as {
    profile: { primaryNeed: string | null; preferredDuration: number | null };
  };
  expect(ownerProfile.profile.primaryNeed).toBe("neck_shoulders");
  expect(ownerProfile.profile.preferredDuration).toBeNull();

  // The owner opens the link from their inbox on another device (no nonce
  // cookie): they are signed in, and the stranger's settings and history are
  // still not applied.
  const ownersOtherDevice = await browser();
  const location = await openLink(ownersOtherDevice, link);
  expect(location).toContain("signed_in=1");
  expect(location).not.toContain("merged=");
  const onOtherDevice = await me(ownersOtherDevice);
  expect(onOtherDevice.profile?.email).toBe(email);
  expect(onOtherDevice.profile?.constraints.sort()).toEqual(["leave_chair", "neck_rotation"]);
  expect(onOtherDevice.sessions).toHaveLength(0);

  // The stranger's browser never got a session.
  expect((await me(stranger)).signedIn).toBe(false);
  await owner.dispose();
  await stranger.dispose();
  await ownersOtherDevice.dispose();
});

test("consumed and malformed login tokens are rejected", async () => {
  const ctx = await browser();
  const link = await requestLink(ctx, `${uid("once")}@example.com`);
  expect(await openLink(ctx, link)).toContain("signed_in=1");

  const again = await browser();
  expect(await openLink(again, link)).toContain("/app/save?error=expired");
  expect((await me(again)).signedIn).toBe(false);

  expect(await openLink(again, "/api/auth/verify?token=nonsense")).toContain("error=expired");
  expect(await openLink(again, "/api/auth/verify")).toContain("error=expired");
  await ctx.dispose();
  await again.dispose();
});

test("anonymous-to-account migration keeps this browser's history and nothing else", async () => {
  // Another account exists with its own history.
  const other = await browser();
  const otherAnon = uid("other-anon");
  const otherSession = crypto.randomUUID();
  await recordSession(other, otherSession, otherAnon);
  await signIn(other, `${uid("other")}@example.com`, { anonymousId: otherAnon });
  expect((await me(other)).sessions?.map((entry) => entry.sessionId)).toEqual([otherSession]);

  // A fresh anonymous browser does two resets, then saves its progress.
  const mine = await browser();
  const myAnon = uid("my-anon");
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  expect((await recordSession(mine, first, myAnon)).ok()).toBe(true);
  expect((await recordSession(mine, second, myAnon)).ok()).toBe(true);
  const link = await requestLink(mine, `${uid("mine")}@example.com`, { anonymousId: myAnon, constraints: ["floor"] });
  const location = await openLink(mine, link);
  expect(location).toContain("signed_in=1");
  expect(location).toContain("merged=2");

  const merged = await me(mine, myAnon);
  expect(merged.sessions?.map((entry) => entry.sessionId).sort()).toEqual([first, second].sort());
  expect(merged.profile?.constraints).toEqual(["floor"]);

  // Naming the other account's anonymous id pulls nothing across.
  const attempt = await me(mine, otherAnon);
  expect(attempt.sessions?.map((entry) => entry.sessionId)).not.toContain(otherSession);
  expect((await me(other)).sessions?.map((entry) => entry.sessionId)).toEqual([otherSession]);

  // And an anonymous request carrying that id reads nothing owned.
  const snoop = await browser();
  const history = (await (await snoop.get(`/api/sessions?anonymousId=${otherAnon}`)).json()) as { sessions: unknown[] };
  expect(history.sessions).toHaveLength(0);
  const snoopMe = (await (await snoop.get(`/api/entitlement?anonymousId=${otherAnon}`)).json()) as { pro: boolean };
  expect(snoopMe.pro).toBe(false);
  await other.dispose();
  await mine.dispose();
  await snoop.dispose();
});

test("health reports capabilities as booleans only", async () => {
  const ctx = await browser();
  const response = await ctx.get("/api/health");
  const body = (await response.json()) as { configured: Record<string, boolean>; scheduler: { vercelCron: boolean } };
  expect(Object.values(body.configured).every((value) => typeof value === "boolean")).toBe(true);
  expect(body.scheduler.vercelCron).toBe(false);
  expect(await response.text()).not.toMatch(/playwright-only-signing-secret/);
  await ctx.dispose();
});

test("sign-in link requests are capped per address, and an earlier link survives the cap", async () => {
  const ctx = await browser();
  const email = `${uid("capped")}@example.com`;
  const first = await requestLink(ctx, email);
  for (let i = 0; i < 4; i += 1) await requestLink(ctx, email);

  const sixth = await ctx.post("/api/auth/magic-link", { data: { email, next: "/app" } });
  expect(sixth.status()).toBe(429);
  expect(sixth.headers()["retry-after"]).toMatch(/^\d+$/);
  const body = (await sixth.json()) as { ok: boolean; error: string; retryAfterSeconds: number; devLink?: string };
  expect(body).toMatchObject({ ok: false, error: "rate_limited" });
  expect(body.devLink).toBeUndefined();

  // The same shape for an address nobody has ever used.
  const fresh = `${uid("never")}@example.com`;
  for (let i = 0; i < 5; i += 1) await requestLink(ctx, fresh);
  const freshSixth = await ctx.post("/api/auth/magic-link", { data: { email: fresh, next: "/app" } });
  expect(freshSixth.status()).toBe(429);
  expect(Object.keys((await freshSixth.json()) as object).sort()).toEqual(Object.keys(body).sort());

  // The first link still signs in.
  expect(await openLink(ctx, first)).toContain("signed_in=1");
  expect((await me(ctx)).profile?.email).toBe(email);
  await ctx.dispose();
});
