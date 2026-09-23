import { expect, test } from "@playwright/test";
import { SHARE_TEXT, shareTargetFor } from "../src/lib/share-reset";
import { PRIMARY_NEEDS } from "../src/lib/types";

const ORIGIN = "https://deskbreak.co";

test.describe("sharing a reset", () => {
  test("each need maps to its own public page", async () => {
    expect(shareTargetFor("neck_shoulders", ORIGIN).url).toBe(`${ORIGIN}/neck-shoulder-exercises`);
    expect(shareTargetFor("back_hips", ORIGIN).url).toBe(`${ORIGIN}/back-stretches-desk-workers`);
    expect(shareTargetFor("wrists_hands", ORIGIN).url).toBe(`${ORIGIN}/wrist-exercises-desk-workers`);
    expect(shareTargetFor("posture", ORIGIN).url).toBe(`${ORIGIN}/posture-reset`);
    expect(shareTargetFor("general", ORIGIN).url).toBe(`${ORIGIN}/desk-exercises`);
  });

  test("a need with no page of its own shares the homepage and generic wording", async () => {
    for (const need of ["energy", "stress"] as const) {
      const target = shareTargetFor(need, ORIGIN);
      expect(target.url).toBe(`${ORIGIN}/`);
      expect(target.text).toBe(SHARE_TEXT);
    }
  });

  test("every need has a target, and none of them carries anything private", async () => {
    for (const need of PRIMARY_NEEDS) {
      const target = shareTargetFor(need, ORIGIN);
      expect(target.url.startsWith(`${ORIGIN}/`)).toBe(true);
      // No query string at all: no session, no recommendation, no attribution.
      expect(target.url).not.toContain("?");
      expect(target.text).toMatch(/free/i);
      expect(target.text).not.toMatch(/pain|cure|fix|relief/i);
    }
  });

  test("an unknown origin falls back to the canonical one", async () => {
    expect(shareTargetFor("general", "").url).toBe("https://deskbreak.co/desk-exercises");
  });
});
