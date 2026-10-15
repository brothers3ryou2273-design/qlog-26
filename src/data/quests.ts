import type { Quest } from "../lib/types";
import village1 from "./village-1.json";
import village2 from "./village-2.json";
import village3 from "./village-3.json";
import village4 from "./village-4.json";
import village5 from "./village-5.json";
import village6 from "./village-6.json";

// IDは表示名・参照元・並び順が変わっても固定。旧14件のg8由来IDも維持する。
export const quests: Quest[] = [
  ...village1,
  ...village2,
  ...village3,
  ...village4,
  ...village5,
  ...village6,
] as Quest[];
export const dataStatus = {
  complete: false,
  note: "村★1〜6の一覧197件（7・37・45・35・28・45件）を収録しています。前提は攻略レシピを基準に判定し、通常の会話・報告は詳細の補足に表示します。曖昧な前提・未収録の前提・未確認の解放要素は個別に記載しています。村★7以上・他カテゴリは未収録です。",
};
