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
      expect(rank.observedGame8Count).toBe(rank.observedRecipeCount);
      expect(group.map((q) => [q.name, q.sources[0].url])).toEqual(
        rank.entries.map((e) => [e.name, e.recipeUrl]),
      );
      for (const e of rank.entries) {
        const q = group.find((q) => q.sources[0].url === e.recipeUrl)!;
        expect(q.role).toBe(e.role);
        expect(q.tags).toEqual(e.tags);
        expect(q.sources.some((s) => s.url === e.game8Url && s.checkedAt)).toBe(
          true,
        );
        expect(
          q.sources.some((s) => s.url === rank.recipeListUrl && s.checkedAt),
        ).toBe(true);
        // Every primary-source direct quest prerequisite is represented, rather than lost in a note.
        for (const url of e.prerequisiteUrls) {
          const requestOwner = audit.ranks
            .flatMap((r) => r.entries)
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
      expect(
        validateQuests(
          quests.filter((q) => Number(q.rank) <= Number(rank.rank)),
        ),
      ).toEqual([]);
    });
  }
  it("has 89 distinct entries, nine prowler quests, and five genuinely condition-free quests", () => {
    expect(quests).toHaveLength(89);
    expect(new Set(quests.map((q) => q.id)).size).toBe(89);
    expect(quests.filter((q) => q.role === "prowler")).toHaveLength(9);
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
      expect(hasKind(byName(next).condition, "external_flag")).toBe(true);
    }
  });
  it("keeps both prerequisites and the village conversation for 波乱の萌芽", () => {
    expect(refs("波乱の萌芽")).toEqual([
      byName("古代林の大怪鳥").id,
      byName("砂に潜む巨大蟹！").id,
    ]);
    expect(hasKind(byName("波乱の萌芽").condition, "external_flag")).toBe(true);
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
  it("does not resolve the conflicting 古代林のポイント招きネコ prerequisite as known", () => {
    const q = byName("古代林のポイント招きネコ");
    expect(hasKind(q.condition, "unknown")).toBe(true);
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: quests.map((q) => q.id),
      }),
    ).toBe("unknown");
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
    for (const q of quests)
      for (const u of q.unlocks) expect(u.note).toBeTruthy();
  });
});
