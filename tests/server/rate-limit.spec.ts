import "./setup";
import { resetStore } from "./setup";
import { expect, test } from "@playwright/test";
import { emailHash, judgeLinkRequest, pruneLinkRequests, requesterHash, type LinkLimits } from "../../src/lib/server/rate-limit";
import { consumeLoginToken, createLoginToken, profileForEmail } from "../../src/lib/server/auth";
import { findMany } from "../../src/lib/server/store";

const limits: LinkLimits = { cooldownSeconds: 60, emailHourlyCap: 3, requesterHourlyCap: 6 };
const at = (seconds: number) => new Date(Date.UTC(2026, 8, 11, 12, 0, seconds));
const alice = emailHash("alice@example.com");
const ipA = "ip-a";
const ipB = "ip-b";

test.beforeEach(async () => {
  await resetStore();
});

test("a resend inside the cooldown is refused and tells the caller when to retry", async () => {
  expect(await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(0))).toEqual({ allowed: true });
  expect(await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(20))).toEqual({
    allowed: false,
    reason: "cooldown",
    retryAfterSeconds: 40,
  });
  expect(await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(61))).toEqual({ allowed: true });
});

test("refused attempts do not extend the cooldown against the address's owner", async () => {
  await judgeLinkRequest({ emailHash: alice, requesterHash: ipB }, limits, at(0));
  // An attacker hammers the address every ten seconds.
  for (let s = 10; s < 60; s += 10) {
    expect((await judgeLinkRequest({ emailHash: alice, requesterHash: ipB }, limits, at(s))).allowed).toBe(false);
  }
  // The owner's own request right after the original cooldown still goes through.
  expect(await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(61))).toEqual({ allowed: true });
});

test("the hourly cap per address counts links actually produced", async () => {
  for (let i = 0; i < 3; i += 1) {
    expect((await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(i * 61))).allowed).toBe(true);
  }
  const fourth = await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(4 * 61));
  expect(fourth).toMatchObject({ allowed: false, reason: "email_cap" });
  if (fourth.allowed) return;
  expect(fourth.retryAfterSeconds).toBeGreaterThan(3000);
  // An hour after the first, one slot frees up.
  expect((await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(3601))).allowed).toBe(true);
});

test("the requester cap counts every attempt across addresses", async () => {
  for (let i = 0; i < 6; i += 1) {
    const verdict = await judgeLinkRequest(
      { emailHash: emailHash(`victim${i}@example.com`), requesterHash: ipB },
      limits,
      at(i),
    );
    expect(verdict.allowed).toBe(true);
  }
  expect(
    await judgeLinkRequest({ emailHash: emailHash("victim7@example.com"), requesterHash: ipB }, limits, at(7)),
  ).toMatchObject({ allowed: false, reason: "requester_cap" });
  // Another requester is unaffected.
  expect(
    await judgeLinkRequest({ emailHash: emailHash("victim7@example.com"), requesterHash: ipA }, limits, at(8)),
  ).toEqual({ allowed: true });
});

test("the verdict is identical for an address with an account and one without", async () => {
  await profileForEmail("known@example.com");
  const known = emailHash("known@example.com");
  const unknown = emailHash("nobody@example.com");
  const first = [
    await judgeLinkRequest({ emailHash: known, requesterHash: ipA }, limits, at(0)),
    await judgeLinkRequest({ emailHash: unknown, requesterHash: ipA }, limits, at(0)),
  ];
  const second = [
    await judgeLinkRequest({ emailHash: known, requesterHash: ipA }, limits, at(10)),
    await judgeLinkRequest({ emailHash: unknown, requesterHash: ipA }, limits, at(10)),
  ];
  expect(first[0]).toEqual(first[1]);
  expect(second[0]).toEqual(second[1]);
});

test("being throttled leaves an existing link valid", async () => {
  const profile = await profileForEmail("linked@example.com");
  const { token } = await createLoginToken(profile, { nextPath: "/app", anonymousId: null, pending: null }, at(0).getTime());
  expect(await judgeLinkRequest({ emailHash: emailHash("linked@example.com"), requesterHash: ipA }, limits, at(1))).toEqual({
    allowed: true,
  });
  expect(
    (await judgeLinkRequest({ emailHash: emailHash("linked@example.com"), requesterHash: ipA }, limits, at(5))).allowed,
  ).toBe(false);
  expect((await consumeLoginToken(token, at(10).getTime()))?.profile.id).toBe(profile.id);
});

test("stored rows are hashes, requester hashing reads the platform header, and old rows are pruned", async () => {
  await judgeLinkRequest({ emailHash: alice, requesterHash: ipA }, limits, at(0));
  const rows = await findMany("auth_requests", {});
  expect(JSON.stringify(rows)).not.toContain("alice@");
  expect(rows[0].email_hash).toHaveLength(64);

  const a = requesterHash(new Request("http://x/", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } }));
  const b = requesterHash(new Request("http://x/", { headers: { "x-forwarded-for": "203.0.113.5" } }));
  const c = requesterHash(new Request("http://x/", { headers: { "x-forwarded-for": "198.51.100.9" } }));
  expect(a).toBe(b);
  expect(a).not.toBe(c);
  expect(a).not.toContain("203.0.113.5");

  await pruneLinkRequests(new Date(at(0).getTime() + 25 * 3600 * 1000));
  expect(await findMany("auth_requests", {})).toHaveLength(0);
});
