import { describe, expect, it } from "vitest";
import audit from "../../docs/data-audit.json";
import { quests } from "./quests";
import { dependents, evaluate, references, validateQuests } from "../lib/rules";
import type { Quest, Rule } from "../lib/types";
const byName = (name: string): Quest => {
  const q = quests.find((q) => q.name === name);
  if (!q) throw Error(`Missing quest: ${name}`);
  return q;
};
const refs = (name: string) => references(byName(name).condition);
const hasKind = (r: Rule, kind: Rule["kind"]): boolean =>
  r.kind === kind ||
  ((r.kind === "all" || r.kind === "any") &&
    r.rules.some((c) => hasKind(c, kind)));

describe("rank-by-rank catalog audit against observed primary rosters", () => {
  for (const rank of audit.ranks) {
    it(`village ${rank.rank}: exact names, detail URLs, roles, tags, sources and integrity`, () => {
      const group = quests.filter(
        (q) => q.rank === rank.rank && q.category === "village",
      );
      expect(group).toHaveLength(rank.observedRecipeCount);
      if (Number(rank.rank) <= 3 && rank.observedGame8Count !== null)
        expect(rank.observedGame8Count).toBe(rank.observedRecipeCount);
      expect(group.map((q) => [q.name, q.sources[0].url])).toEqual(
        rank.entries.map((e) => [e.name, e.recipeUrl]),
      );
      for (const e of rank.entries) {
        const q = group.find((q) => q.sources[0].url === e.recipeUrl)!;
        expect(q.role).toBe(e.role);
        expect(q.tags).toEqual(e.tags);
        if (e.game8Url)
          expect(
            q.sources.some((s) => s.url === e.game8Url && s.checkedAt),
          ).toBe(true);
        expect(
          q.sources.some((s) => s.url === rank.recipeListUrl && s.checkedAt),
        ).toBe(true);
        // Every primary-source direct quest prerequisite is represented, rather than lost in a note.
        for (const url of e.prerequisiteUrls) {
          const requestOwner = audit.ranks
            .flatMap<{
              recipeUrl: string;
              requestUrlFromDetail: string | null;
            }>((r) => r.entries)
            .find((e) => e.requestUrlFromDetail === url);
          const prior = quests.find(
            (p) =>
              p.sources[0].url === url ||
              p.sources[0].url === requestOwner?.recipeUrl,
          );
          if (prior) expect(references(q.condition)).toContain(prior.id);
        }
      }
      for (const e of rank.entries) {
        const q = group.find((q) => q.sources[0].url === e.recipeUrl)!;
        for (const url of e.dependentUrls) {
          const target = quests.find((q) => q.sources[0].url === url);
          if (target) expect(dependents(q.id, quests)).toContain(target);
        }
      }
      expect(validateQuests(quests)).toEqual([]);
    });
  }
  it("has 197 distinct entries, 24 prowler quests, and five genuinely condition-free quests", () => {
    const released = quests.filter((q) => Number(q.rank) <= 6);
    expect(released).toHaveLength(197);
    expect(new Set(quests.map((q) => q.id)).size).toBe(quests.length);
    expect(released.filter((q) => q.role === "prowler")).toHaveLength(24);
    expect(
      quests.filter((q) => q.condition.kind === "none").map((q) => q.name),
    ).toEqual([
      "古代林の特産ゼンマイ",
      "悠久が眠る竜琥珀",
      "滋養強壮不老の蛾",
      "森の中のケルビ",
      "マッカォの群れを討伐せよ！",
    ]);
  });
  it("resolves request chains across ranks and generates the corresponding reverse link", () => {
    const pairs = [
      ["ランポスたちを討伐せよ！", "ドスランポスを狩猟せよ！"],
      ["ドスランポスを狩猟せよ！", "大怪鳥イャンクックを倒せ！"],
      ["大怪鳥イャンクックを倒せ！", "潜入！飛竜の巣！"],
      ["ギアノスたちを討伐せよ！", "雪山の荒くれ者"],
      ["雪山に潜む影", "忍び寄る気配"],
      ["青熊獣アオアシラ", "盾蟹と貝と狩り"],
      ["古代林の暴れん坊", "ムーファたちのふんわり毛玉"],
      ["ぽかぽかタケノコ納品", "ぽかぽかレスキュー隊出動！"],
    ];
    for (const [prior, next] of pairs) {
      expect(refs(next)).toContain(byName(prior).id);
      expect(dependents(byName(prior).id, quests)).toContain(byName(next));
      expect(byName(next).npcNotes?.length).toBeGreaterThan(0);
    }
  });
  it("keeps both prerequisites and the village conversation for 波乱の萌芽", () => {
    expect(refs("波乱の萌芽")).toEqual([
      byName("古代林の大怪鳥").id,
      byName("砂に潜む巨大蟹！").id,
    ]);
    expect(byName("波乱の萌芽").npcNotes).toContain("ベルナ村の村長と話す。");
    expect(refs("強襲する孤島の水流！")).toContain(byName("波乱の萌芽").id);
    expect(refs("毒怪鳥ゲリョスを追え！")).toContain(byName("波乱の萌芽").id);
  });
  it("requires two of the other five village-3 prowler quests for every possible completion subset", () => {
    const target = byName("沼地に異常事態発生虫？");
    const candidates = quests.filter(
      (q) => q.rank === "3" && q.role === "prowler" && q.id !== target.id,
    );
    expect(candidates).toHaveLength(5);
    for (let mask = 0; mask < 32; mask++) {
      const ids = candidates.filter((_, i) => mask & (1 << i)).map((q) => q.id);
      expect(
        evaluate(target.condition, {
          schemaVersion: 1,
          completedQuestIds: ids,
        }),
      ).toBe(ids.length >= 2 ? "met" : "unmet");
    }
    expect(dependents(candidates[0].id, quests)).toContain(target);
  });
  it("adopts the explicit recipe prerequisite despite lower-priority disagreement", () => {
    const q = byName("古代林のポイント招きネコ");
    expect(hasKind(q.condition, "unknown")).toBe(false);
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: quests.map((q) => q.id),
      }),
    ).toBe("met");
    expect(q.verification).toBe("partial");
  });
  it("does not infer prowler roles or request flags just from quest names", () => {
    expect(byName("旧砂漠の縄張り争いニャ！！").role).toBe("hunter");
    expect(byName("ガウシカ料理に挑戦ですニャ！").role).toBe("hunter");
    expect(byName("砂漠の恵みの納品依頼").tags).not.toContain("request");
  });
  it("records confirmed food, arts, facilities and report requirements without claiming receipt", () => {
    expect(byName("ぽかぽかタケノコ納品").unlocks).toContainEqual(
      expect.objectContaining({
        kind: "food",
        label: "ツチタケノコ",
        note: expect.stringContaining("報告"),
      }),
    );
    expect(byName("盾蟹と貝と狩り").unlocks).toContainEqual(
      expect.objectContaining({ kind: "food", label: "モガモ貝" }),
    );
    expect(byName("跳躍のアウトロー").unlocks).toContainEqual(
      expect.objectContaining({ kind: "hunter_art", label: "鏡花の構え LV1" }),
    );
    expect(byName("ほいっ！キノコ納品ですよ！").unlocks).toContainEqual(
      expect.objectContaining({
        kind: "facility",
        label: "ルームサービス変更可能",
      }),
    );
  });
});

