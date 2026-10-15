import { describe, expect, it } from "vitest";
import { demoQuests } from "../data/demo";
import { quests } from "../data/quests";
import { dependents, evaluate, references, validateQuests } from "./rules";
import type { Quest, Rule, SaveData } from "./types";
const cleared: Rule = { kind: "quest_cleared", questId: "q1" };
const unknown: Rule = { kind: "unknown" };
const save: SaveData = { schemaVersion: 1, completedQuestIds: ["q1"] };
const sample = (id: string, condition: Rule): Quest => ({
  ...demoQuests[0],
  id,
  condition,
});
describe("three-valued prerequisite evaluation", () => {
  it.each([
    [cleared, "met"],
    [{ kind: "quest_cleared", questId: "q2" }, "unmet"],
    [unknown, "unknown"],
    [{ kind: "external_flag", label: "村人の依頼" }, "unknown"],
    [{ kind: "none" }, "met"],
    [{ kind: "hr_at_least", value: 2 }, "unknown"],
    [{ kind: "all", rules: [cleared, unknown] }, "unknown"],
    [
      {
        kind: "all",
        rules: [cleared, { kind: "quest_cleared", questId: "q2" }, unknown],
      },
      "unmet",
    ],
    [{ kind: "any", rules: [cleared, unknown] }, "met"],
    [
      {
        kind: "any",
        rules: [{ kind: "quest_cleared", questId: "q2" }, unknown],
      },
      "unknown",
    ],
    [
      { kind: "any", rules: [{ kind: "quest_cleared", questId: "q2" }] },
      "unmet",
    ],
    [{ kind: "all", rules: [] }, "unknown"],
    [{ kind: "any", rules: [] }, "unknown"],
  ] as [Rule, string][])("%j → %s", (rule, expected) =>
    expect(evaluate(rule, save)).toBe(expected),
  );
  it("handles HR boundary and nested AND/OR", () => {
    const rule: Rule = {
      kind: "all",
      rules: [
        { kind: "any", rules: [cleared, unknown] },
        { kind: "hr_at_least", value: 2 },
      ],
    };
    expect(evaluate(rule, { ...save, hr: 1 })).toBe("unmet");
    expect(evaluate(rule, { ...save, hr: 2 })).toBe("met");
  });
});
describe("dataset integrity and reverse links", () => {
  it("validates production and isolated demo datasets", () => {
    expect(validateQuests(quests)).toEqual([]);
    expect(validateQuests(demoQuests)).toEqual([]);
  });
  it("keeps identical names in different ranks distinct", () => {
    expect(demoQuests[1].name).toBe(demoQuests[2].name);
    expect(demoQuests[1].id).not.toBe(demoQuests[2].id);
    const data = {
      schemaVersion: 1 as const,
      completedQuestIds: [demoQuests[1].id],
    };
    expect(
      evaluate({ kind: "quest_cleared", questId: demoQuests[2].id }, data),
    ).toBe("unmet");
  });
  it("derives reverse links from nested prerequisites without duplication", () => {
    const q = sample("next", {
      kind: "any",
      rules: [cleared, { kind: "all", rules: [cleared, unknown] }],
    });
    expect(references(q.condition)).toEqual(["q1"]);
    expect(dependents("q1", [sample("q1", unknown), q])).toEqual([q]);
  });
  it("rejects duplicate IDs and missing references", () => {
    expect(
      validateQuests([sample("x", cleared), sample("x", unknown)]).join(" "),
    ).toMatch(/ID重複/);
    expect(validateQuests([sample("x", cleared)]).join(" ")).toMatch(
      /参照先欠落/,
    );
  });
  it("detects cycles", () => {
    expect(
      validateQuests([
        sample("q1", { kind: "quest_cleared", questId: "q2" }),
        sample("q2", cleared),
      ]).join(" "),
    ).toMatch(/循環依存/);
  });
  it("rejects invalid URLs, empty conditions, and bad HR values", () => {
    expect(
      validateQuests([
        {
          ...sample("x", { kind: "all", rules: [] }),
          sources: [
            { site: "bad", url: "javascript:alert(1)", kind: "detail" },
          ],
        },
      ]).join(" "),
    ).toMatch(/無効URL/);
    expect(
      validateQuests([sample("x", { kind: "all", rules: [] })]).join(" "),
    ).toMatch(/空の条件/);
    expect(
      validateQuests([sample("x", { kind: "hr_at_least", value: -1 })]).join(
        " ",
      ),
    ).toMatch(/無効HR/);
  });
  it("does not label unknown conditions verified", () => {
    expect(
      validateQuests([
        {
          ...sample("x", { kind: "all", rules: [unknown] }),
          verification: "verified",
        },
      ]).join(" "),
    ).toMatch(/未確認条件を検証済み/);
  });
});
