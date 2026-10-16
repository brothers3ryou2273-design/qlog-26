/// <reference types="vite/client" />
import type { Quest } from "../lib/types";
import { describe, expect, it } from "vitest";
import { quests } from "./quests";
import { permitGroups } from "./permit-groups";
import audit from "../../docs/permit-roster-audit.json";
import { dependents, evaluate, references, validateQuests } from "../lib/rules";
import { hasUnlockIndicator } from "../lib/unlocks";
import indicators from "./unlock-indicators.json";
import baseline from "../../docs/progress-baseline-939.json";
import connections from "../../docs/permit-connections.json";
import { parseSave, SAVE_KEY } from "../lib/storage";
import research from "../../docs/permit-research-audit.json";

describe("special permit observed groups", () => {
  for (const group of audit.groups)
    it(`${group.id}: exact roster, stage order, attributes, URLs and dependencies`, () => {
      const qs = quests.filter(
        (q) => q.category === "permit" && q.rank === group.id,
      );
      expect(qs).toHaveLength(group.observedCount);
      expect(
        qs.map((q) => [
          q.id,
          q.name,
          q.order,
          q.permitStage,
          q.role,
          q.tags,
          q.sources[0].url,
        ]),
      ).toEqual(
        group.entries.map((r) => [
          r.questId,
          r.name,
          r.order,
          r.permitStage,
          r.role,
          r.tags,
          r.url,
        ]),
      );
      expect(qs.map((q) => q.permitStage)).toEqual([
        ...(group.legacy
          ? Array.from({ length: 10 }, (_, i) => `LV${i + 1}`)
          : []),
        ...Array.from({ length: 5 }, (_, i) => `G${i + 1}`),
        "超特殊許可",
      ]);
      for (const [i, q] of qs.entries()) {
        expect(q.sources[0].url.startsWith("http://wiki.mhxg.org/ida/")).toBe(
          true,
        );
        expect(group.entries[i].detailTitle.startsWith(q.name)).toBe(true);
        for (const panel of group.entries[i].panels)
          if (panel.title === "備考")
            for (const a of panel.links) {
              const prior = quests.find((x) => x.sources[0].url === a.url);
              if (prior) expect(references(q.condition)).toContain(prior.id);
            }
        for (const id of references(q.condition))
          expect(dependents(id, quests)).toContain(q);
      }
      const superQuest = qs.at(-1)!;
      const g5 = qs.at(-2)!;
      const all = quests.map((q) => q.id);
      expect(
        evaluate(superQuest.condition, {
          schemaVersion: 1,
          completedQuestIds: all,
          hr: 99,
        }),
      ).toBe("unmet");
      expect(
        evaluate(superQuest.condition, {
          schemaVersion: 1,
          completedQuestIds: all.filter((id) => id !== g5.id),
          hr: 100,
        }),
      ).toBe("unmet");
      expect(
        evaluate(superQuest.condition, {
          schemaVersion: 1,
          completedQuestIds: all,
          hr: 100,
        }),
      ).toBe("met");
      expect(hasUnlockIndicator(superQuest)).toBe(true);
      expect(hasUnlockIndicator(qs.find((q) => q.permitStage === "G5")!)).toBe(
        false,
      );
      for (const q of qs) expect(q.tags).not.toContain("unlock");
    });
  it("has 18 distinct stable selector groups and no missing/cyclic or duplicate quest references", () => {
    expect(permitGroups).toHaveLength(18);
    expect(new Set(permitGroups.map((g) => g.id)).size).toBe(18);
    expect(new Set(quests.map((q) => q.sources[0].url)).size).toBe(
      quests.length,
    );
    expect(validateQuests(quests)).toEqual([]);
  });
});

