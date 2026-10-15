import { describe, expect, it } from "vitest";
import audit from "../../docs/upper-hub-audit.json";
import baseline from "../../docs/progress-baseline-474.json";
import { quests } from "./quests";
import { dependents, evaluate, references, validateQuests } from "../lib/rules";
import { parseSave, SAVE_KEY } from "../lib/storage";

describe("upper hub primary rosters and released progress", () => {
  for (const rank of audit.ranks) {
    it(`hub ${rank.rank}: matches all observed names, order, roles, flags and real URLs`, () => {
      const group = quests.filter(
        (q) => q.category === "hub" && q.rank === rank.rank,
      );
      expect(group).toHaveLength(rank.observedCount);
      expect(
        group.map((q) => [q.name, q.sources[0].url, q.role, q.tags]),
      ).toEqual(rank.entries.map((e) => [e.name, e.recipeUrl, e.role, e.tags]));
      group.forEach((q, i) => {
        expect(q.order).toBe(i);
        expect(rank.entries[i].detailTitle.replaceAll(" ", "")).toContain(
          `集★${rank.rank}${q.name}`.replaceAll(" ", ""),
        );
        expect(q.sources).toContainEqual(
          expect.objectContaining({
            url: rank.recipeListUrl,
            checkedAt: audit.checkedAt,
          }),
        );
        for (const id of references(q.condition))
          expect(dependents(id, quests)).toContain(q);
      });
      expect(validateQuests(quests)).toEqual([]);
    });
  }
  it("preserves all 474 stable IDs, canonical names and previous unlocks", () => {
    expect(baseline).toHaveLength(474);
    for (const b of baseline) {
      const q = quests.find((q) => q.id === b.id)!;
      expect([q.name, q.category, q.rank, q.sources[0].url]).toEqual([
        b.name,
        b.category,
        b.rank,
        b.recipeUrl,
      ]);
      expect(q.unlocks).toEqual(expect.arrayContaining(b.unlocks));
    }
  });
  it("keeps version-1 backups, HR and unknown IDs while adding new upper progress", () => {
    expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
    const old = {
      schemaVersion: 1,
      completedQuestIds: [...baseline.map((q) => q.id), "future-id"],
      hr: 9,
    };
    expect(parseSave(JSON.stringify(old))).toEqual(old);
    const updated = {
      ...old,
      completedQuestIds: [
        ...old.completedQuestIds,
        ...quests
          .filter((q) => q.category === "hub" && Number(q.rank) >= 4)
          .map((q) => q.id),
      ],
    };
    expect(parseSave(JSON.stringify(updated))).toEqual(updated);
  });
  it("distinguishes a listed rank-4 quest from HR3 and connects the village food prerequisite", () => {
    const q = quests.find(
      (q) =>
        q.category === "hub" &&
        q.rank === "4" &&
        q.name === "肴のキモはホワイトレバー",
    )!;
    const prior = quests.find(
      (q) =>
        q.category === "village" &&
        q.rank === "2" &&
        q.name === "ドスランポスを狩猟せよ！",
    )!;
    expect(references(q.condition)).toContain(prior.id);
    expect(dependents(prior.id, quests)).toContain(q);
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: [prior.id],
        hr: 3,
      }),
    ).toBe("unmet");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: [prior.id],
        hr: 4,
      }),
    ).toBe("met");
  });
});
