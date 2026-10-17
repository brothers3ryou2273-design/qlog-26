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
import grank4 from "./g-rank-4.json";

import permit0 from "./permit-redhelm.json";
import permit1 from "./permit-snowbaron.json";
import permit2 from "./permit-stonefist.json";
import permit3 from "./permit-dreadqueen.json";
import permit4 from "./permit-drilltusk.json";
import permit5 from "./permit-silverwind.json";
import permit6 from "./permit-crystalbeard.json";
import permit7 from "./permit-deadeye.json";
import permit8 from "./permit-dreadking.json";
import permit9 from "./permit-thunderlord.json";
import permit10 from "./permit-grimclaw.json";
import permit11 from "./permit-hellblade.json";
import permit12 from "./permit-nightcloak.json";
import permit13 from "./permit-rustrazor.json";
import permit14 from "./permit-soulseer.json";
import permit15 from "./permit-boltreaver.json";
import permit16 from "./permit-elderfrost.json";
import permit17 from "./permit-bloodbath.json";

import eventLow from "./event-low.json";

import eventHigh from "./event-high.json";

import eventG from "./event-g.json";
import challengeXX from "./challenge-xx.json";

import arena from "./arena.json";

import challenge from "./challenge.json";

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
  ...grank4,
  ...permit0,
  ...permit1,
  ...permit2,
  ...permit3,
  ...permit4,
  ...permit5,
  ...permit6,
  ...permit7,
  ...permit8,
  ...permit9,
  ...permit10,
  ...permit11,
  ...permit12,
  ...permit13,
  ...permit14,
  ...permit15,
  ...permit16,
  ...permit17,
  ...eventLow,
  ...eventHigh,
  ...eventG,
  ...arena,
  ...challenge,
  ...challengeXX,
] as Quest[];
export const dataStatus = {
  complete: false,
  note: "村370件・集会所339件・G級230件・特殊許可228件・イベント144件と闘技大会17件・チャレンジ39件を収録。追加チャレンジ19件は提供された公開資料と取得可能な補助資料で照合。個別URL未取得の候補1件や出現条件・報酬は調査中です。未確認点は個別に表示します。",
};
