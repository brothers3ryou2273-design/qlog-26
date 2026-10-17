import { expect, it } from "vitest";
import { quests } from "./quests";
import { parseSave, SAVE_KEY } from "../lib/storage";
import baseline from "../../docs/progress-baseline-1348.json";

it("retains every field of the 1348 released records during the partial completion audit", async () => {
  expect(quests.length).toBeGreaterThanOrEqual(baseline.length);
  const byId = new Map(quests.map((q) => [q.id, q]));
  expect(byId.size).toBe(quests.length);
  for (const previous of baseline) {
    const current = byId.get(previous.id);
    expect(current, previous.id).toBeDefined();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(current)),
    );
    const hex = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    expect(hex, previous.id).toBe(previous.questSha256);
  }
});

it("restores and re-exports all 1348 released checks, HR and unknown IDs in the existing format", () => {
  const backup = {
    schemaVersion: 1,
    hr: 123,
    completedQuestIds: [...baseline.map((q) => q.id), "future-quest-stage-12"],
  };
  const restored = parseSave(JSON.stringify(backup));
  expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
  expect(restored).toEqual(backup);
  expect(parseSave(JSON.stringify(restored))).toEqual(backup);
});
