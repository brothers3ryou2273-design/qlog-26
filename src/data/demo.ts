import type { Quest, Rule } from "../lib/types";
/** 架空の動作確認用。ゲーム情報ではなく、実データと保存領域を分ける。 */
function demo(
  id: string,
  rank: string,
  name: string,
  condition: Rule,
  extra: Partial<Quest> = {},
): Quest {
  return {
    id: `demo-${id}`,
    name: `【架空】${name}`,
    rank,
    category: "village",
    order: Number(id),
    role: "hunter",
    tags: ["normal"],
    condition,
    unlocks: [],
    verification: "unverified",
    verificationNote:
      "操作確認専用の架空データ。実際のMHXXクエスト・出現条件とは関係ありません。",
    sources: [
      { site: "MHXX攻略レシピ", url: "http://wiki.mhxg.org/", kind: "home" },
    ],
    ...extra,
  };
}
export const demoQuests: Quest[] = [
  demo("1", "1", "はじめの採集", { kind: "none" }, { tags: ["key"] }),
  demo("2", "1", "森の調査", {
    kind: "unknown",
    note: "出現条件の未確認表示を試す例",
  }),
  demo(
    "3",
    "2",
    "森の調査",
    {
      kind: "all",
      rules: [{ kind: "quest_cleared", questId: "demo-1" }],
    },
    {
      tags: ["request"],
      npcNotes: ["村人から依頼を受注し、必要な会話を行う（架空の例）"],
      unlocks: [
        {
          kind: "food",
          label: "架空の食材",
          note: "受け取りはゲーム内で要確認（動作例）",
        },
      ],
    },
  ),
  demo(
    "4",
    "2",
    "二つの足跡",
    {
      kind: "any",
      rules: [
        { kind: "quest_cleared", questId: "demo-1" },
        { kind: "quest_cleared", questId: "demo-2" },
      ],
    },
    { role: "prowler" },
  ),
  demo(
    "5",
    "3",
    "峠への道",
    {
      kind: "all",
      rules: [
        { kind: "quest_cleared", questId: "demo-3" },
        { kind: "quest_cleared", questId: "demo-4" },
        { kind: "hr_at_least", value: 2 },
      ],
    },
    { tags: ["urgent"] },
  ),
  demo(
    "6",
    "3",
    "最後の調査",
    { kind: "quest_cleared", questId: "demo-5" },
    { tags: ["key", "request"] },
  ),
];
