import type { Quest } from "../lib/types";
import village1 from "./village-1.json";
import village2 from "./village-2.json";
import village3 from "./village-3.json";
import village4 from "./village-4.json";
import village5 from "./village-5.json";
import village6 from "./village-6.json";

import village7 from "./village-7.json";
import village8 from "./village-8.json";
import village9 from "./village-9.json";
import village10 from "./village-10.json";

// IDは表示名・参照元・並び順が変わっても固定。旧14件のg8由来IDも維持する。
export const quests: Quest[] = [
  ...village1,
  ...village2,
  ...village3,
  ...village4,
  ...village5,
  ...village6,
  ...village7,
  ...village8,
  ...village9,
  ...village10,
] as Quest[];
export const dataStatus = {
  complete: false,
  note: "攻略レシピの村★1〜10の全一覧370件（7・37・45・35・28・45・37・42・44・50件）を照合して収録しました。条件・解放要素の完全確認は継続中です。通常の会話・報告は補足に表示し、未確認点は個別に記載しています。集会所・他カテゴリは未収録です。",
};
