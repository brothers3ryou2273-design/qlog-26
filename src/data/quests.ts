import type { Quest } from "../lib/types";
import village1 from "./village-1.json";
import village2 from "./village-2.json";
import village3 from "./village-3.json";
import village4 from "./village-4.json";
import village5 from "./village-5.json";
import village6 from "./village-6.json";

import village7 from "./village-7.json";

// IDは表示名・参照元・並び順が変わっても固定。旧14件のg8由来IDも維持する。
export const quests: Quest[] = [
  ...village1,
  ...village2,
  ...village3,
  ...village4,
  ...village5,
  ...village6,
  ...village7,
] as Quest[];
export const dataStatus = {
  complete: false,
  note: "村★1〜7の234件を収録。村★7は一覧37件を照合済み。村★8〜10は調査・収録中です。前提は攻略レシピを基準に判定し、通常の会話・報告は補足表示します。",
};
