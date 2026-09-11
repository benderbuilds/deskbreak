import "./setup";
import { expect, test } from "@playwright/test";
import { isUuid, randomUuid } from "../../src/lib/ids";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("uses crypto.randomUUID when the browser has it", () => {
  const id = randomUuid({ randomUUID: () => "11111111-2222-4333-8444-555555555555" });
  expect(id).toBe("11111111-2222-4333-8444-555555555555");
});

test("falls back to getRandomValues and still produces a version 4 uuid", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const id = randomUuid({ getRandomValues: (array) => globalThis.crypto.getRandomValues(array) });
    expect(id).toMatch(V4);
    expect(isUuid(id)).toBe(true);
    seen.add(id);
  }
  expect(seen.size).toBe(200);
});

test("falls back to Math.random with no crypto at all and still produces a valid uuid", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const id = randomUuid(undefined);
    expect(id).toMatch(V4);
    seen.add(id);
  }
  expect(seen.size).toBe(200);
  expect(randomUuid({})).toMatch(V4);
});

test("isUuid rejects the old db_ prefixed fallback and other non-uuids", () => {
  expect(isUuid("db_k3j4h5g6lq9x")).toBe(false);
  expect(isUuid("session-abc123")).toBe(false);
  expect(isUuid("")).toBe(false);
  expect(isUuid(null)).toBe(false);
  expect(isUuid(globalThis.crypto.randomUUID())).toBe(true);
});