it("observed permit rosters total 228 with 12 original and 6 new groups, including 18 separate supers", () => {
  const permits = quests.filter((q) => q.category === "permit");
  expect(permits).toHaveLength(228);
  expect(audit.groups.filter((g) => g.legacy)).toHaveLength(12);
  expect(audit.groups.filter((g) => !g.legacy)).toHaveLength(6);
  expect(permits.filter((q) => q.permitStage === "超特殊許可")).toHaveLength(
    18,
  );
  expect(permits.filter((q) => q.permitStage === "G5")).toHaveLength(18);
  for (const group of audit.groups)
    for (const row of group.entries) {
      const q = permits.find((q) => q.id === row.questId)!;
      expect(q.role).toBe(
        row.icons.includes("ニャンター") ? "prowler" : "hunter",
      );
      const flags = [
        ["キー", "key"],
        ["緊急", "urgent"],
        ["依頼", "request"],
      ]
        .filter(([icon]) => row.icons.includes(icon))
        .map(([, tag]) => tag);
      expect(q.tags).toEqual(flags.length ? flags : ["normal"]);
    }
});
it("new G1 alternatives are OR, while Bloodbath preserves all five G1s, final urgent, HR and ordered action", () => {
  const named = (group: string, stage: string) =>
    quests.find(
      (q) =>
        q.category === "permit" && q.rank === group && q.permitStage === stage,
    )!;
  for (const group of ["朧隠", "鎧裂", "天眼", "青電主", "銀嶺"]) {
    const q = named(group, "G1");
    const refs = references(q.condition);
    expect(refs.length).toBe(group === "朧隠" ? 3 : 2);
    for (const id of refs)
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: [id],
          hr: 999,
        }),
      ).toBe("met");
  }
  const blood = named("鏖魔", "G1");
  const refs = references(blood.condition);
  expect(refs).toHaveLength(6);
  expect(refs).toContain("g-rank-4-recipe-294013");
  expect(
    evaluate(blood.condition, {
      schemaVersion: 1,
      completedQuestIds: quests.map((q) => q.id),
      hr: 999,
    }),
  ).toBe("unknown");
  for (const id of refs)
    expect(
      evaluate(blood.condition, {
        schemaVersion: 1,
        completedQuestIds: refs.filter((x) => x !== id),
        hr: 999,
      }),
    ).toBe("unmet");
  expect(JSON.stringify(blood.condition)).toContain("クエスト1回");
  expect(
    blood.unlocks.filter((u) => u.label.includes("特別入手")),
  ).toHaveLength(2);
});

it("keeps all 939 IDs, unlock facts and prerequisite expressions, allowing only audited note updates", async () => {
  expect(baseline).toHaveLength(939);
  for (const b of baseline) {
    const q = quests.find((q) => q.id === b.id)!;
    expect([q.name, q.category, q.rank, q.sources[0].url]).toEqual([
      b.name,
      b.category,
      b.rank,
      b.recipeUrl,
    ]);
    expect(q.unlocks).toEqual(
      b.unlocks.map(
        (u) =>
          connections.unlockNoteChanges.find(
            (c) =>
              c.questId === b.id && c.kind === u.kind && c.label === u.label,
          )?.after ?? u,
      ),
    );
    const canonical = JSON.stringify(q.condition, [
      "kind",
      "label",
      "note",
      "questId",
      "rules",
      "value",
    ]);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    expect(
      [...new Uint8Array(digest)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
    ).toBe(b.conditionSha256);
  }
  expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
  const old = {
    schemaVersion: 1 as const,
    hr: 100,
    completedQuestIds: [...baseline.map((q) => q.id), "future-permit-id"],
  };
  expect(parseSave(JSON.stringify(old))).toEqual(old);
  const added = {
    ...old,
    completedQuestIds: [
      ...old.completedQuestIds,
      ...quests.filter((q) => q.category === "permit").map((q) => q.id),
    ],
  };
  expect(parseSave(JSON.stringify(added))).toEqual(added);
});
it("every old special-permit reference now has a sourced fixed-ID backlink without becoming a reward badge", () => {
  expect(connections.unlockNoteChanges).toHaveLength(42);
  for (const c of connections.unlockNoteChanges) {
    const parent = quests.find((q) => q.id === c.questId)!,
      child = quests.find((q) => q.id === c.targetQuestId)!;
    expect(parent.unlocks).toContainEqual(c.after);
    expect([c.before.kind, c.before.label]).toEqual([
      c.after.kind,
      c.after.label,
    ]);
    expect(c.before.note).toContain("未収録");
    expect(c.after.note).not.toContain("未収録");
    expect(references(child.condition)).toContain(parent.id);
    expect(dependents(parent.id, quests)).toContain(child);
    expect(
      hasUnlockIndicator({
        ...parent,
        unlocks: [c.after as Quest["unlocks"][number]],
      }),
    ).toBe(indicators.confirmedMarkers.includes(parent.id));
  }
});
it("open G-rank Rath conditions accept known candidates and preserve other paths without forcing an AND", () => {
  const named = (rank: string, stage: string) =>
    quests.find(
      (q) =>
        q.category === "permit" && q.rank === rank && q.permitStage === stage,
    )!;
  for (const group of ["紫毒姫", "黒炎王"]) {
    const q = named(group, "G1"),
      level10 = named(group, "LV10");
    const refs = references(q.condition).filter((id) => id !== level10.id);
    expect(refs.length).toBeGreaterThan(0);
    for (const id of refs)
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: [level10.id, id],
          hr: 999,
        }),
      ).toBe("met");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: [level10.id],
        hr: 999,
      }),
    ).toBe("unknown");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: refs,
        hr: 999,
      }),
    ).toBe("unmet");
  }
});

const oldAuditText = import.meta.glob<string>("../../docs/*", {
  query: "?raw",
  import: "default",
  eager: true,
});
it("preserves every pre-existing audit file byte for byte", async () => {
  for (const item of research.priorAuditFiles) {
    const data = oldAuditText[`../../${item.path}`];
    expect(data).toBeDefined();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
    expect(
      [...new Uint8Array(digest)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
    ).toBe(item.sha256);
  }
});
