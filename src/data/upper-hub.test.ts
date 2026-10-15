import upperConnections from "../../docs/upper-hub-connections.json";
import { describe, expect, it } from "vitest";
import villageAudit from "../../docs/data-audit.json";
import lowerAudit from "../../docs/hub-audit.json";
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
        const owners = new Map<string, string>();
        for (const rank of villageAudit.ranks)
          for (const entry of rank.entries)
            if (entry.requestUrlFromDetail)
              owners.set(entry.requestUrlFromDetail, entry.recipeUrl);
        for (const doc of [lowerAudit, audit])
          for (const rank of doc.ranks)
            for (const entry of rank.entries) {
              const own = entry.observations.find((p) => p.title === "依頼")
                ?.links[0]?.url;
              if (own) owners.set(own, entry.recipeUrl);
            }
        for (const panel of rank.entries[i].observations) {
          for (const a of panel.links) {
            const target = quests.find(
              (x) =>
                x.sources[0].url === a.url ||
                x.sources[0].url === owners.get(a.url),
            );
            if (!target || target.id === q.id) continue;
            if (panel.title === "備考" || panel.title === "依頼")
              expect(references(q.condition)).toContain(target.id);
            if (panel.title === "他のクエスト発生に必要")
              expect(dependents(q.id, quests)).toContain(target);
          }
        }
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
      expect(q.unlocks).toEqual(
        expect.arrayContaining(
          b.unlocks.map(
            (u) =>
              upperConnections.unlockNoteChanges.find(
                (c) =>
                  c.questId === b.id &&
                  c.kind === u.kind &&
                  c.label === u.label,
              )?.after ?? u,
          ),
        ),
      );
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

it("only changes audited legacy prerequisites and preserves their residual gates", async () => {
  const flatten = (
    r: import("../lib/types").Rule,
  ): import("../lib/types").Rule[] =>
    r.kind === "all" || r.kind === "any" ? r.rules.flatMap(flatten) : [r];
  for (const b of baseline) {
    const q = quests.find((q) => q.id === b.id)!;
    const c = upperConnections.changes.find((c) => c.questId === b.id);
    if (c) {
      expect(q.condition).toEqual(c.after);
      const inherited = (c.resolvedInheritedPrerequisites ??
        []) as import("../lib/types").Rule[];
      for (const node of flatten(c.before as import("../lib/types").Rule)) {
        if (node.kind === "external_flag" && /集★[4-7]/.test(node.label))
          continue;
        if (inherited.some((x) => JSON.stringify(x) === JSON.stringify(node)))
          continue;
        expect(flatten(q.condition)).toContainEqual(node);
      }
    } else {
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

it("rank-7 urgents distinguish five lower keys, six upper keys, HR and the G-rank transition", () => {
  const named = (name: string) =>
    quests.find(
      (q) => q.category === "hub" && q.rank === "7" && q.name === name,
    )!;
  const lower = quests.filter(
    (q) => q.category === "hub" && q.rank === "6" && q.tags.includes("key"),
  );
  const upper = quests.filter(
    (q) => q.category === "hub" && q.rank === "7" && q.tags.includes("key"),
  );
  expect(lower).toHaveLength(5);
  expect(upper).toHaveLength(6);
  expect(references(named("千刃竜セルレギオス").condition)).toEqual(
    lower.map((q) => q.id),
  );
  const final = named("奈落の妖星");
  expect(references(final.condition)).toEqual(upper.map((q) => q.id));
  for (let mask = 0; mask < 64; mask++)
    expect(
      evaluate(final.condition, {
        schemaVersion: 1,
        completedQuestIds: upper
          .filter((_, i) => mask & (1 << i))
          .map((q) => q.id),
        hr: 7,
      }),
    ).toBe(mask === 63 ? "met" : "unmet");
  expect(
    evaluate(final.condition, {
      schemaVersion: 1,
      completedQuestIds: upper.map((q) => q.id),
      hr: 6,
    }),
  ).toBe("unmet");
  const letter = named("遺跡平原からの伝書");
  expect(references(letter.condition)).toContain(final.id);
  const g = named("その腕前、噂通りかしら…？");
  expect(references(g.condition)).toEqual([
    ...upper.map((q) => q.id),
    letter.id,
  ]);
  const all = quests.map((q) => q.id);
  expect(
    evaluate(g.condition, { schemaVersion: 1, completedQuestIds: all, hr: 7 }),
  ).toBe("unmet");
  expect(
    evaluate(g.condition, { schemaVersion: 1, completedQuestIds: all, hr: 8 }),
  ).toBe("met");
  expect(
    evaluate(g.condition, {
      schemaVersion: 1,
      completedQuestIds: all.filter((id) => id !== letter.id),
      hr: 8,
    }),
  ).toBe("unmet");
});

it("known completion resolves an inherited request without claiming its unknown eligibility is known", () => {
  const parent = quests.find(
    (q) => q.category === "village" && q.name === "熱地に現る、ウラガンキン！",
  )!;
  const request = quests.find(
    (q) => q.category === "hub" && q.name === "心を燃やせ、燃石炭！",
  )!;
  const all = quests.map((q) => q.id);
  expect(
    evaluate(request.condition, {
      schemaVersion: 1,
      completedQuestIds: all,
      hr: 999,
    }),
  ).toBe("unknown");
  expect(
    evaluate(parent.condition, {
      schemaVersion: 1,
      completedQuestIds: all,
      hr: 999,
    }),
  ).toBe("met");
  expect(
    evaluate(parent.condition, {
      schemaVersion: 1,
      completedQuestIds: all.filter((id) => id !== request.id),
      hr: 999,
    }),
  ).toBe("unmet");
});

it("retains G2, material delivery, total hunt counts, random spawns and HR-cap state", () => {
  const all = quests.map((q) => q.id);
  for (const name of [
    "轟竜の狩猟をさせてやるぜ！",
    "高難度：喧嘩の仲裁は村を救う",
    "高難度：炎王の帰還",
  ]) {
    const q = quests.find((q) => q.category === "village" && q.name === name)!;
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: all,
        hr: 999,
      }),
    ).toBe("unknown");
  }
  const ship = quests.find(
    (q) => q.category === "hub" && q.name === "蒼く渦巻く登竜門",
  )!;
  expect(JSON.stringify(ship.condition)).toContain(
    "ユクモの木 x5泡立つ滑液 x2海綿質の上皮 x1",
  );
  const silver = quests.find(
    (q) => q.category === "hub" && q.name === "白銀の火輪",
  )!;
  expect(JSON.stringify(silver.condition)).toContain("200体以上");
  expect(
    evaluate(silver.condition, {
      schemaVersion: 1,
      completedQuestIds: all,
      hr: 999,
    }),
  ).toBe("unknown");
  const random = quests.find(
    (q) =>
      q.category === "hub" && q.rank === "7" && q.name === "氷点下の支配者",
  )!;
  expect(JSON.stringify(random.condition)).toContain("ランダム");
  expect(
    evaluate(random.condition, {
      schemaVersion: 1,
      completedQuestIds: all,
      hr: 999,
    }),
  ).toBe("unknown");
});
