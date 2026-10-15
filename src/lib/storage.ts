import type { SaveData } from "./types";
export const SAVE_KEY = "qlog.mhxx.progress.v1";
export const DEMO_SAVE_KEY = "qlog.mhxx.demo.v1";
export const emptySave = (): SaveData => ({
  schemaVersion: 1,
  completedQuestIds: [],
});
export function parseSave(text: string): SaveData {
  if (text.length > 2_000_000)
    throw Error("ファイルが大きすぎます（上限2MB）。");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error("JSONを読み取れません。");
  }
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.completedQuestIds) ||
    value.completedQuestIds.length > 20000 ||
    !value.completedQuestIds.every(
      (id: unknown) =>
        typeof id === "string" && id.length > 0 && id.length < 200,
    )
  ) {
    throw Error(
      "対応する進捗形式ではありません。schemaVersion: 1 とIDの配列が必要です。",
    );
  }
  if (
    value.hr !== undefined &&
    (!Number.isInteger(value.hr) || value.hr < 1 || value.hr > 999)
  )
    throw Error("HRは1〜999の整数にしてください。");
  return {
    schemaVersion: 1,
    completedQuestIds: [...new Set<string>(value.completedQuestIds)],
    ...(value.hr !== undefined ? { hr: value.hr } : {}),
  };
}
export function mergeSave(current: SaveData, incoming: SaveData): SaveData {
  return {
    ...current,
    completedQuestIds: [
      ...new Set([...current.completedQuestIds, ...incoming.completedQuestIds]),
    ],
  };
}
export function readSave(
  storage: Pick<Storage, "getItem">,
  key: string,
): SaveData {
  const raw = storage.getItem(key);
  return raw === null ? emptySave() : parseSave(raw);
}
