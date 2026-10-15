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

for (const rank of audit.ranks.filter((r) => r.rank === "5")) {
  it("rank-5 urgent requires exactly all four rank-4 keys", () => {
    const q = quests.find(
      (q) => q.category === "hub" && q.name === "渓流の水竜",
    )!;
    const keys = quests.filter(
      (q) => q.category === "hub" && q.rank === "4" && q.tags.includes("key"),
    );
    expect(keys).toHaveLength(4);
    expect(references(q.condition)).toEqual(keys.map((q) => q.id));
    for (let mask = 0; mask < 16; mask++) {
      const completedQuestIds = keys
        .filter((_, i) => mask & (1 << i))
        .map((q) => q.id);
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 999 }),
      ).toBe(mask === 15 ? "met" : "unmet");
    }
    expect(rank.observedCount).toBe(51);
  });
  it("rank-5 prowler reward uses any two of the other four quests and keeps hiring distinct from growth", () => {
    const q = quests.find(
      (q) => q.category === "hub" && q.name === "炎天下の麻痺牙",
    )!;
    const candidates = quests.filter(
      (x) =>
        x.category === "hub" &&
        x.rank === "5" &&
        x.role === "prowler" &&
        x.id !== q.id,
    );
    expect(candidates).toHaveLength(4);
    for (let mask = 0; mask < 16; mask++) {
      const completedQuestIds = candidates
        .filter((_, i) => mask & (1 << i))
        .map((q) => q.id);
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 999 }),
      ).toBe(completedQuestIds.length >= 2 ? "met" : "unmet");
    }
    expect(q.unlocks).toContainEqual(
      expect.objectContaining({
        kind: "facility",
        label: "オトモの初期雇用レベル20〜22",
        note: expect.stringContaining("（OR）"),
      }),
    );
  });
}

for (const rank of audit.ranks.filter((r) => r.rank === "6")) {
  it("rank-6 twin urgents use the five rank-5 keys and keep their joint otomo route as AND", () => {
    const keys = quests.filter(
      (q) => q.category === "hub" && q.rank === "5" && q.tags.includes("key"),
    );
    expect(keys).toHaveLength(5);
    for (const name of ["妖艶なる舞", "不動の山神"]) {
      const q = quests.find((q) => q.category === "hub" && q.name === name)!;
      expect(references(q.condition)).toEqual(keys.map((q) => q.id));
      for (let mask = 0; mask < 32; mask++)
        expect(
          evaluate(q.condition, {
            schemaVersion: 1,
            completedQuestIds: keys
              .filter((_, i) => mask & (1 << i))
              .map((q) => q.id),
            hr: 999,
          }),
        ).toBe(mask === 31 ? "met" : "unmet");
      expect(q.unlocks).toContainEqual(
        expect.objectContaining({
          kind: "facility",
          note: expect.stringContaining("両方のクリアが必要（AND）"),
        }),
      );
    }
    expect(rank.observedCount).toBe(71);
  });
  it("rank-6 initial hyper quests require any two of the exact five keys", () => {
    const keys = quests.filter(
      (q) => q.category === "hub" && q.rank === "6" && q.tags.includes("key"),
    );
    expect(keys).toHaveLength(5);
    const q = quests.find(
      (q) => q.category === "hub" && q.name === "どくどくパニック・毒怪鳥！！",
    )!;
    expect(references(q.condition)).toEqual(keys.map((q) => q.id));
    for (let mask = 0; mask < 32; mask++) {
      const completedQuestIds = keys
        .filter((_, i) => mask & (1 << i))
        .map((q) => q.id);
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 999 }),
      ).toBe(completedQuestIds.length >= 2 ? "met" : "unmet");
    }
  });
}
