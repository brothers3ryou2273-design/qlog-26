import { describe, expect, it } from "vitest";
import audit from "../../docs/hub-audit.json";
import villageAudit from "../../docs/data-audit.json";
import baseline from "../../docs/progress-baseline-370.json";
import connections from "../../docs/hub-village-connections.json";
import { quests } from "./quests";
import { dependents, evaluate, references, validateQuests } from "../lib/rules";
import { parseSave, SAVE_KEY } from "../lib/storage";
import type { Rule } from "../lib/types";
const nodes = (r: Rule): Rule[] =>
  r.kind === "all" || r.kind === "any" ? [r, ...r.rules.flatMap(nodes)] : [r];

describe("observed hub rosters and cross-category dependencies", () => {
  for (const rank of audit.ranks) {
    it(`hub ${rank.rank}: matches the entire observed roster, roles, flags and real detail titles`, () => {
      const group = quests.filter(
        (q) => q.category === "hub" && q.rank === rank.rank,
      );
      expect(group).toHaveLength(rank.observedCount);
      expect(
        group.map((q) => [q.name, q.sources[0].url, q.role, q.tags]),
      ).toEqual(rank.entries.map((e) => [e.name, e.recipeUrl, e.role, e.tags]));
      group.forEach((q, i) => {
        expect(q.order).toBe(i);
        const e = rank.entries[i];
        expect(e.detailTitle.replaceAll(" ", "")).toContain(
          `集★${rank.rank}${q.name}`.replaceAll(" ", ""),
        );
        expect(q.sources).toContainEqual(
          expect.objectContaining({
            url: rank.recipeListUrl,
            checkedAt: audit.checkedAt,
          }),
        );
        for (const p of e.observations) {
          if (!["備考", "依頼"].includes(p.title)) continue;
          for (const link of p.links) {
            const owner = [...audit.ranks.flatMap((r) => r.entries)].find((e) =>
              e.observations.some(
                (p) => p.title === "依頼" && p.links[0]?.url === link.url,
              ),
            );
            const prior = quests.find(
              (p) =>
                p.sources[0].url === link.url ||
                p.sources[0].url === owner?.recipeUrl ||
                p.sources[0].url ===
                  villageAudit.ranks
                    .flatMap<{
                      recipeUrl: string;
                      requestUrlFromDetail: string | null;
                    }>((r) => r.entries)
                    .find((e) => e.requestUrlFromDetail === link.url)
                    ?.recipeUrl,
            );
            if (prior && prior.id !== q.id)
              expect(references(q.condition)).toContain(prior.id);
          }
        }
        for (const id of references(q.condition))
          expect(dependents(id, quests)).toContain(q);
      });
      expect(validateQuests(quests)).toEqual([]);
    });
  }
  it("preserves every village ID and unlock, including prior research", async () => {
    expect(baseline).toHaveLength(370);
    expect(
      quests.filter((q) => q.category === "village").map((q) => q.id),
    ).toEqual(baseline.map((q) => q.id));
    for (const b of baseline) {
      const q = quests.find((q) => q.id === b.id)!;
      expect([q.name, q.rank]).toEqual([b.name, b.rank]);
      expect(q.unlocks).toEqual(expect.arrayContaining(b.unlocks));
      if (!connections.changes.some((c) => c.questId === b.id)) {
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
          Array.from(new Uint8Array(digest), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join(""),
        ).toBe(b.conditionSha256);
      }
    }
  });
  it("connects audited village prerequisites in both directions, preserving every other gate", () => {
    for (const c of connections.changes) {
      const q = quests.find((q) => q.id === c.questId)!;
      expect(q.condition).toEqual(c.after);
      for (const node of nodes(c.before as Rule).filter(
        (r) =>
          r.kind !== "all" &&
          r.kind !== "any" &&
          !(r.kind === "external_flag" && /集★[123]/.test(r.label)),
      ))
        expect(nodes(q.condition)).toContainEqual(node);
      const hubIds = references(q.condition).filter((id) =>
        id.startsWith("hub-"),
      );
      expect(hubIds).toHaveLength(1);
      expect(dependents(hubIds[0], quests)).toContain(q);
      expect(q.npcNotes).toContain(c.addedNpcNote);
      const all = quests.map((q) => q.id);
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: all.filter((id) => id !== hubIds[0]),
          hr: 999,
        }),
      ).toBe("unmet");
    }
  });
  it("round-trips legacy 370 checks, HR, unknown IDs and new hub checks with schema version 1", () => {
    expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
    const old = {
      schemaVersion: 1 as const,
      completedQuestIds: [
        ...baseline.map((q) => q.id),
        "uncollected-future-id",
      ],
      hr: 6,
    };
    expect(parseSave(JSON.stringify(old))).toEqual(old);
    const updated = {
      ...old,
      completedQuestIds: [
        ...old.completedQuestIds,
        ...quests.filter((q) => q.category === "hub").map((q) => q.id),
      ],
    };
    expect(parseSave(JSON.stringify(updated))).toEqual(updated);
  });
});

