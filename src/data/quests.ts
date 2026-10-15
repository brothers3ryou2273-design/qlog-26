import type { Quest } from "../lib/types";
/** 実在・出典を確認したデータのみ追加する。ネットワーク制限のため初版は未収録。 */
export const quests: Quest[] = [];
export const dataStatus = {
  complete: false,
  note: "実クエストは未収録です。攻略レシピへの接続が環境の通信制限で拒否されたため、名称・個別URL・条件を確認できていません。",
};
