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
  "名称・所属・属性・出現条件をGame8の個別ページで確認。攻略レシピは接続タイムアウトにより未照合。食材・狩技等の解放要素は未確認。並び順は収録時の固定順です。";
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
      { site: "MHXX攻略レシピ", url: "https://wiki.mhxg.org/", kind: "home" },
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
// 以下の14個別URLは一覧に掲載されたリンクを実際に開いて確認したもの。
// URL規則から未確認のページを生成しない。全クエストの網羅を示すデータではない。
export const quests: Quest[] = [
  quest(822831, "1", "古代林の特産ゼンマイ", ["key"], { kind: "none" }),
  quest(822835, "1", "古代の森でシメジ狩り", ["key"], cleared("1", 822831), {
    verificationNote: `${commonNote} MHXX攻略Wikiのキー一覧では「古代林でシメジ狩り」と表記が異なります。ここでは個別ページと村下位一覧が一致するGame8の表記を採用し、原典との再照合は未完了です。`,
  }),
  quest(822836, "1", "マッカォの群れを討伐せよ！", ["key"], { kind: "none" }),
  quest(
    822837,
    "1",
    "ネコ嬢のジャギィ討伐依頼",
    ["key"],
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
  quest(822884, "3", "砂に潜む巨大蟹！", ["key"], afterVillage3, {
    verificationNote: `${commonNote} MHXX攻略Wikiのキー一覧では末尾の「！」がありません。Game8の個別ページの表記を採用し、原典との再照合は未完了です。`,
  }),
  quest(822885, "3", "砂上のテーブルマナー", ["key"], afterVillage3),
];
export const dataStatus = {
  complete: false,
  note: "村★1〜3の一部14件を収録しています（4件・6件・4件）。名称・出現条件はGame8の個別ページで確認し、一部のキー属性をMHXX攻略Wikiと照合しました。攻略レシピは接続タイムアウトで未照合のため、すべて「一部確認」です。未収録のクエスト・解放要素があります。",
};
