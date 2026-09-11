import "./setup";
import { expect, test } from "@playwright/test";
import {
  claimDelivery,
  emailDedupeKey,
  markDelivered,
  markFailed,
  pushDedupeKey,
} from "../../src/lib/server/deliveries";
import { findMany, resetMemoryStore } from "../../src/lib/server/store";

test.beforeEach(() => resetMemoryStore());

test("the same send is claimed once across overlapping runs", async () => {
  const key = emailDedupeKey("profile-1", "2026-09-11");
  const claims = await Promise.all(
    Array.from({ length: 6 }, () =>
      claimDelivery({ kind: "email", dedupeKey: key, profileId: "profile-1", target: null }),
    ),
  );
  expect(claims.filter((claim) => claim.claimed)).toHaveLength(1);
  expect(await findMany("notification_deliveries", { dedupe_key: key })).toHaveLength(1);
});

test("a delivered send is never repeated; a failed one retries after its delay", async () => {
  const key = emailDedupeKey("profile-1", "2026-09-11");
  const now = new Date("2026-09-11T14:05:00Z");
  const first = await claimDelivery({ kind: "email", dedupeKey: key, profileId: "profile-1", target: null }, now);
  expect(first.claimed).toBe(true);
  if (!first.claimed) return;

  await markFailed(first.row.id, "send_failed", { retryMinutes: 30 }, now);
  const tooSoon = await claimDelivery(
    { kind: "email", dedupeKey: key, profileId: "profile-1", target: null },
    new Date(now.getTime() + 10 * 60_000),
  );
  expect(tooSoon).toEqual({ claimed: false, reason: "not_yet" });

  const retry = await claimDelivery(
    { kind: "email", dedupeKey: key, profileId: "profile-1", target: null },
    new Date(now.getTime() + 31 * 60_000),
  );
  expect(retry.claimed).toBe(true);
  if (!retry.claimed) return;
  await markDelivered(retry.row.id);

  const again = await claimDelivery(
    { kind: "email", dedupeKey: key, profileId: "profile-1", target: null },
    new Date(now.getTime() + 60 * 60_000),
  );
  expect(again).toEqual({ claimed: false, reason: "already_sent" });
});

test("two retries of one failed send admit exactly one", async () => {
  const key = pushDedupeKey({ breakId: "b1", date: "2026-09-11", endpoint: "https://push/x", attempt: null });
  const now = new Date("2026-09-11T14:05:00Z");
  const first = await claimDelivery({ kind: "push", dedupeKey: key, profileId: "p", target: "https://push/x" }, now);
  if (!first.claimed) throw new Error("expected claim");
  await markFailed(first.row.id, "send_failed", { retryMinutes: 10 }, now);

  const later = new Date(now.getTime() + 11 * 60_000);
  const retries = await Promise.all([
    claimDelivery({ kind: "push", dedupeKey: key, profileId: "p", target: "https://push/x" }, later),
    claimDelivery({ kind: "push", dedupeKey: key, profileId: "p", target: "https://push/x" }, later),
  ]);
  expect(retries.filter((claim) => claim.claimed)).toHaveLength(1);
});

test("a permanent failure holds the key so nothing retries it", async () => {
  const key = pushDedupeKey({ breakId: "b1", date: "2026-09-11", endpoint: "https://push/gone", attempt: null });
  const first = await claimDelivery({ kind: "push", dedupeKey: key, profileId: "p", target: null });
  if (!first.claimed) throw new Error("expected claim");
  await markFailed(first.row.id, "endpoint_gone", { retryMinutes: null });
  const again = await claimDelivery(
    { kind: "push", dedupeKey: key, profileId: "p", target: null },
    new Date(Date.now() + 86_400_000),
  );
  expect(again).toEqual({ claimed: false, reason: "skipped" });
});

test("keys separate days, devices and snooze attempts, and never contain the address", () => {
  const base = { breakId: "b1", date: "2026-09-11", endpoint: "https://push/x", attempt: null };
  expect(pushDedupeKey(base)).toBe(pushDedupeKey({ ...base }));
  expect(pushDedupeKey(base)).not.toBe(pushDedupeKey({ ...base, date: "2026-09-12" }));
  expect(pushDedupeKey(base)).not.toBe(pushDedupeKey({ ...base, endpoint: "https://push/y" }));
  expect(pushDedupeKey(base)).not.toBe(pushDedupeKey({ ...base, attempt: 615 }));
  expect(pushDedupeKey(base)).not.toContain("https://");
  expect(emailDedupeKey("p1", "2026-09-11")).not.toContain("@");
});
