import upperConnections from "../../docs/upper-hub-connections.json";
import { describe, expect, it } from "vitest";
import baseline from "../../docs/progress-baseline-197.json";
import { quests } from "./quests";
import { dependents, evaluate, references } from "../lib/rules";
const named = (name: string, rank: string) =>
  quests.find(
    (q) => q.category === "village" && q.name === name && q.rank === rank,
  )!;
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
      expect(q.unlocks).toEqual(
        expect.arrayContaining(
          old.unlocks.map(
            (u) =>
              upperConnections.unlockNoteChanges.find(
                (c) =>
                  c.questId === old.id &&
                  c.kind === u.kind &&
                  c.label === u.label,
              )?.after ?? u,
          ),
        ),
      );
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

it("village 9 resolves the checked spelling variant and preserves OR versus AND research requirements", () => {
  const urgent = named("彗星の前にあらわる鎧竜", "9");
  const ids = [
    named("ぷくぅーっ！ザボアザギル！", "8").id,
    named("ものぐさには爆鎚竜で喝！", "8").id,
  ];
  expect(references(urgent.condition)).toEqual(ids);
  expect(
    evaluate(urgent.condition, { schemaVersion: 1, completedQuestIds: ids }),
  ).toBe("met");
  expect(urgent.unlocks).toContainEqual(
    expect.objectContaining({
      label: "回復セット【基本】（研究項目）",
      note: expect.stringContaining("解放（OR）"),
    }),
  );
  expect(urgent.unlocks).toContainEqual(
    expect.objectContaining({
      label: "アイテムボックス拡張【極】（研究項目）",
      note: expect.stringContaining("両方"),
    }),
  );
  const target = named("岩竜の胸部破壊に挑戦！", "9");
  for (const prior of ["身の毒は気の毒", "旧砂漠のポイント招きネコ"]) {
    expect(
      evaluate(target.condition, {
        schemaVersion: 1,
        completedQuestIds: [named(prior, "9").id],
      }),
    ).toBe("met");
  }
  expect(target.unlocks).toContainEqual(
    expect.objectContaining({
      label: "オトモ雇用枠84匹",
      note: expect.stringContaining("G★3到達（OR）"),
    }),
  );
});