it("keeps the untracked delivery in the hub-2 weapon request and evaluates its known AND gates", () => {
  const q = quests.find(
    (q) => q.category === "hub" && q.name === "無謀な弟子の、後始末",
  )!;
  expect(q).toBeDefined();
  expect(JSON.stringify(q.condition)).toContain("マカライト鉱石 x2大猪の皮 x1");
  expect(references(q.condition)).toContain(
    quests.find((q) => q.category === "village" && q.name === "鬼面狩人を威す")!
      .id,
  );
  const all = quests.map((q) => q.id);
  expect(
    evaluate(q.condition, { schemaVersion: 1, completedQuestIds: all, hr: 1 }),
  ).toBe("unmet");
  expect(
    evaluate(q.condition, { schemaVersion: 1, completedQuestIds: all, hr: 2 }),
  ).toBe("unknown");
});

for (const rank of audit.ranks.filter((r) => r.rank === "2")) {
  it("hub-2 urgent requires all five hub-1 keys, without including same-named village keys", () => {
    const q = quests.find(
      (q) => q.category === "hub" && q.name === "雪山の主、ドドブランゴ",
    )!;
    const keys = quests.filter(
      (q) => q.category === "hub" && q.rank === "1" && q.tags.includes("key"),
    );
    expect(keys).toHaveLength(5);
    expect(references(q.condition)).toEqual(keys.map((q) => q.id));
    for (let mask = 0; mask < 32; mask++) {
      const completedQuestIds = keys
        .filter((_, i) => mask & (1 << i))
        .map((q) => q.id);
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds }),
      ).toBe(mask === 31 ? "met" : "unmet");
    }
    expect(rank.observedCount).toBe(35);
  });
}

it("hub-3 urgents use the correct six-key sets and preserve the separate HR3 gate", () => {
  for (const [name, keyRank, hr] of [
    ["電の反逆者", "2", undefined],
    ["双頭の骸", "3", 3],
  ] as const) {
    const q = quests.find((q) => q.category === "hub" && q.name === name)!;
    const keys = quests.filter(
      (q) =>
        q.category === "hub" && q.rank === keyRank && q.tags.includes("key"),
    );
    expect(keys).toHaveLength(6);
    expect(references(q.condition)).toEqual(keys.map((q) => q.id));
    for (let mask = 0; mask < 64; mask++) {
      const completedQuestIds = keys
        .filter((_, i) => mask & (1 << i))
        .map((q) => q.id);
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr }),
      ).toBe(mask === 63 ? "met" : "unmet");
    }
    if (hr) {
      const completedQuestIds = keys.map((q) => q.id);
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds }),
      ).toBe("unknown");
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 2 }),
      ).toBe("unmet");
    }
  }
});

it("partly resolves the village-10 chain without erasing hub-5, HR5 or other village prerequisites", () => {
  const q = quests.find(
    (q) => q.category === "village" && q.name === "遺群嶺を塞ぐ恐暴竜",
  )!;
  const hub = quests.find(
    (q) => q.category === "hub" && q.name === "化石に眠る太古の記憶",
  )!;
  expect(references(q.condition)).toContain(hub.id);
  expect(JSON.stringify(q.condition)).toContain("集★5雪山の主、ドドブランゴ");
  expect(nodes(q.condition)).toContainEqual({ kind: "hr_at_least", value: 5 });
  const completedQuestIds = quests.map((q) => q.id);
  expect(
    evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 4 }),
  ).toBe("unmet");
  expect(
    evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 5 }),
  ).toBe("unknown");
  expect(dependents(hub.id, quests)).toContain(q);
});

it("registers exact primary art releases, foods, recipes, and conservative facility findings", () => {
  const hub = quests.filter((q) => q.category === "hub");
  const arts = hub.flatMap((q) =>
    q.unlocks.filter((u) => u.kind === "hunter_art"),
  );
  expect(arts).toHaveLength(50);
  const foods = hub.flatMap((q) => q.unlocks.filter((u) => u.kind === "food"));
  expect(foods.map((u) => u.label)).toEqual([
    "チココーン",
    "モグモガーリック",
    "サイコロミート",
  ]);
  expect(foods.every((u) => u.note?.includes("報告"))).toBe(true);
  const sameNameVillage = quests.find(
    (q) => q.category === "village" && q.name === "廻り集いて回帰せん",
  )!;
  const sameNameHub = hub.find((q) => q.name === "廻り集いて回帰せん")!;
  expect(sameNameVillage.id).not.toBe(sameNameHub.id);
  expect(sameNameHub.unlocks).toContainEqual(
    expect.objectContaining({
      kind: "hunter_art",
      label: "ラピッドヘブン LV2",
    }),
  );
  expect(
    sameNameHub.unlocks.some((u) => u.label === "バレットゲイザー LV2"),
  ).toBe(false);
  expect(hub.filter((q) => q.warnings?.length).map((q) => q.name)).toEqual([
    "雪山の主、ドドブランゴ",
    "電の反逆者",
    "双頭の骸",
  ]);
  const skull = hub.find((q) => q.name === "双頭の骸")!;
  expect(skull.unlocks).toContainEqual(
    expect.objectContaining({
      kind: "facility",
      label: "オトモの初期雇用レベル5〜7の解放経路",
      note: expect.stringContaining("（OR）"),
    }),
  );
  expect(hub.flatMap((q) => q.unlocks).some((u) => u.kind === "trade")).toBe(
    false,
  ); // Ambiguous ★3 urgent must not become a fabricated route.
});