describe("stage 3 source policy and automatic prerequisites", () => {
  it("preserves all 89 released IDs and canonical names", async () => {
    const baseline = (await import("../../docs/progress-id-baseline.json"))
      .default;
    expect(baseline).toHaveLength(89);
    for (const before of baseline) {
      const q = quests.find((q) => q.id === before.id)!;
      expect(q.name).toBe(before.name);
      expect(q.sources[0].url).toBe(before.recipeUrl);
    }
  });
  it("does not use ordinary conversations or reports as gates for ranks 1–3", () => {
    for (const q of quests.filter((q) => Number(q.rank) <= 3)) {
      expect(hasKind(q.condition, "external_flag")).toBe(false);
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: quests.map((q) => q.id),
          hr: 999,
        }),
      ).toBe("met");
    }
    expect(byName("ネコ嬢のジャギィ討伐依頼").npcNotes?.join(" ")).toContain(
      "ベルナ村の村長、ネコ嬢の順に話す",
    );
  });
  it("evaluates rank-4 urgent prerequisites from the six rank-3 keys", () => {
    const keys = quests.filter((q) => q.rank === "3" && q.tags.includes("key"));
    expect(keys).toHaveLength(6);
    const target = byName("幻惑の魔術師");
    expect(
      evaluate(target.condition, {
        schemaVersion: 1,
        completedQuestIds: keys.map((q) => q.id),
      }),
    ).toBe("met");
    expect(
      evaluate(target.condition, {
        schemaVersion: 1,
        completedQuestIds: keys.slice(1).map((q) => q.id),
      }),
    ).toBe("unmet");
  });
  it("retains same-rank quest and request-chain prerequisites without an NPC gate", () => {
    const target = byName("古代林のトレジャー！虫の巻");
    const ids = [
      byName("古代林のトレジャー！蛙の巻").id,
      byName("落石注意！？").id,
    ];
    expect(references(target.condition)).toEqual(ids);
    expect(
      evaluate(target.condition, { schemaVersion: 1, completedQuestIds: ids }),
    ).toBe("met");
    expect(target.npcNotes?.length).toBeGreaterThan(0);
    expect(dependents(ids[0], quests)).toContain(target);
  });
  it("uses OR, not AND, for the rank-5 prowler entry quest", () => {
    const target = byName("赤く染まる沼地");
    for (const prior of ["沼地は釣りの穴場？", "雪山のポイント捜索隊！"]) {
      expect(
        evaluate(target.condition, {
          schemaVersion: 1,
          completedQuestIds: [byName(prior).id],
        }),
      ).toBe("met");
    }
    expect(
      evaluate(target.condition, { schemaVersion: 1, completedQuestIds: [] }),
    ).toBe("unmet");
  });
  it("does not create cycles between the two rank-4 threshold rewards", () => {
    const candidates = [
      "跳狗竜の頭部破壊に挑戦！",
      "高速突進の交差点",
      "アヤシイお仕事",
      "ザザミソは隠し味",
    ].map((n) => byName(n).id);
    for (const name of ["沼地は釣りの穴場？", "雪山のポイント捜索隊！"]) {
      for (let mask = 0; mask < 16; mask++) {
        const ids = candidates.filter((_, i) => mask & (1 << i));
        expect(
          evaluate(byName(name).condition, {
            schemaVersion: 1,
            completedQuestIds: ids,
          }),
        ).toBe(ids.length >= 2 ? "met" : "unmet");
      }
    }
    expect(validateQuests(quests)).toEqual([]);
  });
  it("applies numeric HR requirements automatically", () => {
    const q = byName("高難度：黒狼鳥は舞い降りた");
    const ids = [byName("灼熱の刃").id];
    expect(
      evaluate(q.condition, { schemaVersion: 1, completedQuestIds: ids }),
    ).toBe("unknown");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: ids,
        hr: 4,
      }),
    ).toBe("unmet");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: ids,
        hr: 5,
      }),
    ).toBe("met");
  });
  it.each(["高難度：一対の巨影", "英雄への道"])(
    "does not claim ambiguous or uncollected prerequisites are met: %s",
    (name) => {
      expect(
        evaluate(byName(name).condition, {
          schemaVersion: 1,
          completedQuestIds: quests.map((q) => q.id),
          hr: 999,
        }),
      ).toBe("unknown");
    },
  );
  it("shows the non-routine hero-blade operation as a note and preserves the genuinely unspecified request", () => {
    const q = byName("英雄への道");
    expect(q.npcNotes).toContain("ココット村のヒーローブレードを抜く。");
    expect(hasKind(q.condition, "unknown")).toBe(true);
  });
  it("fills previously missing urgent foods and two trade locations with checked specialist sources", () => {
    expect(byName("跳躍のアウトロー").unlocks.map((u) => u.label)).toEqual(
      expect.arrayContaining(["高玄米", "ベルナッパ", "古代真鯛"]),
    );
    expect(byName("鬼面狩人を威す").unlocks.map((u) => u.label)).toEqual(
      expect.arrayContaining(["リノプロシュート", "ベルナス"]),
    );
    expect(byName("古代林のキノコ生態調査").unlocks).toContainEqual(
      expect.objectContaining({
        kind: "trade",
        label: "ジャンボキノコ山での交易",
        note: expect.stringContaining("または"),
      }),
    );
    expect(byName("沼地に異常事態発生虫？").unlocks).toContainEqual(
      expect.objectContaining({ kind: "trade", label: "モガ養蜂組合での交易" }),
    );
    for (const name of [
      "跳躍のアウトロー",
      "鬼面狩人を威す",
      "古代林のキノコ生態調査",
      "沼地に異常事態発生虫？",
    ]) {
      expect(
        byName(name).sources.some(
          (s) => s.site.startsWith("MHXX攻略Wiki") && s.checkedAt,
        ),
      ).toBe(true);
    }
  });
});

it("uses the explicit primary all-normal-village requirement without NPC or corporate-wiki gates", () => {
  const expected = quests
    .filter(
      (q) =>
        Number(q.rank) <= 6 &&
        q.role === "hunter" &&
        !q.name.startsWith("高難度："),
    )
    .map((q) => q.id);
  for (const name of [
    "高難度：強者たちの祭典！",
    "高難度：非情に波状な状態異常",
  ]) {
    const q = byName(name);
    expect(references(q.condition)).toEqual(expected);
    expect(
      evaluate(q.condition, { schemaVersion: 1, completedQuestIds: expected }),
    ).toBe("met");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: expected.slice(1),
      }),
    ).toBe("unmet");
  }
});
