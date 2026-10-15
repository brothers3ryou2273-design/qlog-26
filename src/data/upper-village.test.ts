import { describe, expect, it } from "vitest";
import baseline from "../../docs/progress-baseline-197.json";
import { quests } from "./quests";
import { dependents, evaluate, references } from "../lib/rules";
const named = (name: string, rank: string) =>
  quests.find((q) => q.name === name && q.rank === rank)!;
describe("upper village catalog and released progress", () => {
  it("preserves all 197 IDs and every existing unlock including PR4 research", () => {
    expect(baseline).toHaveLength(197);
    for (const old of baseline) {
      const q = quests.find((q) => q.id === old.id)!;
      expect([q.name, q.rank, q.sources[0].url]).toEqual([
        old.name,
        old.rank,
        old.recipeUrl,
      ]);
      expect(q.unlocks).toEqual(expect.arrayContaining(old.unlocks));
    }
  });
  it("connects 宿命 to the collected rank-7 urgent without dropping 廻り集いて回帰せん", () => {
    const target = named("宿命の四天王", "6");
    const ids = [
      named("廻り集いて回帰せん", "6").id,
      named("調査隊初陣！遺群嶺の桃毛獣", "7").id,
    ];
    expect(references(target.condition)).toEqual(ids);
    expect(
      evaluate(target.condition, { schemaVersion: 1, completedQuestIds: ids }),
    ).toBe("met");
    expect(
      evaluate(target.condition, {
        schemaVersion: 1,
        completedQuestIds: ids.slice(0, 1),
      }),
    ).toBe("unmet");
    expect(dependents(ids[1], quests)).toContain(target);
  });
  it("keeps all-village-6 conditions restricted to ranks 1–6", () => {
    for (const name of [
      "高難度：強者たちの祭典！",
      "高難度：非情に波状な状態異常",
      "高難度：天と地の怒り",
      "高難度：最後の招待状",
      "高難度：終焉を喰らう者",
    ]) {
      const refs = references(named(name, "6").condition);
      expect(refs.length).toBeGreaterThan(100);
      expect(
        refs.every((id) => Number(quests.find((q) => q.id === id)!.rank) <= 6),
      ).toBe(true);
    }
  });
  it("uses specialist unlocks and the explicit sibling prerequisite over a conflicting corporate page", () => {
    const prior = named("ニャンター、お使い再び", "7");
    for (const name of ["芳香せしコンガ", "疾走するドスランポス"]) {
      expect(references(named(name, "7").condition)).toEqual([prior.id]);
      expect(
        evaluate(named(name, "7").condition, {
          schemaVersion: 1,
          completedQuestIds: [prior.id],
        }),
      ).toBe("met");
    }
    expect(prior.unlocks).toContainEqual(
      expect.objectContaining({
        kind: "facility",
        label: "オトモの育成レベル上限35",
      }),
    );
    expect(named("疾走するドスランポス", "7").unlocks).toContainEqual(
      expect.objectContaining({
        label: "オトモ雇用枠78匹",
        note: expect.stringContaining("G★2到達（OR）"),
      }),
    );
  });
  it("records research availability separately from the paid research procedure", () => {
    const q = named("彗星のカケラはどこに？", "7");
    expect(q.unlocks).toContainEqual(
      expect.objectContaining({ label: "研究室の開放" }),
    );
    expect(q.unlocks).toContainEqual(
      expect.objectContaining({
        label: "アイテムボックス拡張【序】（研究項目）",
        note: expect.stringContaining("灼けた甲殻"),
      }),
    );
  });
});

it("village 8 respects the two rank-7 prerequisites, three ship upgrades, and the prowler OR", () => {
  const ids = [
    named("遺群嶺の不思議な石", "7").id,
    named("これが本当のダイミョウ行列？", "7").id,
  ];
  expect(references(named("原生林に巣食う蜘蛛", "8").condition)).toEqual(ids);
  const upgrades = [
    "龍識船強化！【水竜編】",
    "龍識船強化！【迅竜編】",
    "龍識船強化！【溶岩竜編】",
  ].map((n) => named(n, "8").id);
  expect(references(named("氷海の採集ツアー", "8").condition)).toEqual(
    upgrades,
  );
  const target = named("桃毛獣のトサカ破壊に挑戦！", "8");
  for (const name of ["冷血なるドスギアノス！", "美しき、遺群嶺"]) {
    expect(
      evaluate(target.condition, {
        schemaVersion: 1,
        completedQuestIds: [named(name, "8").id],
      }),
    ).toBe("met");
  }
  expect(target.unlocks).toContainEqual(
    expect.objectContaining({ label: "オトモの初期雇用レベル30〜32" }),
  );
  expect(named("原生林に巣食う蜘蛛", "8").unlocks).toContainEqual(
    expect.objectContaining({
      label: "アイテムボックス拡張【匠】（研究項目）",
      note: expect.stringContaining("両方"),
    }),
  );
});
