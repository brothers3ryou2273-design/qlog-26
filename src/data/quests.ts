import type { Quest } from "../lib/types";
import village1 from "./village-1.json";
import village2 from "./village-2.json";
import village3 from "./village-3.json";

// IDは表示名・参照元・並び順が変わっても固定。旧14件のg8由来IDも維持する。
export const quests: Quest[] = [
  ...village1,
  ...village2,
  ...village3,
] as Quest[];
export const dataStatus = {
  complete: false,
  note: "村★1〜3の一覧89件（7件・37件・45件）を攻略レシピ・Game8と照合して収録しました。条件の不一致1件や、施設・交易等の未確認の解放要素があり、データの完全確認は継続中です。その他ランク・カテゴリは未収録です。",
};
