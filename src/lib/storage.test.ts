import { describe, expect, it } from "vitest";
import { emptySave, mergeSave, parseSave, readSave } from "./storage";
describe("progress and safe backups", () => {
  it("round trips HR, stable IDs and unknown IDs, ignoring display order and names", () => {
    const data = {
      schemaVersion: 1 as const,
      completedQuestIds: ["village-1-source123", "future-id"],
      hr: 3,
    };
    expect(parseSave(JSON.stringify(data))).toEqual(data);
  });
  it("deduplicates IDs", () => {
    expect(
      parseSave('{"schemaVersion":1,"completedQuestIds":["a","a"]}')
        .completedQuestIds,
    ).toEqual(["a"]);
  });
  it.each([
    "{",
    "null",
    "{}",
    '{"schemaVersion":2,"completedQuestIds":[]}',
    '{"schemaVersion":1,"completedQuestIds":[1]}',
    '{"schemaVersion":1,"completedQuestIds":[""]}',
    '{"schemaVersion":1,"completedQuestIds":[],"hr":0}',
    '{"schemaVersion":1,"completedQuestIds":[],"hr":1.5}',
  ])("rejects malformed or unsupported backups: %s", (text) =>
    expect(() => parseSave(text)).toThrow(),
  );
  it("rejects oversized input", () =>
    expect(() => parseSave(" ".repeat(2_000_001))).toThrow(/大きすぎ/));
  it("merges without removing known or unknown IDs or changing current HR", () => {
    const current = {
      schemaVersion: 1 as const,
      completedQuestIds: ["a", "future"],
      hr: 4,
    };
    expect(
      mergeSave(current, {
        schemaVersion: 1,
        completedQuestIds: ["a", "b"],
        hr: 9,
      }),
    ).toEqual({
      schemaVersion: 1,
      completedQuestIds: ["a", "future", "b"],
      hr: 4,
    });
    expect(current.completedQuestIds).toEqual(["a", "future"]);
  });
  it("does not treat corrupt saved data as an empty successful load", () => {
    expect(readSave({ getItem: () => null }, "key")).toEqual(emptySave());
    expect(() => readSave({ getItem: () => "broken" }, "key")).toThrow();
    expect(() =>
      readSave(
        {
          getItem: () => {
            throw Error("denied");
          },
        },
        "key",
      ),
    ).toThrow();
  });
});