describe("village 10 special conditions", () => {
  it("limits five all-clear challenges to normal hunter quests in ranks 7–10", () => {
    const required = quests
      .filter(
        (q) =>
          q.category === "village" &&
          Number(q.rank) >= 7 &&
          Number(q.rank) <= 10 &&
          q.role === "hunter" &&
          !q.name.startsWith("高難度："),
      )
      .map((q) => q.id);
    expect(required).toHaveLength(141);
    for (const name of [
      "高難度：モンスターハンター",
      "高難度：覇者の証明",
      "高難度：龍歴院からの挑戦状",
      "高難度：ギルドからの試練",
      "高難度：ダブルクロス",
    ]) {
      const q = named(name, "10");
      expect(references(q.condition)).toEqual(required);
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: required,
        }),
      ).toBe("met");
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: required.slice(1),
        }),
      ).toBe("unmet");
    }
  });
  it("requires any one of three prowler quests for 怒濤 and keeps the explicit primary prerequisite", () => {
    const ids = [
      "ルドロスの野次馬根性",
      "尾槌竜のコブ破壊に挑戦！",
      "スノーフェスティバル",
    ].map((n) => named(n, "10").id);
    const q = named("怒濤のドスラッシュ！", "10");
    for (let mask = 0; mask < 8; mask++) {
      const completedQuestIds = ids.filter((_, i) => mask & (1 << i));
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds }),
      ).toBe(mask ? "met" : "unmet");
    }
    expect(q.unlocks).toContainEqual(
      expect.objectContaining({ label: "オトモの初期雇用レベル45〜47" }),
    );
  });
  it("evaluates the four final urgents from all six rank-10 keys and HR9", () => {
    const completedQuestIds = quests
      .filter((q) => q.rank === "10" && q.tags.includes("key"))
      .map((q) => q.id);
    expect(completedQuestIds).toHaveLength(6);
    for (const name of [
      "怨嗟の骸",
      "獄炎の覇王",
      "崩せ神の座、威の寝床",
      "嵐龍天翔",
    ]) {
      const q = named(name, "10");
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds }),
      ).toBe("unknown");
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 8 }),
      ).toBe("unmet");
      expect(
        evaluate(q.condition, { schemaVersion: 1, completedQuestIds, hr: 9 }),
      ).toBe("met");
    }
    const finalIds = [
      "怨嗟の骸",
      "獄炎の覇王",
      "崩せ神の座、威の寝床",
      "嵐龍天翔",
    ].map((n) => named(n, "10").id);
    expect(references(named("黒き光を放つ神", "10").condition)).toEqual(
      finalIds,
    );
  });
  it.each([
    "高難度：禍は鋼鉄よりも硬し",
    "高難度：宵闇に消ゆ",
    "高難度：陽炎の帝国",
  ])(
    "keeps the explicit random appearance observable only in game: %s",
    (name) => {
      const q = named(name, "10");
      expect(references(q.condition)).toContain(
        named("黒き光を放つ神", "10").id,
      );
      expect(JSON.stringify(q.condition)).toContain("ランダム出現");
      expect(
        evaluate(q.condition, {
          schemaVersion: 1,
          completedQuestIds: quests.map((q) => q.id),
          hr: 999,
        }),
      ).toBe("unknown");
    },
  );
  it("retains material delivery and HR-cap requirements instead of dropping linked item conditions", () => {
    const q = named("高難度：喧嘩の仲裁は村を救う", "10");
    expect(JSON.stringify(q.condition)).toContain(
      "ユクモの木 x4ガウシカの角 x2巨獣の鼻棘 x1",
    );
    expect(JSON.stringify(q.condition)).toContain("HR上限の解放");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: quests.map((q) => q.id),
        hr: 999,
      }),
    ).toBe("unknown");
  });
  it("distinguishes the special headgear grants from equipment recipes", () => {
    expect(named("恐れ見よ、赤き災厄の彗星を", "10").unlocks).toContainEqual(
      expect.objectContaining({ label: "斬炎のピアス（特別入手）" }),
    );
    expect(named("高難度：モンスターハンター", "10").unlocks).toContainEqual(
      expect.objectContaining({ label: "ポッケ・ネーヴェ（特別入手）" }),
    );
    expect(named("恐れ見よ、赤き災厄の彗星を", "10").unlocks).toContainEqual(
      expect.objectContaining({
        label: "オトモ雇用枠72匹の解放経路",
        note: expect.stringContaining("縮小"),
      }),
    );
  });
});

it("retains the full primary rank-10 roster despite the smaller observed corporate list", async () => {
  const observed = (await import("../../docs/upper-research-audit.json"))
    .default;
  const rank10 = observed.rosterComparisons.find((r) => r.rank === "10")!;
  expect([rank10.primaryCount, rank10.game8Count]).toEqual([50, 33]);
  expect(rank10.primaryOnlyAfterWaveDashNormalization).toHaveLength(17);
  expect(quests.filter((q) => q.rank === "10")).toHaveLength(50);
  expect(named("黒き光を放つ神", "10")).toBeDefined();
  expect(
    quests.filter((q) => q.rank === "10" && q.name.startsWith("高難度：")),
  ).toHaveLength(16);
});

it("uses the fetched corporate pages to fill two wave-dash spelling variants instead of leaving generic unknowns", () => {
  for (const name of ["領主の依頼～大連続篇～", "狩人のための舞台～森丘～"]) {
    const q = named(name, "10");
    expect(references(q.condition)).toEqual([
      named("恐れ見よ、赤き災厄の彗星を", "10").id,
    ]);
    expect(
      q.sources.some((s) => s.site.startsWith("Game8") && s.checkedAt),
    ).toBe(true);
  }
  for (const q of quests.filter(
    (q) => q.category === "village" && Number(q.rank) >= 7,
  ))
    expect(JSON.stringify(q.condition)).not.toContain(
      "出現前提を出典から特定できませんでした",
    );
});
