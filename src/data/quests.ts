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

import hub1 from "./hub-1.json";
import hub2 from "./hub-2.json";
import hub3 from "./hub-3.json";
import hub4 from "./hub-4.json";
import hub5 from "./hub-5.json";
import hub6 from "./hub-6.json";
import hub7 from "./hub-7.json";



import grank1 from "./g-rank-1.json";
import grank2 from "./g-rank-2.json";
import grank3 from "./g-rank-3.json";

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
  ...hub1,
  ...hub2,
  ...hub3,
  ...hub4,
  ...hub5,
  ...hub6,
  ...hub7,
  ...grank1,
  ...grank2,
  ...grank3,
] as Quest[];
export const dataStatus = {
  complete: false,
  note: "村★1〜10の370件、集会所★1〜7の339件とG★1〜3の144件を収録。攻略レシピの一覧と個別ページを照合しています。未確認点は個別に表示します。",
};
