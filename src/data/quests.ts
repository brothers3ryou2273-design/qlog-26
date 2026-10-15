import type { Quest, Rule } from "../lib/types";

// 固定IDは初回確認時に付与し、参照先サイトや表示名が変わっても変更しない。
const id = (rank: string, sourceId: number) => `village-${rank}-g8-${sourceId}`;
const cleared = (rank: string, sourceId: number): Rule => ({
  kind: "quest_cleared",
  questId: id(rank, sourceId),
});
const all = (...rules: Rule[]): Rule => ({ kind: "all", rules });
const conversation = (label: string): Rule => ({
  kind: "external_flag",
  label,
});
const afterVillage2 = all(
  cleared("2", 822843),
  conversation("ベルナ村の村長、龍歴院の主席研究員と話す"),
);
const afterVillage3 = all(
  cleared("3", 822877),
  conversation("ベルナ村の村長と話す"),
);
const commonNote =
  "名称・所属・キー／緊急属性・備考の出現前提を攻略レシピの個別ページで照合済み。会話の詳細な手順はGame8で補完しています。食材・狩技等の解放要素は未網羅のため一部確認です。並び順は収録時の固定順です。";
// 村★1〜3の一覧に実際に掲載されていたリンクを開き、同名・同ランクを確認。
// 保存済み進捗のためGame8由来の既存IDは変更しない。
const recipePages: Record<number, string> = {
  822831: "http://wiki.mhxg.org/ida/219133.html",
  822835: "http://wiki.mhxg.org/ida/218316.html",
  822836: "http://wiki.mhxg.org/ida/218315.html",
  822837: "http://wiki.mhxg.org/ida/219137.html",
  822843: "http://wiki.mhxg.org/ida/219257.html",
  822844: "http://wiki.mhxg.org/ida/219313.html",
  822849: "http://wiki.mhxg.org/ida/218317.html",
  822850: "http://wiki.mhxg.org/ida/218318.html",
  822852: "http://wiki.mhxg.org/ida/218320.html",
  822872: "http://wiki.mhxg.org/ida/218326.html",
  822877: "http://wiki.mhxg.org/ida/219318.html",
  822878: "http://wiki.mhxg.org/ida/219982.html",
  822884: "http://wiki.mhxg.org/ida/219983.html",
  822885: "http://wiki.mhxg.org/ida/219984.html",
};
function quest(
  sourceId: number,
  rank: string,
  name: string,
  tags: Quest["tags"],
  condition: Rule,
  extra: Partial<Quest> = {},
): Quest {
  return {
    id: id(rank, sourceId),
    name,
    category: "village",
    rank,
    order: sourceId,
    role: "hunter",
    tags,
    condition,
    unlocks: [],
    sources: [
      {
        site: "MHXX攻略レシピ",
        url: recipePages[sourceId],
        kind: "detail",
        checkedAt: "2026-10-15",
      },
      {
        site: "Game8 MHXX",
        url: `https://game8.jp/mh-xx/${sourceId}`,
        kind: "detail",
        checkedAt: "2026-10-15",
      },
      ...(tags.length
        ? [
            {
              site: "MHXX攻略Wiki",
              url: "https://mhx-wiki.com/?MHXX%E3%81%AE%E6%9D%91%E3%82%AD%E3%83%BC%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E4%B8%80%E8%A6%A7",
              kind: "list" as const,
              checkedAt: "2026-10-15",
            },
          ]
        : []),
    ],
    verification: "partial",
    verificationNote: commonNote,
    ...extra,
  };
}
// 以下14件の攻略レシピ・Game8の個別URLは、一覧のリンクを実際に開いて確認したもの。
// URL規則から未確認のページを生成しない。全クエストの網羅を示すデータではない。
export const quests: Quest[] = [
  quest(822831, "1", "古代林の特産ゼンマイ", ["key"], { kind: "none" }),
  quest(822835, "1", "古代の森でシメジ狩り", ["key"], cleared("1", 822831)),
  quest(822836, "1", "マッカォの群れを討伐せよ！", ["key"], { kind: "none" }),
  quest(
    822837,
    "1",
    "ネコ嬢のジャギィ討伐依頼",
    ["key", "request"],
    all(cleared("1", 822836), conversation("ベルナ村の村長、ネコ嬢の順に話す")),
  ),
  quest(
    822843,
    "2",
    "跳躍のアウトロー",
    ["urgent"],
    all(
      cleared("1", 822831),
      cleared("1", 822835),
      cleared("1", 822836),
      cleared("1", 822837),
      conversation("ネコ嬢、ベルナ村の村長の順に話す"),
    ),
  ),
  quest(822844, "2", "お騒がせのリノプロス", ["key"], afterVillage2),
  quest(822849, "2", "ドスゲネポスを狩れ！", ["key"], afterVillage2),
  quest(822850, "2", "大地を泳ぐモンスター", ["key"], afterVillage2),
  quest(822852, "2", "迫るヤオザミ包囲網", ["key"], afterVillage2),
  quest(822872, "2", "ニャンター、はじめてのお使い", [], afterVillage2, {
    role: "prowler",
  }),
  quest(
    822877,
    "3",
    "鬼面狩人を威す",
    ["urgent"],
    all(
      cleared("2", 822844),
      cleared("2", 822849),
      cleared("2", 822850),
      cleared("2", 822852),
      conversation(
        "ココット村・ポッケ村・ユクモ村の村長と話したあと、ベルナ村の村長と話す",
      ),
    ),
  ),
  quest(822878, "3", "古代林の大怪鳥", ["key"], afterVillage3),
  quest(822884, "3", "砂に潜む巨大蟹！", ["key"], afterVillage3),
  quest(822885, "3", "砂上のテーブルマナー", ["key"], afterVillage3),
];
export const dataStatus = {
  complete: false,
  note: "村★1〜3の一部14件を収録しています（4件・6件・4件）。攻略レシピのHTTP個別ページで名称・属性・出現前提を照合し、会話の詳細はGame8で補完しています。解放要素が未網羅のため、すべて「一部確認」です。未収録のクエスト・解放要素があります。",
};
